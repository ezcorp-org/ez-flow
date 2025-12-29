# EZ Flow - Technical Architecture Document

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Last Updated** | 2025-12-28 |
| **Status** | Draft |
| **PRD Reference** | docs/prd.md |

---

## 1. Introduction & High-Level Architecture

### 1.1 System Overview

EZ Flow is a privacy-first, local-only speech-to-text desktop application built with Tauri v2. The system performs all transcription locally using OpenAI's Whisper models via whisper-rs, ensuring user audio never leaves their device.

### 1.2 Architecture Philosophy

- **Privacy by Design**: All processing occurs locally; no network calls for transcription
- **Platform Abstraction**: Core logic in Rust with platform-specific implementations isolated
- **Progressive Enhancement**: CPU-first with optional GPU acceleration
- **Minimal Dependencies**: Lean dependency tree to reduce attack surface and bundle size

### 1.3 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        EZ Flow Application                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Frontend (Svelte 5)                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │Main View │ │Settings  │ │History   │ │Model Mgr │   │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │    │
│  │       └────────────┴────────────┴────────────┘         │    │
│  │                         │                               │    │
│  │              ┌──────────▼──────────┐                   │    │
│  │              │   Tauri IPC Bridge   │                   │    │
│  └──────────────┴──────────┬──────────┴───────────────────┘    │
│                            │                                    │
├────────────────────────────┼────────────────────────────────────┤
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │                  Rust Backend (Tauri)                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │Audio Service│ │Transcription│ │ Platform Services   │  │  │
│  │  │   (cpal)    │ │ (whisper-rs)│ │(hotkey/text inject) │  │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘  │  │
│  │         │               │                    │             │  │
│  │  ┌──────▼───────────────▼────────────────────▼──────────┐ │  │
│  │  │              State Management (AppState)              │ │  │
│  │  └───────────────────────┬───────────────────────────────┘ │  │
│  │                          │                                  │  │
│  │  ┌───────────────────────▼───────────────────────────────┐ │  │
│  │  │        Storage Layer (SQLite + File System)           │ │  │
│  └──┴───────────────────────────────────────────────────────┴─┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Data Flow

1. **Audio Capture**: User activates recording via hotkey → cpal captures microphone audio
2. **Audio Processing**: Raw audio → resampled to 16kHz mono → buffered for Whisper
3. **Transcription**: Audio buffer → whisper-rs inference → text result
4. **Output**: Text → clipboard + optional auto-paste to active application
5. **Storage**: Transcription → SQLite history database

---

## 2. Tech Stack

### 2.1 Core Framework

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| App Framework | Tauri | v2.x | Native performance, small bundle, Rust backend |
| Frontend | Svelte | 5.x | Lightweight, reactive, excellent DX |
| Backend | Rust | 1.75+ | Memory safety, performance, native integrations |
| Build Tool | Vite | 5.x | Fast HMR, Svelte plugin ecosystem |

### 2.2 Rust Dependencies

| Crate | Purpose | Notes |
|-------|---------|-------|
| `whisper-rs` | Whisper inference | Bindings to whisper.cpp |
| `cpal` | Audio capture | Cross-platform audio I/O |
| `rubato` | Audio resampling | Resample to 16kHz for Whisper |
| `symphonia` | Audio file decoding | MP3, FLAC, WAV, OGG support |
| `rusqlite` | SQLite database | Transcription history |
| `serde` / `serde_json` | Serialization | IPC and config |
| `tokio` | Async runtime | Background tasks |
| `tauri` | App framework | Window management, IPC |
| `global-hotkey` | System hotkeys | Push-to-talk activation |
| `arboard` | Clipboard | Cross-platform clipboard access |
| `reqwest` | HTTP client | Model downloads |
| `directories` | App directories | Platform-appropriate paths |
| `tracing` | Logging | Structured logging |
| `thiserror` | Error handling | Ergonomic error types |

### 2.3 Platform-Specific Dependencies

| Platform | Crate/Library | Purpose |
|----------|---------------|---------|
| Windows | `windows-rs` | SendInput for text injection |
| macOS | `core-foundation` | CGEvent for text injection |
| Linux | `x11rb` or shell (`xdotool`) | X11/Wayland text injection |

### 2.4 GPU Acceleration

| Platform | Technology | Crate/Binding |
|----------|------------|---------------|
| NVIDIA | CUDA | `whisper-rs` with `cuda` feature |
| Apple Silicon | Metal/CoreML | `whisper-rs` with `metal` feature |
| CPU Fallback | AVX2/NEON | Default whisper.cpp SIMD |

### 2.5 Frontend Dependencies

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | Tauri IPC and window APIs |
| `@tauri-apps/plugin-*` | Official Tauri plugins |
| `svelte` | UI framework |
| `@sveltejs/vite-plugin-svelte` | Vite integration |
| `tailwindcss` | Utility-first CSS |

### 2.6 Development & Build

| Tool | Purpose |
|------|---------|
| `cargo` | Rust package manager |
| `bun` | JS package manager & runtime |
| `tauri-cli` | Tauri build tooling |
| `cross` | Cross-compilation |
| GitHub Actions | CI/CD |

### 2.7 Testing

| Tool | Scope |
|------|-------|
| `cargo test` | Rust unit/integration tests |
| `bun test` | Frontend unit tests |
| Playwright + `tauri-driver` | E2E tests |

---

## 3. Project Structure

```
ez-flow/
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs                  # Build script (GPU detection)
│   ├── tauri.conf.json           # Tauri configuration
│   ├── capabilities/             # Tauri v2 capabilities
│   │   └── default.json
│   ├── icons/                    # App icons
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Library root
│       ├── commands/             # Tauri IPC commands
│       │   ├── mod.rs
│       │   ├── audio.rs          # Audio capture commands
│       │   ├── transcription.rs  # Transcription commands
│       │   ├── models.rs         # Model management
│       │   ├── settings.rs       # Settings commands
│       │   └── history.rs        # History commands
│       ├── services/             # Core business logic
│       │   ├── mod.rs
│       │   ├── audio/
│       │   │   ├── mod.rs
│       │   │   ├── capture.rs    # cpal audio capture
│       │   │   └── processing.rs # Resampling, buffering
│       │   ├── transcription/
│       │   │   ├── mod.rs
│       │   │   ├── engine.rs     # whisper-rs wrapper
│       │   │   └── models.rs     # Model loading/management
│       │   ├── platform/
│       │   │   ├── mod.rs
│       │   │   ├── hotkey.rs     # Global hotkey registration
│       │   │   ├── text_inject.rs # Platform text injection trait
│       │   │   ├── windows.rs    # Windows implementation
│       │   │   ├── macos.rs      # macOS implementation
│       │   │   └── linux.rs      # Linux implementation
│       │   └── storage/
│       │       ├── mod.rs
│       │       ├── database.rs   # SQLite operations
│       │       └── files.rs      # Model file management
│       ├── state/                # Application state
│       │   ├── mod.rs
│       │   └── app_state.rs      # Shared state definitions
│       ├── models/               # Data structures
│       │   ├── mod.rs
│       │   ├── transcription.rs
│       │   ├── settings.rs
│       │   └── audio.rs
│       └── error.rs              # Error types
│
├── src/                          # Svelte frontend
│   ├── app.html                  # HTML template
│   ├── app.css                   # Global styles (Tailwind)
│   ├── main.ts                   # Entry point
│   ├── App.svelte                # Root component
│   ├── lib/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── AudioVisualizer.svelte
│   │   │   ├── TranscriptionDisplay.svelte
│   │   │   ├── ModelSelector.svelte
│   │   │   ├── SettingsPanel.svelte
│   │   │   ├── HistoryList.svelte
│   │   │   └── StatusIndicator.svelte
│   │   ├── stores/               # Svelte stores
│   │   │   ├── transcription.ts  # Current transcription state
│   │   │   ├── settings.ts       # User settings
│   │   │   ├── models.ts         # Available models
│   │   │   └── recording.ts      # Recording state
│   │   ├── services/             # Frontend services
│   │   │   ├── tauri.ts          # Tauri IPC wrappers
│   │   │   └── hotkeys.ts        # Hotkey display helpers
│   │   └── types/                # TypeScript types
│   │       └── index.ts          # Shared type definitions
│   └── routes/                   # Views (if using routing)
│       ├── Main.svelte           # Main transcription view
│       ├── Settings.svelte       # Settings view
│       └── History.svelte        # History view
│
├── tests/                        # E2E tests
│   ├── e2e/
│   │   ├── transcription.spec.ts
│   │   ├── settings.spec.ts
│   │   └── history.spec.ts
│   └── fixtures/
│       └── test-audio/           # Test audio files
│
├── docs/                         # Documentation
│   ├── prd.md
│   ├── architecture.md
│   └── stories/                  # User stories
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI pipeline
│       └── release.yml           # Release builds
│
├── package.json                  # Frontend dependencies
├── bun.lockb                     # Bun lockfile
├── vite.config.ts                # Vite configuration
├── svelte.config.js              # Svelte configuration
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md
```

---

## 4. Rust Backend Architecture

### 4.1 Service Layer Design

The backend follows a service-oriented architecture with clear separation of concerns:

```rust
// src-tauri/src/services/mod.rs
pub mod audio;
pub mod transcription;
pub mod platform;
pub mod storage;

// Each service is initialized and managed through AppState
```

### 4.2 Core Traits

```rust
// Platform abstraction for text injection
pub trait TextInjector: Send + Sync {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError>;
    fn supports_paste(&self) -> bool;
}

// Transcription engine abstraction
pub trait TranscriptionEngine: Send + Sync {
    fn transcribe(&self, audio: &AudioBuffer) -> Result<TranscriptionResult, TranscriptionError>;
    fn transcribe_stream(&self, audio: impl Stream<Item = AudioChunk>) -> impl Stream<Item = PartialResult>;
    fn load_model(&mut self, model: &WhisperModel) -> Result<(), ModelError>;
}

// Audio capture abstraction
pub trait AudioCapture: Send + Sync {
    fn start(&mut self) -> Result<(), AudioError>;
    fn stop(&mut self) -> Result<AudioBuffer, AudioError>;
    fn get_devices(&self) -> Vec<AudioDevice>;
    fn set_device(&mut self, device: &AudioDevice) -> Result<(), AudioError>;
}
```

### 4.3 State Management

```rust
// src-tauri/src/state/app_state.rs
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub transcription_engine: Arc<RwLock<WhisperEngine>>,
    pub audio_capture: Arc<RwLock<AudioCaptureService>>,
    pub settings: Arc<RwLock<Settings>>,
    pub db: Arc<Database>,
    pub text_injector: Arc<dyn TextInjector>,
}

impl AppState {
    pub fn new() -> Result<Self, AppError> {
        let text_injector: Arc<dyn TextInjector> = {
            #[cfg(target_os = "windows")]
            { Arc::new(WindowsTextInjector::new()?) }
            #[cfg(target_os = "macos")]
            { Arc::new(MacOSTextInjector::new()?) }
            #[cfg(target_os = "linux")]
            { Arc::new(LinuxTextInjector::new()?) }
        };

        // ... initialize other services
    }
}
```

### 4.4 Error Handling Strategy

```rust
// src-tauri/src/error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Audio capture error: {0}")]
    Audio(#[from] AudioError),

    #[error("Transcription error: {0}")]
    Transcription(#[from] TranscriptionError),

    #[error("Platform error: {0}")]
    Platform(#[from] PlatformError),

    #[error("Storage error: {0}")]
    Storage(#[from] StorageError),

    #[error("Model error: {0}")]
    Model(#[from] ModelError),
}

// Implement Into<tauri::InvokeError> for frontend communication
impl From<AppError> for tauri::InvokeError {
    fn from(err: AppError) -> Self {
        tauri::InvokeError::from(err.to_string())
    }
}
```

### 4.5 Async Task Management

```rust
// Background transcription with progress events
pub async fn transcribe_with_progress(
    state: &AppState,
    audio: AudioBuffer,
    window: tauri::Window,
) -> Result<TranscriptionResult, AppError> {
    let engine = state.transcription_engine.read().await;

    // Emit progress events to frontend
    let progress_callback = |progress: f32| {
        let _ = window.emit("transcription:progress", progress);
    };

    let result = engine.transcribe_with_callback(&audio, progress_callback).await?;

    // Save to history
    state.db.save_transcription(&result).await?;

    Ok(result)
}
```

---

## 5. Frontend Architecture (Svelte)

### 5.1 State Management with Svelte 5 Runes

```typescript
// src/lib/stores/transcription.ts
import { writable, derived } from 'svelte/store';

interface TranscriptionState {
  isRecording: boolean;
  isProcessing: boolean;
  currentText: string;
  partialText: string;
  error: string | null;
}

function createTranscriptionStore() {
  const { subscribe, set, update } = writable<TranscriptionState>({
    isRecording: false,
    isProcessing: false,
    currentText: '',
    partialText: '',
    error: null,
  });

  return {
    subscribe,
    startRecording: () => update(s => ({ ...s, isRecording: true, error: null })),
    stopRecording: () => update(s => ({ ...s, isRecording: false })),
    setProcessing: (processing: boolean) => update(s => ({ ...s, isProcessing: processing })),
    setResult: (text: string) => update(s => ({ ...s, currentText: text, isProcessing: false })),
    setPartial: (text: string) => update(s => ({ ...s, partialText: text })),
    setError: (error: string) => update(s => ({ ...s, error, isProcessing: false })),
    reset: () => set({ isRecording: false, isProcessing: false, currentText: '', partialText: '', error: null }),
  };
}

export const transcription = createTranscriptionStore();
```

### 5.2 Tauri IPC Service Layer

```typescript
// src/lib/services/tauri.ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { TranscriptionResult, Settings, WhisperModel, AudioDevice } from '$lib/types';

export const tauriService = {
  // Audio Commands
  async startRecording(): Promise<void> {
    return invoke('start_recording');
  },

  async stopRecording(): Promise<TranscriptionResult> {
    return invoke('stop_recording');
  },

  async getAudioDevices(): Promise<AudioDevice[]> {
    return invoke('get_audio_devices');
  },

  async setAudioDevice(deviceId: string): Promise<void> {
    return invoke('set_audio_device', { deviceId });
  },

  // Model Commands
  async getAvailableModels(): Promise<WhisperModel[]> {
    return invoke('get_available_models');
  },

  async downloadModel(modelId: string): Promise<void> {
    return invoke('download_model', { modelId });
  },

  async setActiveModel(modelId: string): Promise<void> {
    return invoke('set_active_model', { modelId });
  },

  // Settings Commands
  async getSettings(): Promise<Settings> {
    return invoke('get_settings');
  },

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    return invoke('update_settings', { settings });
  },

  // Event Listeners
  onTranscriptionProgress(callback: (progress: number) => void) {
    return listen<number>('transcription:progress', (event) => callback(event.payload));
  },

  onPartialTranscription(callback: (text: string) => void) {
    return listen<string>('transcription:partial', (event) => callback(event.payload));
  },

  onRecordingStatus(callback: (status: { isRecording: boolean; level: number }) => void) {
    return listen('recording:status', (event) => callback(event.payload as any));
  },
};
```

### 5.3 Component Architecture

```svelte
<!-- src/lib/components/TranscriptionDisplay.svelte -->
<script lang="ts">
  import { transcription } from '$lib/stores/transcription';
  import { tauriService } from '$lib/services/tauri';
  import { onMount } from 'svelte';

  let progress = $state(0);

  onMount(() => {
    const unsubscribe = tauriService.onTranscriptionProgress((p) => {
      progress = p;
    });
    return () => unsubscribe.then(fn => fn());
  });
</script>

<div class="transcription-display">
  {#if $transcription.isProcessing}
    <div class="progress-bar" style="width: {progress * 100}%"></div>
    <p class="partial">{$transcription.partialText}</p>
  {:else if $transcription.currentText}
    <p class="result">{$transcription.currentText}</p>
  {:else}
    <p class="placeholder">Press and hold to record...</p>
  {/if}
</div>
```

### 5.4 Hotkey Integration

```typescript
// src/lib/services/hotkeys.ts
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { tauriService } from './tauri';
import { transcription } from '$lib/stores/transcription';

export async function setupHotkeys(hotkey: string) {
  await register(hotkey, async (event) => {
    if (event.state === 'Pressed') {
      transcription.startRecording();
      await tauriService.startRecording();
    } else if (event.state === 'Released') {
      transcription.stopRecording();
      transcription.setProcessing(true);
      try {
        const result = await tauriService.stopRecording();
        transcription.setResult(result.text);
      } catch (error) {
        transcription.setError(error.message);
      }
    }
  });
}
```

---

## 6. IPC Commands Interface

### 6.1 Command Definitions

```rust
// src-tauri/src/commands/mod.rs
pub mod audio;
pub mod transcription;
pub mod models;
pub mod settings;
pub mod history;

// Re-export all commands for registration
pub use audio::*;
pub use transcription::*;
pub use models::*;
pub use settings::*;
pub use history::*;
```

### 6.2 Audio Commands

```rust
// src-tauri/src/commands/audio.rs
use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<(), String> {
    let mut capture = state.audio_capture.write().await;
    capture.start().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<TranscriptionResult, String> {
    let mut capture = state.audio_capture.write().await;
    let audio = capture.stop().map_err(|e| e.to_string())?;

    let engine = state.transcription_engine.read().await;
    let result = engine.transcribe(&audio).map_err(|e| e.to_string())?;

    // Auto-inject if enabled
    let settings = state.settings.read().await;
    if settings.auto_paste {
        state.text_injector.inject_text(&result.text).map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_audio_devices(state: State<'_, AppState>) -> Result<Vec<AudioDevice>, String> {
    let capture = state.audio_capture.read().await;
    Ok(capture.get_devices())
}

#[tauri::command]
pub async fn set_audio_device(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut capture = state.audio_capture.write().await;
    let device = capture.get_devices()
        .into_iter()
        .find(|d| d.id == device_id)
        .ok_or("Device not found")?;
    capture.set_device(&device).map_err(|e| e.to_string())
}
```

### 6.3 Model Management Commands

```rust
// src-tauri/src/commands/models.rs

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<WhisperModel>, String> {
    Ok(vec![
        WhisperModel { id: "tiny".into(), name: "Tiny".into(), size_mb: 75, downloaded: false },
        WhisperModel { id: "base".into(), name: "Base".into(), size_mb: 142, downloaded: false },
        WhisperModel { id: "small".into(), name: "Small".into(), size_mb: 466, downloaded: false },
        WhisperModel { id: "medium".into(), name: "Medium".into(), size_mb: 1500, downloaded: false },
        WhisperModel { id: "large-v3".into(), name: "Large v3".into(), size_mb: 3100, downloaded: false },
    ])
}

#[tauri::command]
pub async fn download_model(
    model_id: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let url = get_model_url(&model_id);
    let path = state.storage.get_model_path(&model_id);

    // Download with progress events
    download_with_progress(&url, &path, |progress| {
        let _ = window.emit("model:download_progress", DownloadProgress { model_id: model_id.clone(), progress });
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_model(
    model_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut engine = state.transcription_engine.write().await;
    let path = state.storage.get_model_path(&model_id);
    engine.load_model(&path).map_err(|e| e.to_string())
}
```

### 6.4 Settings Commands

```rust
// src-tauri/src/commands/settings.rs

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let settings = state.settings.read().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn update_settings(
    settings: SettingsUpdate,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut current = state.settings.write().await;
    current.merge(settings);
    current.save().map_err(|e| e.to_string())
}
```

### 6.5 TypeScript Type Definitions

```typescript
// src/lib/types/index.ts

export interface TranscriptionResult {
  id: string;
  text: string;
  duration_ms: number;
  model_id: string;
  timestamp: string;
  language?: string;
}

export interface WhisperModel {
  id: string;
  name: string;
  size_mb: number;
  downloaded: boolean;
  quantization?: 'f16' | 'q8' | 'q5';
}

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

export interface Settings {
  hotkey: string;
  auto_paste: boolean;
  auto_copy: boolean;
  language: string | null;  // null = auto-detect
  model_id: string;
  input_device_id: string | null;
  theme: 'light' | 'dark' | 'system';
  show_in_tray: boolean;
  start_minimized: boolean;
  launch_at_login: boolean;
}

export interface DownloadProgress {
  model_id: string;
  progress: number;  // 0.0 to 1.0
}
```

---

## 7. Audio Pipeline

### 7.1 Audio Capture with cpal

```rust
// src-tauri/src/services/audio/capture.rs
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use std::sync::{Arc, Mutex};

pub struct AudioCaptureService {
    device: Device,
    config: StreamConfig,
    stream: Option<Stream>,
    buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
}

impl AudioCaptureService {
    pub fn new() -> Result<Self, AudioError> {
        let host = cpal::default_host();
        let device = host.default_input_device()
            .ok_or(AudioError::NoInputDevice)?;

        let config = device.default_input_config()?;
        let sample_rate = config.sample_rate().0;

        Ok(Self {
            device,
            config: config.into(),
            stream: None,
            buffer: Arc::new(Mutex::new(Vec::new())),
            sample_rate,
        })
    }

    pub fn start(&mut self) -> Result<(), AudioError> {
        let buffer = self.buffer.clone();

        let stream = self.device.build_input_stream(
            &self.config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut buf = buffer.lock().unwrap();
                buf.extend_from_slice(data);
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )?;

        stream.play()?;
        self.stream = Some(stream);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<AudioBuffer, AudioError> {
        self.stream.take();  // Drop stream to stop recording

        let mut buffer = self.buffer.lock().unwrap();
        let samples = std::mem::take(&mut *buffer);

        // Convert to mono if stereo
        let mono_samples = if self.config.channels() == 2 {
            samples.chunks(2)
                .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
                .collect()
        } else {
            samples
        };

        Ok(AudioBuffer {
            samples: mono_samples,
            sample_rate: self.sample_rate,
        })
    }
}
```

### 7.2 Audio Resampling

```rust
// src-tauri/src/services/audio/processing.rs
use rubato::{Resampler, SincFixedIn, SincInterpolationType, SincInterpolationParameters, WindowFunction};

const WHISPER_SAMPLE_RATE: u32 = 16000;

pub fn resample_for_whisper(audio: AudioBuffer) -> Result<Vec<f32>, AudioError> {
    if audio.sample_rate == WHISPER_SAMPLE_RATE {
        return Ok(audio.samples);
    }

    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let mut resampler = SincFixedIn::<f32>::new(
        WHISPER_SAMPLE_RATE as f64 / audio.sample_rate as f64,
        2.0,
        params,
        audio.samples.len(),
        1,  // mono
    )?;

    let waves_in = vec![audio.samples];
    let waves_out = resampler.process(&waves_in, None)?;

    Ok(waves_out.into_iter().next().unwrap())
}
```

### 7.3 Whisper Integration

```rust
// src-tauri/src/services/transcription/engine.rs
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

pub struct WhisperEngine {
    ctx: Option<WhisperContext>,
    params: TranscriptionParams,
}

impl WhisperEngine {
    pub fn new() -> Self {
        Self {
            ctx: None,
            params: TranscriptionParams::default(),
        }
    }

    pub fn load_model(&mut self, path: &Path) -> Result<(), ModelError> {
        let params = WhisperContextParameters::default();

        // Enable GPU if available
        #[cfg(feature = "cuda")]
        let params = params.use_gpu(true);

        #[cfg(feature = "metal")]
        let params = params.use_gpu(true);

        let ctx = WhisperContext::new_with_params(path.to_str().unwrap(), params)?;
        self.ctx = Some(ctx);
        Ok(())
    }

    pub fn transcribe(&self, audio: &[f32]) -> Result<TranscriptionResult, TranscriptionError> {
        let ctx = self.ctx.as_ref().ok_or(TranscriptionError::NoModelLoaded)?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(self.params.language.as_deref());
        params.set_translate(self.params.translate);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        let mut state = ctx.create_state()?;
        state.full(params, audio)?;

        let num_segments = state.full_n_segments()?;
        let mut text = String::new();

        for i in 0..num_segments {
            let segment = state.full_get_segment_text(i)?;
            text.push_str(&segment);
        }

        Ok(TranscriptionResult {
            text: text.trim().to_string(),
            duration_ms: (audio.len() as f32 / 16.0) as u64,
            // ... other fields
        })
    }
}
```

### 7.4 Audio Pipeline Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Microphone  │───▶│    cpal     │───▶│   rubato    │───▶│  whisper-rs │
│             │    │  (capture)  │    │ (resample)  │    │ (transcribe)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                  │                   │
                         ▼                  ▼                   ▼
                   Native sample      16kHz mono f32       Text output
                   rate (varies)
```

---

## 8. Platform-Specific Implementations

### 8.1 Platform Abstraction

```rust
// src-tauri/src/services/platform/text_inject.rs
pub trait TextInjector: Send + Sync {
    /// Inject text into the currently focused application
    fn inject_text(&self, text: &str) -> Result<(), PlatformError>;

    /// Check if this platform supports clipboard-based injection
    fn supports_paste(&self) -> bool { true }

    /// Get platform-specific instructions for accessibility permissions
    fn get_permission_instructions(&self) -> Option<String> { None }
}
```

### 8.2 Windows Implementation

```rust
// src-tauri/src/services/platform/windows.rs
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    VIRTUAL_KEY, VK_CONTROL, VK_V, KEYEVENTF_KEYUP,
};

#[cfg(target_os = "windows")]
pub struct WindowsTextInjector;

#[cfg(target_os = "windows")]
impl TextInjector for WindowsTextInjector {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError> {
        // Copy to clipboard first
        arboard::Clipboard::new()?.set_text(text)?;

        // Simulate Ctrl+V
        unsafe {
            let inputs = [
                create_key_input(VK_CONTROL, false),
                create_key_input(VK_V, false),
                create_key_input(VK_V, true),
                create_key_input(VK_CONTROL, true),
            ];

            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        }

        Ok(())
    }
}
```

### 8.3 macOS Implementation

```rust
// src-tauri/src/services/platform/macos.rs
#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

#[cfg(target_os = "macos")]
pub struct MacOSTextInjector;

#[cfg(target_os = "macos")]
impl TextInjector for MacOSTextInjector {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError> {
        // Copy to clipboard
        arboard::Clipboard::new()?.set_text(text)?;

        // Simulate Cmd+V
        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| PlatformError::EventSourceError)?;

        let cmd_down = CGEvent::new_keyboard_event(source.clone(), 0x37, true)?;
        let v_down = CGEvent::new_keyboard_event(source.clone(), 0x09, true)?;
        let v_up = CGEvent::new_keyboard_event(source.clone(), 0x09, false)?;
        let cmd_up = CGEvent::new_keyboard_event(source, 0x37, false)?;

        cmd_down.set_flags(CGEventFlags::CGEventFlagCommand);
        v_down.set_flags(CGEventFlags::CGEventFlagCommand);

        cmd_down.post(CGEventTapLocation::HID);
        v_down.post(CGEventTapLocation::HID);
        v_up.post(CGEventTapLocation::HID);
        cmd_up.post(CGEventTapLocation::HID);

        Ok(())
    }

    fn get_permission_instructions(&self) -> Option<String> {
        Some("Grant Accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility".into())
    }
}
```

### 8.4 Linux Implementation

```rust
// src-tauri/src/services/platform/linux.rs
#[cfg(target_os = "linux")]
pub struct LinuxTextInjector {
    display_server: DisplayServer,
}

#[cfg(target_os = "linux")]
enum DisplayServer {
    X11,
    Wayland,
}

#[cfg(target_os = "linux")]
impl LinuxTextInjector {
    pub fn new() -> Result<Self, PlatformError> {
        let display_server = if std::env::var("WAYLAND_DISPLAY").is_ok() {
            DisplayServer::Wayland
        } else {
            DisplayServer::X11
        };
        Ok(Self { display_server })
    }
}

#[cfg(target_os = "linux")]
impl TextInjector for LinuxTextInjector {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError> {
        // Copy to clipboard
        arboard::Clipboard::new()?.set_text(text)?;

        // Use appropriate tool based on display server
        match self.display_server {
            DisplayServer::X11 => {
                // xdotool for X11
                std::process::Command::new("xdotool")
                    .args(["key", "ctrl+v"])
                    .status()
                    .map_err(|e| PlatformError::CommandFailed(e.to_string()))?;
            }
            DisplayServer::Wayland => {
                // ydotool for Wayland (requires ydotoold daemon)
                std::process::Command::new("ydotool")
                    .args(["key", "29:1", "47:1", "47:0", "29:0"]) // Ctrl+V keycodes
                    .status()
                    .map_err(|e| PlatformError::CommandFailed(e.to_string()))?;
            }
        }

        Ok(())
    }
}
```

### 8.5 Global Hotkey Registration

```rust
// src-tauri/src/services/platform/hotkey.rs
use global_hotkey::{GlobalHotKeyManager, GlobalHotKeyEvent, hotkey::HotKey};

pub struct HotkeyService {
    manager: GlobalHotKeyManager,
    registered_hotkey: Option<HotKey>,
}

impl HotkeyService {
    pub fn new() -> Result<Self, PlatformError> {
        let manager = GlobalHotKeyManager::new()?;
        Ok(Self {
            manager,
            registered_hotkey: None,
        })
    }

    pub fn register(&mut self, hotkey_str: &str) -> Result<(), PlatformError> {
        // Unregister existing hotkey if any
        if let Some(hotkey) = self.registered_hotkey.take() {
            self.manager.unregister(hotkey)?;
        }

        let hotkey: HotKey = hotkey_str.parse()?;
        self.manager.register(hotkey)?;
        self.registered_hotkey = Some(hotkey);

        Ok(())
    }

    pub fn listen(&self) -> impl Iterator<Item = GlobalHotKeyEvent> {
        GlobalHotKeyEvent::receiver().try_iter()
    }
}
```

---

## 9. GPU Acceleration Strategy

### 9.1 Compile-Time Feature Flags

```toml
# src-tauri/Cargo.toml
[features]
default = []
cuda = ["whisper-rs/cuda"]
metal = ["whisper-rs/metal"]
```

### 9.2 Runtime GPU Detection

```rust
// src-tauri/src/services/transcription/gpu.rs

#[derive(Debug, Clone)]
pub enum GpuBackend {
    Cuda { device_name: String, vram_mb: u64 },
    Metal { device_name: String },
    Cpu,
}

pub fn detect_gpu_backend() -> GpuBackend {
    #[cfg(feature = "cuda")]
    {
        if let Some(info) = detect_cuda_device() {
            return GpuBackend::Cuda {
                device_name: info.name,
                vram_mb: info.vram_mb,
            };
        }
    }

    #[cfg(feature = "metal")]
    {
        if let Some(info) = detect_metal_device() {
            return GpuBackend::Metal {
                device_name: info.name,
            };
        }
    }

    GpuBackend::Cpu
}

#[cfg(feature = "cuda")]
fn detect_cuda_device() -> Option<CudaDeviceInfo> {
    // Use nvml or cuda runtime to detect device
    // Returns None if no CUDA device available
    todo!()
}

#[cfg(feature = "metal")]
fn detect_metal_device() -> Option<MetalDeviceInfo> {
    // Metal is always available on macOS, but check for Apple Silicon
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("sysctl")
            .args(["-n", "machdep.cpu.brand_string"])
            .output()
            .ok()?;
        let brand = String::from_utf8_lossy(&output.stdout);
        Some(MetalDeviceInfo { name: brand.trim().to_string() })
    }
    #[cfg(not(target_os = "macos"))]
    None
}
```

### 9.3 Model Loading with GPU Context

```rust
impl WhisperEngine {
    pub fn load_model_with_gpu(&mut self, path: &Path, backend: &GpuBackend) -> Result<(), ModelError> {
        let mut params = WhisperContextParameters::default();

        match backend {
            GpuBackend::Cuda { .. } => {
                #[cfg(feature = "cuda")]
                {
                    params = params.use_gpu(true);
                }
            }
            GpuBackend::Metal { .. } => {
                #[cfg(feature = "metal")]
                {
                    params = params.use_gpu(true);
                }
            }
            GpuBackend::Cpu => {
                // CPU fallback - no special config needed
            }
        }

        let ctx = WhisperContext::new_with_params(path.to_str().unwrap(), params)?;
        self.ctx = Some(ctx);
        Ok(())
    }
}
```

### 9.4 Performance Characteristics

| Backend | Tiny Model | Base Model | Small Model | Medium Model |
|---------|------------|------------|-------------|--------------|
| CPU (AVX2) | ~1.0x RT | ~1.5x RT | ~3x RT | ~6x RT |
| CUDA (RTX 3060) | ~0.1x RT | ~0.15x RT | ~0.3x RT | ~0.6x RT |
| Metal (M1) | ~0.15x RT | ~0.2x RT | ~0.4x RT | ~0.8x RT |

*RT = Real-time (1x means 10 seconds of audio takes 10 seconds to process)*

---

## 10. Build & Distribution Strategy

### 10.1 GitHub Actions CI/CD

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          # Windows builds
          - platform: windows-latest
            args: ''
            artifact: windows-cpu
          - platform: windows-latest
            args: '--features cuda'
            artifact: windows-cuda

          # macOS builds
          - platform: macos-latest
            args: '--target aarch64-apple-darwin --features metal'
            artifact: macos-arm64
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
            artifact: macos-x64

          # Linux builds
          - platform: ubuntu-22.04
            args: ''
            artifact: linux-cpu
          - platform: ubuntu-22.04
            args: '--features cuda'
            artifact: linux-cuda

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev

      - name: Install CUDA toolkit
        if: contains(matrix.args, 'cuda')
        uses: Jimver/cuda-toolkit@v0.2.11
        with:
          cuda: '12.2.0'

      - name: Install frontend dependencies
        run: bun install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
        with:
          args: ${{ matrix.args }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: src-tauri/target/release/bundle/
```

### 10.2 Build Matrix

| Platform | Variant | Bundle Size (Est.) | Notes |
|----------|---------|-------------------|-------|
| Windows | CPU | ~15 MB | Includes MSVC runtime |
| Windows | CUDA | ~25 MB | + CUDA libraries |
| macOS | ARM64 (Metal) | ~12 MB | Apple Silicon native |
| macOS | x64 | ~14 MB | Intel Macs |
| Linux | CPU | ~12 MB | AppImage |
| Linux | CUDA | ~22 MB | + CUDA libraries |

### 10.3 Code Signing

```yaml
# Windows code signing
- name: Sign Windows executable
  if: matrix.platform == 'windows-latest'
  run: |
    # Using AzureSignTool for EV code signing
    AzureSignTool sign -kvu "${{ secrets.AZURE_KEY_VAULT_URI }}" \
      -kvi "${{ secrets.AZURE_CLIENT_ID }}" \
      -kvs "${{ secrets.AZURE_CLIENT_SECRET }}" \
      -kvt "${{ secrets.AZURE_TENANT_ID }}" \
      -kvc "${{ secrets.AZURE_CERT_NAME }}" \
      -tr http://timestamp.digicert.com -v \
      src-tauri/target/release/ez-flow.exe

# macOS notarization
- name: Notarize macOS app
  if: matrix.platform == 'macos-latest'
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    xcrun notarytool submit src-tauri/target/release/bundle/macos/EZ\ Flow.app.zip \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait
```

### 10.4 Auto-Update Configuration

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "endpoints": [
        "https://releases.ezflow.app/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

---

## 11. Testing Strategy

### 11.1 Testing Pyramid

```
          ┌──────────┐
          │   E2E    │  ← Playwright + tauri-driver
          │  Tests   │     (10-15 tests)
         ┌┴──────────┴┐
         │Integration │  ← Rust integration tests
         │   Tests    │     (30-50 tests)
        ┌┴────────────┴┐
        │  Unit Tests  │  ← Rust + TypeScript
        │              │     (100+ tests)
       └──────────────────┘
```

### 11.2 Rust Unit Tests

```rust
// src-tauri/src/services/audio/processing.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_44100_to_16000() {
        let samples: Vec<f32> = (0..44100).map(|i| (i as f32 * 0.001).sin()).collect();
        let audio = AudioBuffer { samples, sample_rate: 44100 };

        let resampled = resample_for_whisper(audio).unwrap();

        assert_eq!(resampled.len(), 16000);
    }

    #[test]
    fn test_stereo_to_mono_conversion() {
        let stereo: Vec<f32> = vec![0.5, -0.5, 0.8, -0.8, 1.0, -1.0];
        let mono = convert_stereo_to_mono(&stereo);

        assert_eq!(mono, vec![0.0, 0.0, 0.0]);
    }
}
```

### 11.3 Frontend Unit Tests

```typescript
// src/lib/stores/transcription.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { transcription } from './transcription';

describe('transcription store', () => {
  beforeEach(() => {
    transcription.reset();
  });

  it('should start recording', () => {
    transcription.startRecording();
    const state = get(transcription);
    expect(state.isRecording).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should set transcription result', () => {
    transcription.setResult('Hello world');
    const state = get(transcription);
    expect(state.currentText).toBe('Hello world');
    expect(state.isProcessing).toBe(false);
  });
});
```

### 11.4 Integration Tests

```rust
// src-tauri/tests/integration/transcription_test.rs
use ez_flow::services::transcription::WhisperEngine;
use ez_flow::services::audio::AudioBuffer;

#[tokio::test]
async fn test_full_transcription_pipeline() {
    // Load test audio file
    let audio_data = load_test_audio("tests/fixtures/hello_world.wav");

    // Initialize engine with tiny model for fast testing
    let mut engine = WhisperEngine::new();
    engine.load_model(Path::new("models/ggml-tiny.bin")).unwrap();

    // Transcribe
    let result = engine.transcribe(&audio_data).unwrap();

    // Verify result contains expected text (fuzzy match for robustness)
    assert!(result.text.to_lowercase().contains("hello"));
}
```

### 11.5 E2E Tests with Playwright

```typescript
// tests/e2e/transcription.spec.ts
import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';

let app: ChildProcess;

test.beforeAll(async () => {
  // Start tauri app with tauri-driver
  app = spawn('cargo', ['tauri', 'dev'], {
    env: { ...process.env, TAURI_DRIVER: '1' }
  });
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for app to start
});

test.afterAll(async () => {
  app.kill();
});

test('should display main transcription view on launch', async ({ page }) => {
  await page.goto('tauri://localhost');

  await expect(page.locator('[data-testid="main-view"]')).toBeVisible();
  await expect(page.locator('[data-testid="record-button"]')).toBeVisible();
});

test('should navigate to settings', async ({ page }) => {
  await page.goto('tauri://localhost');

  await page.click('[data-testid="settings-button"]');
  await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
});

test('should change model selection', async ({ page }) => {
  await page.goto('tauri://localhost');

  await page.click('[data-testid="settings-button"]');
  await page.click('[data-testid="model-selector"]');
  await page.click('[data-testid="model-option-base"]');

  await expect(page.locator('[data-testid="active-model"]')).toHaveText('Base');
});
```

### 11.6 Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Audio capture | 70% |
| Transcription engine | 80% |
| Platform services | 60% per platform |
| Frontend stores | 80% |
| IPC commands | 90% |

---

## Appendix A: ADR Log

### ADR-001: Use Tauri over Electron

**Status**: Accepted

**Context**: Need a cross-platform desktop framework.

**Decision**: Use Tauri v2 instead of Electron.

**Rationale**:
- Smaller bundle size (~10MB vs ~150MB)
- Lower memory footprint
- Rust backend enables native performance for audio/ML
- Better security model

**Consequences**:
- Team needs Rust expertise
- Some NPM packages won't work (no Node.js in renderer)
- Smaller ecosystem than Electron

### ADR-002: Use whisper-rs over Python whisper

**Status**: Accepted

**Context**: Need Whisper inference in desktop app.

**Decision**: Use whisper-rs (Rust bindings to whisper.cpp) instead of Python whisper.

**Rationale**:
- No Python runtime dependency
- Smaller bundle size
- Better integration with Tauri/Rust
- whisper.cpp has excellent CPU and GPU optimization

**Consequences**:
- Tied to whisper.cpp development pace
- May not support all Whisper features immediately

### ADR-003: Clipboard-based text injection

**Status**: Accepted

**Context**: Need to inject transcribed text into active application.

**Decision**: Use clipboard + paste simulation rather than direct character injection.

**Rationale**:
- Works across all platforms consistently
- Handles Unicode properly
- Faster for long text
- More reliable than character-by-character input

**Consequences**:
- Overwrites user's clipboard
- Need to implement clipboard save/restore if desired

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **cpal** | Cross-Platform Audio Library for Rust |
| **whisper-rs** | Rust bindings to whisper.cpp |
| **rubato** | Rust audio resampling library |
| **Tauri** | Framework for building desktop apps with web frontends and Rust backends |
| **IPC** | Inter-Process Communication (between frontend and Rust backend) |
| **PTT** | Push-To-Talk |
| **VAD** | Voice Activity Detection |
| **GGML** | ML tensor library format used by whisper.cpp |
