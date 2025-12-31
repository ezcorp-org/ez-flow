# Epic 9: Floating Preview Window

## Status
Planned

## Epic Goal

Create a floating preview window that shows transcription text in real-time as the user speaks, providing visual feedback during dictation before the text is injected at the cursor position.

## Epic Description

### Existing System Context

- **Current recording indicator**: A floating window (`recording-indicator`) that shows audio level bars during recording, configured in `tauri.conf.json` with `alwaysOnTop: true`, `transparent: true`, `skipTaskbar: true`
- **Recording workflow**: Push-to-talk flow orchestrated via `workflow.rs` emitting events (`workflow://state-changed`, `workflow://metrics`, `workflow://error`)
- **Event system**: Frontend listens for workflow state changes (`idle`, `recording`, `transcribing`, `injecting`) via Tauri events
- **AudioVisualizer component**: Already displays 5-bar audio level visualization based on `recording:level` events
- **RecordingIndicator component**: Combines recording dot, audio visualizer, and elapsed time display
- **Indicator service**: `src-tauri/src/services/ui/indicator.rs` handles positioning (TopRight, BottomRight, Cursor, Hidden)
- **Settings model**: Already includes `indicator_position` setting

### Enhancement Details

**What's being added/changed:**

1. **Floating Preview Window** - A new or enhanced window that shows:
   - Real-time transcription preview text during/after transcription
   - Audio visualizer during recording phase
   - Processing indicator during transcription phase
   - Final text preview before injection

2. **Preview Text Events** - Backend emits transcription preview:
   - `preview://text` event with partial/final transcription text
   - Integrates with existing `workflow://state-changed` events
   - Even without streaming transcription, shows "Processing..." then final result

3. **Position Memory** - User preferences for preview window:
   - Draggable window position
   - Position saved across sessions
   - Size preferences (compact vs expanded)

4. **Preview Settings** - New settings for preview behavior:
   - Enable/disable preview window
   - Show/hide audio visualizer in preview
   - Preview display duration before auto-hide

**How it integrates:**
- Reuses existing indicator window infrastructure or creates new preview window
- Listens to existing `workflow://state-changed` events
- Extends `Settings` struct with preview-related fields
- Uses existing window management patterns from `indicator.rs`
- Follows existing Svelte 5 patterns (runes, $state, $effect)

**Success criteria:**
- User sees live transcription preview during dictation workflow
- Preview window is non-intrusive (draggable, always-on-top, transparent background)
- User can enable/disable preview in settings
- Preview position persists across app restarts
- Smooth transition between recording -> transcribing -> showing result states

## Stories

### Story 9.1: Preview Window UI Component

**User Story**
As a user, I want to see my transcription text in a floating preview window while I speak, so that I can verify what's being captured before it's injected.

**Acceptance Criteria**
- [ ] Preview window displays text area for transcription preview
- [ ] Audio visualizer shows during recording phase
- [ ] "Processing..." indicator shows during transcription phase
- [ ] Final transcription text displays before injection
- [ ] Window has transparent/semi-transparent background matching existing dark theme
- [ ] Window is draggable via title bar or designated drag region
- [ ] Window is always-on-top and skips taskbar
- [ ] Window auto-hides after text injection completes

**Integration Verification**
- [ ] Existing recording indicator functionality unchanged
- [ ] Existing hotkey recording workflow unchanged
- [ ] Window styling consistent with existing dark theme (#0a0a0a, #f4c430 accent)

**Technical Notes**

Window configuration in `tauri.conf.json`:
```json
{
  "label": "preview",
  "title": "Transcription Preview",
  "width": 360,
  "height": 180,
  "resizable": false,
  "decorations": false,
  "alwaysOnTop": true,
  "transparent": true,
  "skipTaskbar": true,
  "visible": false,
  "url": "/preview"
}
```

UI Layout:
```
+-----------------------------+
| Recording  [bars]  01:23    |  <- Recording state
+-----------------------------+
| "Hello, this is a test      |  <- Preview text
| of the transcription..."    |
+-----------------------------+
```

**Files to Create/Modify**
| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Add preview window configuration |
| `src/routes/preview/+page.svelte` | NEW: Preview window page |
| `src/lib/components/TranscriptionPreview.svelte` | NEW: Text display component |

---

### Story 9.2: Transcription Preview Events

**User Story**
As a user, I want to see my transcription result in the preview window before it gets injected, so that I can verify the accuracy of the transcription.

**Acceptance Criteria**
- [ ] Backend emits `preview://text` event with transcription text
- [ ] Preview window receives and displays the text
- [ ] Text displayed for configurable duration (default 2-3 seconds) before injection
- [ ] Empty transcription results show "No speech detected"
- [ ] Error states display error message in preview window
- [ ] Preview clears after text injection completes

**Integration Verification**
- [ ] Existing `workflow://state-changed` events continue working
- [ ] Existing `workflow://metrics` events unaffected
- [ ] Text injection timing unchanged
- [ ] Existing tray/hotkey recording workflows continue functioning

**Technical Notes**

```rust
#[derive(serde::Serialize, Clone)]
pub struct PreviewPayload {
    pub text: String,
    pub state: String, // "preview" | "injecting" | "complete" | "error"
}

pub fn emit_preview_text<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    state: &str
) -> Result<(), String> {
    app.emit("preview://text", PreviewPayload {
        text: text.to_string(),
        state: state.to_string(),
    }).map_err(|e| e.to_string())
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/commands/workflow.rs` | Add preview text emission |
| `src-tauri/src/services/ui/mod.rs` | Add `emit_preview_text` function |
| `src/lib/services/workflow.ts` | Add preview event listener |

---

### Story 9.3: Preview Window Positioning

**User Story**
As a user, I want to position my preview window where it's convenient for my workflow, and have it remember that position, so that I don't have to reposition it every time I use the app.

**Acceptance Criteria**
- [ ] Preview window is draggable to any position on screen
- [ ] Window position saves when dragged to new location
- [ ] Position persists across app restarts
- [ ] Position defaults to near-cursor or top-right on first use
- [ ] Position resets gracefully if window would appear off-screen
- [ ] Multi-monitor support: position saved relative to primary or per-monitor

**Integration Verification**
- [ ] Existing indicator position settings unchanged
- [ ] Settings save/load cycle doesn't corrupt existing settings
- [ ] Preview position independent of recording indicator position

**Technical Notes**

```rust
pub struct Settings {
    // ... existing fields

    #[serde(default)]
    pub preview_position_x: Option<i32>,

    #[serde(default)]
    pub preview_position_y: Option<i32>,
}
```

Position validation on startup:
- Check if saved position is within current screen bounds
- If off-screen, reset to default position
- Handle monitor configuration changes gracefully

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add preview position fields |
| `src-tauri/src/services/ui/indicator.rs` | Add preview positioning functions |
| `src/routes/preview/+page.svelte` | Handle drag events, save position |

---

### Story 9.4: Preview Settings

**User Story**
As a user, I want to control whether the preview window shows and how it behaves, so that I can customize my workflow according to my preferences.

**Acceptance Criteria**
- [ ] Toggle: "Show transcription preview" (default: enabled)
- [ ] Slider/input: "Preview display duration" (1-5 seconds, default: 3)
- [ ] Toggle: "Show audio visualizer in preview" (default: enabled)
- [ ] Settings section between "Behavior" and "Advanced"
- [ ] Changes apply immediately without app restart
- [ ] Settings sync with existing settings infrastructure

**Integration Verification**
- [ ] Settings page layout remains clean and organized
- [ ] Settings import/export includes new preview settings
- [ ] Settings reset restores preview defaults
- [ ] Existing settings functionality unchanged

**Technical Notes**

```rust
pub struct Settings {
    // ... existing fields

    #[serde(default = "default_true")]
    pub preview_enabled: bool,

    #[serde(default = "default_preview_duration")]
    pub preview_duration_secs: u32,

    #[serde(default = "default_true")]
    pub preview_show_visualizer: bool,
}

fn default_preview_duration() -> u32 {
    3 // 3 seconds
}
```

**Files to Modify**
| File | Change |
|------|--------|
| `src-tauri/src/models/settings.rs` | Add preview settings fields |
| `src/lib/stores/settings.ts` | Add TypeScript types |
| `src/routes/settings/+page.svelte` | Add Preview settings section |

---

## Compatibility Requirements

- [x] Existing hotkey recording workflow continues working
- [x] Existing tray menu recording continues working
- [x] Existing recording indicator (audio bars only) remains an option
- [x] Settings migration handles missing preview settings gracefully
- [x] Preview window disabled by default doesn't affect existing users
- [x] Multi-platform (macOS, Windows, Linux) window behavior consistent

## Risk Mitigation

- **Primary Risk**: Window positioning issues across different screen configurations
- **Mitigation**: Validate positions on startup, fallback to default if off-screen
- **Rollback Plan**: Preview feature is toggleable; can be disabled without affecting core

- **Secondary Risk**: Preview window blocking or interfering with text injection target
- **Mitigation**: Ensure preview window doesn't steal focus; use appropriate window flags
- **Rollback Plan**: Add setting to auto-hide preview before injection

## Dependency Order

```
Story 9.1 (Preview UI) ----------------------+
                                              |
Story 9.2 (Preview Events) ------------------+--> Story 9.4 (Settings)
                                              |
Story 9.3 (Positioning) ---------------------+
```

Stories 9.1, 9.2, and 9.3 can be developed in parallel.
Story 9.4 (settings) integrates all pieces and should come last.

## Definition of Done

- [ ] Floating preview window displays transcription text during workflow
- [ ] Preview window is draggable with position memory
- [ ] Audio visualizer optionally shows in preview during recording
- [ ] Preview settings accessible in Settings page
- [ ] Preview can be enabled/disabled via settings
- [ ] Existing recording indicator workflow unchanged
- [ ] All existing tests pass
- [ ] New functionality covered by tests
- [ ] Consistent styling with existing dark theme

---

## Files to Create/Modify (Summary)

| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Add preview window configuration |
| `src/routes/preview/+page.svelte` | NEW: Preview window page |
| `src/lib/components/TranscriptionPreview.svelte` | NEW: Preview display component |
| `src-tauri/src/commands/workflow.rs` | Add preview text emission |
| `src-tauri/src/services/ui/mod.rs` | Add preview helper functions |
| `src/lib/services/workflow.ts` | Add preview event listeners |
| `src-tauri/src/models/settings.rs` | Add preview position and settings |
| `src-tauri/src/services/ui/indicator.rs` | Add preview window positioning |
| `src/lib/stores/settings.ts` | Update Settings interface |
| `src/routes/settings/+page.svelte` | Add Preview settings section |

---

## Story Manager Handoff

Please develop detailed implementation tickets for this brownfield epic. Key considerations:

- This is an enhancement to an existing Tauri 2/Svelte 5 system
- Integration points: Workflow service, UI indicator service, settings storage
- Existing patterns to follow: Svelte 5 runes ($state, $props, $effect), Tauri events, dark theme styling
- Critical compatibility: Existing recording indicator and hotkey workflow must continue working
- Each story must verify existing functionality remains intact
- Preview window should be opt-in for existing users (default enabled for new installs)

The epic should maintain system integrity while delivering a valuable preview capability that enhances the user's transcription workflow.
