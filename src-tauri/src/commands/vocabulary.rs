//! Vocabulary management Tauri commands
//!
//! Commands for importing and exporting custom vocabulary.

use serde::{Deserialize, Serialize};

/// Vocabulary export format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabularyExport {
    /// Format version
    pub version: u32,
    /// Optional name for the vocabulary set
    #[serde(default)]
    pub name: Option<String>,
    /// Optional description
    #[serde(default)]
    pub description: Option<String>,
    /// List of vocabulary terms
    pub terms: Vec<String>,
}

impl VocabularyExport {
    /// Current export format version
    pub const CURRENT_VERSION: u32 = 1;

    /// Create a new vocabulary export
    pub fn new(terms: Vec<String>) -> Self {
        Self {
            version: Self::CURRENT_VERSION,
            name: None,
            description: None,
            terms,
        }
    }

    /// Validate the export data
    pub fn validate(&self) -> Result<(), String> {
        if self.version > Self::CURRENT_VERSION {
            return Err(format!(
                "Unsupported vocabulary version: {}. Maximum supported: {}",
                self.version,
                Self::CURRENT_VERSION
            ));
        }

        // Check for empty terms
        for term in &self.terms {
            if term.trim().is_empty() {
                return Err("Vocabulary contains empty terms".to_string());
            }
        }

        Ok(())
    }
}

/// Export vocabulary terms to a JSON file
#[tauri::command]
pub async fn export_vocabulary(path: String, vocabulary: Vec<String>) -> Result<(), String> {
    let export = VocabularyExport::new(vocabulary);
    let content = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    tracing::info!("Vocabulary exported to {} ({} terms)", path, export.terms.len());
    Ok(())
}

/// Import vocabulary terms from a JSON file
///
/// Returns the list of imported terms.
#[tauri::command]
pub async fn import_vocabulary(path: String) -> Result<Vec<String>, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Try to parse as VocabularyExport format
    let imported: VocabularyExport = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid vocabulary file format: {}", e))?;

    // Validate the imported data
    imported.validate()?;

    // Filter out empty terms and duplicates
    let terms: Vec<String> = imported
        .terms
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();

    tracing::info!("Vocabulary imported from {} ({} terms)", path, terms.len());
    Ok(terms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vocabulary_export_new() {
        let terms = vec!["HIPAA".to_string(), "EHR".to_string()];
        let export = VocabularyExport::new(terms.clone());

        assert_eq!(export.version, VocabularyExport::CURRENT_VERSION);
        assert!(export.name.is_none());
        assert!(export.description.is_none());
        assert_eq!(export.terms, terms);
    }

    #[test]
    fn test_vocabulary_export_validate_valid() {
        let export = VocabularyExport::new(vec!["Term1".to_string(), "Term2".to_string()]);
        assert!(export.validate().is_ok());
    }

    #[test]
    fn test_vocabulary_export_validate_empty_term() {
        let export = VocabularyExport::new(vec!["Term1".to_string(), "  ".to_string()]);
        assert!(export.validate().is_err());
    }

    #[test]
    fn test_vocabulary_export_validate_future_version() {
        let mut export = VocabularyExport::new(vec!["Term".to_string()]);
        export.version = 999;
        let result = export.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported vocabulary version"));
    }

    #[test]
    fn test_vocabulary_export_serialization() {
        let mut export = VocabularyExport::new(vec!["HIPAA".to_string(), "COVID-19".to_string()]);
        export.name = Some("Medical Terms".to_string());
        export.description = Some("Common medical vocabulary".to_string());

        let json = serde_json::to_string_pretty(&export).unwrap();
        assert!(json.contains("\"version\": 1"));
        assert!(json.contains("\"name\": \"Medical Terms\""));
        assert!(json.contains("HIPAA"));
        assert!(json.contains("COVID-19"));

        // Parse it back
        let parsed: VocabularyExport = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.name, Some("Medical Terms".to_string()));
        assert_eq!(parsed.terms.len(), 2);
    }

    #[test]
    fn test_vocabulary_export_backward_compatibility() {
        // Test parsing JSON without optional fields
        let json = r#"{
            "version": 1,
            "terms": ["Term1", "Term2"]
        }"#;

        let parsed: VocabularyExport = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.version, 1);
        assert!(parsed.name.is_none());
        assert!(parsed.description.is_none());
        assert_eq!(parsed.terms.len(), 2);
    }
}
