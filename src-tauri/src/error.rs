//! Application error types
//!
//! This module defines the error types used throughout the application.

use thiserror::Error;

/// Main application error type
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// Result type alias for application operations
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::Config("test error".to_string());
        assert_eq!(err.to_string(), "Configuration error: test error");
    }
}
