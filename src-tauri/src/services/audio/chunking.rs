//! Audio chunking for streaming transcription
//!
//! Provides chunk management for incremental audio processing during recording.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};

/// Default chunk size in seconds
pub const DEFAULT_CHUNK_SIZE_SECS: f32 = 2.0;

/// Default overlap between chunks in seconds
pub const DEFAULT_OVERLAP_SECS: f32 = 0.5;

/// Whisper sample rate (16kHz)
pub const WHISPER_SAMPLE_RATE: u32 = 16000;

/// Audio chunk with metadata for streaming transcription
#[derive(Debug, Clone)]
pub struct AudioChunk {
    /// Audio samples (16kHz mono f32)
    pub samples: Vec<f32>,
    /// Sample rate (always 16000 for Whisper)
    pub sample_rate: u32,
    /// Sequential chunk index
    pub chunk_index: u32,
    /// Timestamp in milliseconds from recording start
    pub timestamp_ms: u64,
    /// Whether this chunk includes overlap from previous chunk
    pub has_overlap: bool,
}

impl AudioChunk {
    /// Create a new audio chunk
    pub fn new(
        samples: Vec<f32>,
        sample_rate: u32,
        chunk_index: u32,
        timestamp_ms: u64,
        has_overlap: bool,
    ) -> Self {
        Self {
            samples,
            sample_rate,
            chunk_index,
            timestamp_ms,
            has_overlap,
        }
    }

    /// Get duration of this chunk in seconds
    pub fn duration_secs(&self) -> f32 {
        if self.sample_rate == 0 {
            return 0.0;
        }
        self.samples.len() as f32 / self.sample_rate as f32
    }

    /// Check if chunk is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Get number of samples
    pub fn len(&self) -> usize {
        self.samples.len()
    }
}

/// Configuration for chunked audio buffering
#[derive(Debug, Clone)]
pub struct ChunkConfig {
    /// Chunk size in samples (at 16kHz)
    pub chunk_size_samples: usize,
    /// Overlap size in samples for context continuity
    pub overlap_samples: usize,
    /// Maximum number of chunks to keep in queue
    pub max_queue_size: usize,
}

impl Default for ChunkConfig {
    fn default() -> Self {
        Self {
            // 2 seconds at 16kHz
            chunk_size_samples: (DEFAULT_CHUNK_SIZE_SECS * WHISPER_SAMPLE_RATE as f32) as usize,
            // 0.5 seconds overlap
            overlap_samples: (DEFAULT_OVERLAP_SECS * WHISPER_SAMPLE_RATE as f32) as usize,
            // Keep up to 30 chunks (60 seconds worth)
            max_queue_size: 30,
        }
    }
}

impl ChunkConfig {
    /// Create config with custom chunk duration
    pub fn with_chunk_duration(chunk_secs: f32, overlap_secs: f32) -> Self {
        Self {
            chunk_size_samples: (chunk_secs * WHISPER_SAMPLE_RATE as f32) as usize,
            overlap_samples: (overlap_secs * WHISPER_SAMPLE_RATE as f32) as usize,
            ..Default::default()
        }
    }
}

/// Chunked audio buffer for streaming transcription
///
/// Maintains both a full audio buffer for final reconciliation and
/// a queue of chunks for incremental processing.
#[derive(Debug)]
pub struct ChunkedAudioBuffer {
    /// Configuration
    config: ChunkConfig,
    /// Ready chunks waiting to be processed
    chunks: VecDeque<AudioChunk>,
    /// Full audio buffer for final reconciliation
    full_buffer: Vec<f32>,
    /// Pending samples not yet forming a complete chunk
    pending_samples: Vec<f32>,
    /// Current chunk index counter
    chunk_counter: AtomicU32,
    /// Recording start time in milliseconds
    start_time_ms: u64,
    /// Sample rate of input audio (may need resampling)
    input_sample_rate: u32,
}

impl ChunkedAudioBuffer {
    /// Create a new chunked audio buffer
    pub fn new(config: ChunkConfig, input_sample_rate: u32) -> Self {
        Self {
            config,
            chunks: VecDeque::new(),
            full_buffer: Vec::new(),
            pending_samples: Vec::new(),
            chunk_counter: AtomicU32::new(0),
            start_time_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            input_sample_rate,
        }
    }

    /// Create with default configuration
    pub fn with_defaults(input_sample_rate: u32) -> Self {
        Self::new(ChunkConfig::default(), input_sample_rate)
    }

    /// Reset the buffer for a new recording
    pub fn reset(&mut self) {
        self.chunks.clear();
        self.full_buffer.clear();
        self.pending_samples.clear();
        self.chunk_counter.store(0, Ordering::SeqCst);
        self.start_time_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
    }

    /// Add samples to the buffer
    ///
    /// Samples are added to both the full buffer and pending chunk buffer.
    /// When enough samples accumulate, a new chunk is created.
    pub fn add_samples(&mut self, samples: &[f32]) {
        // Add to full buffer for final reconciliation
        self.full_buffer.extend_from_slice(samples);

        // Add to pending samples
        self.pending_samples.extend_from_slice(samples);

        // Check if we have enough for a new chunk
        while self.pending_samples.len() >= self.config.chunk_size_samples {
            self.create_chunk();
        }
    }

    /// Create a new chunk from pending samples
    fn create_chunk(&mut self) {
        if self.pending_samples.len() < self.config.chunk_size_samples {
            return;
        }

        let chunk_index = self.chunk_counter.fetch_add(1, Ordering::SeqCst);
        let timestamp_ms = self.calculate_timestamp(chunk_index);

        // Get samples for this chunk
        let chunk_samples: Vec<f32> = self
            .pending_samples
            .drain(..self.config.chunk_size_samples)
            .collect();

        // Keep overlap samples for next chunk's context
        // This means we prepend overlap to next chunk, not keep it in pending
        let has_overlap = chunk_index > 0;

        let chunk = AudioChunk::new(
            chunk_samples,
            WHISPER_SAMPLE_RATE,
            chunk_index,
            timestamp_ms,
            has_overlap,
        );

        // Add to queue, respecting max size
        if self.chunks.len() >= self.config.max_queue_size {
            // Remove oldest chunk if queue is full
            self.chunks.pop_front();
        }
        self.chunks.push_back(chunk);
    }

    /// Calculate timestamp for a chunk based on its index
    fn calculate_timestamp(&self, chunk_index: u32) -> u64 {
        let samples_per_chunk = self.config.chunk_size_samples;
        let total_samples_before = chunk_index as usize * samples_per_chunk;
        let ms_before = (total_samples_before as f32 / WHISPER_SAMPLE_RATE as f32 * 1000.0) as u64;
        self.start_time_ms + ms_before
    }

    /// Get pending chunks that haven't been processed
    pub fn get_pending_chunks(&mut self) -> Vec<AudioChunk> {
        self.chunks.drain(..).collect()
    }

    /// Peek at pending chunks without removing them
    pub fn peek_pending_chunks(&self) -> &VecDeque<AudioChunk> {
        &self.chunks
    }

    /// Get the next pending chunk without removing it
    pub fn peek_next_chunk(&self) -> Option<&AudioChunk> {
        self.chunks.front()
    }

    /// Take the next pending chunk
    pub fn take_next_chunk(&mut self) -> Option<AudioChunk> {
        self.chunks.pop_front()
    }

    /// Get the full audio buffer for final reconciliation
    pub fn get_full_buffer(&self) -> &[f32] {
        &self.full_buffer
    }

    /// Take the full buffer, consuming it
    pub fn take_full_buffer(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.full_buffer)
    }

    /// Get total duration of recorded audio in seconds
    pub fn total_duration_secs(&self) -> f32 {
        self.full_buffer.len() as f32 / WHISPER_SAMPLE_RATE as f32
    }

    /// Get number of pending chunks
    pub fn pending_chunk_count(&self) -> usize {
        self.chunks.len()
    }

    /// Check if there are pending chunks
    pub fn has_pending_chunks(&self) -> bool {
        !self.chunks.is_empty()
    }

    /// Get remaining samples that don't form a complete chunk yet
    pub fn get_remaining_samples(&self) -> &[f32] {
        &self.pending_samples
    }

    /// Flush remaining samples as a final chunk (for end of recording)
    pub fn flush_remaining(&mut self) -> Option<AudioChunk> {
        if self.pending_samples.is_empty() {
            return None;
        }

        let chunk_index = self.chunk_counter.fetch_add(1, Ordering::SeqCst);
        let timestamp_ms = self.calculate_timestamp(chunk_index);
        let has_overlap = chunk_index > 0;

        let chunk_samples = std::mem::take(&mut self.pending_samples);

        Some(AudioChunk::new(
            chunk_samples,
            WHISPER_SAMPLE_RATE,
            chunk_index,
            timestamp_ms,
            has_overlap,
        ))
    }

    /// Get chunk with overlap from previous chunk for context
    ///
    /// Returns a chunk with overlap samples prepended if available
    pub fn get_chunk_with_context(&self, chunk_index: u32) -> Option<Vec<f32>> {
        if chunk_index == 0 {
            // First chunk has no context
            return self.chunks.front().map(|c| c.samples.clone());
        }

        // Calculate where the overlap should come from in full buffer
        let chunk_start = chunk_index as usize * self.config.chunk_size_samples;
        let overlap_start = chunk_start.saturating_sub(self.config.overlap_samples);

        if overlap_start >= self.full_buffer.len() {
            return None;
        }

        // Get chunk from queue
        let chunk = self
            .chunks
            .iter()
            .find(|c| c.chunk_index == chunk_index)?;

        // Prepend overlap from full buffer
        let overlap: Vec<f32> = self.full_buffer[overlap_start..chunk_start].to_vec();
        let mut samples_with_context = overlap;
        samples_with_context.extend_from_slice(&chunk.samples);

        Some(samples_with_context)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_creation() {
        let chunk = AudioChunk::new(vec![0.0; 32000], 16000, 0, 0, false);
        assert_eq!(chunk.duration_secs(), 2.0);
        assert!(!chunk.is_empty());
        assert_eq!(chunk.len(), 32000);
    }

    #[test]
    fn test_buffer_add_samples() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);

        // Add 1 second of samples (not enough for a chunk)
        buffer.add_samples(&vec![0.0; 16000]);
        assert_eq!(buffer.pending_chunk_count(), 0);
        assert_eq!(buffer.get_remaining_samples().len(), 16000);

        // Add another 1 second (now we have 2 seconds = 1 chunk)
        buffer.add_samples(&vec![0.0; 16000]);
        assert_eq!(buffer.pending_chunk_count(), 1);
        assert_eq!(buffer.get_remaining_samples().len(), 0);

        // Full buffer should have all samples
        assert_eq!(buffer.get_full_buffer().len(), 32000);
    }

    #[test]
    fn test_buffer_multiple_chunks() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);

        // Add 5 seconds of samples (should create 2 chunks + 1 second remaining)
        buffer.add_samples(&vec![0.0; 80000]); // 5 seconds

        assert_eq!(buffer.pending_chunk_count(), 2);
        assert_eq!(buffer.get_remaining_samples().len(), 16000); // 1 second remaining
        assert_eq!(buffer.get_full_buffer().len(), 80000);
    }

    #[test]
    fn test_take_chunks() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);
        buffer.add_samples(&vec![0.0; 64000]); // 4 seconds = 2 chunks

        let chunks = buffer.get_pending_chunks();
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].chunk_index, 0);
        assert_eq!(chunks[1].chunk_index, 1);

        // Chunks should be empty now
        assert_eq!(buffer.pending_chunk_count(), 0);
    }

    #[test]
    fn test_flush_remaining() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);
        buffer.add_samples(&vec![0.0; 48000]); // 3 seconds = 1 chunk + 1 second remaining

        assert_eq!(buffer.pending_chunk_count(), 1);
        assert_eq!(buffer.get_remaining_samples().len(), 16000);

        let remaining = buffer.flush_remaining();
        assert!(remaining.is_some());
        assert_eq!(remaining.unwrap().len(), 16000);
        assert!(buffer.get_remaining_samples().is_empty());
    }

    #[test]
    fn test_reset() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);
        buffer.add_samples(&vec![0.0; 64000]);

        buffer.reset();

        assert_eq!(buffer.pending_chunk_count(), 0);
        assert!(buffer.get_full_buffer().is_empty());
        assert!(buffer.get_remaining_samples().is_empty());
    }

    #[test]
    fn test_chunk_config() {
        let config = ChunkConfig::with_chunk_duration(3.0, 1.0);
        assert_eq!(config.chunk_size_samples, 48000); // 3 seconds at 16kHz
        assert_eq!(config.overlap_samples, 16000); // 1 second
    }

    #[test]
    fn test_total_duration() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);
        buffer.add_samples(&vec![0.0; 32000]); // 2 seconds

        assert!((buffer.total_duration_secs() - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_chunk_timestamps() {
        let mut buffer = ChunkedAudioBuffer::with_defaults(16000);
        let start_time = buffer.start_time_ms;

        buffer.add_samples(&vec![0.0; 64000]); // 4 seconds = 2 chunks

        let chunks = buffer.get_pending_chunks();
        assert_eq!(chunks[0].timestamp_ms, start_time);
        assert_eq!(chunks[1].timestamp_ms, start_time + 2000); // 2 seconds later
    }
}
