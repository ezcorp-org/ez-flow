//! SQLite database for history storage
//!
//! Handles database initialization and operations for transcription history.

use crate::error::AppError;
use crate::models::HistoryEntry;
use directories::ProjectDirs;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Database connection wrapper
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Create a new database connection
    pub fn new() -> Result<Self, AppError> {
        let path = get_database_path()?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::Config(format!("Failed to create database directory: {}", e))
            })?;
        }

        let conn = Connection::open(&path)
            .map_err(|e| AppError::Config(format!("Failed to open database: {}", e)))?;

        // Initialize schema
        init_schema(&conn)?;

        tracing::info!("Database initialized at {:?}", path);

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Insert a history entry
    pub async fn insert_history(&self, entry: &HistoryEntry) -> Result<i64, AppError> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT INTO history (text, timestamp, duration_ms, model_id, language, gpu_used) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                entry.text,
                entry.timestamp,
                entry.duration_ms as i64,
                entry.model_id,
                entry.language,
                entry.gpu_used as i32,
            ],
        )
        .map_err(|e| AppError::Config(format!("Failed to insert history: {}", e)))?;

        let id = conn.last_insert_rowid();

        // Also update FTS index
        conn.execute(
            "INSERT INTO history_fts (rowid, text) VALUES (?1, ?2)",
            params![id, entry.text],
        )
        .map_err(|e| AppError::Config(format!("Failed to update FTS index: {}", e)))?;

        Ok(id)
    }

    /// Get paginated history entries
    pub async fn get_history(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<HistoryEntry>, AppError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn
            .prepare(
                "SELECT id, text, timestamp, duration_ms, model_id, language, gpu_used
                 FROM history
                 ORDER BY timestamp DESC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| AppError::Config(format!("Failed to prepare query: {}", e)))?;

        let entries = stmt
            .query_map(params![limit as i64, offset as i64], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    timestamp: row.get(2)?,
                    duration_ms: row.get::<_, i64>(3)? as u64,
                    model_id: row.get(4)?,
                    language: row.get(5)?,
                    gpu_used: row.get::<_, i32>(6).unwrap_or(0) != 0,
                })
            })
            .map_err(|e| AppError::Config(format!("Failed to query history: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
    }

    /// Search history using FTS
    pub async fn search_history(&self, query: &str) -> Result<Vec<HistoryEntry>, AppError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn
            .prepare(
                "SELECT h.id, h.text, h.timestamp, h.duration_ms, h.model_id, h.language, h.gpu_used
                 FROM history h
                 JOIN history_fts fts ON h.id = fts.rowid
                 WHERE history_fts MATCH ?1
                 ORDER BY h.timestamp DESC
                 LIMIT 100",
            )
            .map_err(|e| AppError::Config(format!("Failed to prepare search query: {}", e)))?;

        let entries = stmt
            .query_map(params![query], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    timestamp: row.get(2)?,
                    duration_ms: row.get::<_, i64>(3)? as u64,
                    model_id: row.get(4)?,
                    language: row.get(5)?,
                    gpu_used: row.get::<_, i32>(6).unwrap_or(0) != 0,
                })
            })
            .map_err(|e| AppError::Config(format!("Failed to search history: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
    }

    /// Delete a single history entry
    pub async fn delete_entry(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().await;

        // Delete from FTS first
        conn.execute("DELETE FROM history_fts WHERE rowid = ?1", params![id])
            .map_err(|e| AppError::Config(format!("Failed to delete from FTS: {}", e)))?;

        // Delete from main table
        conn.execute("DELETE FROM history WHERE id = ?1", params![id])
            .map_err(|e| AppError::Config(format!("Failed to delete history entry: {}", e)))?;

        Ok(())
    }

    /// Clear all history
    pub async fn clear_all(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().await;

        conn.execute("DELETE FROM history_fts", [])
            .map_err(|e| AppError::Config(format!("Failed to clear FTS: {}", e)))?;

        conn.execute("DELETE FROM history", [])
            .map_err(|e| AppError::Config(format!("Failed to clear history: {}", e)))?;

        Ok(())
    }

    /// Prune history to keep only the most recent entries
    pub async fn prune_history(&self, max_entries: usize) -> Result<usize, AppError> {
        let conn = self.conn.lock().await;

        // Get IDs to delete
        let mut stmt = conn
            .prepare("SELECT id FROM history ORDER BY timestamp DESC LIMIT -1 OFFSET ?1")
            .map_err(|e| AppError::Config(format!("Failed to prepare prune query: {}", e)))?;

        let ids_to_delete: Vec<i64> = stmt
            .query_map(params![max_entries as i64], |row| row.get(0))
            .map_err(|e| AppError::Config(format!("Failed to query prune entries: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();

        let count = ids_to_delete.len();

        for id in ids_to_delete {
            conn.execute("DELETE FROM history_fts WHERE rowid = ?1", params![id])
                .ok();
            conn.execute("DELETE FROM history WHERE id = ?1", params![id])
                .ok();
        }

        if count > 0 {
            tracing::debug!("Pruned {} old history entries", count);
        }

        Ok(count)
    }

    /// Get total count of history entries
    pub async fn count(&self) -> Result<usize, AppError> {
        let conn = self.conn.lock().await;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM history", [], |row| row.get(0))
            .map_err(|e| AppError::Config(format!("Failed to count history: {}", e)))?;
        Ok(count as usize)
    }
}

/// Get the database file path
fn get_database_path() -> Result<PathBuf, AppError> {
    let proj_dirs = ProjectDirs::from("com", "ezflow", "EZ Flow")
        .ok_or_else(|| AppError::Config("Failed to get project directories".into()))?;

    let data_dir = proj_dirs.data_dir();
    Ok(data_dir.join("history.db"))
}

/// Initialize the database schema
fn init_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            model_id TEXT NOT NULL,
            language TEXT,
            gpu_used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC);

        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
            text,
            content='history',
            content_rowid='id'
        );
        "#,
    )
    .map_err(|e| AppError::Config(format!("Failed to initialize database schema: {}", e)))?;

    // Add gpu_used column if it doesn't exist (migration for existing databases)
    let _ = conn.execute(
        "ALTER TABLE history ADD COLUMN gpu_used INTEGER DEFAULT 0",
        [],
    );

    Ok(())
}

/// Database state wrapper for Tauri
pub struct DatabaseState {
    db: Option<Database>,
}

impl DatabaseState {
    /// Create a new database state
    pub fn new() -> Self {
        match Database::new() {
            Ok(db) => Self { db: Some(db) },
            Err(e) => {
                tracing::error!("Failed to initialize database: {}", e);
                Self { db: None }
            }
        }
    }

    /// Get a reference to the database (if available)
    pub fn get(&self) -> Option<&Database> {
        self.db.as_ref()
    }
}

impl Default for DatabaseState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_db() -> (Database, TempDir) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.db");
        let conn = Connection::open(&path).unwrap();
        init_schema(&conn).unwrap();
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        (db, dir) // Return dir to keep it alive
    }

    #[tokio::test]
    async fn test_insert_and_get_history() {
        let (db, _dir) = create_test_db();

        let entry = HistoryEntry {
            id: 0,
            text: "Hello world".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: Some("en".to_string()),
            gpu_used: true,
        };

        let id = db.insert_history(&entry).await.unwrap();
        assert!(id > 0);

        let entries = db.get_history(10, 0).await.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].text, "Hello world");
        assert!(entries[0].gpu_used);
    }

    #[tokio::test]
    async fn test_delete_entry() {
        let (db, _dir) = create_test_db();

        let entry = HistoryEntry {
            id: 0,
            text: "Test entry".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 500,
            model_id: "tiny".to_string(),
            language: None,
            gpu_used: false,
        };

        let id = db.insert_history(&entry).await.unwrap();
        db.delete_entry(id).await.unwrap();

        let entries = db.get_history(10, 0).await.unwrap();
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn test_clear_all() {
        let (db, _dir) = create_test_db();

        for i in 0..5 {
            let entry = HistoryEntry {
                id: 0,
                text: format!("Entry {}", i),
                timestamp: format!("2024-01-0{}T00:00:00Z", i + 1),
                duration_ms: 1000,
                model_id: "base".to_string(),
                language: None,
                gpu_used: i % 2 == 0, // Alternate GPU usage
            };
            db.insert_history(&entry).await.unwrap();
        }

        assert_eq!(db.count().await.unwrap(), 5);

        db.clear_all().await.unwrap();

        assert_eq!(db.count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_prune_history() {
        let (db, _dir) = create_test_db();

        // Insert 10 entries
        for i in 0..10 {
            let entry = HistoryEntry {
                id: 0,
                text: format!("Entry {}", i),
                timestamp: format!("2024-01-{:02}T00:00:00Z", i + 1),
                duration_ms: 1000,
                model_id: "base".to_string(),
                language: None,
                gpu_used: false,
            };
            db.insert_history(&entry).await.unwrap();
        }

        // Prune to keep only 5
        let pruned = db.prune_history(5).await.unwrap();
        assert_eq!(pruned, 5);

        // Should have 5 entries left
        assert_eq!(db.count().await.unwrap(), 5);
    }

    #[tokio::test]
    async fn test_search_history() {
        let (db, _dir) = create_test_db();

        let entry1 = HistoryEntry {
            id: 0,
            text: "Hello world".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: None,
            gpu_used: true,
        };
        db.insert_history(&entry1).await.unwrap();

        let entry2 = HistoryEntry {
            id: 0,
            text: "Goodbye world".to_string(),
            timestamp: "2024-01-02T00:00:00Z".to_string(),
            duration_ms: 1000,
            model_id: "base".to_string(),
            language: None,
            gpu_used: false,
        };
        db.insert_history(&entry2).await.unwrap();

        let results = db.search_history("Hello").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, "Hello world");
        assert!(results[0].gpu_used);
    }
}
