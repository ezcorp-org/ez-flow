//! History Tauri commands
//!
//! Commands for managing transcription history.

use crate::models::HistoryEntry;
use crate::services::storage::DatabaseState;
use crate::services::transcription::TranscriptionResult;
use chrono::Utc;
use tauri::State;

/// Save a transcription result to history
#[tauri::command]
pub async fn save_history(
    result: TranscriptionResult,
    state: State<'_, DatabaseState>,
) -> Result<i64, String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    let entry = HistoryEntry {
        id: 0, // Will be set by database
        text: result.text,
        timestamp: Utc::now().to_rfc3339(),
        duration_ms: result.duration_ms,
        model_id: result.model_id,
        language: result.language,
        gpu_used: result.gpu_used,
    };

    db.insert_history(&entry)
        .await
        .map_err(|e| e.to_string())
}

/// Get paginated history entries
#[tauri::command]
pub async fn get_history(
    limit: usize,
    offset: usize,
    state: State<'_, DatabaseState>,
) -> Result<Vec<HistoryEntry>, String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    db.get_history(limit, offset)
        .await
        .map_err(|e| e.to_string())
}

/// Search history entries
#[tauri::command]
pub async fn search_history(
    query: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<HistoryEntry>, String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    if query.trim().is_empty() {
        return db.get_history(100, 0).await.map_err(|e| e.to_string());
    }

    db.search_history(&query).await.map_err(|e| e.to_string())
}

/// Delete a single history entry
#[tauri::command]
pub async fn delete_history_entry(
    id: i64,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    db.delete_entry(id).await.map_err(|e| e.to_string())
}

/// Clear all history
#[tauri::command]
pub async fn clear_history(state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    db.clear_all().await.map_err(|e| e.to_string())
}

/// Get history entry count
#[tauri::command]
pub async fn get_history_count(state: State<'_, DatabaseState>) -> Result<usize, String> {
    let db = state
        .get()
        .ok_or_else(|| "Database not available".to_string())?;

    db.count().await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::transcription::TranscriptionResult;

    #[test]
    fn test_transcription_result_to_history_entry_conversion() {
        let result = TranscriptionResult {
            text: "Hello world".to_string(),
            duration_ms: 2500,
            model_id: "base".to_string(),
            language: Some("en".to_string()),
            gpu_used: true,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert_eq!(entry.text, "Hello world");
        assert_eq!(entry.duration_ms, 2500);
        assert_eq!(entry.model_id, "base");
        assert_eq!(entry.language, Some("en".to_string()));
        assert!(entry.gpu_used);
        assert_eq!(entry.id, 0); // Should be 0 before database insert
    }

    #[test]
    fn test_transcription_result_without_language() {
        let result = TranscriptionResult {
            text: "Auto-detected language".to_string(),
            duration_ms: 1500,
            model_id: "tiny".to_string(),
            language: None,
            gpu_used: false,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert_eq!(entry.language, None);
        assert!(!entry.gpu_used);
    }

    #[test]
    fn test_timestamp_format() {
        let timestamp = Utc::now().to_rfc3339();

        // Should be a valid RFC3339 timestamp
        assert!(timestamp.contains('T'));
        assert!(timestamp.contains('-'));
        assert!(timestamp.contains(':'));
    }

    #[test]
    fn test_empty_transcription_text() {
        let result = TranscriptionResult {
            text: "".to_string(),
            duration_ms: 0,
            model_id: "base".to_string(),
            language: None,
            gpu_used: false,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert!(entry.text.is_empty());
        assert_eq!(entry.duration_ms, 0);
    }

    #[test]
    fn test_long_transcription_text() {
        let long_text = "a".repeat(10000);
        let result = TranscriptionResult {
            text: long_text.clone(),
            duration_ms: 60000, // 1 minute
            model_id: "large-v3".to_string(),
            language: Some("en".to_string()),
            gpu_used: true,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert_eq!(entry.text.len(), 10000);
        assert_eq!(entry.model_id, "large-v3");
    }

    #[test]
    fn test_special_characters_in_text() {
        let result = TranscriptionResult {
            text: "Hello 'world'! \"Test\" <>&\n\tSpecial chars".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: Some("en".to_string()),
            gpu_used: false,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert!(entry.text.contains("'"));
        assert!(entry.text.contains("\""));
        assert!(entry.text.contains("<>"));
        assert!(entry.text.contains("\n"));
    }

    #[test]
    fn test_unicode_in_text() {
        let result = TranscriptionResult {
            text: "Hello 世界! 🌍 Привет мир".to_string(),
            duration_ms: 2000,
            model_id: "base".to_string(),
            language: Some("multilingual".to_string()),
            gpu_used: true,
        };

        let entry = HistoryEntry {
            id: 0,
            text: result.text.clone(),
            timestamp: Utc::now().to_rfc3339(),
            duration_ms: result.duration_ms,
            model_id: result.model_id.clone(),
            language: result.language.clone(),
            gpu_used: result.gpu_used,
        };

        assert!(entry.text.contains("世界"));
        assert!(entry.text.contains("🌍"));
        assert!(entry.text.contains("Привет"));
    }

    #[test]
    fn test_various_model_ids() {
        let models = vec!["tiny", "tiny.en", "base", "base.en", "small", "medium", "large-v3"];

        for model_id in models {
            let result = TranscriptionResult {
                text: "Test".to_string(),
                duration_ms: 1000,
                model_id: model_id.to_string(),
                language: None,
                gpu_used: false,
            };

            let entry = HistoryEntry {
                id: 0,
                text: result.text,
                timestamp: Utc::now().to_rfc3339(),
                duration_ms: result.duration_ms,
                model_id: result.model_id,
                language: result.language,
                gpu_used: result.gpu_used,
            };

            assert_eq!(entry.model_id, model_id);
        }
    }

    #[test]
    fn test_various_languages() {
        let languages = vec![
            Some("en".to_string()),
            Some("es".to_string()),
            Some("fr".to_string()),
            Some("de".to_string()),
            Some("zh".to_string()),
            Some("ja".to_string()),
            None, // Auto-detect
        ];

        for lang in languages {
            let result = TranscriptionResult {
                text: "Test".to_string(),
                duration_ms: 1000,
                model_id: "base".to_string(),
                language: lang.clone(),
                gpu_used: false,
            };

            let entry = HistoryEntry {
                id: 0,
                text: result.text,
                timestamp: Utc::now().to_rfc3339(),
                duration_ms: result.duration_ms,
                model_id: result.model_id,
                language: result.language,
                gpu_used: result.gpu_used,
            };

            assert_eq!(entry.language, lang);
        }
    }
}
