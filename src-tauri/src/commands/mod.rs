//! Tauri command handlers
//!
//! This module contains all Tauri command handlers that can be invoked from the frontend.

/// Simple greet command for testing IPC
#[tauri::command]
pub fn greet(name: &str) -> String {
    tracing::debug!("Greet command called with name: {}", name);
    format!("Hello, {}! Welcome to EZ Flow.", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert_eq!(result, "Hello, World! Welcome to EZ Flow.");
    }
}
