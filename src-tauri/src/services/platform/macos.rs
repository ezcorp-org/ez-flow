//! macOS-specific text injection implementation
//!
//! Uses CGEvent API to simulate Cmd+V after copying text to clipboard.

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

use super::text_inject::{PlatformError, TextInjector};

/// macOS text injector using clipboard + Cmd+V simulation
#[cfg(target_os = "macos")]
pub struct MacOSTextInjector {
    delay_ms: u32,
}

#[cfg(target_os = "macos")]
impl MacOSTextInjector {
    /// Create a new macOS text injector
    pub fn new() -> Result<Self, PlatformError> {
        Ok(Self { delay_ms: 0 })
    }
}

#[cfg(target_os = "macos")]
impl Default for MacOSTextInjector {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(target_os = "macos")]
impl TextInjector for MacOSTextInjector {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError> {
        if text.is_empty() {
            tracing::debug!("Empty text, nothing to inject");
            return Ok(());
        }

        tracing::info!("Injecting text ({} chars) via clipboard+paste", text.len());

        // Copy to clipboard using arboard
        let mut clipboard = arboard::Clipboard::new()?;
        clipboard.set_text(text)?;

        // Small delay for clipboard to update
        std::thread::sleep(std::time::Duration::from_millis(50 + self.delay_ms as u64));

        // Simulate Cmd+V using CGEvent
        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| PlatformError::EventSourceError)?;

        // Key codes: Command = 0x37 (55), V = 0x09 (9)
        const CMD_KEY: CGKeyCode = 0x37;
        const V_KEY: CGKeyCode = 0x09;

        // Create keyboard events
        let cmd_down = CGEvent::new_keyboard_event(source.clone(), CMD_KEY, true)
            .map_err(|_| PlatformError::EventSourceError)?;
        let v_down = CGEvent::new_keyboard_event(source.clone(), V_KEY, true)
            .map_err(|_| PlatformError::EventSourceError)?;
        let v_up = CGEvent::new_keyboard_event(source.clone(), V_KEY, false)
            .map_err(|_| PlatformError::EventSourceError)?;
        let cmd_up = CGEvent::new_keyboard_event(source, CMD_KEY, false)
            .map_err(|_| PlatformError::EventSourceError)?;

        // Set command flag on the V key events
        cmd_down.set_flags(CGEventFlags::CGEventFlagCommand);
        v_down.set_flags(CGEventFlags::CGEventFlagCommand);

        // Post events
        cmd_down.post(CGEventTapLocation::HID);
        v_down.post(CGEventTapLocation::HID);
        v_up.post(CGEventTapLocation::HID);
        cmd_up.post(CGEventTapLocation::HID);

        tracing::debug!("Text injected successfully via Cmd+V");
        Ok(())
    }

    fn set_delay(&mut self, delay_ms: u32) {
        self.delay_ms = delay_ms.min(50);
    }

    fn get_permission_instructions(&self) -> Option<String> {
        Some(
            "Grant Accessibility permissions: System Preferences > Security & Privacy > Privacy > Accessibility. Add this application to the list."
                .to_string(),
        )
    }
}

// Stub implementation for non-macOS platforms (for compilation)
#[cfg(not(target_os = "macos"))]
pub struct MacOSTextInjector;

#[cfg(not(target_os = "macos"))]
impl MacOSTextInjector {
    pub fn new() -> Result<Self, PlatformError> {
        Err(PlatformError::NotSupported)
    }
}

#[cfg(not(target_os = "macos"))]
impl Default for MacOSTextInjector {
    fn default() -> Self {
        Self
    }
}

#[cfg(not(target_os = "macos"))]
impl TextInjector for MacOSTextInjector {
    fn inject_text(&self, _text: &str) -> Result<(), PlatformError> {
        Err(PlatformError::NotSupported)
    }

    fn set_delay(&mut self, _delay_ms: u32) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn test_macos_injector_creation() {
        let injector = MacOSTextInjector::new();
        assert!(injector.is_ok());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_empty_text() {
        let injector = MacOSTextInjector::new().unwrap();
        let result = injector.inject_text("");
        assert!(result.is_ok());
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn test_macos_not_supported() {
        let injector = MacOSTextInjector::new();
        assert!(injector.is_err());
    }
}
