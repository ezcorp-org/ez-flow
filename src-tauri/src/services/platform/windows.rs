//! Windows-specific text injection implementation
//!
//! Uses SendInput API to simulate Ctrl+V after copying text to clipboard.

use super::text_inject::{PlatformError, TextInjector};

#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    VIRTUAL_KEY, VK_CONTROL, VK_V,
};

/// Windows text injector using clipboard + Ctrl+V simulation
#[cfg(target_os = "windows")]
pub struct WindowsTextInjector {
    delay_ms: u32,
}

#[cfg(target_os = "windows")]
impl WindowsTextInjector {
    /// Create a new Windows text injector
    pub fn new() -> Result<Self, PlatformError> {
        Ok(Self { delay_ms: 0 })
    }

    /// Create a keyboard input event
    fn create_key_input(vk: VIRTUAL_KEY, key_up: bool) -> INPUT {
        let flags = if key_up {
            KEYEVENTF_KEYUP
        } else {
            KEYBD_EVENT_FLAGS::default()
        };

        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }
}

#[cfg(target_os = "windows")]
impl Default for WindowsTextInjector {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(target_os = "windows")]
impl TextInjector for WindowsTextInjector {
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

        // Simulate Ctrl+V using SendInput
        unsafe {
            let inputs = [
                Self::create_key_input(VK_CONTROL, false), // Ctrl down
                Self::create_key_input(VK_V, false),       // V down
                Self::create_key_input(VK_V, true),        // V up
                Self::create_key_input(VK_CONTROL, true),  // Ctrl up
            ];

            let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            if sent != inputs.len() as u32 {
                return Err(PlatformError::CommandFailed(format!(
                    "SendInput only sent {} of {} events",
                    sent,
                    inputs.len()
                )));
            }
        }

        tracing::debug!("Text injected successfully via Ctrl+V");
        Ok(())
    }

    fn set_delay(&mut self, delay_ms: u32) {
        self.delay_ms = delay_ms.min(50);
    }
}

// Stub implementation for non-Windows platforms (for compilation)
#[cfg(not(target_os = "windows"))]
pub struct WindowsTextInjector;

#[cfg(not(target_os = "windows"))]
impl WindowsTextInjector {
    pub fn new() -> Result<Self, PlatformError> {
        Err(PlatformError::NotSupported)
    }
}

#[cfg(not(target_os = "windows"))]
impl Default for WindowsTextInjector {
    fn default() -> Self {
        Self
    }
}

#[cfg(not(target_os = "windows"))]
impl TextInjector for WindowsTextInjector {
    fn inject_text(&self, _text: &str) -> Result<(), PlatformError> {
        Err(PlatformError::NotSupported)
    }

    fn set_delay(&mut self, _delay_ms: u32) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_injector_creation() {
        let injector = WindowsTextInjector::new();
        assert!(injector.is_ok());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_empty_text() {
        let injector = WindowsTextInjector::new().unwrap();
        let result = injector.inject_text("");
        assert!(result.is_ok());
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn test_windows_not_supported() {
        let injector = WindowsTextInjector::new();
        assert!(injector.is_err());
    }
}
