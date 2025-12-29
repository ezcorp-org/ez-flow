//! System tray service
//!
//! Handles system tray icon, menu, and events for EZ Flow.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};

/// Menu item IDs
pub mod menu_ids {
    pub const START_RECORDING: &str = "start_recording";
    pub const STOP_RECORDING: &str = "stop_recording";
    pub const TRANSCRIBE_FILE: &str = "transcribe_file";
    pub const HISTORY: &str = "history";
    pub const SETTINGS: &str = "settings";
    pub const ABOUT: &str = "about";
    pub const QUIT: &str = "quit";
}

/// Set up the system tray icon and menu
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Setting up system tray");

    // Create recording control menu items
    let start_recording = MenuItem::with_id(
        app,
        menu_ids::START_RECORDING,
        "Start Recording",
        true,
        None::<&str>,
    )?;
    let stop_recording = MenuItem::with_id(
        app,
        menu_ids::STOP_RECORDING,
        "Stop Recording",
        false, // Initially disabled
        None::<&str>,
    )?;
    let transcribe_file = MenuItem::with_id(
        app,
        menu_ids::TRANSCRIBE_FILE,
        "Transcribe File...",
        true,
        None::<&str>,
    )?;

    let history = MenuItem::with_id(
        app,
        menu_ids::HISTORY,
        "History...",
        true,
        None::<&str>,
    )?;

    let settings = MenuItem::with_id(
        app,
        menu_ids::SETTINGS,
        "Settings...",
        true,
        None::<&str>,
    )?;

    // Create other menu items
    let about = MenuItem::with_id(app, menu_ids::ABOUT, "About EZ Flow", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, menu_ids::QUIT, "Quit", true, None::<&str>)?;

    // Build menu with separators
    let menu = Menu::with_items(
        app,
        &[
            &start_recording,
            &stop_recording,
            &transcribe_file,
            &PredefinedMenuItem::separator(app)?,
            &history,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &about,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    // Get icon from app resources
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("No default icon found")?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("EZ Flow - Speech to Text")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .build(app)?;

    tracing::info!("System tray setup complete");
    Ok(())
}

/// Handle tray menu events
fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
    tracing::debug!("Tray menu event: {}", menu_id);

    match menu_id {
        menu_ids::START_RECORDING => {
            tracing::info!("Start recording requested from tray menu");
            // Recording is handled via Tauri commands, emit event for frontend
            let _ = app.emit("tray://start-recording", ());
        }
        menu_ids::STOP_RECORDING => {
            tracing::info!("Stop recording requested from tray menu");
            // Recording is handled via Tauri commands, emit event for frontend
            let _ = app.emit("tray://stop-recording", ());
        }
        menu_ids::TRANSCRIBE_FILE => {
            tracing::info!("Transcribe file requested from tray menu");
            // Emit event for frontend to open file picker
            let _ = app.emit("tray://transcribe-file", ());
        }
        menu_ids::HISTORY => {
            tracing::info!("History requested from tray menu");
            show_window(app, "history");
        }
        menu_ids::SETTINGS => {
            tracing::info!("Settings requested from tray menu");
            show_window(app, "settings");
        }
        menu_ids::ABOUT => {
            tracing::info!("About requested from tray menu");
            show_window(app, "main");
        }
        menu_ids::QUIT => {
            tracing::info!("Quit requested from tray menu");
            cleanup_and_exit(app);
        }
        _ => {
            tracing::warn!("Unknown menu event: {}", menu_id);
        }
    }
}

/// Show a window by label
fn show_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        // Show and focus the window
        if let Err(e) = window.show() {
            tracing::error!("Failed to show {} window: {}", label, e);
        }
        if let Err(e) = window.set_focus() {
            tracing::error!("Failed to focus {} window: {}", label, e);
        }
    } else {
        tracing::error!("Window '{}' not found", label);
    }
}

/// Clean up resources and exit the application
fn cleanup_and_exit<R: Runtime>(app: &AppHandle<R>) {
    tracing::info!("Performing clean shutdown");

    // Log shutdown
    tracing::info!("EZ Flow shutting down");

    // Exit the application
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_menu_ids_are_defined() {
        assert_eq!(menu_ids::START_RECORDING, "start_recording");
        assert_eq!(menu_ids::STOP_RECORDING, "stop_recording");
        assert_eq!(menu_ids::TRANSCRIBE_FILE, "transcribe_file");
        assert_eq!(menu_ids::HISTORY, "history");
        assert_eq!(menu_ids::SETTINGS, "settings");
        assert_eq!(menu_ids::ABOUT, "about");
        assert_eq!(menu_ids::QUIT, "quit");
    }
}
