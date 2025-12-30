//! Whisper model manifest and download functionality
//!
//! Provides model metadata and downloading with progress tracking.

use super::{get_model_path, get_models_dir};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::io::Write;
use thiserror::Error;

/// Available Whisper model
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WhisperModel {
    /// Model identifier (e.g., "base", "small")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Size in megabytes
    pub size_mb: u32,
    /// Download URL
    pub url: String,
    /// SHA256 hash for verification
    pub sha256: String,
    /// Whether the model is downloaded
    #[serde(default)]
    pub downloaded: bool,
}

/// Download progress event payload
#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub progress: f32,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

/// Errors during model download
#[derive(Error, Debug)]
pub enum DownloadError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("No content length in response")]
    NoContentLength,

    #[error("Checksum mismatch: expected {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Download cancelled")]
    Cancelled,
}

/// Get the manifest of all available Whisper models
pub fn get_model_manifest() -> Vec<WhisperModel> {
    let mut models = vec![
        WhisperModel {
            id: "tiny".into(),
            name: "Tiny (Fast)".into(),
            size_mb: 75,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin".into(),
            sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21".into(),
            downloaded: false,
        },
        WhisperModel {
            id: "base".into(),
            name: "Base (Balanced)".into(),
            size_mb: 142,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".into(),
            sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe".into(),
            downloaded: false,
        },
        WhisperModel {
            id: "small".into(),
            name: "Small (Good)".into(),
            size_mb: 466,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".into(),
            sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b".into(),
            downloaded: false,
        },
        WhisperModel {
            id: "medium".into(),
            name: "Medium (Better)".into(),
            size_mb: 1500,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin".into(),
            sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208".into(),
            downloaded: false,
        },
        WhisperModel {
            id: "large-v3".into(),
            name: "Large v3 (Best)".into(),
            size_mb: 3100,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin".into(),
            sha256: "64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2".into(),
            downloaded: false,
        },
    ];

    // Update downloaded status based on file existence
    for model in &mut models {
        let path = get_model_path(&model.id);
        model.downloaded = path.exists();
    }

    models
}

/// Get a specific model from the manifest
pub fn get_model(model_id: &str) -> Option<WhisperModel> {
    get_model_manifest().into_iter().find(|m| m.id == model_id)
}

/// Download a model with progress callback
pub async fn download_model_with_progress<F>(
    model: &WhisperModel,
    on_progress: F,
) -> Result<(), DownloadError>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    let dest_path = get_model_path(&model.id);

    // Create models directory if it doesn't exist
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    tracing::info!("Downloading model {} from {}", model.id, model.url);

    let client = reqwest::Client::new();
    let response = client.get(&model.url).send().await?;

    if !response.status().is_success() {
        return Err(DownloadError::Network(
            response.error_for_status().unwrap_err(),
        ));
    }

    let total_size = response
        .content_length()
        .ok_or(DownloadError::NoContentLength)?;

    let temp_path = dest_path.with_extension("tmp");
    let mut file = std::fs::File::create(&temp_path)?;
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_progress: f32 = 0.0;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        hasher.update(&chunk);

        downloaded += chunk.len() as u64;
        let progress = downloaded as f32 / total_size as f32;

        // Emit progress at reasonable intervals (every 1%)
        if progress - last_progress >= 0.01 || progress >= 1.0 {
            on_progress(DownloadProgress {
                model_id: model.id.clone(),
                progress,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
            });
            last_progress = progress;
        }
    }

    file.flush()?;
    drop(file);

    // Verify checksum
    let hash = format!("{:x}", hasher.finalize());
    if hash != model.sha256 {
        tracing::error!(
            "Checksum mismatch for {}: expected {}, got {}",
            model.id,
            model.sha256,
            hash
        );
        std::fs::remove_file(&temp_path)?;
        return Err(DownloadError::ChecksumMismatch {
            expected: model.sha256.clone(),
            actual: hash,
        });
    }

    // Move to final location
    std::fs::rename(&temp_path, &dest_path)?;

    tracing::info!("Model {} downloaded successfully to {:?}", model.id, dest_path);
    Ok(())
}

/// Delete a downloaded model
pub fn delete_model(model_id: &str) -> Result<(), std::io::Error> {
    let path = get_model_path(model_id);
    if path.exists() {
        std::fs::remove_file(&path)?;
        tracing::info!("Deleted model: {}", model_id);
    }
    Ok(())
}

/// Get list of downloaded model IDs
pub fn get_downloaded_models() -> Vec<String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_manifest_has_all_models() {
        let manifest = get_model_manifest();
        assert_eq!(manifest.len(), 5);

        let ids: Vec<_> = manifest.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"tiny"));
        assert!(ids.contains(&"base"));
        assert!(ids.contains(&"small"));
        assert!(ids.contains(&"medium"));
        assert!(ids.contains(&"large-v3"));
    }

    #[test]
    fn test_get_model() {
        let model = get_model("base");
        assert!(model.is_some());
        let model = model.unwrap();
        assert_eq!(model.id, "base");
        assert_eq!(model.size_mb, 142);
    }

    #[test]
    fn test_get_model_not_found() {
        let model = get_model("nonexistent");
        assert!(model.is_none());
    }

    #[test]
    fn test_model_path_resolution() {
        let path = get_model_path("base");
        let path_str = path.to_string_lossy();
        assert!(path_str.contains("ggml-base.bin"));
    }
}
