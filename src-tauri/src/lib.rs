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
        .invoke_handler(tauri::generate_handler![commands::greet])
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
