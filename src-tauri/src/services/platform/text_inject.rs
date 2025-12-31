//! Text injection trait and error types
//!
//! Provides platform-agnostic interface for injecting text at cursor position.

use thiserror::Error;

/// Errors that can occur during text injection operations
#[derive(Error, Debug)]
pub enum PlatformError {
    #[error("Clipboard error: {0}")]
    Clipboard(String),

    #[error("Failed to create event source")]
    EventSourceError,

    #[error("Command failed: {0}")]
    CommandFailed(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Text injection not supported on this platform")]
    NotSupported,
}

impl From<arboard::Error> for PlatformError {
    fn from(err: arboard::Error) -> Self {
        PlatformError::Clipboard(err.to_string())
    }
}

/// Platform-specific text injection interface
pub trait TextInjector: Send + Sync {
    /// Inject text into the currently focused application
    fn inject_text(&self, text: &str) -> Result<(), PlatformError>;

    /// Check if this platform supports clipboard-based injection
    fn supports_paste(&self) -> bool {
        true
    }

    /// Get platform-specific instructions for accessibility permissions
    fn get_permission_instructions(&self) -> Option<String> {
        None
    }

    /// Set the delay between keystrokes in milliseconds
    fn set_delay(&mut self, delay_ms: u32);

    /// Delete the last N characters (simulates backspace)
    fn delete_characters(&self, count: usize) -> Result<(), PlatformError>;

    /// Send undo command (Ctrl+Z on Windows/Linux, Cmd+Z on macOS)
    fn send_undo(&self) -> Result<(), PlatformError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_error_display() {
        let err = PlatformError::Clipboard("test error".to_string());
        assert!(err.to_string().contains("Clipboard error"));

        let err = PlatformError::CommandFailed("xdotool not found".to_string());
        assert!(err.to_string().contains("Command failed"));
    }
}
