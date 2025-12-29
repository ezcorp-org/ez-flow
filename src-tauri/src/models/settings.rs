//! Application settings data model
//!
//! Defines the user-configurable settings for EZ Flow.

use crate::services::ui::IndicatorPosition;
use serde::{Deserialize, Serialize};

/// Recording mode: how the hotkey behaves
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum RecordingMode {
    /// Hold hotkey to record, release to stop
    #[default]
    PushToTalk,
    /// Press hotkey to start, press again to stop
    Toggle,
}

/// Main application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// Global hotkey for recording
    pub hotkey: String,
    /// Recording activation mode
    pub recording_mode: RecordingMode,
    /// Whisper model ID to use
    pub model_id: String,
    /// Language for transcription (None = auto-detect)
    pub language: Option<String>,
    /// Launch at system startup
    pub launch_at_login: bool,
    /// Recording indicator position
    pub indicator_position: IndicatorPosition,
    /// Automatically paste transcribed text
    pub auto_paste: bool,
    /// Also copy to clipboard
    pub auto_copy: bool,
    /// Delay between keystrokes in ms
    pub injection_delay_ms: u32,
    /// Whether onboarding has been completed
    #[serde(default)]
    pub onboarding_completed: bool,
    /// Whether onboarding was skipped
    #[serde(default)]
    pub onboarding_skipped: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hotkey: if cfg!(target_os = "macos") {
                "Cmd+Shift+Space".into()
            } else {
                "Ctrl+Shift+Space".into()
            },
            recording_mode: RecordingMode::PushToTalk,
            model_id: "base".into(),
            language: None,
            launch_at_login: false,
            indicator_position: IndicatorPosition::TopRight,
            auto_paste: true,
            auto_copy: true,
            injection_delay_ms: 0,
            onboarding_completed: false,
            onboarding_skipped: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_default() {
        let settings = Settings::default();
        assert_eq!(settings.recording_mode, RecordingMode::PushToTalk);
        assert_eq!(settings.model_id, "base");
        assert!(settings.auto_paste);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = Settings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.model_id, settings.model_id);
    }

    #[test]
    fn test_recording_mode_serialization() {
        let mode = RecordingMode::Toggle;
        let json = serde_json::to_string(&mode).unwrap();
        assert_eq!(json, "\"toggle\"");
    }
}
