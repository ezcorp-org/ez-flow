//! CLI command implementations

pub mod models;
pub mod record;
pub mod transcribe;

/// Shared command context
pub struct Context {
    pub model: String,
    pub language: Option<String>,
    pub json_output: bool,
}
