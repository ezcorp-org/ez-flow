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
        .manage(commands::AudioState::default())
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
            commands::start_recording,
            commands::stop_recording,
            commands::get_audio_devices,
            commands::check_microphone_permission,
            commands::is_recording,
            commands::get_recording_duration,
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
