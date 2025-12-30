//! Audio processing utilities
//!
//! Provides resampling and format conversion for Whisper compatibility.

use super::AudioError;
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

/// Target sample rate for Whisper
pub const WHISPER_SAMPLE_RATE: u32 = 16000;

/// Audio buffer with sample data and metadata
#[derive(Debug, Clone)]
pub struct AudioBuffer {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

impl AudioBuffer {
    /// Create a new audio buffer
    pub fn new(samples: Vec<f32>, sample_rate: u32) -> Self {
        Self {
            samples,
            sample_rate,
        }
    }

    /// Get duration in seconds
    pub fn duration_secs(&self) -> f32 {
        if self.sample_rate == 0 {
            return 0.0;
        }
        self.samples.len() as f32 / self.sample_rate as f32
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }
}

/// Convert stereo audio to mono by averaging channels
pub fn stereo_to_mono(stereo: &[f32]) -> Vec<f32> {
    stereo
        .chunks(2)
        .map(|chunk| {
            if chunk.len() == 2 {
                (chunk[0] + chunk[1]) / 2.0
            } else {
                chunk[0]
            }
        })
        .collect()
}

/// Resample audio to Whisper-compatible 16kHz
pub fn resample_for_whisper(audio: AudioBuffer) -> Result<Vec<f32>, AudioError> {
    if audio.sample_rate == WHISPER_SAMPLE_RATE {
        return Ok(audio.samples);
    }

    if audio.samples.is_empty() {
        return Ok(Vec::new());
    }

    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let resample_ratio = WHISPER_SAMPLE_RATE as f64 / audio.sample_rate as f64;

    // Calculate chunk size that works with the resampler
    let chunk_size = 1024;
    let mut resampler = SincFixedIn::<f32>::new(resample_ratio, 2.0, params, chunk_size, 1)
        .map_err(|e| AudioError::ResampleError(e.to_string()))?;

    let mut output = Vec::new();
    let mut position = 0;

    while position < audio.samples.len() {
        let end = (position + chunk_size).min(audio.samples.len());
        let mut chunk = audio.samples[position..end].to_vec();

        // Pad last chunk if needed
        if chunk.len() < chunk_size {
            chunk.resize(chunk_size, 0.0);
        }

        let input = vec![chunk];
        let result = resampler
            .process(&input, None)
            .map_err(|e| AudioError::ResampleError(e.to_string()))?;

        if let Some(channel) = result.into_iter().next() {
            output.extend(channel);
        }

        position += chunk_size;
    }

    // Trim output to expected length
    let expected_len = ((audio.samples.len() as f64) * resample_ratio).ceil() as usize;
    output.truncate(expected_len);

    tracing::debug!(
        "Resampled {} samples @ {}Hz to {} samples @ {}Hz",
        audio.samples.len(),
        audio.sample_rate,
        output.len(),
        WHISPER_SAMPLE_RATE
    );

    Ok(output)
}

/// Calculate audio level using RMS (Root Mean Square)
///
/// Returns a normalized value between 0.0 and 1.0 suitable for visualization.
/// Typical speech produces RMS values of 0.01-0.3, which are scaled to 0.0-1.0.
pub fn calculate_audio_level(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    // RMS calculation
    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_squares / samples.len() as f32).sqrt();

    // Normalize to 0-1 range (typical speech is 0.01-0.3 RMS)
    // Multiply by 5.0 to scale typical speech to ~0.5-1.0 range
    (rms * 5.0).min(1.0)
}

/// Normalize audio samples to [-1.0, 1.0] range
pub fn normalize(samples: &mut [f32]) {
    let max_amplitude = samples
        .iter()
        .map(|s| s.abs())
        .fold(0.0f32, |a, b| a.max(b));

    if max_amplitude > 0.0 && max_amplitude != 1.0 {
        let scale = 1.0 / max_amplitude;
        for sample in samples.iter_mut() {
            *sample *= scale;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_buffer_creation() {
        let samples = vec![0.0, 0.5, -0.5, 0.25];
        let buffer = AudioBuffer::new(samples.clone(), 16000);

        assert_eq!(buffer.samples, samples);
        assert_eq!(buffer.sample_rate, 16000);
    }

    #[test]
    fn test_audio_buffer_duration() {
        let samples = vec![0.0; 16000]; // 1 second of audio at 16kHz
        let buffer = AudioBuffer::new(samples, 16000);

        assert!((buffer.duration_secs() - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_stereo_to_mono() {
        let stereo = vec![0.0, 1.0, 0.5, 0.5, -0.5, 0.5];
        let mono = stereo_to_mono(&stereo);

        assert_eq!(mono.len(), 3);
        assert!((mono[0] - 0.5).abs() < 0.001); // (0.0 + 1.0) / 2 = 0.5
        assert!((mono[1] - 0.5).abs() < 0.001); // (0.5 + 0.5) / 2 = 0.5
        assert!((mono[2] - 0.0).abs() < 0.001); // (-0.5 + 0.5) / 2 = 0.0
    }

    #[test]
    fn test_resample_same_rate() {
        let samples = vec![0.0, 0.5, -0.5, 0.25];
        let buffer = AudioBuffer::new(samples.clone(), WHISPER_SAMPLE_RATE);

        let result = resample_for_whisper(buffer).unwrap();
        assert_eq!(result, samples);
    }

    #[test]
    fn test_resample_44100_to_16000() {
        // Create a simple sine wave at 44100Hz
        let sample_rate = 44100u32;
        let duration_secs = 0.1;
        let num_samples = (sample_rate as f32 * duration_secs) as usize;
        let samples: Vec<f32> = (0..num_samples)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin())
            .collect();

        let buffer = AudioBuffer::new(samples.clone(), sample_rate);
        let result = resample_for_whisper(buffer).unwrap();

        // Output should have approximately the right number of samples
        let expected_len = (num_samples as f64 * (16000.0 / 44100.0)).ceil() as usize;
        // Allow some tolerance due to resampling
        assert!(
            (result.len() as i32 - expected_len as i32).abs() < 100,
            "Expected ~{} samples, got {}",
            expected_len,
            result.len()
        );
    }

    #[test]
    fn test_resample_empty_buffer() {
        let buffer = AudioBuffer::new(Vec::new(), 44100);
        let result = resample_for_whisper(buffer).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_normalize() {
        let mut samples = vec![0.0, 0.25, -0.5, 0.1];
        normalize(&mut samples);

        // The max amplitude was 0.5, so everything should be scaled by 2
        assert!((samples[0] - 0.0).abs() < 0.001);
        assert!((samples[1] - 0.5).abs() < 0.001);
        assert!((samples[2] - (-1.0)).abs() < 0.001);
        assert!((samples[3] - 0.2).abs() < 0.001);
    }

    #[test]
    fn test_calculate_audio_level_silence() {
        let samples = vec![0.0; 100];
        let level = calculate_audio_level(&samples);
        assert!((level - 0.0).abs() < 0.001, "Silence should return 0.0");
    }

    #[test]
    fn test_calculate_audio_level_loud() {
        // Full-scale samples (amplitude of 1.0)
        let samples = vec![1.0, -1.0, 1.0, -1.0];
        let level = calculate_audio_level(&samples);
        // RMS of full-scale alternating signal is 1.0, times 5.0 = 5.0, clamped to 1.0
        assert!((level - 1.0).abs() < 0.001, "Loud signal should return 1.0");
    }

    #[test]
    fn test_calculate_audio_level_speech() {
        // Typical speech level (RMS around 0.1)
        let samples: Vec<f32> = (0..100).map(|i| 0.1 * (i as f32 * 0.1).sin()).collect();
        let level = calculate_audio_level(&samples);
        // Should be in the 0.1-0.5 range for typical speech-level signal
        assert!(
            level > 0.0 && level < 1.0,
            "Speech-level signal should return value between 0 and 1, got {}",
            level
        );
    }

    #[test]
    fn test_calculate_audio_level_empty() {
        let samples: Vec<f32> = vec![];
        let level = calculate_audio_level(&samples);
        assert!(
            (level - 0.0).abs() < 0.001,
            "Empty buffer should return 0.0"
        );
    }
}
