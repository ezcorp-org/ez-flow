//! UI services for window management
//!
//! Handles recording indicator, preview window, and other UI windows.

pub mod indicator;
pub mod preview;

pub use indicator::{
    emit_audio_level, hide_indicator, position_indicator, show_indicator, IndicatorPosition,
};

pub use preview::{
    emit_preview_text, get_preview_position, hide_preview, position_preview, show_preview,
    PreviewState, PreviewTextPayload,
};
