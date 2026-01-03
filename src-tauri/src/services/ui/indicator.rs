//! Recording indicator window management
//!
//! Handles positioning and visibility of the floating recording indicator.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow};

/// Position options for the recording indicator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum IndicatorPosition {
    /// Follow cursor position on recording start
    Cursor,
    /// Fixed position at top-right of screen
    #[default]
    TopRight,
    /// Fixed position at bottom-right of screen
    BottomRight,
    /// Don't show indicator
    Hidden,
}

/// Show the recording indicator window
pub fn show_indicator<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("recording-indicator") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the recording indicator window
pub fn hide_indicator<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("recording-indicator") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Position the indicator window based on settings
pub fn position_indicator<R: Runtime>(
    app: &AppHandle<R>,
    position: IndicatorPosition,
) -> Result<(), String> {
    let window = app
        .get_webview_window("recording-indicator")
        .ok_or_else(|| "Recording indicator window not found".to_string())?;

    match position {
        IndicatorPosition::TopRight => {
            position_top_right(&window)?;
        }
        IndicatorPosition::BottomRight => {
            position_bottom_right(&window)?;
        }
        IndicatorPosition::Cursor => {
            position_near_cursor(&window)?;
        }
        IndicatorPosition::Hidden => {
            // Don't show at all
            window.hide().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Position window at top-right corner
fn position_top_right<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let window_width = 220.0 * scale;
        let padding = 20.0 * scale;

        window
            .set_position(PhysicalPosition::new(
                size.width as f64 - window_width - padding,
                padding,
            ))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Position window at bottom-right corner
fn position_bottom_right<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let window_width = 220.0 * scale;
        let window_height = 68.0 * scale;
        let padding = 20.0 * scale;

        window
            .set_position(PhysicalPosition::new(
                size.width as f64 - window_width - padding,
                size.height as f64 - window_height - padding,
            ))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Position window near cursor
fn position_near_cursor<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if let Ok(pos) = window.cursor_position() {
        let offset = 20.0;
        window
            .set_position(PhysicalPosition::new(pos.x + offset, pos.y + offset))
            .map_err(|e| e.to_string())?;
    } else {
        // Fallback to top-right if cursor position unavailable
        position_top_right(window)?;
    }
    Ok(())
}

/// Emit audio level to the indicator window
pub fn emit_audio_level<R: Runtime>(app: &AppHandle<R>, level: f32) -> Result<(), String> {
    // Emit globally to all windows
    app.emit("recording:level", level)
        .map_err(|e| e.to_string())?;

    // Also emit specifically to the indicator window for redundancy
    if let Some(window) = app.get_webview_window("recording-indicator") {
        let _ = window.emit("recording:level", level);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_indicator_position_default() {
        assert_eq!(IndicatorPosition::default(), IndicatorPosition::TopRight);
    }

    #[test]
    fn test_indicator_position_serialization() {
        let pos = IndicatorPosition::Cursor;
        let json = serde_json::to_string(&pos).unwrap();
        assert_eq!(json, "\"cursor\"");

        let pos: IndicatorPosition = serde_json::from_str("\"bottom_right\"").unwrap();
        assert_eq!(pos, IndicatorPosition::BottomRight);
    }
}
