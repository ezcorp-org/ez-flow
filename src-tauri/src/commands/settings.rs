//! Settings Tauri commands
//!
//! Commands for managing user preferences.

use crate::models::Settings;
use crate::services::storage::SettingsState;
use crate::services::transcription::{
    detect_gpu_backend, get_languages, is_gpu_available, GpuBackend, GpuInfo, Language,
};
use tauri::State;

/// Get current settings
#[tauri::command]
pub async fn get_settings(state: State<'_, SettingsState>) -> Result<Settings, String> {
    Ok(state.get().await)
}

/// Update all settings
#[tauri::command]
pub async fn update_settings(
    settings: Settings,
    state: State<'_, SettingsState>,
) -> Result<(), String> {
    state.update(settings).await.map_err(|e| e.to_string())
}

/// Update a single setting field
#[tauri::command]
pub async fn update_setting(
    key: String,
    value: serde_json::Value,
    state: State<'_, SettingsState>,
) -> Result<Settings, String> {
    state
        .update_field(|settings| {
            match key.as_str() {
                "hotkey" => {
                    if let Some(v) = value.as_str() {
                        settings.hotkey = v.to_string();
                    }
                }
                "recording_mode" => {
                    if let Ok(mode) = serde_json::from_value(value.clone()) {
                        settings.recording_mode = mode;
                    }
                }
                "model_id" => {
                    if let Some(v) = value.as_str() {
                        // Validate against known model IDs
                        let valid_models = ["tiny", "base", "small", "medium", "large-v3"];
                        if valid_models.contains(&v) {
                            settings.model_id = v.to_string();
                        } else {
                            tracing::warn!("Invalid model_id '{}', keeping current value", v);
                        }
                    }
                }
                "language" => {
                    settings.language = value.as_str().map(|s| s.to_string());
                }
                "launch_at_login" => {
                    if let Some(v) = value.as_bool() {
                        settings.launch_at_login = v;
                    }
                }
                "indicator_position" => {
                    if let Ok(pos) = serde_json::from_value(value.clone()) {
                        settings.indicator_position = pos;
                    }
                }
                "auto_paste" => {
                    if let Some(v) = value.as_bool() {
                        settings.auto_paste = v;
                    }
                }
                "auto_copy" => {
                    if let Some(v) = value.as_bool() {
                        settings.auto_copy = v;
                    }
                }
                "injection_delay_ms" => {
                    if let Some(v) = value.as_u64() {
                        settings.injection_delay_ms = v as u32;
                    }
                }
                "onboarding_completed" => {
                    if let Some(v) = value.as_bool() {
                        settings.onboarding_completed = v;
                    }
                }
                "onboarding_skipped" => {
                    if let Some(v) = value.as_bool() {
                        settings.onboarding_skipped = v;
                    }
                }
                "use_gpu" => {
                    if let Some(v) = value.as_bool() {
                        settings.use_gpu = v;
                    }
                }
                "auto_check_updates" => {
                    if let Some(v) = value.as_bool() {
                        settings.auto_check_updates = v;
                    }
                }
                "model_idle_timeout_secs" => {
                    if let Some(v) = value.as_u64() {
                        settings.model_idle_timeout_secs = v;
                    }
                }
                _ => {
                    tracing::warn!("Unknown setting key: {}", key);
                }
            }
        })
        .await
        .map_err(|e| e.to_string())
}

/// Reset settings to defaults
#[tauri::command]
pub async fn reset_settings(state: State<'_, SettingsState>) -> Result<Settings, String> {
    let defaults = Settings::default();
    state
        .update(defaults.clone())
        .await
        .map_err(|e| e.to_string())?;
    Ok(defaults)
}

/// Export settings to a JSON file
#[tauri::command]
pub async fn export_settings(
    path: String,
    state: State<'_, SettingsState>,
) -> Result<(), String> {
    let settings = state.get().await;
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    tracing::info!("Settings exported to {}", path);
    Ok(())
}

/// Import settings from a JSON file
#[tauri::command]
pub async fn import_settings(
    path: String,
    state: State<'_, SettingsState>,
) -> Result<Settings, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let imported: Settings =
        serde_json::from_str(&content).map_err(|e| format!("Invalid settings file: {}", e))?;
    state
        .update(imported.clone())
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("Settings imported from {}", path);
    Ok(imported)
}

/// Get GPU information
#[tauri::command]
pub fn get_gpu_info() -> GpuInfo {
    let backend = detect_gpu_backend();
    let available = is_gpu_available();
    GpuInfo {
        backend,
        available,
        in_use: false, // Will be updated when transcription runs
    }
}

/// Get detected GPU backend
#[tauri::command]
pub fn get_gpu_backend() -> GpuBackend {
    detect_gpu_backend()
}

/// Check if GPU acceleration is available
#[tauri::command]
pub fn is_gpu_available_cmd() -> bool {
    is_gpu_available()
}

/// Get all supported languages for transcription
#[tauri::command]
pub fn get_supported_languages() -> Vec<Language> {
    get_languages()
}

#[cfg(test)]
mod tests {
    // Commands require Tauri runtime, tested via integration tests
}
