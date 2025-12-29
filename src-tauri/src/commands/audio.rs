//! Audio-related Tauri commands
//!
//! Provides commands for audio capture and device management.

use crate::services::audio::{
    capture::save_to_temp_wav, processing::resample_for_whisper, AudioCaptureService, AudioDevice,
    AudioError, PermissionStatus, RecordingResult,
};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// State wrapper for the audio capture service
pub struct AudioState {
    pub service: Arc<Mutex<Option<AudioCaptureService>>>,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            service: Arc::new(Mutex::new(None)),
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
pub async fn start_recording(state: State<'_, AudioState>) -> Result<(), String> {
    tracing::info!("Starting audio recording");

    let mut service_guard = state.service.lock().await;

    // Check if already recording
    if let Some(ref service) = *service_guard {
        if service.is_recording() {
            return Err("Recording already in progress".to_string());
        }
    }

    // Create new service if needed
    let mut service = match service_guard.take() {
        Some(s) => s,
        None => AudioCaptureService::new().map_err(|e| e.to_string())?,
    };

    service.start().map_err(|e| e.to_string())?;
    *service_guard = Some(service);

    tracing::info!("Recording started successfully");
    Ok(())
}

/// Stop recording and return the result
#[tauri::command]
pub async fn stop_recording(state: State<'_, AudioState>) -> Result<RecordingResult, String> {
    tracing::info!("Stopping audio recording");

    let mut service_guard = state.service.lock().await;

    let mut service = service_guard
        .take()
        .ok_or_else(|| "No recording in progress".to_string())?;

    if !service.is_recording() {
        *service_guard = Some(service);
        return Err("No recording in progress".to_string());
    }

    let buffer = service.stop().map_err(|e| e.to_string())?;

    if buffer.samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    // Resample to 16kHz for Whisper if needed
    let resampled = resample_for_whisper(buffer.clone()).map_err(|e| e.to_string())?;
    let resampled_buffer = crate::services::audio::processing::AudioBuffer::new(resampled, 16000);

    // Save to temporary WAV file
    let result = save_to_temp_wav(&resampled_buffer).map_err(|e| e.to_string())?;

    // Keep service for reuse
    *service_guard = Some(service);

    tracing::info!("Recording stopped, saved to: {}", result.file_path);
    Ok(result)
}

/// Check if currently recording
#[tauri::command]
pub async fn is_recording(state: State<'_, AudioState>) -> bool {
    let service_guard = state.service.lock().await;
    service_guard
        .as_ref()
        .map(|s| s.is_recording())
        .unwrap_or(false)
}

/// Get current recording duration in seconds
#[tauri::command]
pub async fn get_recording_duration(state: State<'_, AudioState>) -> f32 {
    let service_guard = state.service.lock().await;
    service_guard
        .as_ref()
        .map(|s| s.recording_duration().as_secs_f32())
        .unwrap_or(0.0)
}
