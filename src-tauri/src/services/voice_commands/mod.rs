//! Voice command parsing and processing
//!
//! This module provides functionality for parsing voice commands from transcribed text
//! and converting them into actions like punctuation insertion, formatting, and editing.

use serde::{Deserialize, Serialize};

/// Configuration for the voice command parser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandConfig {
    /// Whether voice commands are enabled
    pub enabled: bool,
    /// Whether a prefix is required before commands (e.g., "command period")
    pub require_prefix: bool,
    /// The prefix to use when require_prefix is true
    pub prefix: String,
}

impl Default for CommandConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        }
    }
}

/// Actions that can be performed by voice commands
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandAction {
    /// Insert text (punctuation, newlines, etc.)
    InsertText(String),
    /// Delete the last N characters
    DeleteCharacters(usize),
    /// Send undo command (Ctrl+Z / Cmd+Z)
    Undo,
    /// Capitalize the next word
    CapitalizeNext,
}

/// Result of parsing a command
#[derive(Debug, Clone)]
pub struct ParseResult {
    /// The processed text with commands replaced
    pub text: String,
    /// List of actions to perform (in order)
    pub actions: Vec<CommandAction>,
    /// Whether capitalization should be applied to the next character
    pub capitalize_next: bool,
}

/// Voice command parser
pub struct CommandParser {
    config: CommandConfig,
}

impl CommandParser {
    /// Create a new command parser with the given configuration
    pub fn new(config: CommandConfig) -> Self {
        Self { config }
    }

    /// Parse transcribed text and extract/process commands
    pub fn parse(&self, text: &str) -> ParseResult {
        if !self.config.enabled {
            return ParseResult {
                text: text.to_string(),
                actions: vec![],
                capitalize_next: false,
            };
        }

        let mut result_text = String::new();
        let mut actions = Vec::new();
        let mut capitalize_next = false;
        let mut skip_space = false;

        // Split text into words while preserving spaces
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut i = 0;

        while i < words.len() {
            let word = words[i];
            let word_lower = word.to_lowercase();

            // Check for prefix if required
            if self.config.require_prefix {
                let prefix_lower = self.config.prefix.to_lowercase();
                if word_lower == prefix_lower && i + 1 < words.len() {
                    // Check if next word is a command
                    let next_word = words[i + 1];
                    if let Some((action, replacement)) = self.parse_command(next_word) {
                        // Process the command
                        if !result_text.is_empty() && !skip_space && !replacement.is_empty() {
                            // Don't add space before punctuation
                            if !is_punctuation(&replacement) {
                                result_text.push(' ');
                            }
                        }

                        // Handle capitalization from previous command
                        let mut to_append = replacement.clone();
                        if capitalize_next && !to_append.is_empty() {
                            to_append = capitalize_first(&to_append);
                            capitalize_next = false;
                        }

                        result_text.push_str(&to_append);
                        actions.push(action.clone());

                        // Check if this action requires capitalizing the next word
                        if matches!(action, CommandAction::InsertText(ref s) if s == "\n\n") {
                            capitalize_next = true;
                        }

                        skip_space = replacement.is_empty() || is_punctuation(&replacement);
                        i += 2;
                        continue;
                    }
                }
            } else {
                // No prefix required - check if word itself is a command
                if let Some((action, replacement)) = self.parse_command(word) {
                    // Process the command
                    if !result_text.is_empty() && !skip_space && !replacement.is_empty() {
                        // Don't add space before punctuation
                        if !is_punctuation(&replacement) {
                            result_text.push(' ');
                        }
                    }

                    // Handle capitalization from previous command
                    let mut to_append = replacement.clone();
                    if capitalize_next && !to_append.is_empty() {
                        to_append = capitalize_first(&to_append);
                        capitalize_next = false;
                    }

                    result_text.push_str(&to_append);
                    actions.push(action.clone());

                    // Check if this action requires capitalizing the next word
                    if matches!(action, CommandAction::InsertText(ref s) if s == "\n\n") {
                        capitalize_next = true;
                    }

                    skip_space = replacement.is_empty() || is_punctuation(&replacement);
                    i += 1;
                    continue;
                }
            }

            // Not a command - add word normally
            if !result_text.is_empty() && !skip_space {
                result_text.push(' ');
            }

            // Handle capitalization from previous command
            let mut to_append = word.to_string();
            if capitalize_next {
                to_append = capitalize_first(&to_append);
                capitalize_next = false;
            }

            result_text.push_str(&to_append);
            skip_space = false;
            i += 1;
        }

        ParseResult {
            text: result_text,
            actions,
            capitalize_next,
        }
    }

    /// Parse a single word as a command
    /// Returns (action, text_replacement) if it's a command
    fn parse_command(&self, word: &str) -> Option<(CommandAction, String)> {
        let word_lower = word.to_lowercase();

        // Punctuation commands (Story 7.2)
        match word_lower.as_str() {
            "period" | "full stop" => {
                Some((CommandAction::InsertText(".".to_string()), ".".to_string()))
            }
            "comma" => Some((CommandAction::InsertText(",".to_string()), ",".to_string())),
            "question mark" | "question" => {
                Some((CommandAction::InsertText("?".to_string()), "?".to_string()))
            }
            "exclamation point" | "exclamation mark" | "exclamation" => {
                Some((CommandAction::InsertText("!".to_string()), "!".to_string()))
            }
            "colon" => Some((CommandAction::InsertText(":".to_string()), ":".to_string())),
            "semicolon" | "semi-colon" => {
                Some((CommandAction::InsertText(";".to_string()), ";".to_string()))
            }

            // Formatting commands (Story 7.3)
            "new line" | "newline" => Some((
                CommandAction::InsertText("\n".to_string()),
                "\n".to_string(),
            )),
            "new paragraph" | "paragraph" => Some((
                CommandAction::InsertText("\n\n".to_string()),
                "\n\n".to_string(),
            )),

            // Editing commands (Story 7.4)
            "delete that" | "backspace" => {
                Some((CommandAction::DeleteCharacters(1), String::new()))
            }
            "undo" => Some((CommandAction::Undo, String::new())),

            _ => None,
        }
    }

    /// Parse multi-word commands (for commands like "full stop", "question mark", etc.)
    /// This is used when we need to check two consecutive words
    pub fn parse_multi_word_command(
        &self,
        word1: &str,
        word2: &str,
    ) -> Option<(CommandAction, String)> {
        let combined = format!("{} {}", word1.to_lowercase(), word2.to_lowercase());

        match combined.as_str() {
            "full stop" => Some((CommandAction::InsertText(".".to_string()), ".".to_string())),
            "question mark" => Some((CommandAction::InsertText("?".to_string()), "?".to_string())),
            "exclamation point" | "exclamation mark" => {
                Some((CommandAction::InsertText("!".to_string()), "!".to_string()))
            }
            "semi colon" | "semi-colon" => {
                Some((CommandAction::InsertText(";".to_string()), ";".to_string()))
            }
            "new line" => Some((
                CommandAction::InsertText("\n".to_string()),
                "\n".to_string(),
            )),
            "new paragraph" => Some((
                CommandAction::InsertText("\n\n".to_string()),
                "\n\n".to_string(),
            )),
            "delete that" => Some((CommandAction::DeleteCharacters(1), String::new())),
            _ => None,
        }
    }

    /// Advanced parse that handles multi-word commands
    pub fn parse_advanced(&self, text: &str) -> ParseResult {
        if !self.config.enabled {
            return ParseResult {
                text: text.to_string(),
                actions: vec![],
                capitalize_next: false,
            };
        }

        let mut result_text = String::new();
        let mut actions = Vec::new();
        let mut capitalize_next = false;
        let mut skip_space = false;

        let words: Vec<&str> = text.split_whitespace().collect();
        let mut i = 0;

        while i < words.len() {
            let word = words[i];
            let word_lower = word.to_lowercase();

            // Check for prefix if required
            let (command_start, prefix_consumed) = if self.config.require_prefix {
                let prefix_lower = self.config.prefix.to_lowercase();
                if word_lower == prefix_lower && i + 1 < words.len() {
                    (i + 1, true)
                } else {
                    // Not a prefix, treat as regular word
                    if !result_text.is_empty() && !skip_space {
                        result_text.push(' ');
                    }
                    let mut to_append = word.to_string();
                    if capitalize_next {
                        to_append = capitalize_first(&to_append);
                        capitalize_next = false;
                    }
                    result_text.push_str(&to_append);
                    skip_space = false;
                    i += 1;
                    continue;
                }
            } else {
                (i, false)
            };

            // Try to parse multi-word command first
            if command_start + 1 < words.len() {
                if let Some((action, replacement)) =
                    self.parse_multi_word_command(words[command_start], words[command_start + 1])
                {
                    if !result_text.is_empty() && !skip_space && !replacement.is_empty() {
                        if !is_punctuation(&replacement) {
                            result_text.push(' ');
                        }
                    }

                    let mut to_append = replacement.clone();
                    if capitalize_next && !to_append.is_empty() {
                        to_append = capitalize_first(&to_append);
                        capitalize_next = false;
                    }

                    result_text.push_str(&to_append);
                    actions.push(action.clone());

                    if matches!(action, CommandAction::InsertText(ref s) if s == "\n\n") {
                        capitalize_next = true;
                    }

                    skip_space = replacement.is_empty() || is_punctuation(&replacement);
                    i = command_start + 2;
                    continue;
                }
            }

            // Try single-word command
            if let Some((action, replacement)) = self.parse_command(words[command_start]) {
                if !result_text.is_empty() && !skip_space && !replacement.is_empty() {
                    if !is_punctuation(&replacement) {
                        result_text.push(' ');
                    }
                }

                let mut to_append = replacement.clone();
                if capitalize_next && !to_append.is_empty() {
                    to_append = capitalize_first(&to_append);
                    capitalize_next = false;
                }

                result_text.push_str(&to_append);
                actions.push(action.clone());

                if matches!(action, CommandAction::InsertText(ref s) if s == "\n\n") {
                    capitalize_next = true;
                }

                skip_space = replacement.is_empty() || is_punctuation(&replacement);
                i = command_start + 1;
                continue;
            }

            // Not a command
            if prefix_consumed {
                // The prefix was consumed but no command found, output prefix as text
                if !result_text.is_empty() && !skip_space {
                    result_text.push(' ');
                }
                let mut to_append = word.to_string();
                if capitalize_next {
                    to_append = capitalize_first(&to_append);
                    capitalize_next = false;
                }
                result_text.push_str(&to_append);
            }

            if !result_text.is_empty() && !skip_space && !prefix_consumed {
                result_text.push(' ');
            } else if !prefix_consumed {
                // Nothing in result_text yet
            }

            if !prefix_consumed {
                let mut to_append = word.to_string();
                if capitalize_next {
                    to_append = capitalize_first(&to_append);
                    capitalize_next = false;
                }
                result_text.push_str(&to_append);
            }

            skip_space = false;
            i += 1;
        }

        ParseResult {
            text: result_text,
            actions,
            capitalize_next,
        }
    }
}

/// Check if a string is punctuation
fn is_punctuation(s: &str) -> bool {
    matches!(s, "." | "," | "?" | "!" | ":" | ";")
}

/// Capitalize the first character of a string
fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_punctuation_commands() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Test period
        let result = parser.parse("hello period world");
        assert_eq!(result.text, "hello. world");
        assert_eq!(result.actions.len(), 1);
        assert!(matches!(result.actions[0], CommandAction::InsertText(ref s) if s == "."));

        // Test comma
        let result = parser.parse("hello comma world");
        assert_eq!(result.text, "hello, world");

        // Test question mark
        let result = parser.parse("hello question");
        assert_eq!(result.text, "hello?");

        // Test exclamation
        let result = parser.parse("hello exclamation");
        assert_eq!(result.text, "hello!");

        // Test colon
        let result = parser.parse("hello colon world");
        assert_eq!(result.text, "hello: world");

        // Test semicolon
        let result = parser.parse("hello semicolon world");
        assert_eq!(result.text, "hello; world");
    }

    #[test]
    fn test_parse_formatting_commands() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Test newline
        let result = parser.parse("hello newline world");
        assert_eq!(result.text, "hello\n world");
        assert!(matches!(result.actions[0], CommandAction::InsertText(ref s) if s == "\n"));

        // Test new paragraph with capitalization
        let result = parser.parse("hello paragraph world");
        assert_eq!(result.text, "hello\n\nWorld");
        assert!(matches!(result.actions[0], CommandAction::InsertText(ref s) if s == "\n\n"));
    }

    #[test]
    fn test_parse_case_insensitive() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Test uppercase
        let result = parser.parse("hello PERIOD world");
        assert_eq!(result.text, "hello. world");

        // Test mixed case
        let result = parser.parse("hello Period world");
        assert_eq!(result.text, "hello. world");

        // Test comma variations
        let result = parser.parse("hello COMMA world");
        assert_eq!(result.text, "hello, world");
    }

    #[test]
    fn test_parse_with_prefix_required() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: true,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Command with prefix should work
        let result = parser.parse("hello command period world");
        assert_eq!(result.text, "hello. world");

        // Command without prefix should be treated as text
        let result = parser.parse("hello period world");
        assert_eq!(result.text, "hello period world");

        // Test case insensitive prefix
        let result = parser.parse("hello COMMAND period world");
        assert_eq!(result.text, "hello. world");
    }

    #[test]
    fn test_parse_disabled() {
        let config = CommandConfig {
            enabled: false,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Commands should be passed through as text when disabled
        let result = parser.parse("hello period world");
        assert_eq!(result.text, "hello period world");
        assert!(result.actions.is_empty());
    }

    #[test]
    fn test_parse_editing_commands() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Test undo
        let result = parser.parse("hello undo");
        assert!(result
            .actions
            .iter()
            .any(|a| matches!(a, CommandAction::Undo)));

        // Test backspace
        let result = parser.parse("hello backspace");
        assert!(result
            .actions
            .iter()
            .any(|a| matches!(a, CommandAction::DeleteCharacters(1))));
    }

    #[test]
    fn test_parse_multi_word_commands() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Test "full stop"
        let result = parser.parse_advanced("hello full stop world");
        assert_eq!(result.text, "hello. world");

        // Test "question mark"
        let result = parser.parse_advanced("hello question mark");
        assert_eq!(result.text, "hello?");

        // Test "new line"
        let result = parser.parse_advanced("hello new line world");
        assert_eq!(result.text, "hello\n world");

        // Test "new paragraph"
        let result = parser.parse_advanced("hello new paragraph world");
        assert_eq!(result.text, "hello\n\nWorld");

        // Test "delete that"
        let result = parser.parse_advanced("hello delete that");
        assert!(result
            .actions
            .iter()
            .any(|a| matches!(a, CommandAction::DeleteCharacters(1))));
    }

    #[test]
    fn test_multiple_commands() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: false,
            prefix: "command".to_string(),
        };
        let parser = CommandParser::new(config);

        // Multiple punctuation
        let result = parser.parse("hello period world comma foo");
        assert_eq!(result.text, "hello. world, foo");
        assert_eq!(result.actions.len(), 2);
    }

    #[test]
    fn test_empty_input() {
        let config = CommandConfig::default();
        let parser = CommandParser::new(config);

        let result = parser.parse("");
        assert_eq!(result.text, "");
        assert!(result.actions.is_empty());
    }

    #[test]
    fn test_no_commands() {
        let config = CommandConfig::default();
        let parser = CommandParser::new(config);

        let result = parser.parse("hello world");
        assert_eq!(result.text, "hello world");
        assert!(result.actions.is_empty());
    }

    #[test]
    fn test_custom_prefix() {
        let config = CommandConfig {
            enabled: true,
            require_prefix: true,
            prefix: "insert".to_string(),
        };
        let parser = CommandParser::new(config);

        // Custom prefix should work
        let result = parser.parse("hello insert period world");
        assert_eq!(result.text, "hello. world");

        // Default prefix should not work
        let result = parser.parse("hello command period world");
        assert_eq!(result.text, "hello command period world");
    }
}
