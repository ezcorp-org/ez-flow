//! Global hotkey service
//!
//! Handles global keyboard shortcuts for push-to-talk recording.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during hotkey operations
#[derive(Error, Debug)]
pub enum HotkeyError {
    #[error("Hotkey '{0}' is already registered by another application")]
    Conflict(String),

    #[error("Failed to register hotkey: {0}")]
    RegistrationFailed(String),

    #[error("Invalid hotkey format: {0}")]
    InvalidFormat(String),

    #[error("Hotkey not registered")]
    NotRegistered,
}

/// Hotkey service state
pub struct HotkeyState {
    /// Currently registered hotkey string
    pub current_hotkey: Arc<RwLock<Option<String>>>,
    /// Whether recording is active via hotkey
    pub is_hotkey_recording: Arc<AtomicBool>,
    /// Whether hotkey registration succeeded
    pub is_registered: Arc<AtomicBool>,
    /// Last error message if registration failed
    pub last_error: Arc<RwLock<Option<String>>>,
}

impl Default for HotkeyState {
    fn default() -> Self {
        Self {
            current_hotkey: Arc::new(RwLock::new(None)),
            is_hotkey_recording: Arc::new(AtomicBool::new(false)),
            is_registered: Arc::new(AtomicBool::new(false)),
            last_error: Arc::new(RwLock::new(None)),
        }
    }
}

/// Get the default hotkey for the current platform
pub fn get_default_hotkey() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "Cmd+Shift+Space"
    }
    #[cfg(not(target_os = "macos"))]
    {
        "Ctrl+Shift+Space"
    }
}

/// Parse a hotkey string to Shortcut
fn parse_shortcut(hotkey: &str) -> Result<Shortcut, HotkeyError> {
    hotkey
        .parse()
        .map_err(|e| HotkeyError::InvalidFormat(format!("{:?}", e)))
}

/// Register the global hotkey with push-to-talk behavior
pub fn register_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    hotkey: &str,
    state: &HotkeyState,
) -> Result<(), HotkeyError> {
    tracing::info!("Registering global hotkey: {}", hotkey);

    // Parse the hotkey string
    let shortcut = parse_shortcut(hotkey)?;

    let is_recording = state.is_hotkey_recording.clone();

    // Register with the global shortcut manager
    let result =
        app.global_shortcut()
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                match event.state {
                    ShortcutState::Pressed => {
                        if !is_recording.load(Ordering::SeqCst) {
                            tracing::info!("Hotkey pressed - starting recording");
                            is_recording.store(true, Ordering::SeqCst);
                            let _ = app.emit("hotkey://recording-started", ());
                        }
                    }
                    ShortcutState::Released => {
                        if is_recording.load(Ordering::SeqCst) {
                            tracing::info!("Hotkey released - stopping recording");
                            is_recording.store(false, Ordering::SeqCst);
                            let _ = app.emit("hotkey://recording-stopped", ());
                        }
                    }
                }
            });

    match result {
        Ok(_) => {
            state.is_registered.store(true, Ordering::SeqCst);
            // Update current hotkey
            let hotkey_str = hotkey.to_string();
            let current = state.current_hotkey.clone();
            tauri::async_runtime::spawn(async move {
                *current.write().await = Some(hotkey_str);
            });
            tracing::info!("Global hotkey registered successfully: {}", hotkey);
            Ok(())
        }
        Err(e) => {
            let error_str = e.to_string();
            state.is_registered.store(false, Ordering::SeqCst);

            // Store error for later retrieval
            let last_error = state.last_error.clone();
            let err_clone = error_str.clone();
            tauri::async_runtime::spawn(async move {
                *last_error.write().await = Some(err_clone);
            });

            if error_str.contains("already") || error_str.contains("conflict") {
                tracing::warn!("Hotkey conflict detected: {}", hotkey);
                Err(HotkeyError::Conflict(hotkey.to_string()))
            } else {
                tracing::error!("Failed to register hotkey: {}", error_str);
                Err(HotkeyError::RegistrationFailed(error_str))
            }
        }
    }
}

/// Unregister the current hotkey
pub fn unregister_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    state: &HotkeyState,
) -> Result<(), HotkeyError> {
    let current = state.current_hotkey.clone();
    let is_registered = state.is_registered.clone();

    // Get current hotkey synchronously via blocking
    let hotkey_opt = tauri::async_runtime::block_on(async { current.read().await.clone() });

    if let Some(hotkey) = hotkey_opt {
        let shortcut = parse_shortcut(&hotkey)?;

        app.global_shortcut()
            .unregister(shortcut)
            .map_err(|e| HotkeyError::RegistrationFailed(e.to_string()))?;

        is_registered.store(false, Ordering::SeqCst);

        // Clear current hotkey
        tauri::async_runtime::spawn(async move {
            *current.write().await = None;
        });

        tracing::info!("Global hotkey unregistered: {}", hotkey);
        Ok(())
    } else {
        Err(HotkeyError::NotRegistered)
    }
}

/// Test if a hotkey is available (not conflicting)
pub fn test_hotkey<R: Runtime>(app: &AppHandle<R>, hotkey: &str) -> Result<bool, HotkeyError> {
    let shortcut = parse_shortcut(hotkey)?;

    // is_registered returns bool directly
    let is_registered = app.global_shortcut().is_registered(shortcut);
    Ok(!is_registered)
}

/// Setup hotkey on app startup with graceful degradation
pub fn setup_hotkey<R: Runtime>(app: &AppHandle<R>, state: &HotkeyState) {
    let hotkey = get_default_hotkey();

    match register_hotkey(app, hotkey, state) {
        Ok(_) => {
            tracing::info!("Push-to-talk hotkey enabled: {}", hotkey);
            let _ = app.emit("hotkey://registered", hotkey);
        }
        Err(e) => {
            tracing::warn!(
                "Failed to register hotkey '{}': {}. Push-to-talk disabled, use tray menu instead.",
                hotkey,
                e
            );
            let _ = app.emit("hotkey://registration-failed", e.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_hotkey_format() {
        let hotkey = get_default_hotkey();
        assert!(hotkey.contains("Shift"));
        assert!(hotkey.contains("Space"));

        #[cfg(target_os = "macos")]
        assert!(hotkey.contains("Cmd"));

        #[cfg(not(target_os = "macos"))]
        assert!(hotkey.contains("Ctrl"));
    }

    #[test]
    fn test_hotkey_state_default() {
        let state = HotkeyState::default();
        assert!(!state.is_registered.load(Ordering::SeqCst));
        assert!(!state.is_hotkey_recording.load(Ordering::SeqCst));
    }
}
