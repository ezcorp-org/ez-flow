//! Audio file decoder using Symphonia
//!
//! Decodes various audio formats to raw samples for transcription.

use super::TranscriptionError;
use crate::services::audio::processing::{resample_for_whisper, stereo_to_mono, AudioBuffer};
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Decode an audio file to f32 samples at 16kHz mono
pub fn decode_audio_file(path: &Path) -> Result<Vec<f32>, TranscriptionError> {
    if !path.exists() {
        return Err(TranscriptionError::InvalidAudioFile(format!(
            "File not found: {}",
            path.display()
        )));
    }

    let file = std::fs::File::open(path).map_err(|e| {
        TranscriptionError::InvalidAudioFile(format!("Failed to open file: {}", e))
    })?;

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create format hint from file extension
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    // Probe the format
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| TranscriptionError::InvalidAudioFile(format!("Failed to probe format: {}", e)))?;

    let mut format = probed.format;

    // Find the first audio track
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| TranscriptionError::InvalidAudioFile("No audio track found".to_string()))?;

    let track_id = track.id;
    let codec_params = track.codec_params.clone();

    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| TranscriptionError::InvalidAudioFile("Unknown sample rate".to_string()))?;

    let channels = codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    tracing::debug!(
        "Decoding audio: {} Hz, {} channels",
        sample_rate,
        channels
    );

    // Create decoder
    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| TranscriptionError::InvalidAudioFile(format!("Failed to create decoder: {}", e)))?;

    // Decode all packets
    let mut samples: Vec<f32> = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(symphonia::core::errors::Error::ResetRequired) => {
                // Reset the decoder
                decoder.reset();
                continue;
            }
            Err(e) => {
                tracing::warn!("Packet read error: {}", e);
                break;
            }
        };

        // Skip packets from other tracks
        if packet.track_id() != track_id {
            continue;
        }

        // Decode the packet
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(e)) => {
                tracing::warn!("Decode error: {}", e);
                continue;
            }
            Err(e) => {
                return Err(TranscriptionError::InvalidAudioFile(format!(
                    "Failed to decode: {}",
                    e
                )));
            }
        };

        // Get or create sample buffer
        if sample_buf.is_none() {
            let spec = *decoded.spec();
            let duration = decoded.capacity() as u64;
            sample_buf = Some(SampleBuffer::new(duration, spec));
        }

        if let Some(ref mut buf) = sample_buf {
            buf.copy_interleaved_ref(decoded);
            samples.extend_from_slice(buf.samples());
        }
    }

    if samples.is_empty() {
        return Err(TranscriptionError::InvalidAudioFile(
            "No audio samples decoded".to_string(),
        ));
    }

    tracing::debug!("Decoded {} raw samples", samples.len());

    // Convert stereo to mono if needed
    let mono_samples = if channels > 1 {
        tracing::debug!("Converting {} channels to mono", channels);
        // Interleaved samples: chunk by channels and average
        samples
            .chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
            .collect()
    } else {
        samples
    };

    tracing::debug!("Mono samples: {}", mono_samples.len());

    // Resample to 16kHz if needed
    let buffer = AudioBuffer::new(mono_samples, sample_rate);
    let resampled = resample_for_whisper(buffer).map_err(|e| {
        TranscriptionError::AudioError(format!("Resampling failed: {}", e))
    })?;

    tracing::info!(
        "Audio decoded: {} samples at 16kHz ({:.2}s)",
        resampled.len(),
        resampled.len() as f32 / 16000.0
    );

    Ok(resampled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_decode_nonexistent_file() {
        let result = decode_audio_file(Path::new("/nonexistent/audio.wav"));
        assert!(matches!(result, Err(TranscriptionError::InvalidAudioFile(_))));
    }

    #[test]
    fn test_decode_invalid_file() {
        // Create a temp file with invalid content
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_invalid.wav");
        std::fs::write(&test_file, b"not valid audio").unwrap();

        let result = decode_audio_file(&test_file);
        assert!(result.is_err());

        std::fs::remove_file(test_file).ok();
    }
}
