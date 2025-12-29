//! Storage services for data persistence
//!
//! Handles settings and other persistent data.

pub mod database;
pub mod settings;

pub use database::{Database, DatabaseState};
pub use settings::{
    get_settings_path, load_settings, save_settings, SettingsError, SettingsState,
};
