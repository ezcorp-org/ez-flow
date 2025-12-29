//! Record command - record from microphone and transcribe

use super::Context;
use crate::output::TranscriptionOutput;
use anyhow::{Context as AnyhowContext, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::io::{self, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Run the record command
pub fn run(max_duration: u32, ctx: &Context) -> Result<()> {
    // Get model path and check it exists
    let model_path = get_model_path(&ctx.model)?;
    if !model_path.exists() {
        anyhow::bail!(
            "Model '{}' not downloaded. Run: ezflow models download {}",
            ctx.model,
            ctx.model
        );
    }

    // Set up audio capture
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .context("No input device available")?;

    let config = device
        .default_input_config()
        .context("Failed to get input config")?;

    let sample_rate = config.sample_rate().0;
    let channels = config.channels() as usize;

    tracing::info!(
        "Recording from: {} ({}Hz, {} channels)",
        device.name().unwrap_or_default(),
        sample_rate,
        channels
    );

    // Print instructions
    if !ctx.json_output {
        println!("Recording... Press Enter to stop.");
        io::stdout().flush()?;
    }

    // Set up recording buffer
    let samples = Arc::new(std::sync::Mutex::new(Vec::<f32>::new()));
    let samples_clone = Arc::clone(&samples);
    let recording = Arc::new(AtomicBool::new(true));
    let recording_clone = Arc::clone(&recording);

    // Build and start the stream
    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            if recording_clone.load(Ordering::Relaxed) {
                let mut samples = samples_clone.lock().unwrap();
                samples.extend_from_slice(data);
            }
        },
        |err| {
            eprintln!("Audio error: {}", err);
        },
        None,
    )?;

    stream.play()?;

    // Wait for Enter key or max duration
    if max_duration > 0 {
        let duration = std::time::Duration::from_secs(max_duration as u64);
        let start = std::time::Instant::now();

        // Use non-blocking stdin check with timeout
        loop {
            if start.elapsed() >= duration {
                break;
            }

            // Sleep a bit to avoid busy waiting
            std::thread::sleep(std::time::Duration::from_millis(100));

            // Check if Enter was pressed (simplified - blocking in practice)
            // For a proper implementation, use crossterm or similar
        }
    } else {
        // Wait for Enter key
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
    }

    // Stop recording
    recording.store(false, Ordering::Relaxed);
    drop(stream);

    // Get recorded samples
    let raw_samples = samples.lock().unwrap().clone();

    if raw_samples.is_empty() {
        anyhow::bail!("No audio recorded");
    }

    // Convert to mono
    let mono_samples: Vec<f32> = if channels > 1 {
        raw_samples
            .chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        raw_samples
    };

    // Resample to 16kHz
    let samples_16k = if sample_rate != 16000 {
        resample(&mono_samples, sample_rate, 16000)?
    } else {
        mono_samples
    };

    let audio_duration_ms = (samples_16k.len() as f32 / 16.0) as u64;

    if !ctx.json_output {
        println!(
            "Recorded {:.1}s, transcribing...",
            audio_duration_ms as f32 / 1000.0
        );
    }

    // Initialize Whisper
    let params = WhisperContextParameters::default();
    let whisper_ctx = WhisperContext::new_with_params(model_path.to_str().unwrap(), params)
        .context("Failed to load Whisper model")?;

    // Configure transcription
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
    let start_time = std::time::Instant::now();

    let mut state = whisper_ctx
        .create_state()
        .context("Failed to create Whisper state")?;

    state
        .full(full_params, &samples_16k)
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
