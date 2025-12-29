use tauri::Manager;
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
        .manage(commands::HotkeyState::default())
        .manage(services::platform::TextInjectorState::default())
        .manage(services::storage::SettingsState::default())
        .manage(services::storage::DatabaseState::default())
        .setup(|app| {
            // Set up system tray
            services::tray::setup_tray(app.handle())?;

            // Set up global hotkey with graceful degradation
            let hotkey_state = app.state::<commands::HotkeyState>();
            services::hotkey::setup_hotkey(app.handle(), &hotkey_state);

            tracing::info!("Application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            // Audio commands
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::audio::stop_recording_and_transcribe,
            commands::audio::get_audio_devices,
            commands::audio::check_microphone_permission,
            commands::audio::is_recording,
            commands::audio::get_recording_duration,
            // Transcription commands
            commands::transcription::load_whisper_model,
            commands::transcription::load_whisper_model_from_path,
            commands::transcription::unload_whisper_model,
            commands::transcription::is_model_loaded,
            commands::transcription::get_loaded_model_id,
            commands::transcription::transcribe_audio,
            commands::transcription::transcribe_samples,
            commands::transcription::get_models_directory,
            commands::transcription::check_model_exists,
            commands::transcription::list_available_models,
            // Model management commands
            commands::models::get_available_models,
            commands::models::get_downloaded_model_ids,
            commands::models::is_model_downloaded,
            commands::models::download_model,
            commands::models::delete_downloaded_model,
            commands::models::get_model_size,
            commands::models::validate_and_load_model,
            // Hotkey commands
            commands::hotkey::set_hotkey,
            commands::hotkey::clear_hotkey,
            commands::hotkey::get_current_hotkey,
            commands::hotkey::get_platform_default_hotkey,
            commands::hotkey::check_hotkey_available,
            commands::hotkey::is_hotkey_registered,
            commands::hotkey::get_hotkey_error,
            // Text injection commands
            commands::text_inject::inject_text,
            commands::text_inject::set_injection_delay,
            commands::text_inject::get_injection_permission_instructions,
            // Workflow commands
            commands::workflow::push_to_talk_complete,
            commands::workflow::is_push_to_talk_cooldown_active,
            commands::workflow::get_workflow_state,
            // Indicator commands
            commands::indicator::show_recording_indicator,
            commands::indicator::hide_recording_indicator,
            commands::indicator::set_indicator_position,
            commands::indicator::get_indicator_positions,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::update_setting,
            commands::settings::reset_settings,
            commands::settings::export_settings,
            commands::settings::import_settings,
            commands::settings::get_gpu_info,
            commands::settings::get_gpu_backend,
            commands::settings::is_gpu_available_cmd,
            commands::settings::get_supported_languages,
            // History commands
            commands::history::get_history,
            commands::history::search_history,
            commands::history::delete_history_entry,
            commands::history::clear_history,
            commands::history::get_history_count,
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
