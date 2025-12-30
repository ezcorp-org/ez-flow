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
    // Commands require Tauri runtime, tested via integration tests
}
