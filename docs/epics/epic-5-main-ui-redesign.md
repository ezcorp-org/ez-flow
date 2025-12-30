# Epic 5: Main UI Redesign & Active Recording Indicator

## Status
Complete

## Epic Goal

Transform the main window into a functional speech-to-text hub with a record button and integrated history, while making the recording indicator reactive to voice input for clear audio feedback.

## Epic Description

### Existing System Context

- **Current main window (App.svelte)**: Placeholder with a "greet" test function - not functional
- **Recording indicator**: UI exists with AudioVisualizer component, but `emit_audio_level()` is never called - no audio reactivity
- **History page**: Full implementation at `/history` route with search, copy, delete functionality
- **Technology stack**: Svelte 5 (runes), Tauri 2, Rust backend
- **Integration points**:
  - Audio recording service (`src-tauri/src/services/audio/`)
  - Indicator service (`src-tauri/src/services/ui/indicator.rs`)
  - History commands (`get_history`, `search_history`, etc.)
  - Model setup screen (shows on startup)

### Enhancement Details

**What's being added/changed:**

1. **Main Window UI** - Replace placeholder with:
   - Prominent record button (start/stop toggle)
   - Embedded history list below
   - Seamless transition from model setup screen

2. **Reactive Recording Indicator** - Make it respond to voice:
   - Calculate audio levels from recorded samples in real-time
   - Emit `recording:level` events during recording
   - AudioVisualizer already handles display (bars react to level)

3. **Startup Flow** - After model setup:
   - Main window shows with record button + history
   - Ready for immediate use

**How it integrates:**
- Reuses existing History page component/logic
- Uses existing indicator window and AudioVisualizer
- Connects to existing audio recording backend
- Follows existing Svelte 5 patterns and styling

**Success criteria:**
- User sees record button + history immediately after model setup
- Recording indicator shows animated bars that react to voice volume
- History updates after each transcription
- Consistent dark theme with yellow accent

## Stories

### Story 5.1: Reactive Recording Indicator (Backend Audio Level Emission)
**Goal**: Make the recording indicator visually respond to voice input

**Problem**: The `emit_audio_level()` function exists but is never called. The audio recording service doesn't calculate or emit audio levels.

**Tasks**:
- Calculate RMS (root mean square) audio level from samples during recording
- Emit `recording:level` events periodically (e.g., every 100ms)
- Level should be normalized 0.0-1.0 for the frontend

**Integration**: Audio service → indicator service → frontend AudioVisualizer

---

### Story 5.2: Main Window UI Redesign
**Goal**: Replace placeholder App.svelte with functional record + history UI

**Tasks**:
- Create RecordButton component with start/stop toggle
- Integrate history list (reuse/embed from history page)
- Handle recording state (listening to `workflow://state-changed`)
- Update history list after transcription completes
- Style consistent with existing dark theme

**UI Layout**:
```
┌─────────────────────────┐
│     EZ Flow Header      │
├─────────────────────────┤
│                         │
│    [ 🎤 RECORD ]        │  ← Large record button
│                         │
├─────────────────────────┤
│    Recent History       │
│  ─────────────────────  │
│  📝 "Hello world..."    │
│  📝 "Meeting notes..."  │
│  📝 "Email draft..."    │
│                         │
│    [View All History]   │
└─────────────────────────┘
```

---

### Story 5.3: Startup Flow Integration
**Goal**: Seamless transition from model setup to main app

**Tasks**:
- After ModelSetupScreen completes, show main window with new UI
- Ensure main window stays visible (don't hide after setup)
- Optional: Add subtle animation/transition

**Current flow**: Model setup → unmount → mount App.svelte
**No changes needed** to flow, just ensure App.svelte is the redesigned version

## Compatibility Requirements

- [x] Existing tray menu recording still works
- [x] Existing hotkey recording still works
- [x] History commands (get_history, search_history) unchanged
- [x] Recording indicator window unchanged (just receives events now)
- [x] UI follows existing dark theme patterns

## Risk Mitigation

- **Primary Risk**: Audio level calculation impacting recording performance
- **Mitigation**: Calculate level on separate samples/buffer, don't block main audio path
- **Rollback Plan**: Disable audio level emission if performance issues detected

## Dependency Order

```
Story 5.1 (Audio Levels) ──┐
                           ├──→ Story 5.3 (Integration)
Story 5.2 (Main UI) ───────┘
```

Stories 5.1 and 5.2 can be developed in parallel, then 5.3 validates the complete flow.

## Definition of Done

- [x] Recording indicator bars visually react to voice volume
- [x] Main window shows record button and history after model setup
- [x] Record button starts/stops recording with visual feedback
- [x] History list updates after each transcription
- [x] Existing tray/hotkey recording still works
- [x] No performance regression in recording quality
- [x] All existing tests pass

---

## Technical Notes

### Audio Level Calculation (Story 5.1)

```rust
// In audio recording callback/loop
fn calculate_audio_level(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    // RMS calculation
    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_squares / samples.len() as f32).sqrt();
    // Normalize to 0-1 range (typical speech is 0.01-0.3 RMS)
    (rms * 5.0).min(1.0)
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/services/audio/recorder.rs` | Add audio level calculation & emission |
| `src/App.svelte` | Complete redesign with record button + history |
| `src/lib/components/RecordButton.svelte` | New component |

### Existing Components to Reuse

- `RecordingIndicator.svelte` - Already handles display
- `AudioVisualizer.svelte` - Already reacts to level prop
- History logic from `routes/history/+page.svelte`

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing Tauri/Svelte 5 system
- Integration points: Audio recorder service, indicator window, history commands
- Existing patterns to follow: Svelte 5 runes ($state, $props, $effect), dark theme styling
- Critical compatibility: Existing tray/hotkey recording must continue working
- Each story must verify existing functionality remains intact

The epic should maintain system integrity while delivering a functional main UI with reactive recording feedback.
