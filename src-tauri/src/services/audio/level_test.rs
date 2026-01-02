//! Tests for audio level calculation and flow

#[cfg(test)]
mod tests {
    use crate::services::audio::processing::calculate_audio_level;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    /// Simulate the audio level flow from capture to shared state
    #[test]
    fn test_audio_level_flow_simulation() {
        // Simulate the shared level (like AudioState::current_level)
        let shared_level = Arc::new(Mutex::new(0.0f32));
        let is_running = Arc::new(AtomicBool::new(true));

        // Simulate audio capture updating the level
        let capture_level = shared_level.clone();
        let capture_running = is_running.clone();

        let capture_thread = std::thread::spawn(move || {
            let mut sample_count = 0;
            while capture_running.load(Ordering::SeqCst) && sample_count < 50 {
                // Simulate speech-level audio (RMS ~0.1)
                let samples: Vec<f32> = (0..1600)
                    .map(|i| 0.15 * ((i as f32 * 0.1) + sample_count as f32).sin())
                    .collect();

                let level = calculate_audio_level(&samples);

                if let Ok(mut lvl) = capture_level.lock() {
                    *lvl = level;
                }

                sample_count += 1;
                std::thread::sleep(Duration::from_millis(20));
            }
        });

        // Simulate level emitter reading and "emitting"
        let emitter_level = shared_level.clone();
        let emitter_running = is_running.clone();
        let emitted_levels = Arc::new(Mutex::new(Vec::new()));
        let emitted_clone = emitted_levels.clone();

        let emitter_thread = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50)); // Wait for capture to start

            for _ in 0..20 {
                if !emitter_running.load(Ordering::SeqCst) {
                    break;
                }

                let level = *emitter_level.lock().unwrap();
                emitted_clone.lock().unwrap().push(level);

                std::thread::sleep(Duration::from_millis(50));
            }
        });

        // Wait for simulation
        std::thread::sleep(Duration::from_millis(1200));
        is_running.store(false, Ordering::SeqCst);

        capture_thread.join().unwrap();
        emitter_thread.join().unwrap();

        // Check results
        let levels = emitted_levels.lock().unwrap();

        // Should have emitted multiple levels
        assert!(
            levels.len() >= 10,
            "Should have emitted at least 10 levels, got {}",
            levels.len()
        );

        // At least some levels should be non-zero (speech simulation)
        let non_zero_count = levels.iter().filter(|&&l| l > 0.01).count();
        assert!(
            non_zero_count > 5,
            "Should have at least 5 non-zero levels, got {} out of {}. Levels: {:?}",
            non_zero_count,
            levels.len(),
            levels
        );

        println!("Emitted {} levels, {} non-zero", levels.len(), non_zero_count);
        println!("Sample levels: {:?}", &levels[..levels.len().min(10)]);
    }

    /// Test that level calculation produces expected values for speech
    #[test]
    fn test_speech_level_values() {
        // Simulate various speech amplitudes
        let test_cases = [
            (0.05, "quiet speech"),
            (0.1, "normal speech"),
            (0.2, "loud speech"),
            (0.3, "very loud speech"),
        ];

        for (amplitude, description) in test_cases {
            let samples: Vec<f32> = (0..1600)
                .map(|i| amplitude * (i as f32 * 0.1).sin())
                .collect();

            let level = calculate_audio_level(&samples);

            println!("{}: amplitude={}, level={:.4}", description, amplitude, level);

            assert!(
                level > 0.0,
                "{} should produce non-zero level, got {}",
                description,
                level
            );
            assert!(
                level <= 1.0,
                "{} should produce level <= 1.0, got {}",
                description,
                level
            );
        }
    }
}
