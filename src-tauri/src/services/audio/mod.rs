//! Audio capture and processing services
//!
//! This module provides audio capture functionality for speech-to-text.

pub mod capture;
pub mod processing;

pub use capture::AudioCaptureService;
pub use processing::{resample_for_whisper, stereo_to_mono, AudioBuffer};

use thiserror::Error;

/// Errors that can occur during audio operations
#[derive(Error, Debug)]
pub enum AudioError {
    #[error("No input device available")]
    NoInputDevice,

    #[error("Microphone permission denied")]
    PermissionDenied,

    #[error("Device disconnected during recording")]
    DeviceDisconnected,

    #[error("Stream error: {0}")]
    StreamError(String),

    #[error("Resampling error: {0}")]
    ResampleError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Audio input device information
#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioDevice {
    pub name: String,
    pub is_default: bool,
}

/// Result of a recording session
#[derive(Debug, Clone, serde::Serialize)]
pub struct RecordingResult {
    pub file_path: String,
    pub duration_secs: f32,
    pub sample_rate: u32,
}

/// Microphone permission status
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionStatus {
    Granted,
    Denied,
    Unknown,
}
