//! Linux-specific text injection implementation
//!
//! Uses xdotool for X11 and ydotool/wtype for Wayland.

use super::text_inject::{PlatformError, TextInjector};
use std::process::Command;

/// Display server type
#[derive(Debug, Clone, Copy)]
enum DisplayServer {
    X11,
    Wayland,
}

/// Linux text injector using clipboard + paste simulation
pub struct LinuxTextInjector {
    display_server: DisplayServer,
    delay_ms: u32,
}

impl LinuxTextInjector {
    /// Create a new Linux text injector
    pub fn new() -> Result<Self, PlatformError> {
        let display_server = if std::env::var("WAYLAND_DISPLAY").is_ok() {
            tracing::debug!("Detected Wayland display server");
            DisplayServer::Wayland
        } else {
            tracing::debug!("Detected X11 display server");
            DisplayServer::X11
        };

        Ok(Self {
            display_server,
            delay_ms: 0,
        })
    }

    /// Check if xdotool is available
    fn has_xdotool() -> bool {
        Command::new("which")
            .arg("xdotool")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Check if ydotool is available
    fn has_ydotool() -> bool {
        Command::new("which")
            .arg("ydotool")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Check if wtype is available (Wayland alternative)
    fn has_wtype() -> bool {
        Command::new("which")
            .arg("wtype")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Simulate Ctrl+V on X11 using xdotool
    fn paste_x11(&self) -> Result<(), PlatformError> {
        let status = Command::new("xdotool")
            .args(["key", "--clearmodifiers", "ctrl+v"])
            .status()
            .map_err(|e| PlatformError::CommandFailed(format!("xdotool: {}", e)))?;

        if !status.success() {
            return Err(PlatformError::CommandFailed(
                "xdotool command failed".to_string(),
            ));
        }

        Ok(())
    }

    /// Simulate Ctrl+V on Wayland using ydotool
    fn paste_wayland_ydotool(&self) -> Result<(), PlatformError> {
        // ydotool keycodes: 29=Ctrl, 47=V
        // Format: key <keycode>:<state> where state 1=down, 0=up
        let status = Command::new("ydotool")
            .args(["key", "29:1", "47:1", "47:0", "29:0"])
            .status()
            .map_err(|e| PlatformError::CommandFailed(format!("ydotool: {}", e)))?;

        if !status.success() {
            return Err(PlatformError::CommandFailed(
                "ydotool command failed".to_string(),
            ));
        }

        Ok(())
    }

    /// Simulate Ctrl+V on Wayland using wtype
    fn paste_wayland_wtype(&self) -> Result<(), PlatformError> {
        let status = Command::new("wtype")
            .args(["-M", "ctrl", "-P", "v", "-p", "v", "-m", "ctrl"])
            .status()
            .map_err(|e| PlatformError::CommandFailed(format!("wtype: {}", e)))?;

        if !status.success() {
            return Err(PlatformError::CommandFailed(
                "wtype command failed".to_string(),
            ));
        }

        Ok(())
    }
}

impl Default for LinuxTextInjector {
    fn default() -> Self {
        Self::new().unwrap_or(Self {
            display_server: DisplayServer::X11,
            delay_ms: 0,
        })
    }
}

impl TextInjector for LinuxTextInjector {
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

        // Simulate paste based on display server
        match self.display_server {
            DisplayServer::X11 => {
                if Self::has_xdotool() {
                    self.paste_x11()
                } else {
                    Err(PlatformError::CommandFailed(
                        "xdotool not found. Install with: sudo apt install xdotool".to_string(),
                    ))
                }
            }
            DisplayServer::Wayland => {
                if Self::has_ydotool() {
                    self.paste_wayland_ydotool()
                } else if Self::has_wtype() {
                    self.paste_wayland_wtype()
                } else {
                    Err(PlatformError::CommandFailed(
                        "Neither ydotool nor wtype found. Install with: sudo apt install ydotool or wtype".to_string(),
                    ))
                }
            }
        }
    }

    fn set_delay(&mut self, delay_ms: u32) {
        self.delay_ms = delay_ms.min(50); // Cap at 50ms as per story requirements
    }

    fn get_permission_instructions(&self) -> Option<String> {
        match self.display_server {
            DisplayServer::X11 => Some(
                "Ensure xdotool is installed: sudo apt install xdotool".to_string(),
            ),
            DisplayServer::Wayland => Some(
                "Ensure ydotool or wtype is installed. For ydotool, you may need to start ydotoold with sudo: sudo ydotoold".to_string(),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linux_injector_creation() {
        let injector = LinuxTextInjector::new();
        assert!(injector.is_ok());
    }

    #[test]
    fn test_display_server_detection() {
        let injector = LinuxTextInjector::new().unwrap();
        // Just ensure it picked something
        assert!(injector.supports_paste());
    }

    #[test]
    fn test_set_delay() {
        let mut injector = LinuxTextInjector::new().unwrap();
        injector.set_delay(25);
        assert_eq!(injector.delay_ms, 25);

        // Test capping at 50ms
        injector.set_delay(100);
        assert_eq!(injector.delay_ms, 50);
    }

    #[test]
    fn test_empty_text() {
        let injector = LinuxTextInjector::new().unwrap();
        // Empty text should succeed without doing anything
        let result = injector.inject_text("");
        assert!(result.is_ok());
    }
}
