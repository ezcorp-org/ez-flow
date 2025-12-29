//! Models command - manage Whisper models

use super::Context;
use anyhow::{Context as AnyhowContext, Result};
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};

/// Model manifest entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size_mb: u64,
    pub url: String,
    pub description: String,
}

/// Get the list of available models
pub fn get_model_manifest() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "tiny".to_string(),
            name: "Tiny (Q5)".to_string(),
            size_mb: 42,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin".to_string(),
            description: "Fastest, lowest accuracy".to_string(),
        },
        ModelInfo {
            id: "tiny.en".to_string(),
            name: "Tiny English (Q5)".to_string(),
            size_mb: 42,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin".to_string(),
            description: "Fastest, English only".to_string(),
        },
        ModelInfo {
            id: "base".to_string(),
            name: "Base (Q5)".to_string(),
            size_mb: 78,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".to_string(),
            description: "Good balance of speed and accuracy".to_string(),
        },
        ModelInfo {
            id: "base.en".to_string(),
            name: "Base English (Q5)".to_string(),
            size_mb: 78,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin".to_string(),
            description: "Good balance, English only".to_string(),
        },
        ModelInfo {
            id: "small".to_string(),
            name: "Small (Q5)".to_string(),
            size_mb: 249,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".to_string(),
            description: "Better accuracy, moderate speed".to_string(),
        },
        ModelInfo {
            id: "small.en".to_string(),
            name: "Small English (Q5)".to_string(),
            size_mb: 249,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin".to_string(),
            description: "Better accuracy, English only".to_string(),
        },
        ModelInfo {
            id: "medium".to_string(),
            name: "Medium (Q5)".to_string(),
            size_mb: 787,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin".to_string(),
            description: "High accuracy, slower".to_string(),
        },
        ModelInfo {
            id: "medium.en".to_string(),
            name: "Medium English (Q5)".to_string(),
            size_mb: 787,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin".to_string(),
            description: "High accuracy, English only".to_string(),
        },
        ModelInfo {
            id: "large-v3".to_string(),
            name: "Large v3".to_string(),
            size_mb: 1550,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin".to_string(),
            description: "Highest accuracy, slowest".to_string(),
        },
        ModelInfo {
            id: "large-v3-turbo".to_string(),
            name: "Large v3 Turbo".to_string(),
            size_mb: 809,
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin".to_string(),
            description: "Fast variant of large-v3".to_string(),
        },
    ]
}

/// Get the models directory path
fn get_models_dir() -> Result<std::path::PathBuf> {
    let dirs = directories::ProjectDirs::from("com", "ezflow", "EZ Flow")
        .context("Failed to get project directories")?;

    let models_dir = dirs.data_dir().join("models");
    std::fs::create_dir_all(&models_dir).context("Failed to create models directory")?;

    Ok(models_dir)
}

/// Check if a model is downloaded
fn is_model_downloaded(model_id: &str) -> Result<bool> {
    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(format!("ggml-{}.bin", model_id));
    Ok(model_path.exists())
}

/// Get model file size
fn get_model_file_size(model_id: &str) -> Result<Option<u64>> {
    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(format!("ggml-{}.bin", model_id));
    if model_path.exists() {
        let metadata = std::fs::metadata(&model_path)?;
        Ok(Some(metadata.len()))
    } else {
        Ok(None)
    }
}

/// List available models
pub fn list(ctx: &Context) -> Result<()> {
    let manifest = get_model_manifest();

    if ctx.json_output {
        let output: Vec<serde_json::Value> = manifest
            .iter()
            .map(|m| {
                let downloaded = is_model_downloaded(&m.id).unwrap_or(false);
                serde_json::json!({
                    "id": m.id,
                    "name": m.name,
                    "size_mb": m.size_mb,
                    "description": m.description,
                    "downloaded": downloaded,
                })
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!(
            "\n{:<15} {:<25} {:>10} {}",
            "ID".bold(),
            "Name".bold(),
            "Size".bold(),
            "Status".bold()
        );
        println!("{}", "-".repeat(70));

        for model in manifest {
            let downloaded = is_model_downloaded(&model.id).unwrap_or(false);
            let status = if downloaded {
                "Downloaded".green().to_string()
            } else {
                "Not downloaded".dimmed().to_string()
            };

            println!(
                "{:<15} {:<25} {:>7} MB {}",
                model.id, model.name, model.size_mb, status
            );
        }
        println!();
    }

    Ok(())
}

/// Download a model
pub fn download(name: &str, ctx: &Context) -> Result<()> {
    let manifest = get_model_manifest();
    let model = manifest
        .iter()
        .find(|m| m.id == name)
        .context(format!("Unknown model: {}. Run 'ezflow models list' to see available models.", name))?;

    // Check if already downloaded
    if is_model_downloaded(&model.id)? {
        if ctx.json_output {
            println!(
                "{}",
                serde_json::json!({
                    "status": "already_downloaded",
                    "model": model.id,
                })
            );
        } else {
            println!("Model '{}' is already downloaded.", model.id);
        }
        return Ok(());
    }

    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(format!("ggml-{}.bin", model.id));

    if !ctx.json_output {
        println!("Downloading {} ({} MB)...", model.name, model.size_mb);
    }

    // Download with progress bar
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        download_with_progress(&model.url, &model_path, model.size_mb, ctx.json_output).await
    })?;

    if ctx.json_output {
        println!(
            "{}",
            serde_json::json!({
                "status": "downloaded",
                "model": model.id,
                "path": model_path.display().to_string(),
            })
        );
    } else {
        println!("Download complete: {}", model_path.display());
    }

    Ok(())
}

/// Download a file with progress bar
async fn download_with_progress(
    url: &str,
    dest: &std::path::Path,
    size_mb: u64,
    json_output: bool,
) -> Result<()> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .context("Failed to start download")?;

    let total_size = response.content_length().unwrap_or(size_mb * 1024 * 1024);

    let pb = if !json_output {
        let pb = ProgressBar::new(total_size);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{msg} [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .unwrap()
                .progress_chars("##-"),
        );
        pb.set_message("Downloading");
        Some(pb)
    } else {
        None
    };

    // Create temporary file
    let temp_path = dest.with_extension("tmp");
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .context("Failed to create file")?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("Error downloading chunk")?;
        file.write_all(&chunk)
            .await
            .context("Failed to write chunk")?;
        downloaded += chunk.len() as u64;

        if let Some(ref pb) = pb {
            pb.set_position(downloaded);
        }
    }

    file.flush().await?;
    drop(file);

    // Move temp file to final destination
    tokio::fs::rename(&temp_path, dest)
        .await
        .context("Failed to finalize download")?;

    if let Some(pb) = pb {
        pb.finish_with_message("Complete");
    }

    Ok(())
}

/// Delete a downloaded model
pub fn delete(name: &str, ctx: &Context) -> Result<()> {
    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(format!("ggml-{}.bin", name));

    if !model_path.exists() {
        if ctx.json_output {
            println!(
                "{}",
                serde_json::json!({
                    "status": "not_found",
                    "model": name,
                })
            );
        } else {
            println!("Model '{}' is not downloaded.", name);
        }
        return Ok(());
    }

    std::fs::remove_file(&model_path).context("Failed to delete model")?;

    if ctx.json_output {
        println!(
            "{}",
            serde_json::json!({
                "status": "deleted",
                "model": name,
            })
        );
    } else {
        println!("Model '{}' deleted.", name);
    }

    Ok(())
}

/// Show model info
pub fn info(name: &str, ctx: &Context) -> Result<()> {
    let manifest = get_model_manifest();
    let model = manifest
        .iter()
        .find(|m| m.id == name)
        .context(format!("Unknown model: {}", name))?;

    let downloaded = is_model_downloaded(&model.id)?;
    let file_size = get_model_file_size(&model.id)?;

    if ctx.json_output {
        let output = serde_json::json!({
            "id": model.id,
            "name": model.name,
            "size_mb": model.size_mb,
            "description": model.description,
            "downloaded": downloaded,
            "file_size_bytes": file_size,
            "url": model.url,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("\n{}", model.name.bold());
        println!("ID:          {}", model.id);
        println!("Size:        {} MB", model.size_mb);
        println!("Description: {}", model.description);
        println!(
            "Status:      {}",
            if downloaded {
                "Downloaded".green()
            } else {
                "Not downloaded".dimmed()
            }
        );
        if let Some(size) = file_size {
            println!(
                "File size:   {:.2} MB",
                size as f64 / (1024.0 * 1024.0)
            );
        }
        println!();
    }

    Ok(())
}
