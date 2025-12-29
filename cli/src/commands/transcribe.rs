//! Transcribe command - transcribe audio files

use super::Context;
use crate::output::TranscriptionOutput;
use anyhow::{bail, Context as AnyhowContext, Result};
use std::path::Path;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Run the transcribe command
pub fn run(file: &Path, ctx: &Context) -> Result<()> {
    // Validate file exists
    if !file.exists() {
        bail!("Audio file not found: {}", file.display());
    }

    tracing::info!("Transcribing file: {}", file.display());

    // Load the audio file
    let audio_samples = load_audio_file(file)?;

    // Get model path
    let model_path = get_model_path(&ctx.model)?;

    // Check if model exists
    if !model_path.exists() {
        bail!(
            "Model '{}' not downloaded. Run: ezflow models download {}",
            ctx.model,
            ctx.model
        );
    }

    // Initialize Whisper
    tracing::info!("Loading model: {}", ctx.model);
    let params = WhisperContextParameters::default();
    let whisper_ctx = WhisperContext::new_with_params(model_path.to_str().unwrap(), params)
        .context("Failed to load Whisper model")?;

    // Configure transcription parameters
    let mut full_params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    full_params.set_print_special(false);
    full_params.set_print_progress(false);
    full_params.set_print_realtime(false);
    full_params.set_print_timestamps(false);

    if let Some(ref lang) = ctx.language {
        full_params.set_language(Some(lang));
    } else {
        full_params.set_language(Some("auto"));
    }

    // Run inference
    tracing::info!("Running transcription...");
    let start_time = std::time::Instant::now();

    let mut state = whisper_ctx
        .create_state()
        .context("Failed to create Whisper state")?;

    state
        .full(full_params, &audio_samples)
        .context("Transcription failed")?;

    let inference_time = start_time.elapsed();

    // Collect results
    let num_segments = state.full_n_segments().context("Failed to get segments")?;
    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment_text) = state.full_get_segment_text(i) {
            text.push_str(&segment_text);
        }
    }

    let text = text.trim().to_string();

    // Get detected language
    let language = state
        .full_lang_id_from_state()
        .ok()
        .and_then(|id| whisper_rs::get_lang_str(id).map(|s| s.to_string()));

    let audio_duration_ms = (audio_samples.len() as f32 / 16.0) as u64;

    // Output result
    let output = TranscriptionOutput {
        text,
        duration_ms: audio_duration_ms,
        model: ctx.model.clone(),
        language,
        inference_time_ms: inference_time.as_millis() as u64,
    };

    output.print(ctx.json_output);

    Ok(())
}

/// Load and resample audio file to 16kHz mono f32
fn load_audio_file(path: &Path) -> Result<Vec<f32>> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(path).context("Failed to open audio file")?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Set up hint for format detection
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    // Probe the format
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .context("Unsupported audio format")?;

    let mut format = probed.format;

    // Get the default audio track
    let track = format
        .default_track()
        .context("No audio track found")?
        .clone();

    let decoder_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .context("Unsupported codec")?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .context("Unknown sample rate")?;
    let channels = track
        .codec_params
        .channels
        .context("Unknown channel count")?
        .count();

    // Decode all samples
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(_)) => break, // EOF
            Err(e) => return Err(e.into()),
        };

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(_) => continue,
        };

        let spec = *decoded.spec();
        let duration = decoded.capacity() as u64;

        let mut sample_buf = SampleBuffer::<f32>::new(duration, spec);
        sample_buf.copy_interleaved_ref(decoded);

        all_samples.extend_from_slice(sample_buf.samples());
    }

    // Convert to mono if stereo
    let mono_samples = if channels > 1 {
        all_samples
            .chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        all_samples
    };

    // Resample to 16kHz if needed
    let samples_16k = if sample_rate != 16000 {
        resample(&mono_samples, sample_rate, 16000)?
    } else {
        mono_samples
    };

    tracing::debug!(
        "Loaded {} samples ({:.2}s)",
        samples_16k.len(),
        samples_16k.len() as f32 / 16000.0
    );

    Ok(samples_16k)
}

/// Resample audio to target sample rate
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
    use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType};

    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: rubato::WindowFunction::BlackmanHarris2,
    };

    let mut resampler = SincFixedIn::<f32>::new(
        to_rate as f64 / from_rate as f64,
        2.0,
        params,
        samples.len(),
        1,
    )
    .context("Failed to create resampler")?;

    let waves_in = vec![samples.to_vec()];
    let mut waves_out = resampler
        .process(&waves_in, None)
        .context("Resampling failed")?;

    Ok(waves_out.remove(0))
}

/// Get the path to a model file
fn get_model_path(model_id: &str) -> Result<std::path::PathBuf> {
    let dirs = directories::ProjectDirs::from("com", "ezflow", "EZ Flow")
        .context("Failed to get project directories")?;

    let models_dir = dirs.data_dir().join("models");
    let filename = format!("ggml-{}.bin", model_id);

    Ok(models_dir.join(filename))
}
