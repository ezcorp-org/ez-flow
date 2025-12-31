# Epic 8: Custom Vocabulary & Prompts

## Status
Planned

## Epic Goal

Enable users to improve transcription accuracy for domain-specific terminology by allowing custom vocabulary and context prompts that bias Whisper's recognition toward specialized terms.

## Epic Description

### Existing System Context

- **Settings system**: Robust settings model in `src-tauri/src/models/settings.rs` with JSON persistence via `SettingsState`
- **Transcription engine**: `WhisperEngine` in `src-tauri/src/services/transcription/engine.rs` uses whisper-rs `FullParams` for inference configuration
- **Settings UI**: Full settings page at `/settings` with sections for Recording, Transcription, Behavior, and Advanced
- **Technology stack**: Svelte 5 (runes), Tauri 2, Rust backend with whisper-rs 0.11
- **Integration points**:
  - Settings commands (`get_settings`, `update_setting`, etc.)
  - Transcription workflow (`push_to_talk_complete`, `transcribe_samples`)
  - Settings store (`src/lib/stores/settings.ts`)

### Enhancement Details

**What's being added/changed:**

1. **Custom Vocabulary Management** - Allow users to add/edit/delete custom words:
   - List of terms Whisper should recognize (names, technical jargon, etc.)
   - Stored in settings and persisted to JSON
   - UI for managing vocabulary list

2. **Context Prompt Configuration** - Let users describe the domain:
   - Text area for context prompts like "Medical transcription about cardiology"
   - Prompts bias Whisper toward domain-specific recognition
   - Optional per-session or always-on

3. **Whisper Prompt Integration** - Technical implementation:
   - Use whisper-rs `FullParams::set_initial_prompt()` method
   - Combine custom vocabulary + context prompt into initial_prompt
   - Pass to inference engine during transcription

4. **Vocabulary Import/Export** - Shareability:
   - Export vocabulary to JSON file
   - Import vocabulary from JSON file
   - Enable sharing between users/teams

**How it integrates:**
- Extends existing `Settings` struct with vocabulary and prompt fields
- Modifies `WhisperEngine::transcribe()` to accept and use prompts
- Adds new section in Settings UI between Transcription and Behavior
- Uses existing file dialog (tauri-plugin-dialog) for import/export
- Follows existing Svelte 5 patterns and dark theme styling

**Success criteria:**
- User can add custom vocabulary terms that improve recognition
- User can set context prompts that bias transcription toward a domain
- Prompts are passed to Whisper during inference
- Vocabulary can be imported/exported as JSON files
- Existing transcription functionality unchanged when features disabled

## Stories

### Story 8.1: Custom Vocabulary Management UI

**User Story**
As a user, I want to add custom vocabulary terms that Whisper should recognize, so that it transcribes domain-specific words more accurately.

**Acceptance Criteria**
- [ ] Add `custom_vocabulary: Vec<String>` to Settings model
- [ ] Create VocabularyManager Svelte component
- [ ] Add term via text input + button
- [ ] Remove term via delete button on each item
- [ ] Display current term count in section header
- [ ] Terms persist across app restarts
- [ ] Empty state shows helpful message
- [ ] Limit to reasonable number of terms (~500 max with warning)

**Integration Verification**
- [ ] Settings page renders correctly with new section
- [ ] Terms save and load correctly
- [ ] Settings export includes vocabulary
- [ ] Existing settings unchanged

**Technical Notes**

```rust
// Add to Settings struct
pub struct Settings {
    // ... existing fields

    #[serde(default)]
    pub custom_vocabulary: Vec<String>,
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add `custom_vocabulary` field |
| `src/lib/stores/settings.ts` | Add TypeScript type |
| `src/routes/settings/+page.svelte` | Add Vocabulary section |
| `src/lib/components/VocabularyManager.svelte` | NEW: Vocabulary list component |

---

### Story 8.2: Context Prompt Configuration

**User Story**
As a user, I want to provide a context prompt describing my transcription domain, so that Whisper better understands the context of my speech.

**Acceptance Criteria**
- [ ] Add `context_prompt: Option<String>` to Settings model
- [ ] Add `use_context_prompt: bool` toggle to Settings
- [ ] Create text area for entering context prompt
- [ ] Toggle to enable/disable prompt use
- [ ] Show example prompts (medical, legal, technical)
- [ ] Character limit (~500 chars) with counter
- [ ] Prompt persists across app restarts

**Integration Verification**
- [ ] Settings page renders correctly
- [ ] Prompt saves and loads correctly
- [ ] Toggle enables/disables prompt use
- [ ] Empty prompt treated as disabled

**Technical Notes**

Example context prompts:
- "Medical transcription about cardiology and heart conditions"
- "Legal document dictation with case references"
- "Software development discussion about React and TypeScript"
- "Scientific research notes about quantum physics"

```rust
pub struct Settings {
    // ... existing fields

    #[serde(default)]
    pub context_prompt: Option<String>,

    #[serde(default)]
    pub use_context_prompt: bool,
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add prompt fields |
| `src/lib/stores/settings.ts` | Add TypeScript types |
| `src/routes/settings/+page.svelte` | Add context prompt section |
| `src/lib/components/ContextPromptEditor.svelte` | NEW: Prompt editor component |

---

### Story 8.3: Whisper Prompt Integration (Backend)

**User Story**
As a developer, I want the transcription engine to use custom vocabulary and context prompts, so that Whisper is biased toward recognizing specified terms.

**Acceptance Criteria**
- [ ] Modify `WhisperEngine::transcribe()` to accept optional prompt parameter
- [ ] Use `FullParams::set_initial_prompt()` from whisper-rs
- [ ] Build effective prompt: context + vocabulary combined
- [ ] Update workflow commands to pass prompt from settings
- [ ] Log prompt usage for debugging
- [ ] Handle empty/disabled prompts gracefully

**Integration Verification**
- [ ] Transcription works with prompt enabled
- [ ] Transcription works with prompt disabled
- [ ] Vocabulary terms appear more accurately in output
- [ ] No performance regression
- [ ] Existing tests pass

**Technical Notes**

```rust
impl WhisperEngine {
    pub fn transcribe_with_prompt(
        &self,
        audio: &[f32],
        initial_prompt: Option<&str>,
    ) -> Result<TranscriptionResult, TranscriptionError> {
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        if let Some(prompt) = initial_prompt {
            params.set_initial_prompt(prompt);
            tracing::debug!("Using initial prompt: {}", prompt);
        }

        // ... rest of transcription
    }
}

pub fn build_initial_prompt(
    vocabulary: &[String],
    context_prompt: Option<&str>,
) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(context) = context_prompt {
        if !context.trim().is_empty() {
            parts.push(context.trim().to_string());
        }
    }

    if !vocabulary.is_empty() {
        let vocab_str = vocabulary.join(", ");
        parts.push(format!("Key terms: {}", vocab_str));
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(". "))
    }
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/services/transcription/engine.rs` | Add prompt support |
| `src-tauri/src/commands/workflow.rs` | Pass prompt from settings |
| `src-tauri/src/commands/transcription.rs` | Update transcribe command |

---

### Story 8.4: Vocabulary Import/Export

**User Story**
As a user, I want to import and export my vocabulary list, so that I can share it with others or backup my terms.

**Acceptance Criteria**
- [ ] Export button saves vocabulary to JSON file
- [ ] Import button loads vocabulary from JSON file
- [ ] Use file dialog for save/open operations
- [ ] JSON schema includes version, name, description, terms
- [ ] Validate imported data before applying
- [ ] Merge option: add to existing or replace
- [ ] Show success/error feedback to user

**Integration Verification**
- [ ] Export creates valid JSON file
- [ ] Import loads valid JSON file
- [ ] Invalid files show error message
- [ ] Large vocabularies handled correctly
- [ ] File dialog works on all platforms

**Technical Notes**

Vocabulary JSON schema:
```json
{
  "version": "1.0",
  "name": "Medical Terms",
  "description": "Cardiology vocabulary",
  "terms": [
    "myocardial infarction",
    "arrhythmia",
    "electrocardiogram"
  ]
}
```

```rust
#[derive(Serialize, Deserialize)]
pub struct VocabularyFile {
    pub version: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub terms: Vec<String>,
}

#[tauri::command]
pub async fn export_vocabulary(
    settings: State<'_, SettingsState>,
    path: PathBuf,
) -> Result<(), String>;

#[tauri::command]
pub async fn import_vocabulary(
    settings: State<'_, SettingsState>,
    path: PathBuf,
    merge: bool,
) -> Result<usize, String>;
```

**Files to Create/Modify**
| File | Change |
|------|--------|
| `src-tauri/src/commands/vocabulary.rs` | NEW: Import/export commands |
| `src-tauri/src/commands/mod.rs` | Add vocabulary module |
| `src/lib/components/VocabularyManager.svelte` | Add import/export buttons |

---

## Compatibility Requirements

- [x] Existing transcription workflows unaffected when features disabled
- [x] Settings migration handles missing new fields with defaults
- [x] Settings import/export includes new vocabulary fields
- [x] UI follows existing dark theme patterns
- [x] Empty vocabulary/prompt treated same as disabled

## Risk Mitigation

- **Primary Risk**: Prompt length limit in whisper-rs may truncate long vocabularies
- **Mitigation**: Cap vocabulary at reasonable size (~100-500 terms), warn user
- **Fallback**: Prompts disabled by default, can be toggled off if issues arise

- **Secondary Risk**: Custom vocabulary may worsen general recognition
- **Mitigation**: Make features opt-in with clear documentation
- **Fallback**: Easy toggle to disable all custom prompts

## Dependency Order

```
Story 8.1 (Vocabulary UI) -----+
                               +---> Story 8.3 (Backend) ---> Story 8.4 (Import/Export)
Story 8.2 (Context Prompt) ----+
```

Stories 8.1 and 8.2 can be developed in parallel (both add settings fields).
Story 8.3 integrates with backend.
Story 8.4 adds import/export after vocabulary management is complete.

## Definition of Done

- [ ] Custom vocabulary terms can be added/removed in settings
- [ ] Context prompt can be entered and enabled/disabled
- [ ] Vocabulary and prompts passed to Whisper during transcription
- [ ] Import/export vocabulary as JSON files works
- [ ] Settings persist across app restarts
- [ ] Existing transcription accuracy unchanged when features disabled
- [ ] All existing tests pass
- [ ] UI consistent with existing dark theme

---

## Files to Create/Modify (Summary)

| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add vocabulary and prompt fields |
| `src-tauri/src/services/transcription/engine.rs` | Add `transcribe_with_prompt()` |
| `src-tauri/src/commands/workflow.rs` | Pass prompt to transcription |
| `src-tauri/src/commands/vocabulary.rs` | NEW: Import/export commands |
| `src/lib/stores/settings.ts` | Add TypeScript types |
| `src/routes/settings/+page.svelte` | Add Vocabulary section |
| `src/lib/components/VocabularyManager.svelte` | NEW: Vocabulary list component |
| `src/lib/components/ContextPromptEditor.svelte` | NEW: Prompt editor component |

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing Tauri/Svelte 5 system
- Integration points: Settings model, transcription engine, settings UI
- Existing patterns to follow: Svelte 5 runes ($state, $props, $effect), dark theme styling, settings update pattern
- Critical compatibility: Existing transcription workflows must continue working
- Each story must verify existing functionality remains intact

The epic should maintain system integrity while delivering vocabulary and prompt features that improve transcription accuracy for specialized domains.
