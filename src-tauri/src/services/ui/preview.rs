//! Preview window management
//!
//! Handles the floating transcription preview window.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Preview text state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviewState {
    /// Showing preview of transcribed text
    Preview,
    /// Text is being injected
    Injecting,
    /// Text injection complete
    Complete,
    /// An error occurred
    Error,
}

/// Preview text event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTextPayload {
    /// The transcribed text to display
    pub text: String,
    /// Current state of the preview
    pub state: PreviewState,
}

/// Emit preview text to the preview window
pub fn emit_preview_text<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    state: PreviewState,
) -> Result<(), String> {
    app.emit(
        "preview://text",
        PreviewTextPayload {
            text: text.to_string(),
            state,
        },
    )
    .map_err(|e| e.to_string())
}

/// Get or create the preview window
pub fn get_or_create_preview<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    if let Some(window) = app.get_webview_window("preview") {
        return Ok(window);
    }

    // Create the preview window if it doesn't exist
    tracing::info!("Creating preview window");
    let window = WebviewWindowBuilder::new(app, "preview", WebviewUrl::App("/preview".into()))
        .title("Transcription Preview")
        .inner_size(480.0, 240.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(window)
}

/// Show the preview window (creates it if needed)
pub fn show_preview<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = get_or_create_preview(app)?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Show the preview window centered on screen
pub fn show_preview_centered<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = get_or_create_preview(app)?;

    // Center on screen
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let screen_size = monitor.size();
        let scale = monitor.scale_factor();
        let window_width = 480.0 * scale;
        let window_height = 240.0 * scale;

        let x = (screen_size.width as f64 - window_width) / 2.0;
        let y = (screen_size.height as f64 - window_height) / 2.0;

        window
            .set_position(PhysicalPosition::new(x as i32, y as i32))
            .map_err(|e| e.to_string())?;
    } else {
        // Fallback: try to center using window.center()
        window.center().map_err(|e| e.to_string())?;
    }

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Hide the preview window
pub fn hide_preview<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("preview") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Position the preview window at saved position or default
pub fn position_preview<R: Runtime>(
    app: &AppHandle<R>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("preview")
        .ok_or_else(|| "Preview window not found".to_string())?;

    match (x, y) {
        (Some(px), Some(py)) => {
            // Validate position is on screen
            if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
                let size = monitor.size();
                let scale = monitor.scale_factor();
                let window_width = 480.0 * scale;
                let window_height = 240.0 * scale;
                let screen_width = size.width as f64;
                let screen_height = size.height as f64;

                // Check if position is valid (at least 50% visible)
                let visible_x = (px as f64).max(-(window_width * 0.5)).min(screen_width - window_width * 0.5);
                let visible_y = (py as f64).max(0.0).min(screen_height - window_height * 0.5);

                // If position is too far off screen, use default
                if (px as f64 - visible_x).abs() > 100.0 || (py as f64 - visible_y).abs() > 100.0 {
                    return position_preview_top_right(&window);
                }

                window
                    .set_position(PhysicalPosition::new(px, py))
                    .map_err(|e| e.to_string())?;
            } else {
                window
                    .set_position(PhysicalPosition::new(px, py))
                    .map_err(|e| e.to_string())?;
            }
        }
        _ => {
            position_preview_top_right(&window)?;
        }
    }

    Ok(())
}

/// Position preview window at top-right corner
fn position_preview_top_right<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let window_width = 500.0 * scale; // Slightly larger to account for padding
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

/// Get the current position of the preview window
pub fn get_preview_position<R: Runtime>(app: &AppHandle<R>) -> Result<(i32, i32), String> {
    let window = app
        .get_webview_window("preview")
        .ok_or_else(|| "Preview window not found".to_string())?;

    let position = window.outer_position().map_err(|e| e.to_string())?;
    Ok((position.x, position.y))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preview_state_serialization() {
        let state = PreviewState::Injecting;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"injecting\"");

        let state: PreviewState = serde_json::from_str("\"complete\"").unwrap();
        assert_eq!(state, PreviewState::Complete);
    }

    #[test]
    fn test_preview_text_payload_serialization() {
        let payload = PreviewTextPayload {
            text: "Hello world".to_string(),
            state: PreviewState::Preview,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"text\":\"Hello world\""));
        assert!(json.contains("\"state\":\"preview\""));
    }
}
