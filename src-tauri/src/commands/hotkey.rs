//! Hotkey-related Tauri commands
//!
//! Provides commands for managing global keyboard shortcuts.

use crate::services::hotkey::{
    get_default_hotkey, register_hotkey, test_hotkey, unregister_hotkey, HotkeyState,
};
use tauri::{AppHandle, State};

/// Register a new global hotkey
#[tauri::command]
pub async fn set_hotkey(
    app: AppHandle,
    state: State<'_, HotkeyState>,
    hotkey: String,
) -> Result<(), String> {
    // First unregister existing hotkey if any
    let _ = unregister_hotkey(&app, &state);

    // Register new hotkey
    register_hotkey(&app, &hotkey, &state).map_err(|e| e.to_string())
}

/// Unregister the current global hotkey
#[tauri::command]
pub async fn clear_hotkey(app: AppHandle, state: State<'_, HotkeyState>) -> Result<(), String> {
    unregister_hotkey(&app, &state).map_err(|e| e.to_string())
}

/// Get the currently registered hotkey
#[tauri::command]
pub async fn get_current_hotkey(state: State<'_, HotkeyState>) -> Result<Option<String>, String> {
    Ok(state.current_hotkey.read().await.clone())
}

/// Get the default hotkey for this platform
#[tauri::command]
pub fn get_platform_default_hotkey() -> String {
    get_default_hotkey().to_string()
}

/// Check if a hotkey is available (not conflicting with other apps)
#[tauri::command]
pub async fn check_hotkey_available(app: AppHandle, hotkey: String) -> Result<bool, String> {
    test_hotkey(&app, &hotkey).map_err(|e| e.to_string())
}

/// Check if hotkey is currently registered
#[tauri::command]
pub async fn is_hotkey_registered(state: State<'_, HotkeyState>) -> Result<bool, String> {
    Ok(state
        .is_registered
        .load(std::sync::atomic::Ordering::SeqCst))
}

/// Get the last hotkey error if any
#[tauri::command]
pub async fn get_hotkey_error(state: State<'_, HotkeyState>) -> Result<Option<String>, String> {
    Ok(state.last_error.read().await.clone())
}
