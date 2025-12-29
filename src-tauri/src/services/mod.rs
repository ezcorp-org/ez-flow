//! Application services
//!
//! This module contains the core business logic services.

/// Placeholder for future audio capture service
pub mod audio {
    pub fn init() {
        tracing::debug!("Audio service placeholder initialized");
    }
}

/// Placeholder for future transcription service
pub mod transcription {
    pub fn init() {
        tracing::debug!("Transcription service placeholder initialized");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_services_init() {
        // Services init without panic
        super::audio::init();
        super::transcription::init();
    }
}
