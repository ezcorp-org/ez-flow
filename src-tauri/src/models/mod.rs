//! Data models
//!
//! This module contains the data structures used throughout the application.

use serde::{Deserialize, Serialize};

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    /// Whether the app should start minimized to tray
    pub start_minimized: bool,

    /// The global hotkey for push-to-talk
    pub hotkey: String,

    /// The selected Whisper model ID
    pub model_id: String,

    /// The selected language for transcription
    pub language: String,

    /// Whether to automatically check for updates
    pub auto_check_updates: bool,
}

impl Settings {
    pub fn new() -> Self {
        Self {
            start_minimized: false,
            hotkey: "Ctrl+Shift+Space".to_string(),
            model_id: "base".to_string(),
            language: "en".to_string(),
            auto_check_updates: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = Settings::new();
        assert_eq!(settings.hotkey, "Ctrl+Shift+Space");
        assert_eq!(settings.model_id, "base");
    }
}
