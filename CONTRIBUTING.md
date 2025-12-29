# Contributing to EZ Flow

Thank you for your interest in contributing to EZ Flow! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- **Rust** 1.75 or later
- **Bun** (latest)
- **Git**

### Platform-Specific Dependencies

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libasound2-dev
```

#### macOS

No additional dependencies required. For Metal GPU support, ensure you have Xcode command line tools installed.

#### Windows

No additional dependencies required. For CUDA GPU support, install the [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads).

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/ez-flow.git
   cd ez-flow
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Run in development mode**

   ```bash
   bun tauri dev
   ```

4. **Run tests**

   ```bash
   # Frontend tests
   bun test

   # Rust tests
   cd src-tauri && cargo test
   ```

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check the [existing issues](https://github.com/ezflow/ez-flow/issues) to avoid duplicates
2. Collect information about the bug:
   - OS and version
   - EZ Flow version
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs or screenshots

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) when creating a new issue.

### Suggesting Features

We welcome feature suggestions! Please:

1. Check existing issues and discussions first
2. Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)
3. Provide context on why this feature would be useful

### Pull Requests

1. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes**

   - Follow the coding style guidelines below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   # Run all tests
   bun test
   cd src-tauri && cargo test

   # Run linting
   bun run lint
   cd src-tauri && cargo clippy

   # Type checking
   bun run check
   ```

4. **Commit your changes**

   Use clear, descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat: add language selection dropdown
   fix: resolve audio capture on Linux
   docs: update installation instructions
   test: add unit tests for transcription service
   ```

5. **Push and create a PR**

   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a Pull Request on GitHub.

## Coding Style

### Rust

- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` to format code
- Use `cargo clippy` to catch common mistakes
- Document public APIs with doc comments

### TypeScript/Svelte

- Use TypeScript for type safety
- Follow the existing code style
- Use meaningful variable and function names
- Keep components focused and reusable

### General

- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Prefer composition over inheritance

## Project Structure

```
ez-flow/
├── src/                    # Svelte frontend
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── stores/         # Svelte stores
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── routes/             # SvelteKit routes
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── services/       # Business logic
│   │   │   ├── audio/      # Audio capture
│   │   │   ├── transcription/ # Whisper integration
│   │   │   └── storage/    # Settings & history
│   │   ├── models/         # Data structures
│   │   └── state/          # App state management
│   └── Cargo.toml
├── cli/                    # CLI application
│   └── src/
│       └── commands/       # CLI commands
├── tests/                  # E2E tests
└── docs/                   # Documentation
```

## GPU Development

### Building with CUDA support (Linux/Windows)

```bash
cd src-tauri
cargo build --features cuda
```

### Building with Metal support (macOS)

```bash
cd src-tauri
cargo build --features metal
```

### Testing GPU features

GPU features require appropriate hardware. Tests will automatically skip if the required GPU is not available.

## Getting Help

- Open a [Discussion](https://github.com/ezflow/ez-flow/discussions) for questions
- Join our community chat (coming soon)
- Check the [documentation](docs/)

## License

By contributing to EZ Flow, you agree that your contributions will be licensed under the MIT License.
