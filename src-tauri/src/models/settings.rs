//! Application settings data model
//!
//! Defines the user-configurable settings for EZ Flow.

use crate::services::ui::IndicatorPosition;
use crate::services::voice_commands::CommandConfig;
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

/// Streaming transcription mode: trade-off between speed and accuracy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StreamingMode {
    /// Use streaming result directly (fastest, no final reconciliation)
    Speed,
    /// Re-transcribe last portion for cleanup (default balance)
    #[default]
    Balanced,
    /// Full re-transcription with streaming previews (most accurate)
    Accuracy,
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
    /// Use GPU acceleration if available
    #[serde(default = "default_use_gpu")]
    pub use_gpu: bool,
    /// Automatically check for updates
    #[serde(default = "default_true")]
    pub auto_check_updates: bool,
    /// Model idle timeout in seconds (0 = never unload)
    #[serde(default = "default_model_idle_timeout")]
    pub model_idle_timeout_secs: u64,
    /// Custom vocabulary terms to improve transcription accuracy
    #[serde(default)]
    pub custom_vocabulary: Vec<String>,
    /// Context prompt for domain-specific transcription (e.g., medical, legal, technical)
    #[serde(default)]
    pub context_prompt: Option<String>,
    /// Whether to use the context prompt during transcription
    #[serde(default)]
    pub use_context_prompt: bool,
    /// Whether to show the preview window
    #[serde(default = "default_true")]
    pub preview_enabled: bool,
    /// Duration to show the preview window in seconds (1-5)
    #[serde(default = "default_preview_duration")]
    pub preview_duration_secs: u32,
    /// Whether to show the audio visualizer in the preview window
    #[serde(default = "default_true")]
    pub preview_show_visualizer: bool,
    /// X position of the preview window (None = default position)
    #[serde(default)]
    pub preview_position_x: Option<i32>,
    /// Y position of the preview window (None = default position)
    #[serde(default)]
    pub preview_position_y: Option<i32>,
    /// Voice command settings
    #[serde(default)]
    pub voice_commands: CommandConfig,
    /// Whether streaming transcription is enabled
    #[serde(default = "default_true")]
    pub streaming_enabled: bool,
    /// Streaming transcription mode (speed/balanced/accuracy)
    #[serde(default)]
    pub streaming_mode: StreamingMode,
}

fn default_use_gpu() -> bool {
    true // Default to use GPU if available
}

fn default_true() -> bool {
    true
}

fn default_model_idle_timeout() -> u64 {
    300 // 5 minutes
}

fn default_preview_duration() -> u32 {
    3 // 3 seconds
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
            use_gpu: default_use_gpu(),
            auto_check_updates: default_true(),
            model_idle_timeout_secs: default_model_idle_timeout(),
            custom_vocabulary: Vec::new(),
            context_prompt: None,
            use_context_prompt: false,
            preview_enabled: default_true(),
            preview_duration_secs: default_preview_duration(),
            preview_show_visualizer: default_true(),
            preview_position_x: None,
            preview_position_y: None,
            voice_commands: CommandConfig::default(),
            streaming_enabled: default_true(),
            streaming_mode: StreamingMode::default(),
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
        assert!(settings.custom_vocabulary.is_empty());
        assert!(settings.context_prompt.is_none());
        assert!(!settings.use_context_prompt);
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

    #[test]
    fn test_custom_vocabulary_serialization() {
        let mut settings = Settings::default();
        settings.custom_vocabulary = vec!["HIPAA".to_string(), "EHR".to_string()];
        settings.context_prompt = Some("Medical transcription context".to_string());
        settings.use_context_prompt = true;

        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.custom_vocabulary.len(), 2);
        assert_eq!(parsed.custom_vocabulary[0], "HIPAA");
        assert_eq!(
            parsed.context_prompt,
            Some("Medical transcription context".to_string())
        );
        assert!(parsed.use_context_prompt);
    }

    #[test]
    fn test_settings_backward_compatibility() {
        // Test that settings without new fields can still be parsed
        let old_json = r#"{
            "hotkey": "Ctrl+Shift+Space",
            "recording_mode": "push_to_talk",
            "model_id": "base",
            "language": null,
            "launch_at_login": false,
            "indicator_position": "top_right",
            "auto_paste": true,
            "auto_copy": true,
            "injection_delay_ms": 0,
            "onboarding_completed": false,
            "onboarding_skipped": false
        }"#;

        let parsed: Settings = serde_json::from_str(old_json).unwrap();
        assert!(parsed.custom_vocabulary.is_empty());
        assert!(parsed.context_prompt.is_none());
        assert!(!parsed.use_context_prompt);
    }

    #[test]
    fn test_preview_settings_default() {
        let settings = Settings::default();
        assert!(settings.preview_enabled);
        assert_eq!(settings.preview_duration_secs, 3);
        assert!(settings.preview_show_visualizer);
        assert!(settings.preview_position_x.is_none());
        assert!(settings.preview_position_y.is_none());
    }

    #[test]
    fn test_preview_settings_serialization() {
        let mut settings = Settings::default();
        settings.preview_enabled = false;
        settings.preview_duration_secs = 5;
        settings.preview_show_visualizer = false;
        settings.preview_position_x = Some(100);
        settings.preview_position_y = Some(200);

        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();

        assert!(!parsed.preview_enabled);
        assert_eq!(parsed.preview_duration_secs, 5);
        assert!(!parsed.preview_show_visualizer);
        assert_eq!(parsed.preview_position_x, Some(100));
        assert_eq!(parsed.preview_position_y, Some(200));
    }

    #[test]
    fn test_streaming_settings_default() {
        let settings = Settings::default();
        assert!(settings.streaming_enabled);
        assert_eq!(settings.streaming_mode, StreamingMode::Balanced);
    }

    #[test]
    fn test_streaming_mode_serialization() {
        let speed = StreamingMode::Speed;
        let json = serde_json::to_string(&speed).unwrap();
        assert_eq!(json, "\"speed\"");

        let balanced = StreamingMode::Balanced;
        let json = serde_json::to_string(&balanced).unwrap();
        assert_eq!(json, "\"balanced\"");

        let accuracy = StreamingMode::Accuracy;
        let json = serde_json::to_string(&accuracy).unwrap();
        assert_eq!(json, "\"accuracy\"");
    }

    #[test]
    fn test_streaming_settings_serialization() {
        let mut settings = Settings::default();
        settings.streaming_enabled = false;
        settings.streaming_mode = StreamingMode::Speed;

        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();

        assert!(!parsed.streaming_enabled);
        assert_eq!(parsed.streaming_mode, StreamingMode::Speed);
    }

    #[test]
    fn test_streaming_settings_backward_compatibility() {
        // Old settings without streaming fields should default correctly
        let old_json = r#"{
            "hotkey": "Ctrl+Shift+Space",
            "recording_mode": "push_to_talk",
            "model_id": "base",
            "language": null,
            "launch_at_login": false,
            "indicator_position": "top_right",
            "auto_paste": true,
            "auto_copy": true,
            "injection_delay_ms": 0,
            "onboarding_completed": false,
            "onboarding_skipped": false
        }"#;

        let parsed: Settings = serde_json::from_str(old_json).unwrap();
        assert!(parsed.streaming_enabled);
        assert_eq!(parsed.streaming_mode, StreamingMode::Balanced);
    }
}
