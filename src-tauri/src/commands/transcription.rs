//! Transcription-related Tauri commands
//!
//! Provides commands for speech-to-text transcription.

use crate::services::transcription::{
    decode_audio_file, engine::SharedWhisperEngine, get_model_path, get_models_dir,
    TranscriptionResult,
};
use std::path::Path;
use tauri::State;

/// State wrapper for the transcription engine
pub struct TranscriptionState {
    pub engine: SharedWhisperEngine,
}

impl Default for TranscriptionState {
    fn default() -> Self {
        Self {
            engine: SharedWhisperEngine::new(),
        }
    }
}

/// Load a Whisper model by name (e.g., "base", "small", "medium")
#[tauri::command]
pub async fn load_whisper_model(
    state: State<'_, TranscriptionState>,
    model_name: String,
) -> Result<(), String> {
    let model_path = get_model_path(&model_name);
    tracing::info!("Loading model: {} from {:?}", model_name, model_path);

    state
        .engine
        .load_model(&model_path)
        .await
        .map_err(|e| e.to_string())
}

/// Load a Whisper model from a specific path
#[tauri::command]
pub async fn load_whisper_model_from_path(
    state: State<'_, TranscriptionState>,
    path: String,
) -> Result<(), String> {
    let model_path = Path::new(&path);
    tracing::info!("Loading model from path: {:?}", model_path);

    state
        .engine
        .load_model(model_path)
        .await
        .map_err(|e| e.to_string())
}

/// Unload the current model
#[tauri::command]
pub async fn unload_whisper_model(state: State<'_, TranscriptionState>) -> Result<(), String> {
    state.engine.unload_model().await;
    Ok(())
}

/// Check if a model is currently loaded
#[tauri::command]
pub async fn is_model_loaded(state: State<'_, TranscriptionState>) -> Result<bool, String> {
    Ok(state.engine.is_loaded().await)
}

/// Get the currently loaded model ID
#[tauri::command]
pub async fn get_loaded_model_id(state: State<'_, TranscriptionState>) -> Result<Option<String>, String> {
    let model_id = state.engine.model_id().await;
    if model_id.is_empty() {
        Ok(None)
    } else {
        Ok(Some(model_id))
    }
}

/// Transcribe an audio file
#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, TranscriptionState>,
    file_path: String,
) -> Result<TranscriptionResult, String> {
    let path = Path::new(&file_path);
    tracing::info!("Transcribing audio file: {:?}", path);

    // Decode audio file to samples
    let samples = decode_audio_file(path).map_err(|e| e.to_string())?;

    // Run transcription
    let result = state
        .engine
        .transcribe(samples)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!("Transcription result: {} chars", result.text.len());
    Ok(result)
}

/// Transcribe raw audio samples (16kHz mono f32)
#[tauri::command]
pub async fn transcribe_samples(
    state: State<'_, TranscriptionState>,
    samples: Vec<f32>,
) -> Result<TranscriptionResult, String> {
    tracing::info!("Transcribing {} samples", samples.len());

    let result = state
        .engine
        .transcribe(samples)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!("Transcription result: {} chars", result.text.len());
    Ok(result)
}

/// Get the models directory path
#[tauri::command]
pub fn get_models_directory() -> String {
    get_models_dir().to_string_lossy().to_string()
}

/// Check if a model file exists
#[tauri::command]
pub fn check_model_exists(model_name: String) -> bool {
    let path = get_model_path(&model_name);
    path.exists()
}

/// List available models in the models directory
#[tauri::command]
pub fn list_available_models() -> Vec<String> {
    let models_dir = get_models_dir();

    if !models_dir.exists() {
        return Vec::new();
    }

    std::fs::read_dir(models_dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let path = e.path();
                    if path.extension().map(|ext| ext == "bin").unwrap_or(false) {
                        path.file_stem()
                            .and_then(|s| s.to_str())
                            .map(|s| s.trim_start_matches("ggml-").to_string())
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}
