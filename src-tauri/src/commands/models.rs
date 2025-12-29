//! Model management Tauri commands
//!
//! Provides commands for downloading and managing Whisper models.

use crate::services::transcription::{
    delete_model as delete_model_file, download_model_with_progress, get_downloaded_models,
    get_model, get_model_manifest, get_model_path, DownloadProgress, WhisperModel,
};
use tauri::{Emitter, Window};

/// Get list of all available models with download status
#[tauri::command]
pub fn get_available_models() -> Vec<WhisperModel> {
    tracing::debug!("Getting available models");
    get_model_manifest()
}

/// Get list of downloaded model IDs
#[tauri::command]
pub fn get_downloaded_model_ids() -> Vec<String> {
    tracing::debug!("Getting downloaded models");
    get_downloaded_models()
}

/// Check if a specific model is downloaded
#[tauri::command]
pub fn is_model_downloaded(model_id: String) -> bool {
    let path = get_model_path(&model_id);
    path.exists()
}

/// Download a model with progress events
#[tauri::command]
pub async fn download_model(model_id: String, window: Window) -> Result<(), String> {
    tracing::info!("Download requested for model: {}", model_id);

    let model = get_model(&model_id).ok_or_else(|| format!("Model not found: {}", model_id))?;

    // Check if already downloaded
    if get_model_path(&model_id).exists() {
        tracing::info!("Model {} already downloaded", model_id);
        return Ok(());
    }

    let model_id_clone = model_id.clone();
    let window_clone = window.clone();

    download_model_with_progress(&model, move |progress| {
        let _ = window_clone.emit("model:download_progress", &progress);
    })
    .await
    .map_err(|e| e.to_string())?;

    // Emit completion event
    let _ = window.emit("model:download_complete", &model_id_clone);

    Ok(())
}

/// Delete a downloaded model
#[tauri::command]
pub async fn delete_downloaded_model(model_id: String) -> Result<(), String> {
    tracing::info!("Delete requested for model: {}", model_id);
    delete_model_file(&model_id).map_err(|e| e.to_string())
}

/// Get model file size in bytes (if downloaded)
#[tauri::command]
pub fn get_model_size(model_id: String) -> Option<u64> {
    let path = get_model_path(&model_id);
    if path.exists() {
        std::fs::metadata(&path).ok().map(|m| m.len())
    } else {
        None
    }
}
