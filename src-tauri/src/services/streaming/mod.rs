//! Streaming transcription service
//!
//! Manages real-time streaming transcription during recording,
//! emitting partial results as audio chunks become available.

use crate::models::StreamingMode;
use crate::services::audio::AudioChunk;
use crate::services::transcription::{ChunkTranscriptionResult, SharedWhisperEngine, TranscriptionError};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::{Mutex, RwLock};

/// Event name for partial transcription results
pub const EVENT_PARTIAL: &str = "transcription://partial";

/// Event name for final transcription result
pub const EVENT_COMPLETE: &str = "transcription://complete";

/// Event name for streaming errors
pub const EVENT_ERROR: &str = "transcription://error";

/// Maximum emission rate (events per second)
const MAX_EMIT_RATE_PER_SEC: u32 = 3;

/// Minimum interval between emissions in milliseconds
const MIN_EMIT_INTERVAL_MS: u64 = 333; // ~3 per second

/// Partial transcription event payload
#[derive(Debug, Clone, Serialize)]
pub struct PartialTranscriptionEvent {
    /// Accumulated transcribed text so far
    pub text: String,
    /// Index of the latest chunk included
    pub chunk_index: u32,
    /// Timestamp in milliseconds from recording start
    pub timestamp_ms: u64,
    /// Whether this is the final result
    pub is_final: bool,
}

/// Final transcription event payload
#[derive(Debug, Clone, Serialize)]
pub struct FinalTranscriptionEvent {
    /// Final transcribed text
    pub text: String,
    /// Total number of chunks processed
    pub total_chunks: u32,
    /// Total audio duration in seconds
    pub duration_secs: f32,
    /// Whether final reconciliation was performed
    pub reconciled: bool,
}

/// Streaming transcription error event payload
#[derive(Debug, Clone, Serialize)]
pub struct StreamingErrorEvent {
    /// Error message
    pub message: String,
    /// Chunk index where error occurred (if applicable)
    pub chunk_index: Option<u32>,
}

/// Streaming transcription service state
pub struct StreamingTranscriptionService {
    /// Accumulated transcription text from all chunks
    accumulated_text: Arc<RwLock<String>>,
    /// Last chunk index that was transcribed
    last_chunk_index: Arc<AtomicU32>,
    /// Whether streaming is currently active
    is_active: Arc<AtomicBool>,
    /// Context for next chunk transcription
    last_context: Arc<RwLock<Option<String>>>,
    /// Last emission time for rate limiting
    last_emit_time: Arc<Mutex<Instant>>,
    /// Number of chunks processed
    chunks_processed: Arc<AtomicU32>,
    /// Streaming mode setting
    mode: Arc<RwLock<StreamingMode>>,
}

impl StreamingTranscriptionService {
    /// Create a new streaming transcription service
    pub fn new() -> Self {
        Self {
            accumulated_text: Arc::new(RwLock::new(String::new())),
            last_chunk_index: Arc::new(AtomicU32::new(0)),
            is_active: Arc::new(AtomicBool::new(false)),
            last_context: Arc::new(RwLock::new(None)),
            last_emit_time: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1))),
            chunks_processed: Arc::new(AtomicU32::new(0)),
            mode: Arc::new(RwLock::new(StreamingMode::default())),
        }
    }

    /// Start a new streaming session
    pub async fn start(&self, mode: StreamingMode) {
        self.accumulated_text.write().await.clear();
        self.last_chunk_index.store(0, Ordering::SeqCst);
        self.is_active.store(true, Ordering::SeqCst);
        *self.last_context.write().await = None;
        *self.last_emit_time.lock().await = Instant::now() - Duration::from_secs(1);
        self.chunks_processed.store(0, Ordering::SeqCst);
        *self.mode.write().await = mode;

        tracing::info!("Streaming transcription started with mode: {:?}", mode);
    }

    /// Stop the streaming session
    pub async fn stop(&self) {
        self.is_active.store(false, Ordering::SeqCst);
        tracing::info!(
            "Streaming transcription stopped. Chunks processed: {}",
            self.chunks_processed.load(Ordering::SeqCst)
        );
    }

    /// Check if streaming is active
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    /// Get accumulated text so far
    pub async fn get_accumulated_text(&self) -> String {
        self.accumulated_text.read().await.clone()
    }

    /// Get number of chunks processed
    pub fn chunks_processed(&self) -> u32 {
        self.chunks_processed.load(Ordering::SeqCst)
    }

    /// Process a chunk and emit partial result
    ///
    /// Returns the chunk transcription result if successful.
    pub async fn process_chunk<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        engine: &SharedWhisperEngine,
        chunk: &AudioChunk,
        model_id: &str,
    ) -> Result<ChunkTranscriptionResult, TranscriptionError> {
        if !self.is_active() {
            return Err(TranscriptionError::InferenceFailed(
                "Streaming not active".to_string(),
            ));
        }

        // Prevent duplicate processing
        let current_index = self.last_chunk_index.load(Ordering::SeqCst);
        if chunk.chunk_index < current_index {
            tracing::debug!(
                "Skipping already processed chunk {} (current: {})",
                chunk.chunk_index,
                current_index
            );
            return Err(TranscriptionError::InferenceFailed(
                "Chunk already processed".to_string(),
            ));
        }

        // Get context from previous transcription
        let context = self.last_context.read().await.clone();

        // Transcribe the chunk
        let result = engine
            .transcribe_chunk_with_auto_load(chunk, model_id, context.as_deref())
            .await?;

        // Update state
        self.last_chunk_index
            .store(chunk.chunk_index + 1, Ordering::SeqCst);
        self.chunks_processed.fetch_add(1, Ordering::SeqCst);

        // Append to accumulated text if not empty
        if !result.text.is_empty() {
            let mut accumulated = self.accumulated_text.write().await;
            if !accumulated.is_empty() {
                accumulated.push(' ');
            }
            accumulated.push_str(&result.text);

            // Update context for next chunk
            *self.last_context.write().await = Some(accumulated.clone());
        }

        // Emit partial result (rate-limited)
        self.maybe_emit_partial(app, &result).await;

        Ok(result)
    }

    /// Emit partial transcription event (rate-limited)
    async fn maybe_emit_partial<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        result: &ChunkTranscriptionResult,
    ) {
        let mut last_emit = self.last_emit_time.lock().await;
        let now = Instant::now();
        let elapsed = now.duration_since(*last_emit);

        if elapsed.as_millis() < MIN_EMIT_INTERVAL_MS as u128 {
            tracing::debug!(
                "Rate limiting partial event for chunk {} ({}ms since last)",
                result.chunk_index,
                elapsed.as_millis()
            );
            return;
        }

        *last_emit = now;
        drop(last_emit);

        let accumulated_text = self.accumulated_text.read().await.clone();
        let event = PartialTranscriptionEvent {
            text: accumulated_text,
            chunk_index: result.chunk_index,
            timestamp_ms: result.timestamp_ms,
            is_final: false,
        };

        if let Err(e) = app.emit(EVENT_PARTIAL, &event) {
            tracing::warn!("Failed to emit partial transcription event: {}", e);
        } else {
            tracing::debug!(
                "Emitted partial transcription for chunk {}: {} chars",
                result.chunk_index,
                event.text.len()
            );
        }
    }

    /// Emit final transcription event
    pub async fn emit_final<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        text: &str,
        duration_secs: f32,
        reconciled: bool,
    ) {
        let event = FinalTranscriptionEvent {
            text: text.to_string(),
            total_chunks: self.chunks_processed.load(Ordering::SeqCst),
            duration_secs,
            reconciled,
        };

        if let Err(e) = app.emit(EVENT_COMPLETE, &event) {
            tracing::warn!("Failed to emit final transcription event: {}", e);
        } else {
            tracing::info!(
                "Emitted final transcription: {} chars, {} chunks, reconciled: {}",
                text.len(),
                event.total_chunks,
                reconciled
            );
        }
    }

    /// Emit error event
    pub fn emit_error<R: Runtime>(&self, app: &AppHandle<R>, message: &str, chunk_index: Option<u32>) {
        let event = StreamingErrorEvent {
            message: message.to_string(),
            chunk_index,
        };

        if let Err(e) = app.emit(EVENT_ERROR, &event) {
            tracing::warn!("Failed to emit streaming error event: {}", e);
        }

        tracing::error!(
            "Streaming transcription error (chunk {:?}): {}",
            chunk_index,
            message
        );
    }

    /// Force emit current accumulated text (ignoring rate limit)
    pub async fn force_emit_partial<R: Runtime>(&self, app: &AppHandle<R>) {
        let accumulated_text = self.accumulated_text.read().await.clone();
        let chunk_index = self.last_chunk_index.load(Ordering::SeqCst);

        let event = PartialTranscriptionEvent {
            text: accumulated_text,
            chunk_index,
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            is_final: false,
        };

        if let Err(e) = app.emit(EVENT_PARTIAL, &event) {
            tracing::warn!("Failed to force emit partial transcription event: {}", e);
        }
    }

    /// Perform final reconciliation based on mode
    ///
    /// Returns the final text to use (either streaming result or reconciled).
    pub async fn reconcile<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        engine: &SharedWhisperEngine,
        full_audio: &[f32],
        model_id: &str,
        initial_prompt: Option<&str>,
    ) -> Result<String, TranscriptionError> {
        let mode = *self.mode.read().await;
        let streaming_text = self.accumulated_text.read().await.clone();

        match mode {
            StreamingMode::Speed => {
                // Use streaming result directly
                tracing::info!("Speed mode: using streaming result directly");
                self.emit_final(app, &streaming_text, full_audio.len() as f32 / 16000.0, false)
                    .await;
                Ok(streaming_text)
            }
            StreamingMode::Balanced => {
                // Re-transcribe last 5 seconds for cleanup
                let last_5_secs_samples = 5 * 16000;
                if full_audio.len() > last_5_secs_samples {
                    tracing::info!("Balanced mode: re-transcribing last 5 seconds");

                    let tail = &full_audio[full_audio.len() - last_5_secs_samples..];
                    let tail_result = engine
                        .transcribe_with_auto_load_and_prompt(tail.to_vec(), model_id, initial_prompt)
                        .await?;

                    // Replace last portion with reconciled text
                    let word_count = streaming_text.split_whitespace().count();
                    let tail_word_count = tail_result.text.split_whitespace().count();

                    if word_count > tail_word_count {
                        // Keep earlier words, replace tail
                        let words: Vec<&str> = streaming_text.split_whitespace().collect();
                        let keep_count = word_count.saturating_sub(tail_word_count + 2);
                        let mut final_text = words[..keep_count.min(words.len())].join(" ");
                        if !final_text.is_empty() {
                            final_text.push(' ');
                        }
                        final_text.push_str(&tail_result.text);

                        self.emit_final(app, &final_text, full_audio.len() as f32 / 16000.0, true)
                            .await;
                        Ok(final_text)
                    } else {
                        // Use tail result
                        self.emit_final(
                            app,
                            &tail_result.text,
                            full_audio.len() as f32 / 16000.0,
                            true,
                        )
                        .await;
                        Ok(tail_result.text)
                    }
                } else {
                    // Audio too short, use streaming result
                    self.emit_final(app, &streaming_text, full_audio.len() as f32 / 16000.0, false)
                        .await;
                    Ok(streaming_text)
                }
            }
            StreamingMode::Accuracy => {
                // Full re-transcription
                tracing::info!("Accuracy mode: performing full re-transcription");

                let result = engine
                    .transcribe_with_auto_load_and_prompt(full_audio.to_vec(), model_id, initial_prompt)
                    .await?;

                self.emit_final(app, &result.text, full_audio.len() as f32 / 16000.0, true)
                    .await;
                Ok(result.text)
            }
        }
    }
}

impl Default for StreamingTranscriptionService {
    fn default() -> Self {
        Self::new()
    }
}

/// Shared streaming transcription service for use across the application
pub struct SharedStreamingService {
    inner: Arc<StreamingTranscriptionService>,
}

impl SharedStreamingService {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(StreamingTranscriptionService::new()),
        }
    }

    pub fn get(&self) -> Arc<StreamingTranscriptionService> {
        Arc::clone(&self.inner)
    }
}

impl Default for SharedStreamingService {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SharedStreamingService {
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
    fn test_partial_event_serialization() {
        let event = PartialTranscriptionEvent {
            text: "Hello world".to_string(),
            chunk_index: 0,
            timestamp_ms: 1000,
            is_final: false,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Hello world"));
        assert!(json.contains("\"chunk_index\":0"));
        assert!(json.contains("\"is_final\":false"));
    }

    #[test]
    fn test_final_event_serialization() {
        let event = FinalTranscriptionEvent {
            text: "Hello world".to_string(),
            total_chunks: 5,
            duration_secs: 10.0,
            reconciled: true,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"total_chunks\":5"));
        assert!(json.contains("\"reconciled\":true"));
    }

    #[test]
    fn test_error_event_serialization() {
        let event = StreamingErrorEvent {
            message: "Test error".to_string(),
            chunk_index: Some(3),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Test error"));
        assert!(json.contains("\"chunk_index\":3"));
    }

    #[tokio::test]
    async fn test_service_start_stop() {
        let service = StreamingTranscriptionService::new();
        assert!(!service.is_active());

        service.start(StreamingMode::Balanced).await;
        assert!(service.is_active());

        service.stop().await;
        assert!(!service.is_active());
    }

    #[tokio::test]
    async fn test_service_accumulation() {
        let service = StreamingTranscriptionService::new();
        service.start(StreamingMode::Balanced).await;

        // Manually accumulate text for testing
        {
            let mut text = service.accumulated_text.write().await;
            text.push_str("Hello");
        }
        assert_eq!(service.get_accumulated_text().await, "Hello");

        {
            let mut text = service.accumulated_text.write().await;
            text.push_str(" world");
        }
        assert_eq!(service.get_accumulated_text().await, "Hello world");
    }

    #[test]
    fn test_shared_service_clone() {
        let service = SharedStreamingService::new();
        let _cloned = service.clone();
    }
}
