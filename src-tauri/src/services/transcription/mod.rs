//! Transcription service module
//!
//! Provides Whisper-based speech-to-text transcription.

pub mod decoder;
pub mod engine;
pub mod gpu;
pub mod languages;
pub mod models;

pub use decoder::decode_audio_file;
pub use engine::{build_initial_prompt, ChunkTranscriptionResult, WhisperEngine};
pub use gpu::{detect_gpu_backend, is_gpu_available, GpuBackend, GpuInfo};
pub use languages::{get_language_by_code, get_languages, is_valid_language_code, Language};
pub use models::{
    delete_model, download_model_with_progress, get_downloaded_models, get_model,
    get_model_manifest, DownloadError, DownloadProgress, WhisperModel,
};

use std::path::PathBuf;
use thiserror::Error;

/// Transcription result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionResult {
    /// Transcribed text
    pub text: String,
    /// Duration of audio in milliseconds
    pub duration_ms: u64,
    /// Model ID used for transcription
    pub model_id: String,
    /// Language detected or used
    pub language: Option<String>,
    /// Whether GPU acceleration was used
    #[serde(default)]
    pub gpu_used: bool,
}

/// Errors that can occur during transcription
#[derive(Error, Debug)]
pub enum TranscriptionError {
    #[error("No model loaded")]
    ModelNotLoaded,

    #[error("Invalid audio file: {0}")]
    InvalidAudioFile(String),

    #[error("Transcription failed: {0}")]
    InferenceFailed(String),

    #[error("Model error: {0}")]
    ModelError(#[from] ModelError),

    #[error("Audio error: {0}")]
    AudioError(String),
}

/// Errors related to model loading
#[derive(Error, Debug)]
pub enum ModelError {
    #[error("Model file not found: {0}")]
    NotFound(PathBuf),

    #[error("Invalid model path")]
    InvalidPath,

    #[error("Failed to load model: {0}")]
    LoadFailed(String),
}

/// Get the default model directory path
pub fn get_models_dir() -> PathBuf {
    use directories::ProjectDirs;

    if let Some(proj_dirs) = ProjectDirs::from("com", "ezflow", "EZFlow") {
        proj_dirs.data_dir().join("models")
    } else {
        // Fallback to current directory
        PathBuf::from("models")
    }
}

/// Get the path to a specific model file
pub fn get_model_path(model_name: &str) -> PathBuf {
    get_models_dir().join(format!("ggml-{}.bin", model_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_model_path() {
        let path = get_model_path("base");
        assert!(path.to_string_lossy().contains("ggml-base.bin"));
    }

    #[test]
    fn test_transcription_result_serialization() {
        let result = TranscriptionResult {
            text: "Hello world".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: Some("en".to_string()),
            gpu_used: false,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Hello world"));
        assert!(json.contains("\"duration_ms\":1000"));
    }
}
