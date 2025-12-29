# EZ Flow

[![CI](https://github.com/your-org/ez-flow/workflows/CI/badge.svg)](https://github.com/your-org/ez-flow/actions)

**Local speech-to-text that just works.**

EZ Flow is a desktop application that provides push-to-talk transcription using OpenAI's Whisper model, running entirely on your local machine. Your audio never leaves your device.

## Features

- 🎤 **Push-to-talk transcription** - Hold a hotkey, speak, release, done
- 🔒 **100% local** - Your audio never leaves your device
- ⚡ **Fast** - GPU-accelerated transcription in under 3 seconds
- 🌍 **Multi-language** - Support for 99+ languages
- 💻 **Cross-platform** - Windows, macOS, and Linux

## Prerequisites

- **Rust** 1.75 or later
- **Bun** (latest)
- **Platform-specific dependencies**

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

### macOS

No additional dependencies required.

### Windows

No additional dependencies required.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ez-flow.git
cd ez-flow

# Install frontend dependencies
bun install

# Run in development mode
bun tauri dev
```

## Building

```bash
# Build for your current platform
bun tauri build
```

Build outputs will be in `src-tauri/target/release/bundle/`.

## Testing

```bash
# Run frontend tests
bun test

# Run Rust tests
cd src-tauri && cargo test

# Run linting
bun run lint

# Run type checking
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
│   │   ├── state/          # App state
│   │   └── error.rs        # Error types
│   └── Cargo.toml
├── tests/                  # E2E tests
└── docs/                   # Documentation
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
