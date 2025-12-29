use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub mod commands;
pub mod error;
pub mod models;
pub mod services;
pub mod state;

/// Initialize tracing/logging for the application
fn init_logging() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(
            EnvFilter::from_default_env()
                .add_directive("ez_flow=debug".parse().unwrap())
                .add_directive("ez_flow_lib=debug".parse().unwrap()),
        )
        .init();

    tracing::info!("EZ Flow logging initialized");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

    tracing::info!("Starting EZ Flow application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(commands::AudioState::default())
        .manage(commands::TranscriptionState::default())
        .setup(|app| {
            // Set up system tray
            services::tray::setup_tray(app.handle())?;
            tracing::info!("Application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            // Audio commands
            commands::start_recording,
            commands::stop_recording,
            commands::stop_recording_and_transcribe,
            commands::get_audio_devices,
            commands::check_microphone_permission,
            commands::is_recording,
            commands::get_recording_duration,
            // Transcription commands
            commands::load_whisper_model,
            commands::load_whisper_model_from_path,
            commands::unload_whisper_model,
            commands::is_model_loaded,
            commands::get_loaded_model_id,
            commands::transcribe_audio,
            commands::transcribe_samples,
            commands::get_models_directory,
            commands::check_model_exists,
            commands::list_available_models,
            // Model management commands
            commands::get_available_models,
            commands::get_downloaded_model_ids,
            commands::is_model_downloaded,
            commands::download_model,
            commands::delete_downloaded_model,
            commands::get_model_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_placeholder() {
        assert!(true, "Placeholder test passes");
    }
}
