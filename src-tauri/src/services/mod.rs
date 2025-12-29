//! Application services
//!
//! This module contains the core business logic services.

pub mod audio;
pub mod tray;

/// Placeholder for future transcription service
pub mod transcription {
    pub fn init() {
        tracing::debug!("Transcription service placeholder initialized");
    }
}
