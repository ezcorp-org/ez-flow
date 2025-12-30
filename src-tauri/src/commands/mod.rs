//! Tauri command handlers
//!
//! This module contains all Tauri command handlers that can be invoked from the frontend.

pub mod audio;
pub mod history;
pub mod hotkey;
pub mod indicator;
pub mod models;
pub mod settings;
pub mod text_inject;
pub mod transcription;
pub mod workflow;

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

pub use audio::{
    check_microphone_permission, get_audio_devices, get_recording_duration, is_recording,
    start_recording, stop_recording, stop_recording_and_transcribe, AudioState,
};

pub use transcription::{
    check_model_exists, get_loaded_model_id, get_models_directory, is_model_loaded,
    list_available_models, load_whisper_model, load_whisper_model_from_path, transcribe_audio,
    transcribe_dropped_file, transcribe_samples, unload_whisper_model, TranscriptionState,
};

pub use models::{
    delete_downloaded_model, download_model, get_available_models, get_downloaded_model_ids,
    get_model_size, is_model_downloaded, validate_and_load_model, ModelValidationResult,
};

pub use settings::{get_gpu_backend, get_gpu_info, get_supported_languages, is_gpu_available_cmd};

// Re-export hotkey state for managed state
pub use crate::services::hotkey::HotkeyState;

/// Simple greet command for testing IPC
#[tauri::command]
pub fn greet(name: &str) -> String {
    tracing::debug!("Greet command called with name: {}", name);
    format!("Hello, {}! Welcome to EZ Flow.", name)
}

/// Enable auto-start at system login
#[tauri::command]
pub fn enable_autostart(app: AppHandle) -> Result<(), String> {
    tracing::info!("Enabling autostart");
    app.autolaunch()
        .enable()
        .map_err(|e| e.to_string())
}

/// Disable auto-start at system login
#[tauri::command]
pub fn disable_autostart(app: AppHandle) -> Result<(), String> {
    tracing::info!("Disabling autostart");
    app.autolaunch()
        .disable()
        .map_err(|e| e.to_string())
}

/// Check if auto-start is enabled
#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert_eq!(result, "Hello, World! Welcome to EZ Flow.");
    }
}
