//! UI services for window management
//!
//! Handles recording indicator and other UI windows.

pub mod indicator;

pub use indicator::{
    emit_audio_level, hide_indicator, position_indicator, show_indicator, IndicatorPosition,
};
