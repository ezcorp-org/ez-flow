# EZ Flow

<p align="center">
  <img src="assets/logo.svg" width="200" alt="EZ Flow Logo">
</p>

<p align="center">
  <b>Local speech-to-text that just works.</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/ezflow/ez-flow/actions"><img src="https://github.com/ezflow/ez-flow/workflows/CI/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ezflow/ez-flow" alt="License"></a>
  <a href="https://github.com/ezflow/ez-flow/releases"><img src="https://img.shields.io/github/v/release/ezflow/ez-flow" alt="Release"></a>
  <a href="https://github.com/ezflow/ez-flow/releases"><img src="https://img.shields.io/github/downloads/ezflow/ez-flow/total" alt="Downloads"></a>
</p>

---

EZ Flow is a desktop application that provides push-to-talk transcription using OpenAI's Whisper model, running entirely on your local machine. Your audio never leaves your device.

## Features

- **Push-to-talk transcription** - Hold a hotkey, speak, release, done
- **100% local** - Your audio never leaves your device
- **Fast** - GPU-accelerated transcription in under 3 seconds
- **Multi-language** - Support for 99+ languages
- **Cross-platform** - Windows, macOS, and Linux
- **System tray** - Runs quietly in the background
- **Transcription history** - Review and copy past transcriptions
- **Customizable hotkeys** - Configure your preferred shortcuts
- **Multiple Whisper models** - Choose between speed and accuracy

## Screenshots

<p align="center">
  <img src="docs/screenshots/main-window.png" width="600" alt="EZ Flow Main Window">
</p>

<details>
<summary>More screenshots</summary>

### Settings Panel
<img src="docs/screenshots/settings.png" width="600" alt="Settings Panel">

### Transcription History
<img src="docs/screenshots/history.png" width="600" alt="Transcription History">

### System Tray
<img src="docs/screenshots/system-tray.png" width="300" alt="System Tray">

</details>

## Installation

### Windows

Download the latest `.exe` installer from [Releases](https://github.com/ezflow/ez-flow/releases).

```
EZFlow_x.x.x_x64-setup.exe
```

### macOS

Download the latest `.dmg` from [Releases](https://github.com/ezflow/ez-flow/releases).

```bash
# Intel Mac
EZFlow_x.x.x_x64.dmg

# Apple Silicon (M1/M2/M3)
EZFlow_x.x.x_aarch64.dmg
```

### Linux

```bash
# AppImage (any distro)
chmod +x EZFlow_x.x.x_amd64.AppImage
./EZFlow_x.x.x_amd64.AppImage

# Debian/Ubuntu
sudo dpkg -i ezflow_x.x.x_amd64.deb

# Fedora/RHEL
sudo rpm -i ezflow-x.x.x-1.x86_64.rpm
```

## Usage

### First Run

1. Launch EZ Flow
2. Complete the setup wizard to download a Whisper model
3. Configure your preferred hotkey (default: `Ctrl+Shift+Space`)

### Transcribing

1. Hold your configured hotkey
2. Speak clearly
3. Release the hotkey
4. Your transcription appears at your cursor

### System Tray

EZ Flow runs in the system tray. Right-click the tray icon for quick access to:
- Settings
- Transcription history
- Pause/Resume
- Quit

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Push-to-talk | `Ctrl+Shift+Space` | `Cmd+Shift+Space` |
| Open settings | `Ctrl+,` | `Cmd+,` |
| Toggle history | `Ctrl+H` | `Cmd+H` |
| Quit application | `Ctrl+Q` | `Cmd+Q` |

> **Note:** The push-to-talk hotkey can be customized in Settings.

## Model Selection

EZ Flow supports multiple Whisper model sizes:

| Model | Size | Speed | Accuracy | VRAM |
|-------|------|-------|----------|------|
| Tiny | 75 MB | Fastest | Basic | ~1 GB |
| Base | 145 MB | Fast | Good | ~1 GB |
| Small | 488 MB | Medium | Better | ~2 GB |
| Medium | 1.5 GB | Slow | Great | ~5 GB |
| Large | 3 GB | Slowest | Best | ~10 GB |

## GPU Acceleration

EZ Flow automatically detects and uses GPU acceleration when available:

- **NVIDIA GPU**: CUDA acceleration (Windows/Linux)
- **Apple Silicon**: Metal acceleration (macOS)
- **CPU fallback**: Works on any system, just slower

## Development

### Prerequisites

- **Rust** 1.75 or later
- **Bun** (latest)
- Platform-specific dependencies (see below)

### Linux (Ubuntu/Debian)

```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libasound2-dev
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/ezflow/ez-flow.git
cd ez-flow

# Install dependencies
bun install

# Run in development mode
bun tauri dev

# Build for production
bun tauri build
```

### Testing

```bash
# Frontend tests
bun test

# Rust tests
cd src-tauri && cargo test

# Linting
bun run lint
cd src-tauri && cargo clippy

# Type checking
bun run check
```

## Project Structure

```
ez-flow/
├── src/                    # Svelte frontend
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── stores/         # Svelte stores
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   ├── App.svelte
│   └── main.ts
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Data structures
│   │   └── state/          # App state
│   └── Cargo.toml
├── cli/                    # CLI application
├── tests/                  # E2E tests
└── docs/                   # Documentation
```

## Troubleshooting

### Audio not detected

- Ensure your microphone is connected and not muted
- Check system audio permissions for EZ Flow
- Try selecting a different audio input device in Settings

### Transcription is slow

- Download a smaller Whisper model (Tiny or Base)
- Enable GPU acceleration if you have a compatible GPU
- Close other resource-intensive applications

### Hotkey not working

- Check if another application is using the same hotkey
- Try a different key combination in Settings
- On Linux, ensure you have proper permissions for global hotkeys

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For security issues, please see [SECURITY.md](SECURITY.md).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition model
- [Tauri](https://tauri.app/) - Desktop application framework
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - C++ implementation of Whisper
