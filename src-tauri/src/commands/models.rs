//! Model management Tauri commands
//!
//! Provides commands for downloading and managing Whisper models.

use crate::commands::TranscriptionState;
use crate::services::storage::SettingsState;
use crate::services::transcription::{
    delete_model as delete_model_file, download_model_with_progress, get_downloaded_models,
    get_model, get_model_manifest, get_model_path, WhisperModel,
};
use serde::Serialize;
use tauri::{Emitter, State, Window};

/// Result of model validation on startup
#[derive(Debug, Clone, Serialize)]
pub struct ModelValidationResult {
    /// Whether a model was successfully loaded
    pub loaded: bool,
    /// The model ID that was validated
    pub model_id: String,
    /// Whether the user needs to download a model
    pub needs_download: bool,
    /// Error message if validation failed
    pub error: Option<String>,
}

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

/// Validate that the configured model exists and attempt to load it
///
/// This command checks if the model specified in settings exists on disk
/// and attempts to load it into the transcription engine.
#[tauri::command]
pub async fn validate_and_load_model(
    transcription_state: State<'_, TranscriptionState>,
    settings_state: State<'_, SettingsState>,
) -> Result<ModelValidationResult, String> {
    let settings = settings_state.get().await;
    let model_id = settings.model_id.clone();

    tracing::info!("Validating model: {}", model_id);

    // Check if model file exists
    let model_path = get_model_path(&model_id);
    if !model_path.exists() {
        tracing::warn!("Model file not found: {:?}", model_path);
        return Ok(ModelValidationResult {
            loaded: false,
            model_id,
            needs_download: true,
            error: Some("Model file not found".to_string()),
        });
    }

    // Attempt to load the model
    match transcription_state.engine.load_model(&model_path).await {
        Ok(_) => {
            tracing::info!("Model {} loaded successfully", model_id);
            Ok(ModelValidationResult {
                loaded: true,
                model_id,
                needs_download: false,
                error: None,
            })
        }
        Err(e) => {
            tracing::error!("Failed to load model {}: {}", model_id, e);
            Ok(ModelValidationResult {
                loaded: false,
                model_id,
                needs_download: true,
                error: Some(e.to_string()),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_validation_result_serialization() {
        let result = ModelValidationResult {
            loaded: true,
            model_id: "base".to_string(),
            needs_download: false,
            error: None,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"loaded\":true"));
        assert!(json.contains("\"model_id\":\"base\""));
        assert!(json.contains("\"needs_download\":false"));
    }

    #[test]
    fn test_model_validation_result_with_error() {
        let result = ModelValidationResult {
            loaded: false,
            model_id: "base".to_string(),
            needs_download: true,
            error: Some("Model file not found".to_string()),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"loaded\":false"));
        assert!(json.contains("\"needs_download\":true"));
        assert!(json.contains("Model file not found"));
    }

    #[test]
    fn test_is_model_downloaded_nonexistent() {
        // Test with a model that definitely doesn't exist
        let result = is_model_downloaded("nonexistent_model_xyz".to_string());
        assert!(!result);
    }

    #[test]
    fn test_get_available_models_returns_all() {
        let models = get_available_models();
        assert!(!models.is_empty());

        // Should have the standard models
        let ids: Vec<_> = models.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"tiny"));
        assert!(ids.contains(&"base"));
    }

    #[test]
    fn test_get_model_size_nonexistent() {
        let size = get_model_size("nonexistent_model_xyz".to_string());
        assert!(size.is_none());
    }
}
