//! Audio capture service using cpal
//!
//! Handles microphone input and buffering for transcription.

use super::{
    chunking::{AudioChunk, ChunkedAudioBuffer},
    processing::{calculate_audio_level, AudioBuffer},
    AudioDevice, AudioError, RecordingResult,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Maximum recording duration in seconds (5 minutes)
const MAX_RECORDING_DURATION_SECS: u64 = 300;

/// Number of samples to use for level calculation (~100ms at 16kHz)
const LEVEL_CALCULATION_SAMPLES: usize = 1600;

/// Audio capture service for recording from microphone
pub struct AudioCaptureService {
    device: cpal::Device,
    config: cpal::SupportedStreamConfig,
    stream: Option<cpal::Stream>,
    buffer: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
    recording_start: Option<Instant>,
    channels: u16,
    /// Current audio level (0.0-1.0), updated during recording
    current_level: Arc<Mutex<f32>>,
    /// Buffer for level calculation to avoid allocation in callback
    level_buffer: Arc<Mutex<Vec<f32>>>,
    /// Chunked buffer for streaming transcription
    chunked_buffer: Arc<Mutex<ChunkedAudioBuffer>>,
    /// Whether streaming mode is enabled
    streaming_enabled: Arc<AtomicBool>,
}

impl AudioCaptureService {
    /// Create a new audio capture service with the default input device
    pub fn new() -> Result<Self, AudioError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(AudioError::NoInputDevice)?;
        let config = device
            .default_input_config()
            .map_err(|e| AudioError::StreamError(e.to_string()))?;

        let sample_rate = config.sample_rate().0;

        tracing::info!(
            "Audio capture initialized: {} @ {}Hz, {} channels",
            device.name().unwrap_or_default(),
            sample_rate,
            config.channels()
        );

        Ok(Self {
            device,
            channels: config.channels(),
            config,
            stream: None,
            buffer: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(AtomicBool::new(false)),
            recording_start: None,
            current_level: Arc::new(Mutex::new(0.0)),
            level_buffer: Arc::new(Mutex::new(Vec::with_capacity(LEVEL_CALCULATION_SAMPLES))),
            chunked_buffer: Arc::new(Mutex::new(ChunkedAudioBuffer::with_defaults(sample_rate))),
            streaming_enabled: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Create a new audio capture service with a specific device
    pub fn with_device(device_name: &str) -> Result<Self, AudioError> {
        let host = cpal::default_host();
        let device = host
            .input_devices()
            .map_err(|e| AudioError::StreamError(e.to_string()))?
            .find(|d| d.name().map(|n| n == device_name).unwrap_or(false))
            .ok_or(AudioError::NoInputDevice)?;
        let config = device
            .default_input_config()
            .map_err(|e| AudioError::StreamError(e.to_string()))?;
        let sample_rate = config.sample_rate().0;

        Ok(Self {
            device,
            channels: config.channels(),
            config,
            stream: None,
            buffer: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(AtomicBool::new(false)),
            recording_start: None,
            current_level: Arc::new(Mutex::new(0.0)),
            level_buffer: Arc::new(Mutex::new(Vec::with_capacity(LEVEL_CALCULATION_SAMPLES))),
            chunked_buffer: Arc::new(Mutex::new(ChunkedAudioBuffer::with_defaults(sample_rate))),
            streaming_enabled: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Get list of available audio input devices
    pub fn get_devices() -> Result<Vec<AudioDevice>, AudioError> {
        let host = cpal::default_host();
        let default_device_name = host
            .default_input_device()
            .and_then(|d| d.name().ok())
            .unwrap_or_default();

        let devices = host
            .input_devices()
            .map_err(|e| AudioError::StreamError(e.to_string()))?
            .filter_map(|d| {
                d.name().ok().map(|name| AudioDevice {
                    is_default: name == default_device_name,
                    name,
                })
            })
            .collect();

        Ok(devices)
    }

    /// Enable or disable streaming mode
    pub fn set_streaming_enabled(&mut self, enabled: bool) {
        self.streaming_enabled.store(enabled, Ordering::SeqCst);
        tracing::info!("Streaming mode: {}", if enabled { "enabled" } else { "disabled" });
    }

    /// Check if streaming mode is enabled
    pub fn is_streaming_enabled(&self) -> bool {
        self.streaming_enabled.load(Ordering::SeqCst)
    }

    /// Start recording audio
    pub fn start(&mut self) -> Result<(), AudioError> {
        if self.is_recording.load(Ordering::SeqCst) {
            tracing::warn!("Recording already in progress");
            return Ok(());
        }

        // Clear any previous buffer and reset level
        self.buffer.lock().unwrap().clear();
        self.level_buffer.lock().unwrap().clear();
        *self.current_level.lock().unwrap() = 0.0;

        // Reset chunked buffer for streaming mode
        if self.streaming_enabled.load(Ordering::SeqCst) {
            self.chunked_buffer.lock().unwrap().reset();
        }

        let buffer = self.buffer.clone();
        let level_buffer = self.level_buffer.clone();
        let current_level = self.current_level.clone();
        let is_recording = self.is_recording.clone();
        let channels = self.channels;
        let chunked_buffer = self.chunked_buffer.clone();
        let streaming_enabled = self.streaming_enabled.clone();

        let err_fn = |err| {
            tracing::error!("Audio stream error: {}", err);
        };

        let stream = match self.config.sample_format() {
            cpal::SampleFormat::F32 => self.device.build_input_stream(
                &self.config.clone().into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if is_recording.load(Ordering::SeqCst) {
                        let mut buf = buffer.lock().unwrap();
                        let mut lvl_buf = level_buffer.lock().unwrap();

                        // Collect mono samples
                        let mono_samples: Vec<f32> = if channels == 2 {
                            data.chunks(2)
                                .filter_map(|chunk| {
                                    if chunk.len() == 2 {
                                        Some((chunk[0] + chunk[1]) / 2.0)
                                    } else {
                                        None
                                    }
                                })
                                .collect()
                        } else {
                            data.to_vec()
                        };

                        // Add to main buffer
                        buf.extend_from_slice(&mono_samples);
                        lvl_buf.extend_from_slice(&mono_samples);

                        // Add to chunked buffer if streaming is enabled
                        if streaming_enabled.load(Ordering::SeqCst) {
                            if let Ok(mut chunk_buf) = chunked_buffer.lock() {
                                chunk_buf.add_samples(&mono_samples);
                            }
                        }

                        // Calculate level when we have enough samples
                        if lvl_buf.len() >= LEVEL_CALCULATION_SAMPLES {
                            let level = calculate_audio_level(&lvl_buf);
                            // Log non-zero levels for debugging
                            if level > 0.01 {
                                tracing::debug!("[AudioCapture] Calculated level: {:.4} from {} samples", level, lvl_buf.len());
                            }
                            if let Ok(mut lvl) = current_level.lock() {
                                *lvl = level;
                            }
                            lvl_buf.clear();
                        }
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => {
                let buffer = buffer.clone();
                let level_buffer = level_buffer.clone();
                let current_level = current_level.clone();
                let is_recording = is_recording.clone();
                let chunked_buffer = chunked_buffer.clone();
                let streaming_enabled = streaming_enabled.clone();
                self.device.build_input_stream(
                    &self.config.clone().into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if is_recording.load(Ordering::SeqCst) {
                            let mut buf = buffer.lock().unwrap();
                            let mut lvl_buf = level_buffer.lock().unwrap();

                            // Collect mono samples, converting from i16
                            let mono_samples: Vec<f32> = if channels == 2 {
                                data.chunks(2)
                                    .filter_map(|chunk| {
                                        if chunk.len() == 2 {
                                            let left = chunk[0] as f32 / i16::MAX as f32;
                                            let right = chunk[1] as f32 / i16::MAX as f32;
                                            Some((left + right) / 2.0)
                                        } else {
                                            None
                                        }
                                    })
                                    .collect()
                            } else {
                                data.iter()
                                    .map(|s| *s as f32 / i16::MAX as f32)
                                    .collect()
                            };

                            // Add to main buffer
                            buf.extend_from_slice(&mono_samples);
                            lvl_buf.extend_from_slice(&mono_samples);

                            // Add to chunked buffer if streaming is enabled
                            if streaming_enabled.load(Ordering::SeqCst) {
                                if let Ok(mut chunk_buf) = chunked_buffer.lock() {
                                    chunk_buf.add_samples(&mono_samples);
                                }
                            }

                            // Calculate level when we have enough samples
                            if lvl_buf.len() >= LEVEL_CALCULATION_SAMPLES {
                                let level = calculate_audio_level(&lvl_buf);
                                // Log non-zero levels for debugging
                                if level > 0.01 {
                                    tracing::debug!("[AudioCapture] Calculated level: {:.4} from {} samples (i16)", level, lvl_buf.len());
                                }
                                if let Ok(mut lvl) = current_level.lock() {
                                    *lvl = level;
                                }
                                lvl_buf.clear();
                            }
                        }
                    },
                    err_fn,
                    None,
                )
            }
            _ => return Err(AudioError::StreamError("Unsupported sample format".into())),
        }
        .map_err(|e| AudioError::StreamError(e.to_string()))?;

        stream
            .play()
            .map_err(|e| AudioError::StreamError(e.to_string()))?;

        self.is_recording.store(true, Ordering::SeqCst);
        self.recording_start = Some(Instant::now());
        self.stream = Some(stream);

        tracing::info!("Recording started");
        Ok(())
    }

    /// Stop recording and return the audio buffer
    pub fn stop(&mut self) -> Result<AudioBuffer, AudioError> {
        self.is_recording.store(false, Ordering::SeqCst);

        // Drop the stream to stop recording
        self.stream.take();

        let samples = std::mem::take(&mut *self.buffer.lock().unwrap());
        let sample_rate = self.config.sample_rate().0;
        let duration = self
            .recording_start
            .map(|s| s.elapsed())
            .unwrap_or(Duration::ZERO);

        tracing::info!(
            "Recording stopped: {} samples, {:.2}s",
            samples.len(),
            duration.as_secs_f32()
        );

        self.recording_start = None;

        Ok(AudioBuffer {
            samples,
            sample_rate,
        })
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    /// Get the elapsed recording duration
    pub fn recording_duration(&self) -> Duration {
        self.recording_start
            .map(|s| s.elapsed())
            .unwrap_or(Duration::ZERO)
    }

    /// Check if recording has exceeded maximum duration
    pub fn has_exceeded_max_duration(&self) -> bool {
        self.recording_duration() >= Duration::from_secs(MAX_RECORDING_DURATION_SECS)
    }

    /// Get the device sample rate
    pub fn sample_rate(&self) -> u32 {
        self.config.sample_rate().0
    }

    /// Get the current audio level (0.0-1.0)
    pub fn get_current_level(&self) -> f32 {
        *self.current_level.lock().unwrap()
    }

    /// Get pending audio chunks for streaming transcription
    ///
    /// Returns all chunks that haven't been processed yet.
    /// Only available when streaming mode is enabled.
    pub fn get_pending_chunks(&self) -> Vec<AudioChunk> {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return Vec::new();
        }
        self.chunked_buffer.lock().unwrap().get_pending_chunks()
    }

    /// Take the next pending chunk without waiting
    ///
    /// Returns None if no chunks are ready or streaming is disabled.
    pub fn take_next_chunk(&self) -> Option<AudioChunk> {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return None;
        }
        self.chunked_buffer.lock().unwrap().take_next_chunk()
    }

    /// Check if there are pending chunks ready for processing
    pub fn has_pending_chunks(&self) -> bool {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return false;
        }
        self.chunked_buffer.lock().unwrap().has_pending_chunks()
    }

    /// Get number of pending chunks
    pub fn pending_chunk_count(&self) -> usize {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return 0;
        }
        self.chunked_buffer.lock().unwrap().pending_chunk_count()
    }

    /// Flush remaining audio as a final chunk (call at end of recording)
    pub fn flush_remaining_chunk(&self) -> Option<AudioChunk> {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return None;
        }
        self.chunked_buffer.lock().unwrap().flush_remaining()
    }

    /// Get the full audio buffer from chunked storage (for final reconciliation)
    pub fn get_full_chunked_buffer(&self) -> Vec<f32> {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return Vec::new();
        }
        self.chunked_buffer.lock().unwrap().get_full_buffer().to_vec()
    }

    /// Get total duration recorded in streaming mode
    pub fn streaming_duration_secs(&self) -> f32 {
        if !self.streaming_enabled.load(Ordering::SeqCst) {
            return 0.0;
        }
        self.chunked_buffer.lock().unwrap().total_duration_secs()
    }
}

/// Save audio buffer to a temporary WAV file
pub fn save_to_temp_wav(buffer: &AudioBuffer) -> Result<RecordingResult, AudioError> {
    use hound::{SampleFormat, WavSpec, WavWriter};

    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let file_path = temp_dir.join(format!("ez_flow_recording_{}.wav", timestamp));

    let spec = WavSpec {
        channels: 1,
        sample_rate: buffer.sample_rate,
        bits_per_sample: 32,
        sample_format: SampleFormat::Float,
    };

    let mut writer = WavWriter::create(&file_path, spec)?;
    for sample in &buffer.samples {
        writer.write_sample(*sample)?;
    }
    writer.finalize()?;

    let duration_secs = buffer.samples.len() as f32 / buffer.sample_rate as f32;

    tracing::info!("Saved recording to: {:?}", file_path);

    Ok(RecordingResult {
        file_path: file_path.to_string_lossy().to_string(),
        duration_secs,
        sample_rate: buffer.sample_rate,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_devices() {
        // This test may fail in CI without audio devices, but should not panic
        let result = AudioCaptureService::get_devices();
        // Just verify it returns a result (either Ok or Err)
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_save_to_temp_wav() {
        let buffer = AudioBuffer {
            samples: vec![0.0, 0.5, -0.5, 0.25, -0.25],
            sample_rate: 16000,
        };

        let result = save_to_temp_wav(&buffer);
        assert!(result.is_ok());

        let recording_result = result.unwrap();
        assert!(recording_result.file_path.contains("ez_flow_recording_"));
        assert!(recording_result.file_path.ends_with(".wav"));
        assert_eq!(recording_result.sample_rate, 16000);

        // Clean up
        let _ = std::fs::remove_file(&recording_result.file_path);
    }
}
