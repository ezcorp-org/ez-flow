//! Application state management
//!
//! This module contains the shared application state.

use crate::models::Settings;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared application state
#[derive(Debug)]
pub struct AppState {
    /// Application settings
    pub settings: Arc<RwLock<Settings>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(RwLock::new(Settings::default())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_app_state_creation() {
        let state = AppState::new();
        let settings = state.settings.read().await;
        assert_eq!(settings.model_id, "base");
    }
}
