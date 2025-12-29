//! Recording indicator Tauri commands
//!
//! Commands for controlling the recording indicator window.

use crate::services::ui::{hide_indicator, position_indicator, show_indicator, IndicatorPosition};
use tauri::AppHandle;

/// Show the recording indicator window
#[tauri::command]
pub fn show_recording_indicator(app: AppHandle) -> Result<(), String> {
    tracing::debug!("Showing recording indicator");
    show_indicator(&app)
}

/// Hide the recording indicator window
#[tauri::command]
pub fn hide_recording_indicator(app: AppHandle) -> Result<(), String> {
    tracing::debug!("Hiding recording indicator");
    hide_indicator(&app)
}

/// Set the position of the recording indicator
#[tauri::command]
pub fn set_indicator_position(app: AppHandle, position: IndicatorPosition) -> Result<(), String> {
    tracing::debug!("Setting indicator position to: {:?}", position);
    position_indicator(&app, position)
}

/// Get available indicator position options
#[tauri::command]
pub fn get_indicator_positions() -> Vec<String> {
    vec![
        "cursor".to_string(),
        "top_right".to_string(),
        "bottom_right".to_string(),
        "hidden".to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_indicator_positions() {
        let positions = get_indicator_positions();
        assert_eq!(positions.len(), 4);
        assert!(positions.contains(&"cursor".to_string()));
        assert!(positions.contains(&"hidden".to_string()));
    }
}
