//! Data models
//!
//! This module contains the data structures used throughout the application.

pub mod history;
pub mod settings;

pub use history::HistoryEntry;
pub use settings::{RecordingMode, Settings};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = Settings::default();
        assert_eq!(settings.model_id, "base");
    }
}
