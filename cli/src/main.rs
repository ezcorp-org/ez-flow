//! EZ Flow CLI - Local speech-to-text transcription
//!
//! A command-line interface for transcribing audio files and recordings.

mod commands;
mod output;

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Exit codes for CLI
pub mod exit_codes {
    pub const SUCCESS: i32 = 0;
    pub const RUNTIME_ERROR: i32 = 1;
    pub const INVALID_ARGS: i32 = 2;
}

#[derive(Parser)]
#[command(name = "ezflow")]
#[command(version, about = "Local speech-to-text transcription", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Output format as JSON
    #[arg(long, global = true)]
    json: bool,

    /// Whisper model to use
    #[arg(long, global = true, default_value = "base")]
    model: String,

    /// Transcription language (auto-detect if not specified)
    #[arg(long, global = true)]
    language: Option<String>,

    /// Enable verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Transcribe an audio file
    Transcribe {
        /// Path to audio file (WAV, MP3, FLAC, OGG)
        file: PathBuf,
    },

    /// Record from microphone and transcribe
    Record {
        /// Maximum recording duration in seconds (0 = unlimited)
        #[arg(long, default_value = "0")]
        max_duration: u32,
    },

    /// Manage Whisper models
    Models {
        #[command(subcommand)]
        action: ModelsAction,
    },
}

#[derive(Subcommand)]
enum ModelsAction {
    /// List available models
    List,

    /// Download a model
    Download {
        /// Model name (tiny, base, small, medium, large-v3)
        name: String,
    },

    /// Delete a downloaded model
    Delete {
        /// Model name to delete
        name: String,
    },

    /// Show model info
    Info {
        /// Model name
        name: String,
    },
}

fn init_logging(verbose: bool) {
    let filter = if verbose {
        EnvFilter::from_default_env()
            .add_directive("ezflow=debug".parse().unwrap())
            .add_directive("whisper_rs=debug".parse().unwrap())
    } else {
        EnvFilter::from_default_env().add_directive("ezflow=warn".parse().unwrap())
    };

    tracing_subscriber::registry()
        .with(fmt::layer().with_target(false).without_time())
        .with(filter)
        .init();
}

fn run() -> anyhow::Result<()> {
    let cli = Cli::parse();

    init_logging(cli.verbose);

    let ctx = commands::Context {
        model: cli.model,
        language: cli.language,
        json_output: cli.json,
    };

    match cli.command {
        Commands::Transcribe { file } => {
            commands::transcribe::run(&file, &ctx)?;
        }
        Commands::Record { max_duration } => {
            commands::record::run(max_duration, &ctx)?;
        }
        Commands::Models { action } => match action {
            ModelsAction::List => {
                commands::models::list(&ctx)?;
            }
            ModelsAction::Download { name } => {
                commands::models::download(&name, &ctx)?;
            }
            ModelsAction::Delete { name } => {
                commands::models::delete(&name, &ctx)?;
            }
            ModelsAction::Info { name } => {
                commands::models::info(&name, &ctx)?;
            }
        },
    }

    Ok(())
}

fn main() {
    let result = run();

    std::process::exit(match result {
        Ok(_) => exit_codes::SUCCESS,
        Err(e) => {
            eprintln!("Error: {:#}", e);

            // Check if it's an invalid argument error
            let err_str = e.to_string().to_lowercase();
            if err_str.contains("invalid")
                || err_str.contains("not found")
                || err_str.contains("unknown")
            {
                exit_codes::INVALID_ARGS
            } else {
                exit_codes::RUNTIME_ERROR
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn verify_cli() {
        Cli::command().debug_assert();
    }
}
