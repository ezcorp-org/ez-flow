//! Text injection Tauri commands
//!
//! Exposes text injection functionality to the frontend.

use crate::services::platform::TextInjectorState;
use tauri::State;

/// Inject text at the current cursor position
#[tauri::command]
pub async fn inject_text(
    text: String,
    state: State<'_, TextInjectorState>,
) -> Result<(), String> {
    tracing::info!("inject_text command called with {} chars", text.len());

    state
        .inject_text(&text)
        .await
        .map_err(|e| e.to_string())
}

/// Set the keystroke delay for text injection
#[tauri::command]
pub async fn set_injection_delay(
    delay_ms: u32,
    state: State<'_, TextInjectorState>,
) -> Result<(), String> {
    tracing::debug!("Setting injection delay to {}ms", delay_ms);
    state.set_delay(delay_ms).await;
    Ok(())
}

/// Get permission instructions for text injection (if needed)
#[tauri::command]
pub async fn get_injection_permission_instructions(
    state: State<'_, TextInjectorState>,
) -> Result<Option<String>, String> {
    Ok(state.get_permission_instructions().await)
}

#[cfg(test)]
mod tests {
    // Command tests require Tauri runtime, tested via integration tests
}
