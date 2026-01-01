//! Audio chunking for streaming transcription
//!
//! Provides chunk management for incremental audio processing during recording.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};
use rubato::{FftFixedIn, Resampler};

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
pub struct ChunkedAudioBuffer {
    /// Configuration
    config: ChunkConfig,
    /// Ready chunks waiting to be processed
    chunks: VecDeque<AudioChunk>,
    /// Full audio buffer for final reconciliation (resampled to 16kHz)
    full_buffer: Vec<f32>,
    /// Pending samples not yet forming a complete chunk (at input sample rate)
    pending_samples: Vec<f32>,
    /// Current chunk index counter
    chunk_counter: AtomicU32,
    /// Recording start time in milliseconds
    start_time_ms: u64,
    /// Sample rate of input audio (may need resampling)
    input_sample_rate: u32,
    /// Chunk size in input samples (scaled from 16kHz)
    input_chunk_size: usize,
    /// Resampler for converting to 16kHz
    resampler: Option<FftFixedIn<f32>>,
}

impl ChunkedAudioBuffer {
    /// Create a new chunked audio buffer
    pub fn new(config: ChunkConfig, input_sample_rate: u32) -> Self {
        // Calculate chunk size at input sample rate
        // config.chunk_size_samples is at 16kHz, scale to input rate
        let ratio = input_sample_rate as f32 / WHISPER_SAMPLE_RATE as f32;
        let input_chunk_size = (config.chunk_size_samples as f32 * ratio) as usize;

        // Create resampler if needed
        let resampler = if input_sample_rate != WHISPER_SAMPLE_RATE {
            // Use FFT-based resampler with a reasonable block size
            // Use 1024 samples per block for good balance of efficiency and latency
            let block_size = 1024;
            match FftFixedIn::<f32>::new(
                input_sample_rate as usize,
                WHISPER_SAMPLE_RATE as usize,
                block_size,
                2, // sub_chunks
                1, // channels
            ) {
                Ok(r) => {
                    tracing::info!(
                        "Created resampler: {}Hz -> {}Hz, block_size={}",
                        input_sample_rate,
                        WHISPER_SAMPLE_RATE,
                        block_size
                    );
                    Some(r)
                }
                Err(e) => {
                    tracing::error!("Failed to create resampler: {}", e);
                    None
                }
            }
        } else {
            tracing::info!("No resampling needed, input already at {}Hz", WHISPER_SAMPLE_RATE);
            None
        };

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
            input_chunk_size,
            resampler,
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

        // Reset resampler state
        if let Some(ref mut resampler) = self.resampler {
            resampler.reset();
        }
    }

    /// Add samples to the buffer
    ///
    /// Samples are added to both the full buffer and pending chunk buffer.
    /// When enough samples accumulate, a new chunk is created.
    pub fn add_samples(&mut self, samples: &[f32]) {
        // Add to pending samples (at input sample rate)
        self.pending_samples.extend_from_slice(samples);

        // Check if we have enough for a new chunk (using input-rate chunk size)
        while self.pending_samples.len() >= self.input_chunk_size {
            tracing::debug!(
                "Creating chunk: pending={}, chunk_size={}, input_rate={}",
                self.pending_samples.len(),
                self.input_chunk_size,
                self.input_sample_rate
            );
            self.create_chunk();
        }
    }

    /// Create a new chunk from pending samples
    fn create_chunk(&mut self) {
        if self.pending_samples.len() < self.input_chunk_size {
            return;
        }

        let chunk_index = self.chunk_counter.fetch_add(1, Ordering::SeqCst);
        let timestamp_ms = self.calculate_timestamp(chunk_index);

        // Get samples for this chunk (at input sample rate)
        let input_samples: Vec<f32> = self
            .pending_samples
            .drain(..self.input_chunk_size)
            .collect();

        // Resample to 16kHz if needed
        let chunk_samples = if let Some(ref mut resampler) = self.resampler {
            let block_size = resampler.input_frames_max();
            let mut output_samples = Vec::new();
            let mut position = 0;

            while position < input_samples.len() {
                let end = (position + block_size).min(input_samples.len());
                let mut block = input_samples[position..end].to_vec();

                // Pad last block if needed
                if block.len() < block_size {
                    block.resize(block_size, 0.0);
                }

                match resampler.process(&[block], None) {
                    Ok(result) => {
                        if let Some(channel) = result.into_iter().next() {
                            output_samples.extend(channel);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Resampling block failed: {}", e);
                    }
                }
                position += block_size;
            }

            // Trim to expected output size
            let expected_len = (input_samples.len() as f64
                * WHISPER_SAMPLE_RATE as f64
                / self.input_sample_rate as f64)
                .ceil() as usize;
            output_samples.truncate(expected_len);

            tracing::debug!(
                "Resampled chunk {}: {} -> {} samples",
                chunk_index,
                input_samples.len(),
                output_samples.len()
            );

            output_samples
        } else {
            // No resampling needed, already at 16kHz
            input_samples.clone()
        };

        // Add resampled samples to full buffer for final reconciliation
        self.full_buffer.extend_from_slice(&chunk_samples);

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

        let input_samples = std::mem::take(&mut self.pending_samples);

        // Resample to 16kHz if needed
        let chunk_samples = if let Some(ref mut resampler) = self.resampler {
            let block_size = resampler.input_frames_max();
            let mut output_samples = Vec::new();
            let mut position = 0;

            while position < input_samples.len() {
                let end = (position + block_size).min(input_samples.len());
                let mut block = input_samples[position..end].to_vec();

                // Pad last block if needed
                if block.len() < block_size {
                    block.resize(block_size, 0.0);
                }

                match resampler.process(&[block], None) {
                    Ok(result) => {
                        if let Some(channel) = result.into_iter().next() {
                            output_samples.extend(channel);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Resampling block failed for final chunk: {}", e);
                    }
                }
                position += block_size;
            }

            // Trim to expected output size
            let expected_len = (input_samples.len() as f64
                * WHISPER_SAMPLE_RATE as f64
                / self.input_sample_rate as f64)
                .ceil() as usize;
            output_samples.truncate(expected_len);
            output_samples
        } else {
            input_samples.clone()
        };

        // Add to full buffer
        self.full_buffer.extend_from_slice(&chunk_samples);

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
        // Full buffer only contains completed chunks until flush_remaining is called
        assert_eq!(buffer.get_full_buffer().len(), 64000); // 2 chunks * 32000

        // After flushing remaining, full buffer should have all samples
        buffer.flush_remaining();
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
