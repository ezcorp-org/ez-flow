//! Settings persistence service
//!
//! Handles saving and loading user settings to disk.

use crate::models::Settings;
use directories::ProjectDirs;
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during settings operations
#[derive(Error, Debug)]
pub enum SettingsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Could not determine app directories")]
    NoAppDirs,
}

/// Get the settings file path
pub fn get_settings_path() -> Result<PathBuf, SettingsError> {
    let proj_dirs =
        ProjectDirs::from("com", "ezflow", "EZFlow").ok_or(SettingsError::NoAppDirs)?;
    Ok(proj_dirs.config_dir().join("settings.json"))
}

/// Load settings from disk
pub fn load_settings() -> Settings {
    match load_settings_inner() {
        Ok(settings) => {
            tracing::info!("Loaded settings from disk");
            settings
        }
        Err(e) => {
            tracing::warn!("Could not load settings, using defaults: {}", e);
            Settings::default()
        }
    }
}

fn load_settings_inner() -> Result<Settings, SettingsError> {
    let path = get_settings_path()?;
    if path.exists() {
        let content = std::fs::read_to_string(&path)?;
        let settings: Settings = serde_json::from_str(&content)?;
        Ok(settings)
    } else {
        Ok(Settings::default())
    }
}

/// Save settings to disk
pub fn save_settings(settings: &Settings) -> Result<(), SettingsError> {
    let path = get_settings_path()?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, content)?;

    tracing::debug!("Settings saved to {:?}", path);
    Ok(())
}

/// Thread-safe settings state wrapper
pub struct SettingsState {
    settings: Arc<RwLock<Settings>>,
}

impl SettingsState {
    /// Create a new settings state, loading from disk
    pub fn new() -> Self {
        let settings = load_settings();
        Self {
            settings: Arc::new(RwLock::new(settings)),
        }
    }

    /// Get current settings
    pub async fn get(&self) -> Settings {
        self.settings.read().await.clone()
    }

    /// Get model_id synchronously (non-blocking)
    /// Returns the current model_id or "base" as fallback if lock unavailable
    pub fn get_model_id_sync(&self) -> String {
        match self.settings.try_read() {
            Ok(guard) => guard.model_id.clone(),
            Err(_) => {
                tracing::warn!("Could not acquire settings lock, using default model_id");
                "base".to_string()
            }
        }
    }

    /// Update settings and save to disk
    pub async fn update(&self, settings: Settings) -> Result<(), SettingsError> {
        save_settings(&settings)?;
        *self.settings.write().await = settings;
        Ok(())
    }

    /// Update a single field and save
    pub async fn update_field<F>(&self, updater: F) -> Result<Settings, SettingsError>
    where
        F: FnOnce(&mut Settings),
    {
        let mut settings = self.settings.write().await;
        updater(&mut settings);
        save_settings(&settings)?;
        Ok(settings.clone())
    }
}

impl Default for SettingsState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_settings_path() {
        let path = get_settings_path();
        // Should not error on systems with valid home directories
        if let Ok(p) = path {
            assert!(p.ends_with("settings.json"));
        }
    }

    #[test]
    fn test_load_default_settings() {
        let settings = load_settings();
        assert_eq!(settings.model_id, "base");
    }

    #[tokio::test]
    async fn test_settings_state() {
        let state = SettingsState::new();
        let settings = state.get().await;
        assert_eq!(settings.model_id, "base");
    }

    #[test]
    fn test_get_model_id_sync() {
        let state = SettingsState::new();
        let model_id = state.get_model_id_sync();
        // Should return default model_id
        assert_eq!(model_id, "base");
    }

    #[test]
    fn test_get_model_id_sync_returns_string() {
        let state = SettingsState::new();
        let model_id = state.get_model_id_sync();
        // Model ID should be a non-empty string
        assert!(!model_id.is_empty());
        // Should be one of the valid model IDs
        let valid_models = ["tiny", "base", "small", "medium", "large-v3"];
        assert!(valid_models.contains(&model_id.as_str()));
    }
}
