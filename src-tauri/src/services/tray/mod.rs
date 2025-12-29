//! System tray service
//!
//! Handles system tray icon, menu, and events for EZ Flow.

use crate::commands::audio::{AudioCommand, AudioResponse, AudioState};
use crate::commands::TranscriptionState;
use crate::services::audio::processing::resample_for_whisper;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

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
            start_recording_from_tray(app);
        }
        menu_ids::STOP_RECORDING => {
            tracing::info!("Stop recording requested from tray menu");
            stop_recording_from_tray(app);
        }
        menu_ids::TRANSCRIBE_FILE => {
            tracing::info!("Transcribe file requested from tray menu");
            transcribe_file_from_tray(app);
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

/// Start recording from tray menu
fn start_recording_from_tray<R: Runtime>(app: &AppHandle<R>) {
    tracing::info!("Starting recording from tray menu");

    // Get the AudioState from the app
    let audio_state = app.state::<AudioState>();

    // Start recording directly
    match audio_state.send_command(AudioCommand::Start) {
        Ok(AudioResponse::Ok) => {
            tracing::info!("Recording started successfully from tray");
            // Emit event so UI can update (e.g., show indicator)
            let _ = app.emit("tray://recording-started", ());
        }
        Ok(AudioResponse::Error(e)) => {
            tracing::error!("Failed to start recording from tray: {}", e);
        }
        Ok(_) => {
            tracing::error!("Unexpected response when starting recording");
        }
        Err(e) => {
            tracing::error!("Error starting recording from tray: {}", e);
        }
    }
}

/// Stop recording and transcribe from tray menu
fn stop_recording_from_tray<R: Runtime>(app: &AppHandle<R>) {
    tracing::info!("Stopping recording and transcribing from tray menu");

    let audio_state = app.state::<AudioState>();
    let transcription_state = app.state::<TranscriptionState>();
    let app_handle = app.clone();

    // Stop recording
    let buffer = match audio_state.send_command(AudioCommand::Stop) {
        Ok(AudioResponse::Buffer(Ok(buf))) => buf,
        Ok(AudioResponse::Buffer(Err(e))) => {
            tracing::error!("Failed to stop recording: {}", e);
            let _ = app_handle.emit("tray://transcription-error", e);
            return;
        }
        Ok(_) => {
            tracing::error!("Unexpected response when stopping recording");
            return;
        }
        Err(e) => {
            tracing::error!("Error stopping recording: {}", e);
            let _ = app_handle.emit("tray://transcription-error", e);
            return;
        }
    };

    if buffer.samples.is_empty() {
        tracing::warn!("No audio recorded");
        let _ = app_handle.emit("tray://transcription-error", "No audio recorded");
        return;
    }

    // Resample to 16kHz for Whisper
    let samples = match resample_for_whisper(buffer) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to resample audio: {}", e);
            let _ = app_handle.emit("tray://transcription-error", e.to_string());
            return;
        }
    };

    // Clone the engine for the async task
    let engine = transcription_state.engine.clone();

    // Spawn async task for transcription
    tauri::async_runtime::spawn(async move {
        tracing::info!("Starting transcription...");
        match engine.transcribe(samples).await {
            Ok(result) => {
                tracing::info!("Transcription complete: {} chars", result.text.len());
                let _ = app_handle.emit("tray://transcription-complete", &result.text);
            }
            Err(e) => {
                tracing::error!("Transcription failed: {}", e);
                let _ = app_handle.emit("tray://transcription-error", e.to_string());
            }
        }
    });
}

/// Open file dialog and transcribe selected file
fn transcribe_file_from_tray<R: Runtime>(app: &AppHandle<R>) {
    tracing::info!("Opening file dialog for transcription");

    let app_handle = app.clone();

    // Open file dialog
    app.dialog()
        .file()
        .add_filter("Audio Files", &["wav", "mp3", "m4a", "ogg", "flac", "webm"])
        .pick_file(move |file_path| {
            let Some(path) = file_path else {
                tracing::info!("No file selected");
                return;
            };

            let path_str = path.to_string();
            tracing::info!("Selected file for transcription: {}", path_str);

            let transcription_state = app_handle.state::<TranscriptionState>();
            let engine = transcription_state.engine.clone();
            let app_for_emit = app_handle.clone();

            // Spawn async task for transcription
            tauri::async_runtime::spawn(async move {
                tracing::info!("Loading audio file: {}", path_str);

                // Read and decode the audio file
                match crate::services::transcription::decoder::decode_audio_file(std::path::Path::new(&path_str)) {
                    Ok(samples) => {
                        tracing::info!("Audio file decoded, {} samples", samples.len());

                        match engine.transcribe(samples).await {
                            Ok(result) => {
                                tracing::info!("File transcription complete: {} chars", result.text.len());
                                let _ = app_for_emit.emit("tray://transcription-complete", &result.text);
                            }
                            Err(e) => {
                                tracing::error!("File transcription failed: {}", e);
                                let _ = app_for_emit.emit("tray://transcription-error", e.to_string());
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to decode audio file: {}", e);
                        let _ = app_for_emit.emit("tray://transcription-error", e.to_string());
                    }
                }
            });
        });
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
