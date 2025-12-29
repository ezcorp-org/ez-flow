//! Audio-related Tauri commands
//!
//! Provides commands for audio capture and device management.
//!
//! Note: cpal::Stream is !Send on some platforms, so we use a dedicated thread
//! for audio operations and communicate via channels.

use crate::commands::TranscriptionState;
use crate::services::audio::{
    capture::save_to_temp_wav, processing::resample_for_whisper, AudioCaptureService, AudioDevice,
    AudioError, PermissionStatus, RecordingResult,
};
use crate::services::audio::processing::AudioBuffer;
use crate::services::transcription::TranscriptionResult;
use std::time::{Duration, Instant};
use tauri::State;

/// Commands for the audio thread
enum AudioCommand {
    Start,
    Stop,
    IsRecording,
    GetDuration,
    Shutdown,
}

/// Responses from the audio thread
enum AudioResponse {
    Ok,
    Buffer(Result<AudioBuffer, String>),
    Bool(bool),
    Duration(f32),
    Error(String),
}

/// Thread-safe handle to the audio capture thread
pub struct AudioState {
    cmd_tx: std::sync::Mutex<Option<std::sync::mpsc::Sender<AudioCommand>>>,
    resp_rx: std::sync::Mutex<Option<std::sync::mpsc::Receiver<AudioResponse>>>,
    thread_handle: std::sync::Mutex<Option<std::thread::JoinHandle<()>>>,
    initialized: std::sync::atomic::AtomicBool,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            cmd_tx: std::sync::Mutex::new(None),
            resp_rx: std::sync::Mutex::new(None),
            thread_handle: std::sync::Mutex::new(None),
            initialized: std::sync::atomic::AtomicBool::new(false),
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

        let handle = std::thread::spawn(move || {
            let mut service: Option<AudioCaptureService> = None;

            loop {
                match cmd_rx.recv() {
                    Ok(AudioCommand::Start) => {
                        let result = (|| -> Result<(), String> {
                            if service.is_none() {
                                service = Some(AudioCaptureService::new().map_err(|e| e.to_string())?);
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
                    Ok(AudioCommand::Shutdown) | Err(_) => {
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

    fn send_command(&self, cmd: AudioCommand) -> Result<AudioResponse, String> {
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
pub async fn start_recording(state: State<'_, AudioState>) -> Result<(), String> {
    tracing::info!("Starting audio recording");

    match state.send_command(AudioCommand::Start)? {
        AudioResponse::Ok => {
            tracing::info!("Recording started successfully");
            Ok(())
        }
        AudioResponse::Error(e) => Err(e),
        _ => Err("Unexpected response from audio thread".to_string()),
    }
}

/// Stop recording and return the result
#[tauri::command]
pub async fn stop_recording(state: State<'_, AudioState>) -> Result<RecordingResult, String> {
    tracing::info!("Stopping audio recording");

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
    audio_state: State<'_, AudioState>,
    transcription_state: State<'_, TranscriptionState>,
) -> Result<TranscriptionResult, String> {
    let start = Instant::now();

    tracing::info!("Stopping recording and transcribing");

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

    // Transcribe
    let result = transcription_state
        .engine
        .transcribe(samples)
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

    Ok(result)
}
