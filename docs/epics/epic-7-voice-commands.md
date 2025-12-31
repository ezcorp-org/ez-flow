# Epic 7: Voice Commands

## Status
Planned

## Epic Goal

Enable voice commands during dictation so users can say things like "new paragraph", "delete that", or "period" and have those commands executed rather than transcribed as literal text. This transforms raw transcription into formatted, editable text through natural speech.

## Epic Description

### Existing System Context

- **Current transcription flow**: User speaks, audio is captured, Whisper transcribes to text, text is injected at cursor position via `push_to_talk_complete()` in `src-tauri/src/commands/workflow.rs`
- **Text injection**: Platform-specific implementations in `src-tauri/src/services/platform/` using clipboard + paste simulation (xdotool on X11, ydotool/wtype on Wayland, SendInput on Windows, CGEvent on macOS)
- **Settings infrastructure**: Existing `Settings` struct in `src-tauri/src/models/settings.rs` with serialization, defaults, and frontend Settings page at `src/routes/settings/+page.svelte`
- **Technology stack**: Svelte 5 (runes), Tauri 2, Rust backend with whisper-rs
- **Integration points**:
  - Transcription result handling in `workflow.rs` (`push_to_talk_complete`)
  - Text injector service (`TextInjectorState`, `inject_text()` command)
  - Settings persistence (`SettingsState`, `update_setting` command)
  - History storage (transcribed text saved after processing)

### Enhancement Details

**What's being added/changed:**

1. **Voice Command Parser** (Rust module)
   - Post-process transcription text to detect command phrases
   - Case-insensitive matching with configurable command prefix
   - Return structured result: parsed text + detected commands

2. **Punctuation Commands**
   - "period" / "full stop" -> `.`
   - "comma" -> `,`
   - "question mark" -> `?`
   - "exclamation point" / "exclamation mark" -> `!`
   - "colon" -> `:`
   - "semicolon" -> `;`

3. **Formatting Commands**
   - "new line" -> `\n` (single line break)
   - "new paragraph" -> `\n\n` (double line break)

4. **Editing Commands**
   - "delete that" -> Simulate backspace to remove last injected phrase
   - "undo" -> Simulate Ctrl+Z / Cmd+Z platform-specific undo

5. **Control Commands**
   - "stop listening" -> Immediately end recording session

6. **Settings UI**
   - Toggle: Enable/disable voice commands
   - Toggle: Require command prefix (e.g., "command: period")
   - Command prefix customization

**How it integrates:**
- Voice command parser runs between transcription result and text injection
- Modified `push_to_talk_complete` flow: transcribe -> parse commands -> execute actions + inject text
- Editing commands use existing platform text injection infrastructure (send key events)
- Settings stored alongside existing settings with serde serialization
- Control commands interact with recording state machine

**Success criteria:**
- User says "hello period new paragraph how are you question mark" and gets "Hello.\n\nHow are you?" injected
- "Delete that" removes the last phrase that was just typed
- Commands work regardless of capitalization ("PERIOD", "Period", "period" all work)
- Voice commands can be disabled entirely via Settings
- Optional command prefix prevents accidental command triggers
- Existing transcription workflow continues to work with commands disabled

## Stories

### Story 7.1: Voice Command Parser

**User Story**
As a developer, I want a Rust module that detects and processes voice commands in transcription text, so that spoken commands can be converted to actions.

**Acceptance Criteria**
- [ ] Create `src-tauri/src/services/voice_commands/mod.rs` module
- [ ] Implement `CommandParser` struct with configurable options
- [ ] Parse transcription text, detecting command phrases
- [ ] Return structured `ParseResult` with cleaned text and detected actions
- [ ] Support case-insensitive matching
- [ ] Support optional command prefix filtering
- [ ] Handle multiple commands in single transcription
- [ ] Unit tests for all command parsing scenarios

**Integration Verification**
- [ ] Module compiles and exports correctly
- [ ] Can be called from workflow commands
- [ ] Disabled parser returns original text unchanged

**Technical Notes**

```rust
// src-tauri/src/services/voice_commands/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandConfig {
    pub enabled: bool,
    pub require_prefix: bool,
    pub prefix: String,
}

pub enum CommandAction {
    InsertPunctuation(char),
    InsertLineBreak(usize),
    DeleteLastPhrase,
    Undo,
    StopListening,
}

pub struct ParseResult {
    pub text: String,
    pub actions: Vec<CommandAction>,
    pub should_stop: bool,
}

pub struct CommandParser {
    config: CommandConfig,
}

impl CommandParser {
    pub fn parse(&self, text: &str) -> ParseResult;
}
```

**Files to Create/Modify**
| File | Change |
|------|--------|
| `src-tauri/src/services/voice_commands/mod.rs` | NEW: Voice command parser module |
| `src-tauri/src/services/mod.rs` | Add `pub mod voice_commands;` |

---

### Story 7.2: Punctuation Commands

**User Story**
As a user, I want to say punctuation names and have them inserted as actual punctuation, so that I can dictate properly formatted text hands-free.

**Acceptance Criteria**
- [ ] "period" / "full stop" inserts `.`
- [ ] "comma" inserts `,`
- [ ] "question mark" inserts `?`
- [ ] "exclamation point" / "exclamation mark" inserts `!`
- [ ] "colon" inserts `:`
- [ ] "semicolon" inserts `;`
- [ ] Commands detected at word boundaries only
- [ ] Punctuation inserted without extra spaces
- [ ] Multiple punctuation commands in sequence work

**Integration Verification**
- [ ] "hello period" becomes "hello."
- [ ] "how are you question mark" becomes "how are you?"
- [ ] Commands case-insensitive: "PERIOD", "Period", "period" all work
- [ ] Non-command text unchanged: "the period button" stays as-is when not enabled

**Technical Notes**

```rust
const PUNCTUATION_COMMANDS: &[(&str, char)] = &[
    ("period", '.'),
    ("full stop", '.'),
    ("comma", ','),
    ("question mark", '?'),
    ("exclamation point", '!'),
    ("exclamation mark", '!'),
    ("colon", ':'),
    ("semicolon", ';'),
];
```

---

### Story 7.3: Formatting Commands

**User Story**
As a user, I want to say "new line" or "new paragraph" to insert line breaks, so that I can structure my text while dictating.

**Acceptance Criteria**
- [ ] "new line" inserts single `\n`
- [ ] "new paragraph" inserts double `\n\n`
- [ ] Commands work mid-sentence
- [ ] Word after "new paragraph" is capitalized
- [ ] Multiple formatting commands in sequence work
- [ ] Works combined with punctuation commands

**Integration Verification**
- [ ] "hello new line world" becomes "hello\nworld"
- [ ] "hello new paragraph world" becomes "hello\n\nWorld"
- [ ] Combined: "hello period new paragraph how are you" -> "hello.\n\nHow are you"

**Technical Notes**

```rust
const FORMATTING_COMMANDS: &[(&str, usize)] = &[
    ("new line", 1),
    ("new paragraph", 2),
];
```

---

### Story 7.4: Editing Commands

**User Story**
As a user, I want to say "delete that" or "undo" to correct mistakes, so that I can edit my text without using the keyboard.

**Acceptance Criteria**
- [ ] "delete that" removes the last phrase/sentence that was injected
- [ ] "undo" sends platform-specific undo keystroke (Ctrl+Z / Cmd+Z)
- [ ] Commands work via platform text injection (backspace keys, modifier keys)
- [ ] Track last injected text length for "delete that" functionality
- [ ] Commands execute after text injection

**Integration Verification**
- [ ] "hello delete that" injects "hello" then deletes it
- [ ] "undo" triggers system undo in target application
- [ ] Works on Windows, macOS, and Linux (X11/Wayland)
- [ ] Graceful failure if platform doesn't support key simulation

**Technical Notes**

```rust
// Extend text injector trait
pub trait TextInjector: Send + Sync {
    fn inject_text(&self, text: &str) -> Result<(), PlatformError>;
    fn delete_characters(&self, count: usize) -> Result<(), PlatformError>;
    fn send_undo(&self) -> Result<(), PlatformError>;
}
```

Platform implementations:
- Linux X11: `xdotool key BackSpace`, `xdotool key ctrl+z`
- Linux Wayland: `ydotool key 14:1 14:0`, `ydotool key 29:1 44:1 44:0 29:0`
- Windows: `SendInput` with `VK_BACK`, `VK_CONTROL + 'Z'`
- macOS: `CGEvent` with key codes

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/services/platform/text_inject.rs` | Add trait methods |
| `src-tauri/src/services/platform/linux.rs` | Implement for Linux |
| `src-tauri/src/services/platform/windows.rs` | Implement for Windows |
| `src-tauri/src/services/platform/macos.rs` | Implement for macOS |

---

### Story 7.5: Voice Command Settings UI

**User Story**
As a user, I want to configure voice command behavior in settings, so that I can enable/disable features and customize the experience.

**Acceptance Criteria**
- [ ] Toggle: "Enable voice commands" (default: enabled)
- [ ] Toggle: "Require command prefix" (default: disabled)
- [ ] Text input: "Command prefix" (default: "command")
- [ ] Settings section placed between "Transcription" and "Behavior"
- [ ] Changes apply immediately (no restart required)
- [ ] Settings persist across app restarts
- [ ] Settings included in import/export

**Integration Verification**
- [ ] Settings page renders correctly
- [ ] Toggle changes persist after navigating away
- [ ] Voice command behavior changes immediately when settings change
- [ ] Settings export JSON includes voice command fields

**Technical Notes**

```rust
// Add to Settings struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceCommandSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub require_prefix: bool,
    #[serde(default = "default_prefix")]
    pub prefix: String,
}

pub struct Settings {
    // ... existing fields ...
    #[serde(default)]
    pub voice_commands: VoiceCommandSettings,
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add VoiceCommandSettings |
| `src-tauri/src/commands/settings.rs` | Handle new setting fields |
| `src/lib/stores/settings.ts` | Add TypeScript types |
| `src/routes/settings/+page.svelte` | Add Voice Commands section |

---

## Compatibility Requirements

- [x] Existing push-to-talk workflow continues to work
- [x] Existing tray menu recording still works
- [x] Existing hotkey recording still works
- [x] History records processed text (with punctuation applied)
- [x] Voice commands can be completely disabled
- [x] Settings persist across app restarts
- [x] Works on all platforms (Windows, macOS, Linux)

## Risk Mitigation

- **Primary Risk**: False positive command detection ("I said comma, not punctuation")
- **Mitigation**: Optional command prefix ("command: comma"), disable option, word boundary detection

- **Secondary Risk**: Performance impact from text parsing
- **Mitigation**: Simple regex/string matching, run synchronously (text is small)

- **Tertiary Risk**: Platform differences in key simulation for editing commands
- **Mitigation**: Leverage existing platform abstractions, graceful degradation

- **Rollback Plan**: Voice commands enabled by default but can be easily disabled in settings

## Dependency Order

```
Story 7.1 (Parser) ------+---> Story 7.2 (Punctuation)
                         +---> Story 7.3 (Formatting)
                         +---> Story 7.4 (Editing)
                         +---> Story 7.5 (Settings UI)
```

Story 7.1 must be completed first. Stories 7.2-7.5 can be developed in parallel after 7.1.

## Definition of Done

- [ ] User can speak punctuation ("period", "comma") and get actual punctuation inserted
- [ ] User can say "new paragraph" and get a paragraph break
- [ ] User can say "delete that" to remove last phrase
- [ ] User can say "undo" to trigger platform undo
- [ ] User can say "stop listening" to end recording immediately
- [ ] Voice commands work case-insensitively
- [ ] Voice commands can be enabled/disabled in Settings
- [ ] Optional command prefix prevents false positives
- [ ] All existing tests pass
- [ ] New unit tests cover command parsing
- [ ] No performance regression in transcription latency

---

## Files to Create/Modify (Summary)

| File | Change |
|------|--------|
| `src-tauri/src/services/voice_commands/mod.rs` | NEW: Voice command parser module |
| `src-tauri/src/services/mod.rs` | Add `pub mod voice_commands;` |
| `src-tauri/src/models/settings.rs` | Add `VoiceCommandSettings` struct |
| `src-tauri/src/commands/workflow.rs` | Integrate command parsing |
| `src-tauri/src/services/platform/text_inject.rs` | Add trait methods |
| `src-tauri/src/services/platform/linux.rs` | Implement new methods |
| `src-tauri/src/services/platform/windows.rs` | Implement new methods |
| `src-tauri/src/services/platform/macos.rs` | Implement new methods |
| `src/routes/settings/+page.svelte` | Add Voice Commands section |
| `src/lib/stores/settings.ts` | Add TypeScript types |

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing Tauri/Svelte 5 + Rust system
- Integration points: Workflow command, text injector service, settings storage
- Existing patterns to follow: Svelte 5 runes ($state, $props, $effect), dark theme styling, Rust module organization
- Critical compatibility: Existing push-to-talk workflow must continue working
- Voice commands should be enabled by default but easily disabled
- Each story must verify existing functionality remains intact

The epic should maintain system integrity while delivering voice command capabilities for hands-free text editing and formatting.
