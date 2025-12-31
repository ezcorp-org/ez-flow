//! Whisper transcription engine
//!
//! Wraps whisper-rs for local speech-to-text inference.

use super::gpu::{detect_gpu_backend, GpuBackend};
use super::{ModelError, TranscriptionError, TranscriptionResult};
use crate::services::audio::AudioChunk;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Result of transcribing a single audio chunk
#[derive(Debug, Clone, serde::Serialize)]
pub struct ChunkTranscriptionResult {
    /// Transcribed text from this chunk
    pub text: String,
    /// Sequential chunk index
    pub chunk_index: u32,
    /// Whether this is a partial (non-final) result
    pub is_partial: bool,
    /// Confidence score (0.0-1.0, currently estimated)
    pub confidence: f32,
    /// Timestamp in milliseconds from recording start
    pub timestamp_ms: u64,
}

/// Whisper transcription engine
pub struct WhisperEngine {
    ctx: Option<WhisperContext>,
    model_id: String,
    /// Current GPU backend in use
    gpu_backend: GpuBackend,
    /// Whether GPU is currently being used for inference
    using_gpu: bool,
}

impl WhisperEngine {
    /// Create a new Whisper engine (no model loaded)
    pub fn new() -> Self {
        let gpu_backend = detect_gpu_backend();
        Self {
            ctx: None,
            model_id: String::new(),
            gpu_backend,
            using_gpu: false,
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

    /// Check if GPU is being used
    pub fn is_using_gpu(&self) -> bool {
        self.using_gpu
    }

    /// Get the current GPU backend
    pub fn gpu_backend(&self) -> &GpuBackend {
        &self.gpu_backend
    }

    /// Load a Whisper model from a GGML file
    pub fn load_model(&mut self, path: &Path) -> Result<(), ModelError> {
        self.load_model_with_gpu(path, self.gpu_backend.is_gpu())
    }

    /// Load a Whisper model with explicit GPU preference
    pub fn load_model_with_gpu(&mut self, path: &Path, use_gpu: bool) -> Result<(), ModelError> {
        if !path.exists() {
            return Err(ModelError::NotFound(path.to_path_buf()));
        }

        let path_str = path.to_str().ok_or(ModelError::InvalidPath)?;

        tracing::info!(
            "Loading Whisper model from: {} (GPU: {})",
            path_str,
            use_gpu
        );

        let params = WhisperContextParameters::default();

        // Enable GPU if requested and available
        #[cfg(any(feature = "cuda", feature = "metal"))]
        if use_gpu && self.gpu_backend.is_gpu() {
            params = params.use_gpu(true);
            tracing::info!("GPU acceleration enabled: {:?}", self.gpu_backend);
        }

        match WhisperContext::new_with_params(path_str, params) {
            Ok(ctx) => {
                self.ctx = Some(ctx);
                self.using_gpu = use_gpu && self.gpu_backend.is_gpu();
                self.model_id = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                tracing::info!(
                    "Whisper model loaded: {} (GPU: {})",
                    self.model_id,
                    self.using_gpu
                );
                Ok(())
            }
            Err(e) if use_gpu => {
                // GPU initialization failed, fall back to CPU
                tracing::warn!("GPU initialization failed, falling back to CPU: {}", e);
                self.load_model_with_gpu(path, false)
            }
            Err(e) => Err(ModelError::LoadFailed(e.to_string())),
        }
    }

    /// Unload the current model
    pub fn unload_model(&mut self) {
        self.ctx = None;
        self.model_id.clear();
        self.using_gpu = false;
        tracing::info!("Whisper model unloaded");
    }

    /// Transcribe audio samples (must be 16kHz mono f32)
    pub fn transcribe(&self, audio: &[f32]) -> Result<TranscriptionResult, TranscriptionError> {
        self.transcribe_with_prompt(audio, None)
    }

    /// Transcribe audio samples with an optional initial prompt
    ///
    /// The initial prompt helps guide the model by providing context about
    /// the expected content, including custom vocabulary terms.
    pub fn transcribe_with_prompt(
        &self,
        audio: &[f32],
        initial_prompt: Option<&str>,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        let ctx = self
            .ctx
            .as_ref()
            .ok_or(TranscriptionError::ModelNotLoaded)?;

        if audio.is_empty() {
            return Err(TranscriptionError::InvalidAudioFile(
                "Empty audio buffer".to_string(),
            ));
        }

        let audio_duration_secs = audio.len() as f32 / 16000.0;
        tracing::debug!(
            "Transcribing {} samples ({:.2}s) with {} backend, prompt: {}",
            audio.len(),
            audio_duration_secs,
            self.gpu_backend.name(),
            initial_prompt.map(|p| format!("{}...", &p[..p.len().min(50)])).unwrap_or_else(|| "none".to_string())
        );

        let start_time = std::time::Instant::now();

        // Configure transcription parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_language(Some("auto"));

        // Set initial prompt if provided
        if let Some(prompt) = initial_prompt {
            params.set_initial_prompt(prompt);
            tracing::debug!("Set initial prompt for transcription");
        }

        // Create state and run inference
        let mut state = ctx
            .create_state()
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        state
            .full(params, audio)
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        let inference_duration = start_time.elapsed();

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
        let language = state
            .full_lang_id_from_state()
            .ok()
            .and_then(|id| whisper_rs::get_lang_str(id).map(|s| s.to_string()));

        let duration_ms = (audio.len() as f32 / 16.0) as u64;

        // Calculate real-time factor (RTF) - lower is better
        // RTF < 1 means faster than real-time
        let rtf = inference_duration.as_secs_f32() / audio_duration_secs;

        tracing::info!(
            "Transcription complete: {} chars in {:.2}s ({:.2}x real-time), backend: {}, GPU: {}",
            text.len(),
            inference_duration.as_secs_f32(),
            rtf,
            self.gpu_backend.name(),
            self.using_gpu
        );

        Ok(TranscriptionResult {
            text: text.trim().to_string(),
            duration_ms,
            model_id: self.model_id.clone(),
            language,
            gpu_used: self.using_gpu,
        })
    }

    /// Transcribe a single audio chunk with optional context from previous transcription
    ///
    /// This method is optimized for streaming transcription, processing smaller
    /// audio segments incrementally. The context parameter should contain the
    /// text from the previous chunk to improve transcription continuity.
    pub fn transcribe_chunk(
        &self,
        chunk: &AudioChunk,
        context: Option<&str>,
    ) -> Result<ChunkTranscriptionResult, TranscriptionError> {
        let ctx = self
            .ctx
            .as_ref()
            .ok_or(TranscriptionError::ModelNotLoaded)?;

        if chunk.is_empty() {
            return Ok(ChunkTranscriptionResult {
                text: String::new(),
                chunk_index: chunk.chunk_index,
                is_partial: true,
                confidence: 0.0,
                timestamp_ms: chunk.timestamp_ms,
            });
        }

        // Minimum samples for meaningful transcription (~0.5 seconds)
        const MIN_SAMPLES: usize = 8000;
        if chunk.samples.len() < MIN_SAMPLES {
            tracing::debug!(
                "Chunk {} too short ({} samples), returning empty",
                chunk.chunk_index,
                chunk.samples.len()
            );
            return Ok(ChunkTranscriptionResult {
                text: String::new(),
                chunk_index: chunk.chunk_index,
                is_partial: true,
                confidence: 0.0,
                timestamp_ms: chunk.timestamp_ms,
            });
        }

        let chunk_duration_secs = chunk.duration_secs();
        tracing::debug!(
            "Transcribing chunk {} ({} samples, {:.2}s), context: {}",
            chunk.chunk_index,
            chunk.samples.len(),
            chunk_duration_secs,
            context.map(|c| format!("{}...", &c[..c.len().min(30)])).unwrap_or_else(|| "none".to_string())
        );

        let start_time = std::time::Instant::now();

        // Configure parameters for chunk transcription
        // Use greedy sampling for speed in streaming mode
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_language(Some("auto"));

        // Use context from previous transcription as initial prompt
        // This helps maintain continuity between chunks
        if let Some(ctx_text) = context {
            if !ctx_text.is_empty() {
                // Take the last portion of context (Whisper has token limits)
                let context_suffix = if ctx_text.len() > 200 {
                    &ctx_text[ctx_text.len() - 200..]
                } else {
                    ctx_text
                };
                params.set_initial_prompt(context_suffix);
            }
        }

        // Create state and run inference
        let mut state = ctx
            .create_state()
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        state
            .full(params, &chunk.samples)
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        let inference_duration = start_time.elapsed();

        // Collect results
        let num_segments = state
            .full_n_segments()
            .map_err(|e| TranscriptionError::InferenceFailed(e.to_string()))?;

        let mut text = String::new();
        let mut total_tokens = 0;
        for i in 0..num_segments {
            if let Ok(segment_text) = state.full_get_segment_text(i) {
                text.push_str(&segment_text);
            }
            // Count tokens for confidence estimation
            if let Ok(n_tokens) = state.full_n_tokens(i) {
                total_tokens += n_tokens;
            }
        }

        // Estimate confidence based on transcription characteristics
        // This is a heuristic since whisper-rs doesn't expose per-token probabilities easily
        let confidence = estimate_chunk_confidence(&text, chunk_duration_secs, total_tokens);

        // Calculate real-time factor for logging
        let rtf = inference_duration.as_secs_f32() / chunk_duration_secs;

        tracing::debug!(
            "Chunk {} transcribed: {} chars in {:.2}s ({:.2}x real-time), confidence: {:.2}",
            chunk.chunk_index,
            text.len(),
            inference_duration.as_secs_f32(),
            rtf,
            confidence
        );

        Ok(ChunkTranscriptionResult {
            text: text.trim().to_string(),
            chunk_index: chunk.chunk_index,
            is_partial: true,
            confidence,
            timestamp_ms: chunk.timestamp_ms,
        })
    }
}

/// Estimate confidence for a chunk transcription based on heuristics
///
/// Returns a value between 0.0 and 1.0 indicating transcription quality.
fn estimate_chunk_confidence(text: &str, duration_secs: f32, token_count: i32) -> f32 {
    // Base confidence
    let mut confidence: f32 = 0.7;

    // Adjust based on text length relative to duration
    // Typical speech is ~2-3 words per second, ~5-6 chars per word
    let expected_chars = duration_secs * 15.0; // ~15 chars per second
    let actual_chars = text.len() as f32;

    if actual_chars > 0.0 {
        let ratio = actual_chars / expected_chars;
        // Penalize if too few or too many characters
        if ratio < 0.3 {
            confidence -= 0.2; // Too little text
        } else if ratio > 3.0 {
            confidence -= 0.15; // Too much text (possible hallucination)
        } else if (0.5..=2.0).contains(&ratio) {
            confidence += 0.1; // Good ratio
        }
    } else {
        confidence -= 0.3; // No text at all
    }

    // Adjust based on token density
    if token_count > 0 {
        let tokens_per_sec = token_count as f32 / duration_secs;
        if tokens_per_sec > 10.0 {
            confidence -= 0.1; // Suspiciously high token rate
        }
    }

    // Check for common issues
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return 0.0;
    }

    // Repeated patterns often indicate hallucination
    if has_repetition(trimmed) {
        confidence -= 0.2;
    }

    confidence.clamp(0.0, 1.0)
}

/// Check if text has suspicious repetition patterns
fn has_repetition(text: &str) -> bool {
    if text.len() < 20 {
        return false;
    }

    // Check for repeated substrings
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() >= 4 {
        // Check for consecutive word repetition
        for i in 0..words.len() - 3 {
            if words[i] == words[i + 1]
                && words[i + 1] == words[i + 2]
                && words[i + 2] == words[i + 3]
            {
                return true;
            }
        }
    }

    false
}

/// Build an initial prompt from custom vocabulary and context prompt
///
/// The prompt is constructed by joining vocabulary terms with commas
/// and appending the context prompt if provided.
pub fn build_initial_prompt(
    vocabulary: &[String],
    context_prompt: Option<&str>,
    use_context_prompt: bool,
) -> Option<String> {
    let mut parts = Vec::new();

    // Add vocabulary terms
    if !vocabulary.is_empty() {
        parts.push(vocabulary.join(", "));
    }

    // Add context prompt if enabled
    if use_context_prompt {
        if let Some(prompt) = context_prompt {
            if !prompt.is_empty() {
                parts.push(prompt.to_string());
            }
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(". "))
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

    pub async fn transcribe(
        &self,
        audio: Vec<f32>,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        let engine = self.inner.lock().await;
        engine.transcribe(&audio)
    }

    /// Transcribe audio with an optional initial prompt
    pub async fn transcribe_with_prompt(
        &self,
        audio: Vec<f32>,
        initial_prompt: Option<&str>,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        let engine = self.inner.lock().await;
        engine.transcribe_with_prompt(&audio, initial_prompt)
    }

    /// Transcribe with automatic model loading fallback
    ///
    /// If no model is loaded, attempts to load the model specified by model_id.
    /// This provides lazy loading capability for scenarios where the model
    /// wasn't loaded at startup.
    pub async fn transcribe_with_auto_load(
        &self,
        audio: Vec<f32>,
        model_id: &str,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        self.transcribe_with_auto_load_and_prompt(audio, model_id, None).await
    }

    /// Transcribe with automatic model loading fallback and an optional initial prompt
    ///
    /// If no model is loaded, attempts to load the model specified by model_id.
    /// The initial prompt helps guide the model with custom vocabulary and context.
    pub async fn transcribe_with_auto_load_and_prompt(
        &self,
        audio: Vec<f32>,
        model_id: &str,
        initial_prompt: Option<&str>,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        let mut engine = self.inner.lock().await;

        // If model is not loaded, attempt lazy loading
        if !engine.is_loaded() {
            tracing::info!(
                "No model loaded, attempting lazy load of model: {}",
                model_id
            );

            let model_path = super::get_model_path(model_id);

            if !model_path.exists() {
                tracing::error!("Model file not found for lazy loading: {:?}", model_path);
                return Err(TranscriptionError::ModelNotLoaded);
            }

            match engine.load_model(&model_path) {
                Ok(_) => {
                    tracing::info!("Lazy loaded model {} successfully", model_id);
                }
                Err(e) => {
                    tracing::error!("Failed to lazy load model {}: {}", model_id, e);
                    return Err(TranscriptionError::ModelNotLoaded);
                }
            }
        }

        engine.transcribe_with_prompt(&audio, initial_prompt)
    }

    /// Transcribe a single audio chunk for streaming
    ///
    /// This method is optimized for incremental transcription during recording.
    /// It uses context from previous transcriptions to maintain continuity.
    pub async fn transcribe_chunk(
        &self,
        chunk: &AudioChunk,
        context: Option<&str>,
    ) -> Result<ChunkTranscriptionResult, TranscriptionError> {
        let engine = self.inner.lock().await;
        engine.transcribe_chunk(chunk, context)
    }

    /// Transcribe a chunk with automatic model loading
    ///
    /// If no model is loaded, attempts to load the specified model first.
    pub async fn transcribe_chunk_with_auto_load(
        &self,
        chunk: &AudioChunk,
        model_id: &str,
        context: Option<&str>,
    ) -> Result<ChunkTranscriptionResult, TranscriptionError> {
        let mut engine = self.inner.lock().await;

        // If model is not loaded, attempt lazy loading
        if !engine.is_loaded() {
            tracing::info!(
                "No model loaded for chunk transcription, attempting lazy load: {}",
                model_id
            );

            let model_path = super::get_model_path(model_id);

            if !model_path.exists() {
                tracing::error!("Model file not found for lazy loading: {:?}", model_path);
                return Err(TranscriptionError::ModelNotLoaded);
            }

            match engine.load_model(&model_path) {
                Ok(_) => {
                    tracing::info!("Lazy loaded model {} for chunk transcription", model_id);
                }
                Err(e) => {
                    tracing::error!("Failed to lazy load model {}: {}", model_id, e);
                    return Err(TranscriptionError::ModelNotLoaded);
                }
            }
        }

        engine.transcribe_chunk(chunk, context)
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

    #[test]
    fn test_shared_engine_creation() {
        let engine = SharedWhisperEngine::new();
        // SharedWhisperEngine should be clonable
        let _engine_clone = engine.clone();
    }

    #[tokio::test]
    async fn test_shared_engine_is_loaded_default() {
        let engine = SharedWhisperEngine::new();
        assert!(!engine.is_loaded().await);
    }

    #[tokio::test]
    async fn test_shared_engine_model_id_default() {
        let engine = SharedWhisperEngine::new();
        assert!(engine.model_id().await.is_empty());
    }

    #[tokio::test]
    async fn test_transcribe_with_auto_load_missing_model() {
        let engine = SharedWhisperEngine::new();
        // Should return ModelNotLoaded when model file doesn't exist
        let result = engine
            .transcribe_with_auto_load(vec![0.0; 16000], "nonexistent_model")
            .await;
        assert!(matches!(result, Err(TranscriptionError::ModelNotLoaded)));
    }

    #[tokio::test]
    async fn test_shared_engine_transcribe_without_model() {
        let engine = SharedWhisperEngine::new();
        let result = engine.transcribe(vec![0.0; 16000]).await;
        assert!(matches!(result, Err(TranscriptionError::ModelNotLoaded)));
    }

    #[test]
    fn test_build_initial_prompt_empty() {
        let result = build_initial_prompt(&[], None, false);
        assert!(result.is_none());
    }

    #[test]
    fn test_build_initial_prompt_vocabulary_only() {
        let vocab = vec!["HIPAA".to_string(), "EHR".to_string(), "COVID-19".to_string()];
        let result = build_initial_prompt(&vocab, None, false);
        assert_eq!(result, Some("HIPAA, EHR, COVID-19".to_string()));
    }

    #[test]
    fn test_build_initial_prompt_context_only() {
        let context = "Medical transcription context";
        let result = build_initial_prompt(&[], Some(context), true);
        assert_eq!(result, Some("Medical transcription context".to_string()));
    }

    #[test]
    fn test_build_initial_prompt_both() {
        let vocab = vec!["HIPAA".to_string(), "EHR".to_string()];
        let context = "This is a medical transcription.";
        let result = build_initial_prompt(&vocab, Some(context), true);
        assert_eq!(result, Some("HIPAA, EHR. This is a medical transcription.".to_string()));
    }

    #[test]
    fn test_build_initial_prompt_context_disabled() {
        let vocab = vec!["API".to_string()];
        let context = "Technical context";
        // Context prompt disabled - should only include vocabulary
        let result = build_initial_prompt(&vocab, Some(context), false);
        assert_eq!(result, Some("API".to_string()));
    }

    #[test]
    fn test_build_initial_prompt_empty_context() {
        let vocab = vec!["Term1".to_string()];
        // Empty context string should be ignored
        let result = build_initial_prompt(&vocab, Some(""), true);
        assert_eq!(result, Some("Term1".to_string()));
    }

    #[test]
    fn test_build_initial_prompt_no_vocabulary_with_context() {
        let context = "Legal proceedings transcription";
        let result = build_initial_prompt(&[], Some(context), true);
        assert_eq!(result, Some("Legal proceedings transcription".to_string()));
    }

    #[test]
    fn test_estimate_chunk_confidence_empty_text() {
        let confidence = estimate_chunk_confidence("", 2.0, 0);
        assert_eq!(confidence, 0.0);
    }

    #[test]
    fn test_estimate_chunk_confidence_normal_text() {
        // 2 seconds of audio with ~30 chars of text (normal speech)
        let confidence = estimate_chunk_confidence("Hello, this is a test sentence.", 2.0, 10);
        assert!(confidence > 0.5, "Expected confidence > 0.5, got {}", confidence);
    }

    #[test]
    fn test_estimate_chunk_confidence_too_little_text() {
        // 5 seconds of audio with only 10 chars (suspicious)
        let confidence = estimate_chunk_confidence("Hi there.", 5.0, 3);
        assert!(confidence < 0.7, "Expected confidence < 0.7 for too little text, got {}", confidence);
    }

    #[test]
    fn test_has_repetition_no_repetition() {
        assert!(!has_repetition("This is a normal sentence with no repeated words."));
    }

    #[test]
    fn test_has_repetition_with_repetition() {
        assert!(has_repetition("The the the the same word repeated four times."));
    }

    #[test]
    fn test_has_repetition_short_text() {
        // Short text should not trigger repetition check
        assert!(!has_repetition("Short text"));
    }

    #[test]
    fn test_chunk_transcription_result_serialization() {
        let result = ChunkTranscriptionResult {
            text: "Hello world".to_string(),
            chunk_index: 0,
            is_partial: true,
            confidence: 0.85,
            timestamp_ms: 1000,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Hello world"));
        assert!(json.contains("\"chunk_index\":0"));
        assert!(json.contains("\"is_partial\":true"));
    }

    #[test]
    fn test_transcribe_chunk_without_model() {
        let engine = WhisperEngine::new();
        let chunk = AudioChunk::new(vec![0.0; 32000], 16000, 0, 0, false);
        let result = engine.transcribe_chunk(&chunk, None);
        assert!(matches!(result, Err(TranscriptionError::ModelNotLoaded)));
    }

    #[test]
    fn test_transcribe_empty_chunk() {
        // Empty chunks should return empty result without model needed
        // (handled before model check)
        let engine = WhisperEngine::new();
        let chunk = AudioChunk::new(vec![], 16000, 0, 0, false);
        // This will still fail due to model not loaded since we don't short-circuit
        // before the model check for safety
        let result = engine.transcribe_chunk(&chunk, None);
        // Empty chunk with no model should return ModelNotLoaded since model is checked first
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_shared_engine_transcribe_chunk_without_model() {
        let engine = SharedWhisperEngine::new();
        let chunk = AudioChunk::new(vec![0.0; 32000], 16000, 0, 0, false);
        let result = engine.transcribe_chunk(&chunk, None).await;
        assert!(matches!(result, Err(TranscriptionError::ModelNotLoaded)));
    }
}
