//! Integration test for audio level capture
//! Run with: cargo test --test audio_level_test -- --nocapture

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[test]
fn test_real_audio_capture_levels() {
    // Initialize tracing for debug output
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(true)
        .init();

    println!("=== Testing Real Audio Capture ===");

    // Try to create audio capture service
    let service = match ez_flow_lib::services::audio::AudioCaptureService::new() {
        Ok(s) => {
            println!("✓ AudioCaptureService created successfully");
            s
        }
        Err(e) => {
            println!("✗ Failed to create AudioCaptureService: {}", e);
            println!("  This is expected in environments without audio devices");
            return;
        }
    };

    println!("  Sample rate: {} Hz", service.sample_rate());

    // Start recording
    let mut service = service;
    if let Err(e) = service.start() {
        println!("✗ Failed to start recording: {}", e);
        return;
    }
    println!("✓ Recording started");

    // Collect levels for 2 seconds
    let mut levels: Vec<f32> = Vec::new();
    let start = std::time::Instant::now();

    println!("  Collecting audio levels for 2 seconds...");
    println!("  (Make some noise or speak into the microphone)");

    while start.elapsed() < Duration::from_secs(2) {
        let level = service.get_current_level();
        levels.push(level);

        if level > 0.01 {
            println!("  Level: {:.4}", level);
        }

        std::thread::sleep(Duration::from_millis(100));
    }

    // Stop recording
    match service.stop() {
        Ok(buffer) => {
            println!("✓ Recording stopped: {} samples", buffer.samples.len());
        }
        Err(e) => {
            println!("✗ Failed to stop recording: {}", e);
        }
    }

    // Analyze results
    let non_zero_levels: Vec<f32> = levels.iter().filter(|&&l| l > 0.01).copied().collect();
    let max_level = levels.iter().copied().fold(0.0f32, f32::max);

    println!("\n=== Results ===");
    println!("  Total level readings: {}", levels.len());
    println!("  Non-zero readings: {}", non_zero_levels.len());
    println!("  Max level: {:.4}", max_level);

    if non_zero_levels.is_empty() {
        println!("\n⚠ WARNING: No audio levels detected!");
        println!("  Possible causes:");
        println!("  - Microphone is muted or disconnected");
        println!("  - No sound was made during the test");
        println!("  - Audio permission denied");
    } else {
        println!("\n✓ Audio levels are being captured correctly!");
        println!("  Sample non-zero levels: {:?}", &non_zero_levels[..non_zero_levels.len().min(5)]);
    }
}
