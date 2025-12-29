//! Workflow commands for end-to-end operations
//!
//! Provides commands that orchestrate multiple services for complete workflows.

use crate::commands::{AudioState, TranscriptionState};
use crate::services::platform::TextInjectorState;
use crate::services::storage::SettingsState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

/// Cooldown tracking for push-to-talk
static LAST_COMPLETION_MS: AtomicU64 = AtomicU64::new(0);

/// Minimum cooldown between push-to-talk sessions (ms)
const COOLDOWN_MS: u64 = 500;

/// Result of a push-to-talk operation
#[derive(serde::Serialize, Clone)]
pub struct PushToTalkResult {
    /// The transcribed text that was injected
    pub text: String,
    /// Audio duration in seconds
    pub audio_duration_secs: f32,
    /// Time spent on transcription in ms
    pub transcription_time_ms: u64,
    /// Time spent on text injection in ms
    pub injection_time_ms: u64,
    /// Total end-to-end latency in ms
    pub total_latency_ms: u64,
}

/// Push-to-talk metrics event payload
#[derive(serde::Serialize, Clone)]
pub struct PushToTalkMetrics {
    pub audio_duration_secs: f32,
    pub transcription_time_ms: u64,
    pub injection_time_ms: u64,
    pub total_latency_ms: u64,
    pub text_length: usize,
}

/// Push-to-talk error event payload
#[derive(serde::Serialize, Clone)]
pub struct PushToTalkError {
    pub phase: String,
    pub message: String,
}

/// Check if cooldown is active
fn is_cooldown_active() -> bool {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let last = LAST_COMPLETION_MS.load(Ordering::SeqCst);
    now_ms.saturating_sub(last) < COOLDOWN_MS
}

/// Update last completion time
fn update_completion_time() {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    LAST_COMPLETION_MS.store(now_ms, Ordering::SeqCst);
}

/// Complete push-to-talk flow: stop recording → transcribe → inject text
///
/// This is called when the hotkey is released to complete the dictation flow.
#[tauri::command]
pub async fn push_to_talk_complete(
    app: AppHandle,
    audio_state: State<'_, AudioState>,
    transcription_state: State<'_, TranscriptionState>,
    text_injector_state: State<'_, TextInjectorState>,
    settings_state: State<'_, SettingsState>,
) -> Result<PushToTalkResult, String> {
    let start = Instant::now();

    // Check cooldown
    if is_cooldown_active() {
        tracing::debug!("Push-to-talk blocked by cooldown");
        return Err("Cooldown active - please wait before recording again".to_string());
    }

    tracing::info!("Starting push-to-talk completion flow");
    let _ = app.emit("workflow://state-changed", "transcribing");

    // Stop recording and transcribe (with auto-load fallback)
    let transcribe_start = Instant::now();
    let transcription_result = match crate::commands::audio::stop_recording_and_transcribe(
        audio_state.clone(),
        transcription_state.clone(),
        settings_state.clone(),
    )
    .await
    {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Transcription failed: {}", e);
            let _ = app.emit(
                "workflow://error",
                PushToTalkError {
                    phase: "transcription".to_string(),
                    message: e.clone(),
                },
            );
            let _ = app.emit("workflow://state-changed", "idle");
            return Err(e);
        }
    };
    let transcription_time_ms = transcribe_start.elapsed().as_millis() as u64;

    let text = transcription_result.text.trim().to_string();

    // Skip injection if text is empty
    if text.is_empty() {
        tracing::warn!("Transcription returned empty text, skipping injection");
        let _ = app.emit("workflow://state-changed", "idle");
        update_completion_time();
        return Ok(PushToTalkResult {
            text: String::new(),
            audio_duration_secs: transcription_result.duration_ms as f32 / 1000.0,
            transcription_time_ms,
            injection_time_ms: 0,
            total_latency_ms: start.elapsed().as_millis() as u64,
        });
    }

    // Inject text
    let _ = app.emit("workflow://state-changed", "injecting");
    let inject_start = Instant::now();
    if let Err(e) = text_injector_state.inject_text(&text).await {
        tracing::error!("Text injection failed: {}", e);
        let _ = app.emit(
            "workflow://error",
            PushToTalkError {
                phase: "injection".to_string(),
                message: e.to_string(),
            },
        );
        let _ = app.emit("workflow://state-changed", "idle");
        return Err(format!("Text injection failed: {}", e));
    }
    let injection_time_ms = inject_start.elapsed().as_millis() as u64;

    let total_latency_ms = start.elapsed().as_millis() as u64;

    let audio_duration_secs = transcription_result.duration_ms as f32 / 1000.0;

    // Log metrics
    tracing::info!(
        audio_duration_secs = audio_duration_secs,
        transcription_time_ms = transcription_time_ms,
        injection_time_ms = injection_time_ms,
        total_latency_ms = total_latency_ms,
        text_length = text.len(),
        "Push-to-talk flow completed"
    );

    if total_latency_ms > 3000 {
        tracing::warn!(
            "Latency exceeded 3 second target: {}ms",
            total_latency_ms
        );
    }

    // Emit metrics event
    let _ = app.emit(
        "workflow://metrics",
        PushToTalkMetrics {
            audio_duration_secs,
            transcription_time_ms,
            injection_time_ms,
            total_latency_ms,
            text_length: text.len(),
        },
    );

    // Update cooldown and return to idle
    update_completion_time();
    let _ = app.emit("workflow://state-changed", "idle");

    Ok(PushToTalkResult {
        text,
        audio_duration_secs,
        transcription_time_ms,
        injection_time_ms,
        total_latency_ms,
    })
}

/// Check if push-to-talk cooldown is currently active
#[tauri::command]
pub fn is_push_to_talk_cooldown_active() -> bool {
    is_cooldown_active()
}

/// Get the current workflow state
#[tauri::command]
pub async fn get_workflow_state(
    audio_state: State<'_, AudioState>,
) -> Result<String, String> {
    let is_recording = crate::commands::audio::is_recording(audio_state).await?;

    if is_recording {
        Ok("recording".to_string())
    } else {
        Ok("idle".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cooldown_functions_exist() {
        // Test that cooldown functions work without panicking
        let _ = is_cooldown_active();
        update_completion_time();
        // After update, cooldown should be active
        assert!(is_cooldown_active());
    }

    #[test]
    fn test_cooldown_deactivates_over_time() {
        // If we set a very old timestamp, cooldown should not be active
        LAST_COMPLETION_MS.store(0, Ordering::SeqCst);
        // With timestamp 0 (1970), definitely more than 500ms have passed
        assert!(!is_cooldown_active());
    }
}
