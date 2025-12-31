//! Platform-specific implementations
//!
//! Provides cross-platform abstractions for text injection and other platform features.

pub mod text_inject;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

// Re-export types for convenience
pub use text_inject::{PlatformError, TextInjector};

#[cfg(target_os = "linux")]
pub use linux::LinuxTextInjector;
#[cfg(target_os = "macos")]
pub use macos::MacOSTextInjector;
#[cfg(target_os = "windows")]
pub use windows::WindowsTextInjector;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Get the platform-specific text injector
pub fn get_text_injector() -> Result<Box<dyn TextInjector>, PlatformError> {
    #[cfg(target_os = "linux")]
    {
        Ok(Box::new(LinuxTextInjector::new()?))
    }

    #[cfg(target_os = "macos")]
    {
        Ok(Box::new(MacOSTextInjector::new()?))
    }

    #[cfg(target_os = "windows")]
    {
        Ok(Box::new(WindowsTextInjector::new()?))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err(PlatformError::NotSupported)
    }
}

/// Shared text injector state for use in Tauri commands
pub struct TextInjectorState {
    injector: Arc<Mutex<Box<dyn TextInjector>>>,
}

impl TextInjectorState {
    /// Create a new text injector state
    pub fn new() -> Result<Self, PlatformError> {
        let injector = get_text_injector()?;
        Ok(Self {
            injector: Arc::new(Mutex::new(injector)),
        })
    }

    /// Inject text using the platform-specific injector
    pub async fn inject_text(&self, text: &str) -> Result<(), PlatformError> {
        let injector = self.injector.lock().await;
        injector.inject_text(text)
    }

    /// Set the keystroke delay
    pub async fn set_delay(&self, delay_ms: u32) {
        let mut injector = self.injector.lock().await;
        injector.set_delay(delay_ms);
    }

    /// Get permission instructions if needed
    pub async fn get_permission_instructions(&self) -> Option<String> {
        let injector = self.injector.lock().await;
        injector.get_permission_instructions()
    }

    /// Delete the last N characters
    pub async fn delete_characters(&self, count: usize) -> Result<(), PlatformError> {
        let injector = self.injector.lock().await;
        injector.delete_characters(count)
    }

    /// Send undo command
    pub async fn send_undo(&self) -> Result<(), PlatformError> {
        let injector = self.injector.lock().await;
        injector.send_undo()
    }
}

impl Default for TextInjectorState {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            injector: Arc::new(Mutex::new(Box::new(StubInjector))),
        })
    }
}

/// Stub injector for when platform is not supported
struct StubInjector;

impl TextInjector for StubInjector {
    fn inject_text(&self, _text: &str) -> Result<(), PlatformError> {
        Err(PlatformError::NotSupported)
    }

    fn set_delay(&mut self, _delay_ms: u32) {}

    fn delete_characters(&self, _count: usize) -> Result<(), PlatformError> {
        Err(PlatformError::NotSupported)
    }

    fn send_undo(&self) -> Result<(), PlatformError> {
        Err(PlatformError::NotSupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_text_injector() {
        let injector = get_text_injector();
        // Should succeed on supported platforms
        #[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
        assert!(injector.is_ok());
    }

    #[tokio::test]
    async fn test_text_injector_state_creation() {
        let state = TextInjectorState::new();
        #[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
        assert!(state.is_ok());
    }
}
