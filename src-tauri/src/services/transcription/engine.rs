//! Whisper transcription engine
//!
//! Wraps whisper-rs for local speech-to-text inference.

use super::{ModelError, TranscriptionError, TranscriptionResult};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Whisper transcription engine
pub struct WhisperEngine {
    ctx: Option<WhisperContext>,
    model_id: String,
}

impl WhisperEngine {
    /// Create a new Whisper engine (no model loaded)
    pub fn new() -> Self {
        Self {
            ctx: None,
            model_id: String::new(),
        }
    }

    /// Check if a model is loaded
    pub fn is_loaded(&self) -> bool {
        self.ctx.is_some()
    }

    /// Get the currently loaded model ID
    pub fn model_id(&self) -> &str {
        &self.model_id
    }

    /// Load a Whisper model from a GGML file
    pub fn load_model(&mut self, path: &Path) -> Result<(), ModelError> {
        if !path.exists() {
            return Err(ModelError::NotFound(path.to_path_buf()));
        }

        let path_str = path.to_str().ok_or(ModelError::InvalidPath)?;

        tracing::info!("Loading Whisper model from: {}", path_str);

        let params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(path_str, params)
            .map_err(|e| ModelError::LoadFailed(e.to_string()))?;

        self.ctx = Some(ctx);
        self.model_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        tracing::info!("Whisper model loaded: {}", self.model_id);
        Ok(())
    }

    /// Unload the current model
    pub fn unload_model(&mut self) {
        self.ctx = None;
        self.model_id.clear();
        tracing::info!("Whisper model unloaded");
    }

    /// Transcribe audio samples (must be 16kHz mono f32)
    pub fn transcribe(&self, audio: &[f32]) -> Result<TranscriptionResult, TranscriptionError> {
        let ctx = self.ctx.as_ref().ok_or(TranscriptionError::ModelNotLoaded)?;

        if audio.is_empty() {
            return Err(TranscriptionError::InvalidAudioFile(
                "Empty audio buffer".to_string(),
            ));
        }

        tracing::debug!(
            "Transcribing {} samples ({:.2}s)",
            audio.len(),
            audio.len() as f32 / 16000.0
        );

        // Configure transcription parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_language(Some("auto"));

        // Create state and run inference
        let mut state = ctx
            .create_state()
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        state
            .full(params, audio)
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        // Collect results
        let num_segments = state
            .full_n_segments()
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        let mut text = String::new();
        for i in 0..num_segments {
            if let Ok(segment_text) = state.full_get_segment_text(i) {
                text.push_str(&segment_text);
            }
        }

        // Get detected language if available
        let language = state.full_lang_id_from_state().ok().and_then(|id| {
            whisper_rs::get_lang_str(id).map(|s| s.to_string())
        });

        let duration_ms = (audio.len() as f32 / 16.0) as u64;

        tracing::info!(
            "Transcription complete: {} chars, language: {:?}",
            text.len(),
            language
        );

        Ok(TranscriptionResult {
            text: text.trim().to_string(),
            duration_ms,
            model_id: self.model_id.clone(),
            language,
        })
    }
}

impl Default for WhisperEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe wrapper for the Whisper engine
pub struct SharedWhisperEngine {
    inner: Arc<Mutex<WhisperEngine>>,
}

impl SharedWhisperEngine {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(WhisperEngine::new())),
        }
    }

    pub async fn load_model(&self, path: &Path) -> Result<(), ModelError> {
        let path = path.to_path_buf();
        let mut engine = self.inner.lock().await;
        engine.load_model(&path)
    }

    pub async fn unload_model(&self) {
        let mut engine = self.inner.lock().await;
        engine.unload_model();
    }

    pub async fn is_loaded(&self) -> bool {
        let engine = self.inner.lock().await;
        engine.is_loaded()
    }

    pub async fn model_id(&self) -> String {
        let engine = self.inner.lock().await;
        engine.model_id().to_string()
    }

    pub async fn transcribe(&self, audio: Vec<f32>) -> Result<TranscriptionResult, TranscriptionError> {
        let engine = self.inner.lock().await;
        engine.transcribe(&audio)
    }
}

impl Default for SharedWhisperEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SharedWhisperEngine {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = WhisperEngine::new();
        assert!(!engine.is_loaded());
        assert!(engine.model_id().is_empty());
    }

    #[test]
    fn test_transcribe_without_model() {
        let engine = WhisperEngine::new();
        let result = engine.transcribe(&[0.0; 16000]);
        assert!(matches!(result, Err(TranscriptionError::ModelNotLoaded)));
    }

    #[test]
    fn test_load_nonexistent_model() {
        let mut engine = WhisperEngine::new();
        let result = engine.load_model(Path::new("/nonexistent/model.bin"));
        assert!(matches!(result, Err(ModelError::NotFound(_))));
    }
}
