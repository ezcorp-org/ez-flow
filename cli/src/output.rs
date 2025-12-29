//! Output formatting for CLI

use serde::Serialize;

/// Transcription output structure
#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionOutput {
    pub text: String,
    pub duration_ms: u64,
    pub model: String,
    pub language: Option<String>,
    pub inference_time_ms: u64,
}

impl TranscriptionOutput {
    /// Print the output in the requested format
    pub fn print(&self, json: bool) {
        if json {
            let output = serde_json::json!({
                "text": self.text,
                "duration_ms": self.duration_ms,
                "model": self.model,
                "language": self.language,
                "inference_time_ms": self.inference_time_ms,
            });
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
        } else {
            println!("{}", self.text);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transcription_output_serialization() {
        let output = TranscriptionOutput {
            text: "Hello world".to_string(),
            duration_ms: 1000,
            model: "base".to_string(),
            language: Some("en".to_string()),
            inference_time_ms: 500,
        };

        let json = serde_json::to_string(&output).unwrap();
        assert!(json.contains("Hello world"));
        assert!(json.contains("base"));
    }
}
