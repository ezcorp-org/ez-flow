//! History entry model for transcription history

use serde::{Deserialize, Serialize};

/// A history entry representing a past transcription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    /// Unique identifier
    pub id: i64,
    /// The transcribed text
    pub text: String,
    /// ISO 8601 timestamp when transcription occurred
    pub timestamp: String,
    /// Duration of audio in milliseconds
    pub duration_ms: u64,
    /// Model used for transcription
    pub model_id: String,
    /// Language detected/used (if any)
    pub language: Option<String>,
}

impl HistoryEntry {
    /// Create a preview of the text (truncated to max_len chars)
    pub fn preview(&self, max_len: usize) -> String {
        if self.text.len() <= max_len {
            self.text.clone()
        } else {
            format!("{}...", &self.text.chars().take(max_len).collect::<String>())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preview_short_text() {
        let entry = HistoryEntry {
            id: 1,
            text: "Hello world".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: None,
        };
        assert_eq!(entry.preview(50), "Hello world");
    }

    #[test]
    fn test_preview_long_text() {
        let entry = HistoryEntry {
            id: 1,
            text: "This is a very long text that should be truncated".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: None,
        };
        let preview = entry.preview(20);
        assert!(preview.ends_with("..."));
        assert!(preview.len() <= 23); // 20 chars + "..."
    }

    #[test]
    fn test_history_entry_serialization() {
        let entry = HistoryEntry {
            id: 1,
            text: "Hello".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 1500,
            model_id: "tiny".to_string(),
            language: Some("en".to_string()),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let parsed: HistoryEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, entry.id);
        assert_eq!(parsed.text, entry.text);
        assert_eq!(parsed.language, Some("en".to_string()));
    }
}
