//! Audio-related Tauri commands
//!
//! Provides commands for audio capture and device management.
//!
//! Note: cpal::Stream is !Send on some platforms, so we use a dedicated thread
//! for audio operations and communicate via channels.

use crate::commands::TranscriptionState;
use crate::models::HistoryEntry;
use crate::services::audio::processing::AudioBuffer;
use crate::services::audio::{
    capture::save_to_temp_wav, processing::resample_for_whisper, AudioCaptureService, AudioDevice,
    AudioError, PermissionStatus, RecordingResult,
};
use crate::services::storage::{DatabaseState, SettingsState};
use crate::services::transcription::TranscriptionResult;
use crate::services::ui::indicator::emit_audio_level;
use chrono::Utc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime, State};

/// Commands for the audio thread
pub enum AudioCommand {
    Start,
    Stop,
    IsRecording,
    GetDuration,
    GetLevel,
    Shutdown,
    /// Enable streaming mode for chunk-based transcription
    EnableStreaming,
    /// Disable streaming mode
    DisableStreaming,
    /// Get pending audio chunks for processing
    GetChunks,
    /// Flush remaining samples as a final chunk
    FlushChunk,
    /// Get full audio buffer for reconciliation
    GetFullBuffer,
}

/// Responses from the audio thread
pub enum AudioResponse {
    Ok,
    Buffer(Result<AudioBuffer, String>),
    Bool(bool),
    Duration(f32),
    Level(f32),
    Error(String),
    /// Audio chunks for streaming transcription
    Chunks(Vec<crate::services::audio::AudioChunk>),
    /// Single chunk (e.g., flushed remaining samples)
    Chunk(Option<crate::services::audio::AudioChunk>),
    /// Full audio buffer as samples
    Samples(Vec<f32>),
}

/// Thread-safe handle to the audio capture thread
pub struct AudioState {
    cmd_tx: std::sync::Mutex<Option<std::sync::mpsc::Sender<AudioCommand>>>,
    resp_rx: std::sync::Mutex<Option<std::sync::mpsc::Receiver<AudioResponse>>>,
    thread_handle: std::sync::Mutex<Option<std::thread::JoinHandle<()>>>,
    initialized: std::sync::atomic::AtomicBool,
    /// Shared audio level for periodic emission
    current_level: Arc<std::sync::Mutex<f32>>,
    /// Flag to control level emitter thread
    level_emitter_running: Arc<AtomicBool>,
    /// Handle to level emitter thread
    level_emitter_handle: std::sync::Mutex<Option<std::thread::JoinHandle<()>>>,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            cmd_tx: std::sync::Mutex::new(None),
            resp_rx: std::sync::Mutex::new(None),
            thread_handle: std::sync::Mutex::new(None),
            initialized: std::sync::atomic::AtomicBool::new(false),
            current_level: Arc::new(std::sync::Mutex::new(0.0)),
            level_emitter_running: Arc::new(AtomicBool::new(false)),
            level_emitter_handle: std::sync::Mutex::new(None),
        }
    }
}

impl AudioState {
    /// Initialize the audio thread if not already done
    fn ensure_initialized(&self) -> Result<(), String> {
        use std::sync::atomic::Ordering;

        if self.initialized.load(Ordering::SeqCst) {
            return Ok(());
        }

        let mut cmd_tx_guard = self.cmd_tx.lock().map_err(|e| e.to_string())?;
        let mut resp_rx_guard = self.resp_rx.lock().map_err(|e| e.to_string())?;
        let mut handle_guard = self.thread_handle.lock().map_err(|e| e.to_string())?;

        // Double-check after acquiring lock
        if self.initialized.load(Ordering::SeqCst) {
            return Ok(());
        }

        let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<AudioCommand>();
        let (resp_tx, resp_rx) = std::sync::mpsc::channel::<AudioResponse>();

        // Share the level with the audio thread
        let shared_level = self.current_level.clone();

        let handle = std::thread::spawn(move || {
            let mut service: Option<AudioCaptureService> = None;

            loop {
                // Use recv_timeout to periodically update the shared level
                match cmd_rx.recv_timeout(Duration::from_millis(50)) {
                    Ok(AudioCommand::Start) => {
                        let result = (|| -> Result<(), String> {
                            if service.is_none() {
                                service =
                                    Some(AudioCaptureService::new().map_err(|e| e.to_string())?);
                            }
                            if let Some(ref mut svc) = service {
                                svc.start().map_err(|e| e.to_string())?;
                            }
                            Ok(())
                        })();
                        let _ = resp_tx.send(match result {
                            Ok(()) => AudioResponse::Ok,
                            Err(e) => AudioResponse::Error(e),
                        });
                    }
                    Ok(AudioCommand::Stop) => {
                        let result = if let Some(ref mut svc) = service {
                            svc.stop().map_err(|e| e.to_string())
                        } else {
                            Err("No recording in progress".to_string())
                        };
                        let _ = resp_tx.send(AudioResponse::Buffer(result));
                    }
                    Ok(AudioCommand::IsRecording) => {
                        let is_rec = service.as_ref().map(|s| s.is_recording()).unwrap_or(false);
                        let _ = resp_tx.send(AudioResponse::Bool(is_rec));
                    }
                    Ok(AudioCommand::GetDuration) => {
                        let dur = service
                            .as_ref()
                            .map(|s| s.recording_duration().as_secs_f32())
                            .unwrap_or(0.0);
                        let _ = resp_tx.send(AudioResponse::Duration(dur));
                    }
                    Ok(AudioCommand::GetLevel) => {
                        let level = service
                            .as_ref()
                            .map(|s| s.get_current_level())
                            .unwrap_or(0.0);
                        let _ = resp_tx.send(AudioResponse::Level(level));
                    }
                    Ok(AudioCommand::EnableStreaming) => {
                        tracing::info!("=== [Audio] EnableStreaming command received ===");
                        if let Some(ref mut svc) = service {
                            tracing::info!("[Audio] Enabling streaming on existing service");
                            svc.set_streaming_enabled(true);
                        } else {
                            // Initialize service if needed
                            tracing::info!("[Audio] Creating new service for streaming");
                            match AudioCaptureService::new() {
                                Ok(mut svc) => {
                                    svc.set_streaming_enabled(true);
                                    service = Some(svc);
                                    tracing::info!("[Audio] Service created and streaming enabled");
                                }
                                Err(e) => {
                                    tracing::error!("[Audio] Failed to create service: {}", e);
                                    let _ = resp_tx.send(AudioResponse::Error(e.to_string()));
                                    continue;
                                }
                            }
                        }
                        let _ = resp_tx.send(AudioResponse::Ok);
                    }
                    Ok(AudioCommand::DisableStreaming) => {
                        if let Some(ref mut svc) = service {
                            svc.set_streaming_enabled(false);
                        }
                        let _ = resp_tx.send(AudioResponse::Ok);
                    }
                    Ok(AudioCommand::GetChunks) => {
                        let chunks = service
                            .as_ref()
                            .map(|s| s.get_pending_chunks())
                            .unwrap_or_default();
                        let _ = resp_tx.send(AudioResponse::Chunks(chunks));
                    }
                    Ok(AudioCommand::FlushChunk) => {
                        let chunk = service.as_ref().and_then(|s| s.flush_remaining_chunk());
                        let _ = resp_tx.send(AudioResponse::Chunk(chunk));
                    }
                    Ok(AudioCommand::GetFullBuffer) => {
                        let samples = service
                            .as_ref()
                            .map(|s| s.get_full_chunked_buffer())
                            .unwrap_or_default();
                        let _ = resp_tx.send(AudioResponse::Samples(samples));
                    }
                    Ok(AudioCommand::Shutdown) => {
                        break;
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // Update shared level during recording
                        if let Some(ref svc) = service {
                            if svc.is_recording() {
                                let level = svc.get_current_level();
                                // Debug: log level updates periodically
                                static LEVEL_LOG_COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
                                let count = LEVEL_LOG_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                                // Log more frequently for debugging (every 10 updates = ~0.5s)
                                if count % 10 == 0 || level > 0.01 {
                                    tracing::info!("[AudioThread] Level update #{}: {:.4}", count, level);
                                }
                                if let Ok(mut lvl) = shared_level.lock() {
                                    *lvl = level;
                                }
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
        });

        *cmd_tx_guard = Some(cmd_tx);
        *resp_rx_guard = Some(resp_rx);
        *handle_guard = Some(handle);
        self.initialized.store(true, Ordering::SeqCst);

        Ok(())
    }

    /// Send a command to the audio thread and wait for response
    pub fn send_command(&self, cmd: AudioCommand) -> Result<AudioResponse, String> {
        self.ensure_initialized()?;

        let cmd_tx = self.cmd_tx.lock().map_err(|e| e.to_string())?;
        let resp_rx = self.resp_rx.lock().map_err(|e| e.to_string())?;

        cmd_tx
            .as_ref()
            .ok_or_else(|| "Audio thread not initialized".to_string())?
            .send(cmd)
            .map_err(|e| e.to_string())?;

        resp_rx
            .as_ref()
            .ok_or_else(|| "Audio thread not initialized".to_string())?
            .recv_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())
    }

    /// Start the level emitter thread that periodically emits audio levels
    pub fn start_level_emitter<R: Runtime + 'static>(
        &self,
        app: AppHandle<R>,
    ) -> Result<(), String> {
        tracing::info!("[LevelEmitter] start_level_emitter called");

        // Stop any existing emitter
        self.stop_level_emitter();

        if let Err(e) = self.ensure_initialized() {
            tracing::error!("[LevelEmitter] Failed to ensure_initialized: {}", e);
            return Err(e);
        }
        tracing::info!("[LevelEmitter] Audio state initialized, starting emitter thread");
        self.level_emitter_running.store(true, Ordering::SeqCst);

        let running = self.level_emitter_running.clone();
        let current_level = self.current_level.clone();

        let handle = std::thread::spawn(move || {
            tracing::info!("[LevelEmitter] Thread started");
            let mut emit_count = 0u32;
            while running.load(Ordering::SeqCst) {
                // Sleep for ~100ms between level updates
                std::thread::sleep(Duration::from_millis(100));

                if !running.load(Ordering::SeqCst) {
                    break;
                }

                // Get current level from shared state
                let level = *current_level.lock().unwrap_or_else(|e| e.into_inner());

                // Debug: log emitted levels periodically
                emit_count += 1;
                // Log more frequently for debugging
                if emit_count % 5 == 0 || level > 0.01 {
                    tracing::info!("[LevelEmitter] Emitting level: {:.4} (count: {})", level, emit_count);
                }

                // Emit the level event
                if let Err(e) = emit_audio_level(&app, level) {
                    tracing::warn!("[LevelEmitter] Failed to emit audio level: {}", e);
                }
            }
            tracing::info!("[LevelEmitter] Stopped after {} emissions", emit_count);
        });

        *self
            .level_emitter_handle
            .lock()
            .map_err(|e| e.to_string())? = Some(handle);
        Ok(())
    }

    /// Update the current level from the audio thread
    pub fn update_level(&self, level: f32) {
        if let Ok(mut lvl) = self.current_level.lock() {
            *lvl = level;
        }
    }

    /// Stop the level emitter thread
    pub fn stop_level_emitter(&self) {
        self.level_emitter_running.store(false, Ordering::SeqCst);
        if let Ok(mut handle) = self.level_emitter_handle.lock() {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }
    }

    /// Get the current audio level (for polling)
    pub fn get_level(&self) -> f32 {
        match self.send_command(AudioCommand::GetLevel) {
            Ok(AudioResponse::Level(l)) => l,
            _ => 0.0,
        }
    }
}

impl Drop for AudioState {
    fn drop(&mut self) {
        if let Ok(cmd_tx) = self.cmd_tx.lock() {
            if let Some(tx) = cmd_tx.as_ref() {
                let _ = tx.send(AudioCommand::Shutdown);
            }
        }
        if let Ok(mut handle) = self.thread_handle.lock() {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }
    }
}

/// Get list of available audio input devices
#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    tracing::debug!("Getting audio devices");
    AudioCaptureService::get_devices().map_err(|e| e.to_string())
}

/// Check microphone permission status
#[tauri::command]
pub async fn check_microphone_permission() -> PermissionStatus {
    tracing::debug!("Checking microphone permission");

    // Try to create an audio service to check if we have permission
    match AudioCaptureService::new() {
        Ok(_) => {
            tracing::debug!("Microphone permission: granted");
            PermissionStatus::Granted
        }
        Err(AudioError::PermissionDenied) => {
            tracing::warn!("Microphone permission: denied");
            PermissionStatus::Denied
        }
        Err(AudioError::NoInputDevice) => {
            tracing::warn!("No input device available");
            PermissionStatus::Unknown
        }
        Err(_) => {
            tracing::debug!("Microphone permission: unknown");
            PermissionStatus::Unknown
        }
    }
}

/// Start recording audio
#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, AudioState>,
    _settings_state: State<'_, crate::services::storage::SettingsState>,
) -> Result<(), String> {
    tracing::info!("Starting audio recording");

    match state.send_command(AudioCommand::Start)? {
        AudioResponse::Ok => {
            tracing::info!("Recording started successfully");

            // Start emitting audio levels
            if let Err(e) = state.start_level_emitter(app.clone()) {
                tracing::warn!("Failed to start level emitter: {}", e);
            }

            // Emit event to update tray icon and menu
            let _ = app.emit("tray://update-recording-state", true);

            Ok(())
        }
        AudioResponse::Error(e) => Err(e),
        _ => Err("Unexpected response from audio thread".to_string()),
    }
}

/// Stop recording and return the result
#[tauri::command]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, AudioState>,
) -> Result<RecordingResult, String> {
    tracing::info!("Stopping audio recording");

    // Stop level emitter
    state.stop_level_emitter();

    // Emit event to update tray icon and menu
    let _ = app.emit("tray://update-recording-state", false);

    match state.send_command(AudioCommand::Stop)? {
        AudioResponse::Buffer(Ok(buffer)) => {
            if buffer.samples.is_empty() {
                return Err("No audio recorded".to_string());
            }

            // Resample to 16kHz for Whisper if needed
            let resampled = resample_for_whisper(buffer.clone()).map_err(|e| e.to_string())?;
            let resampled_buffer = AudioBuffer::new(resampled, 16000);

            // Save to temporary WAV file
            let result = save_to_temp_wav(&resampled_buffer).map_err(|e| e.to_string())?;

            tracing::info!("Recording stopped, saved to: {}", result.file_path);
            Ok(result)
        }
        AudioResponse::Buffer(Err(e)) => Err(e),
        _ => Err("Unexpected response from audio thread".to_string()),
    }
}

/// Check if currently recording
#[tauri::command]
pub async fn is_recording(state: State<'_, AudioState>) -> Result<bool, String> {
    match state.send_command(AudioCommand::IsRecording) {
        Ok(AudioResponse::Bool(b)) => Ok(b),
        _ => Ok(false),
    }
}

/// Get current recording duration in seconds
#[tauri::command]
pub async fn get_recording_duration(state: State<'_, AudioState>) -> Result<f32, String> {
    match state.send_command(AudioCommand::GetDuration) {
        Ok(AudioResponse::Duration(d)) => Ok(d),
        _ => Ok(0.0),
    }
}

/// Stop recording and immediately transcribe the audio
#[tauri::command]
pub async fn stop_recording_and_transcribe(
    app: AppHandle,
    audio_state: State<'_, AudioState>,
    transcription_state: State<'_, TranscriptionState>,
    settings_state: State<'_, SettingsState>,
    database_state: State<'_, DatabaseState>,
) -> Result<TranscriptionResult, String> {
    let start = Instant::now();

    tracing::info!("Stopping recording and transcribing");

    // Stop level emitter
    audio_state.stop_level_emitter();

    // Emit event to update tray icon and menu
    let _ = app.emit("tray://update-recording-state", false);

    // Stop recording
    let buffer = match audio_state.send_command(AudioCommand::Stop)? {
        AudioResponse::Buffer(Ok(buf)) => buf,
        AudioResponse::Buffer(Err(e)) => return Err(e),
        _ => return Err("Unexpected response from audio thread".to_string()),
    };

    if buffer.samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    let audio_duration_secs = buffer.samples.len() as f32 / buffer.sample_rate as f32;

    // Resample to 16kHz for Whisper if needed
    let samples = resample_for_whisper(buffer).map_err(|e| e.to_string())?;

    // Get settings for model_id and prompt configuration
    let settings = settings_state.get().await;
    let model_id = settings.model_id.clone();

    // Build initial prompt from custom vocabulary and context prompt
    let initial_prompt = crate::services::transcription::build_initial_prompt(
        &settings.custom_vocabulary,
        settings.context_prompt.as_deref(),
        settings.use_context_prompt,
    );

    // Transcribe with auto-load fallback and prompt
    let result = transcription_state
        .engine
        .transcribe_with_auto_load_and_prompt(samples, &model_id, initial_prompt.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let transcription_time_ms = start.elapsed().as_millis() as u64;
    let realtime_factor = if audio_duration_secs > 0.0 {
        transcription_time_ms as f32 / (audio_duration_secs * 1000.0)
    } else {
        0.0
    };

    tracing::info!(
        audio_duration_secs = audio_duration_secs,
        transcription_time_ms = transcription_time_ms,
        realtime_factor = realtime_factor,
        model = %result.model_id,
        text_length = result.text.len(),
        "Transcription completed"
    );

    // Save to history
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
            tracing::debug!("Saved transcription to history");
            // Emit event to refresh history UI
            match app.emit("history://new-entry", ()) {
                Ok(_) => tracing::debug!("Emitted history://new-entry event"),
                Err(e) => tracing::error!("Failed to emit history://new-entry: {}", e),
            }
        }
    }

    Ok(result)
}
