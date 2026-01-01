//! Global hotkey service
//!
//! Handles global keyboard shortcuts for push-to-talk recording.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use thiserror::Error;
use tokio::sync::RwLock;

use crate::commands::audio::{AudioCommand, AudioResponse, AudioState};
use crate::commands::TranscriptionState;
use crate::models::HistoryEntry;
use crate::services::audio::processing::resample_for_whisper;
use crate::services::storage::{DatabaseState, SettingsState};
use crate::services::streaming::SharedStreamingService;
use crate::services::ui::preview;
use chrono::Utc;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Errors that can occur during hotkey operations
#[derive(Error, Debug)]
pub enum HotkeyError {
    #[error("Hotkey '{0}' is already registered by another application")]
    Conflict(String),

    #[error("Failed to register hotkey: {0}")]
    RegistrationFailed(String),

    #[error("Invalid hotkey format: {0}")]
    InvalidFormat(String),

    #[error("Hotkey not registered")]
    NotRegistered,
}

/// Minimum recording duration in milliseconds before release is processed
/// This prevents accidental immediate release when pressing key combinations
const MIN_RECORDING_DURATION_MS: u64 = 200;

/// Hotkey service state
pub struct HotkeyState {
    /// Currently registered hotkey string
    pub current_hotkey: Arc<RwLock<Option<String>>>,
    /// Whether recording is active via hotkey
    pub is_hotkey_recording: Arc<AtomicBool>,
    /// Whether hotkey registration succeeded
    pub is_registered: Arc<AtomicBool>,
    /// Last error message if registration failed
    pub last_error: Arc<RwLock<Option<String>>>,
    /// Timestamp when recording started (millis since epoch)
    pub recording_start_time: Arc<AtomicU64>,
    /// Whether streaming mode is active for current recording
    pub is_streaming_active: Arc<AtomicBool>,
}

impl Default for HotkeyState {
    fn default() -> Self {
        Self {
            current_hotkey: Arc::new(RwLock::new(None)),
            is_hotkey_recording: Arc::new(AtomicBool::new(false)),
            is_registered: Arc::new(AtomicBool::new(false)),
            last_error: Arc::new(RwLock::new(None)),
            recording_start_time: Arc::new(AtomicU64::new(0)),
            is_streaming_active: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Get current time in milliseconds since epoch
fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Get the default hotkey for the current platform
pub fn get_default_hotkey() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "Cmd+Shift+Space"
    }
    #[cfg(not(target_os = "macos"))]
    {
        "Ctrl+Shift+Space"
    }
}

/// Parse a hotkey string to Shortcut
fn parse_shortcut(hotkey: &str) -> Result<Shortcut, HotkeyError> {
    hotkey
        .parse()
        .map_err(|e| HotkeyError::InvalidFormat(format!("{:?}", e)))
}

/// Register the global hotkey with push-to-talk behavior
pub fn register_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    hotkey: &str,
    state: &HotkeyState,
) -> Result<(), HotkeyError> {
    tracing::info!("Registering global hotkey: {}", hotkey);

    // Parse the hotkey string
    let shortcut = parse_shortcut(hotkey)?;

    let is_recording = state.is_hotkey_recording.clone();
    let recording_start_time = state.recording_start_time.clone();
    let is_streaming_active = state.is_streaming_active.clone();

    // Register with the global shortcut manager
    let result = app
        .global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| match event.state {
            ShortcutState::Pressed => {
                if !is_recording.load(Ordering::SeqCst) {
                    tracing::info!("Hotkey pressed - starting recording");
                    is_recording.store(true, Ordering::SeqCst);
                    // Store the start time
                    recording_start_time.store(current_time_ms(), Ordering::SeqCst);

                    // Check if streaming is enabled in settings
                    let settings_state = app.state::<SettingsState>();
                    let streaming_enabled = settings_state.get_streaming_enabled_sync();
                    let streaming_mode = settings_state.get_streaming_mode_sync();

                    // Get audio state
                    let audio_state = app.state::<AudioState>();

                    // Enable streaming mode if configured
                    if streaming_enabled {
                        tracing::info!("Streaming mode enabled, setting up streaming transcription");
                        is_streaming_active.store(true, Ordering::SeqCst);

                        // Show preview window centered for live transcription
                        let settings = tauri::async_runtime::block_on(async {
                            settings_state.get().await
                        });
                        if settings.preview_enabled {
                            if let Err(e) = preview::show_preview_centered(app) {
                                tracing::warn!("Failed to show preview window: {}", e);
                            }
                        }

                        // Enable streaming on audio capture
                        if let Err(e) = audio_state.send_command(AudioCommand::EnableStreaming) {
                            tracing::warn!("Failed to enable streaming: {:?}", e);
                            is_streaming_active.store(false, Ordering::SeqCst);
                        }

                        // Start streaming session
                        let streaming_service = app.state::<SharedStreamingService>();
                        let service = streaming_service.get();
                        let mode = streaming_mode;
                        tauri::async_runtime::spawn(async move {
                            service.start(mode).await;
                        });

                        // Spawn chunk processing task
                        let app_for_chunks = app.clone();
                        let is_recording_clone = is_recording.clone();
                        tauri::async_runtime::spawn(async move {
                            process_streaming_chunks(app_for_chunks, is_recording_clone).await;
                        });
                    } else {
                        is_streaming_active.store(false, Ordering::SeqCst);
                    }

                    // Actually start recording
                    match audio_state.send_command(AudioCommand::Start) {
                        Ok(AudioResponse::Ok) => {
                            tracing::info!("[Hotkey] Recording started from hotkey");
                            // Start emitting audio levels
                            if let Err(e) = audio_state.start_level_emitter(app.clone()) {
                                tracing::warn!("[Hotkey] Failed to start level emitter: {}", e);
                            } else {
                                tracing::info!("[Hotkey] Level emitter started successfully");
                            }
                            // Emit event for tray update and UI
                            tracing::info!("[Hotkey] Emitting hotkey://recording-started event");
                            let _ = app.emit("hotkey://recording-started", ());
                            let _ = app.emit("tray://update-recording-state", true);
                        }
                        Ok(AudioResponse::Error(e)) => {
                            tracing::error!("Failed to start recording from hotkey: {}", e);
                            is_recording.store(false, Ordering::SeqCst);
                            is_streaming_active.store(false, Ordering::SeqCst);
                        }
                        Ok(_) => {
                            tracing::error!(
                                "Unexpected response when starting recording from hotkey"
                            );
                            is_recording.store(false, Ordering::SeqCst);
                            is_streaming_active.store(false, Ordering::SeqCst);
                        }
                        Err(e) => {
                            tracing::error!("Error starting recording from hotkey: {}", e);
                            is_recording.store(false, Ordering::SeqCst);
                            is_streaming_active.store(false, Ordering::SeqCst);
                        }
                    }
                }
            }
            ShortcutState::Released => {
                if is_recording.load(Ordering::SeqCst) {
                    // Check if minimum recording duration has passed
                    let start_time = recording_start_time.load(Ordering::SeqCst);
                    let elapsed = current_time_ms().saturating_sub(start_time);

                    if elapsed < MIN_RECORDING_DURATION_MS {
                        tracing::debug!(
                            "Ignoring early release ({}ms < {}ms minimum)",
                            elapsed,
                            MIN_RECORDING_DURATION_MS
                        );
                        return;
                    }

                    tracing::info!("Hotkey released after {}ms - stopping recording", elapsed);
                    let was_streaming = is_streaming_active.load(Ordering::SeqCst);
                    is_recording.store(false, Ordering::SeqCst);
                    is_streaming_active.store(false, Ordering::SeqCst);

                    // Emit event for tray update
                    let _ = app.emit("tray://update-recording-state", false);

                    // Stop recording and transcribe
                    let audio_state = app.state::<AudioState>();
                    audio_state.stop_level_emitter();

                    if was_streaming {
                        // Handle streaming completion
                        handle_streaming_completion(app.clone());
                    } else {
                        // Use batch transcription (existing logic)
                        handle_batch_transcription(app.clone());
                    }
                }
            }
        });

    match result {
        Ok(_) => {
            state.is_registered.store(true, Ordering::SeqCst);
            // Update current hotkey
            let hotkey_str = hotkey.to_string();
            let current = state.current_hotkey.clone();
            tauri::async_runtime::spawn(async move {
                *current.write().await = Some(hotkey_str);
            });
            tracing::info!("Global hotkey registered successfully: {}", hotkey);
            Ok(())
        }
        Err(e) => {
            let error_str = e.to_string();
            state.is_registered.store(false, Ordering::SeqCst);

            // Store error for later retrieval
            let last_error = state.last_error.clone();
            let err_clone = error_str.clone();
            tauri::async_runtime::spawn(async move {
                *last_error.write().await = Some(err_clone);
            });

            if error_str.contains("already") || error_str.contains("conflict") {
                tracing::warn!("Hotkey conflict detected: {}", hotkey);
                Err(HotkeyError::Conflict(hotkey.to_string()))
            } else {
                tracing::error!("Failed to register hotkey: {}", error_str);
                Err(HotkeyError::RegistrationFailed(error_str))
            }
        }
    }
}

/// Unregister the current hotkey
pub fn unregister_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    state: &HotkeyState,
) -> Result<(), HotkeyError> {
    let current = state.current_hotkey.clone();
    let is_registered = state.is_registered.clone();

    // Get current hotkey synchronously via blocking
    let hotkey_opt = tauri::async_runtime::block_on(async { current.read().await.clone() });

    if let Some(hotkey) = hotkey_opt {
        let shortcut = parse_shortcut(&hotkey)?;

        app.global_shortcut()
            .unregister(shortcut)
            .map_err(|e| HotkeyError::RegistrationFailed(e.to_string()))?;

        is_registered.store(false, Ordering::SeqCst);

        // Clear current hotkey
        tauri::async_runtime::spawn(async move {
            *current.write().await = None;
        });

        tracing::info!("Global hotkey unregistered: {}", hotkey);
        Ok(())
    } else {
        Err(HotkeyError::NotRegistered)
    }
}

/// Test if a hotkey is available (not conflicting)
pub fn test_hotkey<R: Runtime>(app: &AppHandle<R>, hotkey: &str) -> Result<bool, HotkeyError> {
    let shortcut = parse_shortcut(hotkey)?;

    // is_registered returns bool directly
    let is_registered = app.global_shortcut().is_registered(shortcut);
    Ok(!is_registered)
}

/// Setup hotkey on app startup with graceful degradation (uses platform default)
pub fn setup_hotkey<R: Runtime>(app: &AppHandle<R>, state: &HotkeyState) {
    let hotkey = get_default_hotkey();
    setup_hotkey_with_key(app, state, hotkey);
}

/// Setup hotkey on app startup with a specific hotkey string
pub fn setup_hotkey_with_key<R: Runtime>(app: &AppHandle<R>, state: &HotkeyState, hotkey: &str) {
    match register_hotkey(app, hotkey, state) {
        Ok(_) => {
            tracing::info!("Push-to-talk hotkey enabled: {}", hotkey);
            let _ = app.emit("hotkey://registered", hotkey);
        }
        Err(e) => {
            tracing::warn!(
                "Failed to register hotkey '{}': {}. Push-to-talk disabled, use tray menu instead.",
                hotkey,
                e
            );
            let _ = app.emit("hotkey://registration-failed", e.to_string());
        }
    }
}

/// Process audio chunks in streaming mode while recording is active
async fn process_streaming_chunks<R: Runtime + 'static>(
    app: AppHandle<R>,
    is_recording: Arc<AtomicBool>,
) {
    use std::time::Duration;

    tracing::info!("Starting streaming chunk processing loop");

    let audio_state = app.state::<AudioState>();
    let streaming_service = app.state::<SharedStreamingService>();
    let transcription_state = app.state::<TranscriptionState>();
    let settings_state = app.state::<SettingsState>();

    let service = streaming_service.get();
    let engine = transcription_state.engine.clone();
    let model_id = settings_state.get_model_id_sync();

    // Poll for chunks every 100ms while recording
    let poll_interval = Duration::from_millis(100);
    let mut chunks_processed = 0u32;
    let mut poll_count = 0u32;
    let mut empty_polls = 0u32;

    tracing::info!("[StreamingChunks] Starting poll loop, model_id={}", model_id);

    while is_recording.load(Ordering::SeqCst) {
        // Sleep before checking to allow chunks to accumulate
        tokio::time::sleep(poll_interval).await;
        poll_count += 1;

        // Get pending chunks from audio capture
        let chunks = match audio_state.send_command(AudioCommand::GetChunks) {
            Ok(AudioResponse::Chunks(c)) => c,
            Ok(resp) => {
                tracing::warn!("[StreamingChunks] Unexpected response: {:?}", std::any::type_name_of_val(&resp));
                continue;
            }
            Err(e) => {
                tracing::warn!("[StreamingChunks] Failed to get audio chunks: {}", e);
                continue;
            }
        };

        if chunks.is_empty() {
            empty_polls += 1;
            // Log periodically when no chunks available
            if empty_polls % 20 == 0 {
                tracing::debug!("[StreamingChunks] No chunks after {} polls ({} empty)", poll_count, empty_polls);
            }
            continue;
        }

        tracing::info!("[StreamingChunks] Got {} chunks to process (poll #{})", chunks.len(), poll_count);

        // Process each chunk through streaming service
        for chunk in chunks {
            tracing::info!(
                "[StreamingChunks] Processing chunk {} ({} samples, {:.2}s)",
                chunk.chunk_index,
                chunk.samples.len(),
                chunk.duration_secs()
            );
            match service.process_chunk(&app, &engine, &chunk, &model_id).await {
                Ok(result) => {
                    chunks_processed += 1;
                    tracing::info!(
                        "[StreamingChunks] Transcribed chunk {}: '{}' ({} chars)",
                        chunk.chunk_index,
                        result.text.chars().take(50).collect::<String>(),
                        result.text.len()
                    );
                }
                Err(e) => {
                    // Don't emit error for "already processed" - just skip
                    if !e.to_string().contains("already processed") {
                        tracing::error!(
                            "[StreamingChunks] Failed to transcribe chunk {}: {}",
                            chunk.chunk_index,
                            e
                        );
                        service.emit_error(&app, &e.to_string(), Some(chunk.chunk_index));
                    }
                }
            }
        }
    }

    tracing::info!(
        "Streaming chunk processing loop ended. Processed {} chunks total",
        chunks_processed
    );
}

/// Handle completion of streaming transcription
fn handle_streaming_completion<R: Runtime + 'static>(app: AppHandle<R>) {
    tracing::info!("Handling streaming transcription completion");

    let audio_state = app.state::<AudioState>();
    let streaming_service = app.state::<SharedStreamingService>();
    let transcription_state = app.state::<TranscriptionState>();
    let settings_state = app.state::<SettingsState>();

    // Stop the audio recording and get buffer for batch fallback
    let buffer = match audio_state.send_command(AudioCommand::Stop) {
        Ok(AudioResponse::Buffer(Ok(buf))) => buf,
        Ok(AudioResponse::Buffer(Err(e))) => {
            tracing::error!("Failed to stop recording: {}", e);
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
        Ok(_) => {
            tracing::error!("Unexpected response when stopping recording");
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
        Err(e) => {
            tracing::error!("Error stopping recording: {}", e);
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
    };

    let _ = app.emit("hotkey://recording-stopped", ());

    if buffer.samples.is_empty() {
        tracing::warn!("No audio recorded");
        return;
    }

    // Flush any remaining audio chunk
    let final_chunk = match audio_state.send_command(AudioCommand::FlushChunk) {
        Ok(AudioResponse::Chunk(c)) => c,
        _ => None,
    };

    // Get full buffer for reconciliation
    let full_samples = match audio_state.send_command(AudioCommand::GetFullBuffer) {
        Ok(AudioResponse::Samples(s)) if !s.is_empty() => s,
        _ => {
            // Fall back to regular buffer if streaming buffer is empty
            match resample_for_whisper(buffer) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to resample audio: {}", e);
                    return;
                }
            }
        }
    };

    // Disable streaming mode
    let _ = audio_state.send_command(AudioCommand::DisableStreaming);

    // Get service and engine for async task
    let service = streaming_service.get();
    let engine = transcription_state.engine.clone();
    let model_id = settings_state.get_model_id_sync();

    // Build initial prompt from settings
    let settings = tauri::async_runtime::block_on(async { settings_state.get().await });
    let initial_prompt = crate::services::transcription::build_initial_prompt(
        &settings.custom_vocabulary,
        settings.context_prompt.as_deref(),
        settings.use_context_prompt,
    );

    // Spawn async task for reconciliation and final processing
    tauri::async_runtime::spawn(async move {
        // Process final chunk if available
        if let Some(chunk) = final_chunk {
            tracing::debug!("Processing final chunk {}", chunk.chunk_index);
            let _ = service.process_chunk(&app, &engine, &chunk, &model_id).await;
        }

        // Force emit final partial update
        service.force_emit_partial(&app).await;

        // Perform reconciliation based on streaming mode
        let final_text = match service
            .reconcile(&app, &engine, &full_samples, &model_id, initial_prompt.as_deref())
            .await
        {
            Ok(text) => text,
            Err(e) => {
                tracing::error!("Reconciliation failed: {}", e);
                // Fall back to streaming accumulated text
                service.get_accumulated_text().await
            }
        };

        // Stop streaming session
        service.stop().await;

        tracing::info!(
            "Streaming transcription complete: {} chars",
            final_text.len()
        );

        // Save to history
        let database_state = app.state::<DatabaseState>();
        if let Some(db) = database_state.get() {
            let entry = HistoryEntry {
                id: 0,
                text: final_text.clone(),
                timestamp: Utc::now().to_rfc3339(),
                duration_ms: (full_samples.len() as f32 / 16.0) as u64, // approximate
                model_id: model_id.clone(),
                language: None,
                gpu_used: false, // we don't have this info easily
            };
            if let Err(e) = db.insert_history(&entry).await {
                tracing::error!("Failed to save transcription to history: {}", e);
            } else {
                let _ = app.emit("history://new-entry", ());
            }
        }

        // Copy to clipboard
        if !final_text.is_empty() {
            if let Err(e) = app.clipboard().write_text(&final_text) {
                tracing::error!("Failed to copy to clipboard: {}", e);
            } else {
                tracing::info!("Transcription copied to clipboard");
            }
        }

        let _ = app.emit("hotkey://transcription-complete", &final_text);
    });
}

/// Handle batch transcription (non-streaming mode)
fn handle_batch_transcription<R: Runtime + 'static>(app: AppHandle<R>) {
    let audio_state = app.state::<AudioState>();

    let buffer = match audio_state.send_command(AudioCommand::Stop) {
        Ok(AudioResponse::Buffer(Ok(buf))) => buf,
        Ok(AudioResponse::Buffer(Err(e))) => {
            tracing::error!("Failed to stop recording from hotkey: {}", e);
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
        Ok(_) => {
            tracing::error!("Unexpected response when stopping recording from hotkey");
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
        Err(e) => {
            tracing::error!("Error stopping recording from hotkey: {}", e);
            let _ = app.emit("hotkey://recording-stopped", ());
            return;
        }
    };

    let _ = app.emit("hotkey://recording-stopped", ());

    if buffer.samples.is_empty() {
        tracing::warn!("No audio recorded from hotkey");
        return;
    }

    // Resample for Whisper
    let samples = match resample_for_whisper(buffer) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to resample audio from hotkey: {}", e);
            return;
        }
    };

    // Get states for async task
    let transcription_state = app.state::<TranscriptionState>();
    let settings_state = app.state::<SettingsState>();
    let engine = transcription_state.engine.clone();
    let model_id = settings_state.get_model_id_sync();

    // Spawn async task for transcription
    tauri::async_runtime::spawn(async move {
        tracing::info!("Starting transcription from hotkey...");

        match engine.transcribe_with_auto_load(samples, &model_id).await {
            Ok(result) => {
                tracing::info!(
                    "Hotkey transcription complete: {} chars",
                    result.text.len()
                );

                // Save to history
                let database_state = app.state::<DatabaseState>();
                if let Some(db) = database_state.get() {
                    let entry = HistoryEntry {
                        id: 0,
                        text: result.text.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                        duration_ms: result.duration_ms,
                        model_id: result.model_id.clone(),
                        language: result.language.clone(),
                        gpu_used: result.gpu_used,
                    };
                    if let Err(e) = db.insert_history(&entry).await {
                        tracing::error!("Failed to save transcription to history: {}", e);
                    } else {
                        // Emit event to refresh history UI
                        let _ = app.emit("history://new-entry", ());
                    }
                }

                // Copy to clipboard
                if !result.text.is_empty() {
                    if let Err(e) = app.clipboard().write_text(&result.text) {
                        tracing::error!("Failed to copy to clipboard: {}", e);
                    } else {
                        tracing::info!("Transcription copied to clipboard");
                    }
                }

                let _ = app.emit("hotkey://transcription-complete", &result.text);
            }
            Err(e) => {
                tracing::error!("Hotkey transcription failed: {}", e);
                let _ = app.emit("hotkey://transcription-error", e.to_string());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_hotkey_format() {
        let hotkey = get_default_hotkey();
        assert!(hotkey.contains("Shift"));
        assert!(hotkey.contains("Space"));

        #[cfg(target_os = "macos")]
        assert!(hotkey.contains("Cmd"));

        #[cfg(not(target_os = "macos"))]
        assert!(hotkey.contains("Ctrl"));
    }

    #[test]
    fn test_hotkey_state_default() {
        let state = HotkeyState::default();
        assert!(!state.is_registered.load(Ordering::SeqCst));
        assert!(!state.is_hotkey_recording.load(Ordering::SeqCst));
    }
}
