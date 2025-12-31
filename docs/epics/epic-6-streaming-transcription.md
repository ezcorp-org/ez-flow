# Epic 6: Streaming Transcription

## Status
Planned

## Epic Goal

Enable real-time streaming transcription where partial text results appear as the user speaks, dramatically improving perceived speed and user feedback during the push-to-talk workflow.

## Epic Description

### Existing System Context

- **Current recording flow**: Hold hotkey -> record audio to buffer -> release -> transcribe entire audio -> inject text
- **Audio capture service** (`src-tauri/src/services/audio/capture.rs`): Buffers all audio samples in a single `Vec<f32>`, emits audio levels periodically (~100ms)
- **Transcription engine** (`src-tauri/src/services/transcription/engine.rs`): Uses whisper-rs for batch transcription of complete audio buffers
- **Workflow service** (`src-tauri/src/commands/workflow.rs`): Orchestrates stop -> transcribe -> inject flow
- **Recording indicator** (`src/routes/indicator/+page.svelte`): Shows recording dot, audio visualizer, and "Transcribing..." state
- **Event system**: Uses Tauri events (`workflow://state-changed`, `recording:level`, etc.) for frontend communication
- **Technology stack**: Svelte 5 (runes), Tauri 2, Rust backend, whisper-rs

### Enhancement Details

**What's being added/changed:**

1. **Chunked Audio Buffer** - Segment audio during recording:
   - Maintain rolling audio chunks (e.g., 2-3 seconds each)
   - Enable progressive processing without waiting for recording to end
   - Preserve full audio buffer for final reconciliation

2. **Incremental Transcription Engine** - Process audio in chunks:
   - Transcribe chunks as they become available during recording
   - Use context from previous chunks to improve accuracy
   - Balance chunk size for latency vs accuracy trade-off

3. **Streaming Events** - Emit partial results:
   - New event `transcription://partial` with partial text
   - Emit after each chunk is transcribed
   - Include chunk index for ordering/deduplication

4. **Preview Window Integration** - Display partial results:
   - Transform recording indicator into transcription preview window
   - Show partial text with typing animation effect
   - Maintain audio visualizer during recording phase

5. **Final Reconciliation** - Accuracy pass (optional):
   - Re-transcribe full audio at end for improved accuracy
   - Replace partial results with final polished text
   - Configurable via settings (speed vs accuracy preference)

**How it integrates:**
- Extends existing `AudioCaptureService` with chunk management
- Adds new streaming capability alongside existing `WhisperEngine`
- Uses existing Tauri event system for frontend communication
- Builds on existing indicator window infrastructure
- Follows existing Svelte 5 patterns ($state, $effect)

**Success criteria:**
- Users see partial text within 2-3 seconds of speaking
- Final accuracy matches or exceeds current batch transcription
- No performance regression for short recordings
- Seamless fallback to batch mode if streaming disabled
- Recording indicator smoothly transitions between states

## Stories

### Story 6.1: Chunked Audio Buffer (Backend Audio Segmentation)

**User Story**
As a developer, I want the audio capture service to segment audio into chunks during recording, so that each chunk can be processed incrementally for streaming transcription.

**Acceptance Criteria**
- [ ] Audio is buffered in configurable chunk sizes (default: 2 seconds at 16kHz = 32,000 samples)
- [ ] Each chunk is accessible via a queue/channel without blocking ongoing recording
- [ ] Full audio buffer remains available for final transcription
- [ ] Chunk boundaries include overlap (e.g., 0.5s) for context continuity
- [ ] Memory usage remains bounded even for long recordings
- [ ] Existing `stop()` method continues to return complete audio buffer
- [ ] New method `get_pending_chunks()` returns unprocessed chunks

**Integration Verification**
- [ ] Existing recording via tray menu works unchanged
- [ ] Existing hotkey recording works unchanged
- [ ] Audio level emission continues working
- [ ] `stop_recording_and_transcribe` command works with full buffer
- [ ] Unit tests pass for chunk segmentation logic

**Technical Notes**

```rust
// New structures in audio/capture.rs or audio/chunking.rs
pub struct AudioChunk {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub chunk_index: u32,
    pub timestamp_ms: u64,
    pub has_overlap: bool,
}

pub struct ChunkedAudioBuffer {
    chunks: VecDeque<AudioChunk>,
    full_buffer: Vec<f32>,
    chunk_size_samples: usize,
    overlap_samples: usize,
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/services/audio/capture.rs` | Add chunk management alongside existing buffer |
| `src-tauri/src/services/audio/mod.rs` | Export new chunking types |
| `src-tauri/src/services/audio/processing.rs` | Add chunk overlap logic |

---

### Story 6.2: Incremental Transcription Engine (Whisper Chunked Processing)

**User Story**
As a developer, I want the transcription engine to process audio chunks incrementally, so that partial transcription results are available before recording completes.

**Acceptance Criteria**
- [ ] New `transcribe_chunk()` method processes individual audio chunks
- [ ] Maintains transcription context between chunks (previous text prompt)
- [ ] Returns partial result with confidence indicator
- [ ] Supports configurable chunk processing parameters
- [ ] Falls back gracefully if chunk is too short/noisy
- [ ] Thread-safe for concurrent chunk processing
- [ ] Does not block batch transcription capability

**Integration Verification**
- [ ] Existing `transcribe()` method unchanged and working
- [ ] Batch transcription via `stop_recording_and_transcribe` still works
- [ ] Model loading/unloading unchanged
- [ ] GPU acceleration works for chunk transcription
- [ ] Unit tests cover chunk transcription edge cases

**Technical Notes**

```rust
// Extensions to engine.rs
impl WhisperEngine {
    /// Transcribe a single chunk with optional context
    pub fn transcribe_chunk(
        &self,
        chunk: &AudioChunk,
        context: Option<&str>, // Previous transcription for continuity
    ) -> Result<ChunkTranscriptionResult, TranscriptionError>;
}

pub struct ChunkTranscriptionResult {
    pub text: String,
    pub chunk_index: u32,
    pub is_partial: bool,
    pub confidence: f32, // 0.0-1.0 confidence score
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/services/transcription/engine.rs` | Add `transcribe_chunk()` method |
| `src-tauri/src/services/transcription/mod.rs` | Export `ChunkTranscriptionResult` |

---

### Story 6.3: Streaming Events (Emit Partial Results to Frontend)

**User Story**
As a user, I want to receive partial transcription results as I speak, so that I can see text appearing in real-time and verify my speech is being recognized.

**Acceptance Criteria**
- [ ] New `transcription://partial` event emitted after each chunk transcription
- [ ] Event payload includes: partial text, chunk index, timestamp
- [ ] Events are deduplicated (same chunk not emitted twice)
- [ ] Emit rate limited to prevent UI thrashing (max 2-3/second)
- [ ] `transcription://complete` event signals final result
- [ ] Error events for chunk processing failures
- [ ] Streaming can be enabled/disabled via settings

**Integration Verification**
- [ ] Existing workflow events (`workflow://state-changed`) unchanged
- [ ] Existing `recording:level` events continue working
- [ ] Frontend can listen to partial events without breaking existing flow
- [ ] Hotkey recording emits partial events correctly
- [ ] Tray menu recording works with streaming enabled

**Technical Notes**

```rust
// Event payloads
#[derive(Serialize)]
pub struct PartialTranscriptionEvent {
    pub text: String,
    pub chunk_index: u32,
    pub timestamp_ms: u64,
    pub is_final: bool,
}

// Emit events
app.emit("transcription://partial", PartialTranscriptionEvent {...})?;
app.emit("transcription://complete", FinalTranscriptionEvent {...})?;
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/commands/workflow.rs` | Add streaming transcription flow |
| `src-tauri/src/services/hotkey/mod.rs` | Emit partial events during recording |
| `src/lib/services/workflow.ts` | Add partial event listener |
| `src/lib/stores/workflow.ts` | Add partialText store |

---

### Story 6.4: Preview Window Integration (Display Partial Results)

**User Story**
As a user, I want to see partial transcription text appearing in the recording indicator window as I speak, so that I get immediate visual feedback that my speech is being recognized.

**Acceptance Criteria**
- [ ] Recording indicator window expands to show partial text preview
- [ ] Text appears with typing animation effect (character by character or word by word)
- [ ] Audio visualizer remains visible during recording
- [ ] Smooth transition from "Recording" to "Transcribing..." to showing text
- [ ] Text is scrollable if it exceeds window height
- [ ] Window can be resized/repositioned by user
- [ ] Preview text is replaced by final text when available
- [ ] Accessibility: Screen reader announces partial text updates

**Integration Verification**
- [ ] Indicator window still shows/hides correctly with workflow states
- [ ] Audio level visualization unchanged
- [ ] Escape key still hides window
- [ ] Window positioning (cursor, top-right, bottom-right) still works
- [ ] Window transparency and drag behavior unchanged

**Technical Notes**

UI Layout:
```
Recording (with streaming):
+-----------------------------+
| Recording  [bars]  01:23    |  <- Existing indicator
+-----------------------------+
| "Hello, this is a test      |  <- New partial text preview
| of streaming transcr..."    |
+-----------------------------+

After completion:
+-----------------------------+
| Transcribed                 |
| "Hello, this is a test      |
| of streaming transcription" |
+-----------------------------+
```

**Files to Modify**
| File | Change |
|------|--------|
| `src/routes/indicator/+page.svelte` | Add partial text display |
| `src/lib/components/RecordingIndicator.svelte` | Extend to show preview text |
| `src-tauri/tauri.conf.json` | May need to adjust indicator window size |

---

### Story 6.5: Final Transcription Reconciliation (Optional Accuracy Pass)

**User Story**
As a user, I want the option to have a final accuracy pass after streaming transcription, so that I can choose between maximum speed or maximum accuracy.

**Acceptance Criteria**
- [ ] New setting `streaming_mode`: "speed" | "balanced" | "accuracy"
- [ ] "Speed" mode: Use streaming result as final (fastest)
- [ ] "Balanced" mode: Quick re-transcribe of last 5 seconds for cleanup
- [ ] "Accuracy" mode: Full re-transcription with streaming previews (current behavior + preview)
- [ ] Setting persists across app restarts
- [ ] UI clearly indicates which mode is active
- [ ] Performance metrics logged for each mode

**Integration Verification**
- [ ] Settings page shows streaming mode option
- [ ] Mode change takes effect immediately (no restart)
- [ ] Existing transcription quality maintained in accuracy mode
- [ ] All three modes produce valid transcription results
- [ ] Settings export/import includes streaming mode

**Technical Notes**

Settings addition:
```rust
#[derive(Serialize, Deserialize)]
pub enum StreamingMode {
    Speed,     // Use streaming result directly
    Balanced,  // Re-transcribe last portion
    Accuracy,  // Full re-transcription
}

pub struct Settings {
    // ... existing fields
    pub streaming_mode: StreamingMode,
    pub streaming_enabled: bool, // Master toggle
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add StreamingMode enum and fields |
| `src-tauri/src/commands/workflow.rs` | Implement reconciliation based on mode |
| `src/routes/settings/+page.svelte` | Add streaming mode UI |

---

## Compatibility Requirements

- [x] Existing tray menu recording still works
- [x] Existing hotkey recording still works
- [x] History commands unchanged
- [x] Text injection unchanged
- [x] Batch transcription (streaming disabled) unchanged
- [x] Model loading/selection unchanged
- [x] Settings persistence unchanged
- [x] UI follows existing dark theme patterns

## Risk Mitigation

- **Primary Risk**: Whisper chunked inference may produce worse quality than batch
- **Mitigation**: Use overlap between chunks, provide context via initial_prompt
- **Fallback**: Settings allow disabling streaming entirely

- **Secondary Risk**: Increased CPU/memory usage from concurrent transcription
- **Mitigation**: Limit concurrent chunk processing, use bounded channel
- **Fallback**: Disable streaming on low-end hardware detection

- **Tertiary Risk**: UI flicker from rapid partial updates
- **Mitigation**: Rate-limit emissions, use CSS transitions, debounce updates

## Dependency Order

```
Story 6.1 (Chunked Buffer) ---+
                              +--> Story 6.3 (Events) ---+
Story 6.2 (Chunk Engine) -----+                          +--> Story 6.5 (Reconciliation)
                                                         |
Story 6.4 (Preview UI) ----------------------------------+
```

Stories 6.1 and 6.2 can be developed in parallel as backend infrastructure.
Story 6.3 integrates them and enables testing.
Story 6.4 can begin once events are working.
Story 6.5 ties everything together with user-configurable modes.

## Definition of Done

- [ ] Partial text appears within 2-3 seconds of speaking
- [ ] Recording indicator shows streaming preview
- [ ] Settings page includes streaming mode toggle
- [ ] All three modes (speed/balanced/accuracy) work correctly
- [ ] Existing tray/hotkey recording still works
- [ ] No performance regression for short recordings (<5s)
- [ ] Final transcription accuracy >= current batch mode
- [ ] All existing tests pass
- [ ] New tests cover streaming scenarios

---

## Files to Modify (Summary)

| File | Change |
|------|--------|
| `src-tauri/src/services/audio/capture.rs` | Add chunk management |
| `src-tauri/src/services/audio/processing.rs` | Add chunk overlap logic |
| `src-tauri/src/services/transcription/engine.rs` | Add `transcribe_chunk()` |
| `src-tauri/src/commands/workflow.rs` | Streaming transcription flow |
| `src-tauri/src/services/hotkey/mod.rs` | Emit partial events |
| `src-tauri/src/models/settings.rs` | Add streaming settings |
| `src/routes/indicator/+page.svelte` | Display partial text |
| `src/lib/components/RecordingIndicator.svelte` | Add preview section |
| `src/lib/services/workflow.ts` | Add streaming event listeners |
| `src/lib/stores/workflow.ts` | Add partialText store |
| `src/routes/settings/+page.svelte` | Add streaming mode UI |

---

## Story Manager Handoff

Please develop these user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing Tauri 2/Svelte 5/Rust system
- Integration points: Audio capture, transcription engine, workflow commands, indicator window
- Existing patterns to follow: Svelte 5 runes ($state, $props, $effect), Tauri events, dark theme styling
- Critical compatibility: Existing recording flows must continue working unchanged
- Each story must verify existing functionality remains intact
- Priority focus is **raw speed** - users want to see text appear as they speak

The epic should maintain system integrity while delivering real-time streaming transcription feedback.
