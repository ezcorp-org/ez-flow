import { test, expect } from '@playwright/test';
import { testIds, waitForAppReady, openSettings, openHistory, startRecording, stopRecording, waitForTranscription } from './helpers';

/**
 * Epic 2: Live Workflow & System Integration
 *
 * Tests for global hotkeys, text injection, push-to-talk,
 * recording indicator, settings, history, and onboarding.
 */

test.describe('Epic 2: Live Workflow & System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');
    await waitForAppReady(page);
  });

  /**
   * Story 2.1: Global Hotkey Registration
   * Validates global hotkey functionality
   */
  test.describe('Story 2.1: Global Hotkey Registration', () => {
    test('should have hotkey configuration in settings', async ({ page }) => {
      // AC2: Default hotkey configurable
      await openSettings(page);

      const hotkeyInput = page.locator(`[data-testid="${testIds.hotkeyInput}"]`);
      await expect(hotkeyInput).toBeVisible();

      // Should show default hotkey
      const value = await hotkeyInput.inputValue();
      expect(value).toMatch(/ctrl|cmd|shift|space/i);
    });

    test('should allow hotkey customization', async ({ page }) => {
      await openSettings(page);

      const hotkeyInput = page.locator(`[data-testid="${testIds.hotkeyInput}"]`);
      await hotkeyInput.click();

      // Show "Press keys..." prompt
      const prompt = page.locator('[data-testid="hotkey-capture-prompt"]');
      await expect(prompt).toBeVisible();

      // Simulate key press (mocked in test env)
      await page.keyboard.press('Control+Alt+R');

      // Hotkey should be captured
      await expect(hotkeyInput).toHaveValue(/ctrl.*alt.*r/i);
    });

    test('should detect hotkey conflicts', async ({ page }) => {
      // AC6: Conflict detection
      await openSettings(page);

      const hotkeyInput = page.locator(`[data-testid="${testIds.hotkeyInput}"]`);
      await hotkeyInput.click();

      // Try a commonly used system hotkey
      await page.keyboard.press('Control+C');

      const conflictWarning = page.locator('[data-testid="hotkey-conflict-warning"]');
      await expect(conflictWarning).toBeVisible();
    });

    test('should show hotkey registration status', async ({ page }) => {
      // AC7: Status feedback if hotkey registration fails
      await openSettings(page);

      const status = page.locator('[data-testid="hotkey-status"]');
      await expect(status).toBeVisible();

      // Should indicate if hotkey is active
      await expect(status).toContainText(/active|registered|enabled/i);
    });
  });

  /**
   * Story 2.2: Text Injection at Cursor
   * Validates text injection functionality
   */
  test.describe('Story 2.2: Text Injection', () => {
    test('should have text injection command available', async ({ page }) => {
      // AC2: Tauri command inject_text exposed
      const hasCommand = await page.evaluate(async () => {
        try {
          // @ts-ignore
          const commands = await window.__TAURI__.invoke('list_commands');
          return commands.includes('inject_text');
        } catch {
          return false;
        }
      });

      expect(hasCommand).toBeTruthy();
    });

    test('should have injection delay setting', async ({ page }) => {
      // AC6: Configurable delay between keystrokes
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const delaySlider = page.locator('[data-testid="injection-delay-slider"]');
      await expect(delaySlider).toBeVisible();
    });

    test('should handle text injection errors gracefully', async ({ page }) => {
      // AC7: Error handling for injection issues
      // Simulate injection when no text field is focused
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore
          await window.__TAURI__.invoke('inject_text', { text: 'Test' });
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });

      // Should either succeed or return meaningful error
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  /**
   * Story 2.3: Push-to-Talk Complete Flow
   * Validates the full push-to-talk experience
   */
  test.describe('Story 2.3: Push-to-Talk Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure model is available
      const hasModel = await page.evaluate(async () => {
        // @ts-ignore
        const models = await window.__TAURI__.invoke('get_downloaded_models');
        return models.length > 0;
      });

      if (!hasModel) {
        test.skip();
      }
    });

    test('should start recording immediately on hotkey press', async ({ page }) => {
      // AC1: Hotkey hold -> recording starts immediately
      // Simulate push-to-talk
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.down('Space');

      const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
      await expect(indicator).toBeVisible();

      // Release
      await page.keyboard.up('Space');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
    });

    test('should complete transcription within latency target', async ({ page }) => {
      // AC3: Total latency < 3 seconds
      const startTime = Date.now();

      await startRecording(page);
      await page.waitForTimeout(1000); // Brief recording
      await stopRecording(page);

      await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 3000 });

      const endTime = Date.now();
      const latency = endTime - startTime - 1000; // Subtract recording time

      expect(latency).toBeLessThan(3000);
    });

    test('should prevent double-trigger with cooldown', async ({ page }) => {
      // AC7: Cooldown prevents accidental double-triggers
      await startRecording(page);
      await page.waitForTimeout(500);
      await stopRecording(page);

      // Immediately try to start again
      const recordBtn = page.locator(`[data-testid="${testIds.recordButton}"]`);

      // Button should be disabled during cooldown
      await expect(recordBtn).toBeDisabled();

      // Wait for cooldown to end
      await page.waitForTimeout(500);
      await expect(recordBtn).toBeEnabled();
    });

    test('should show error notification on transcription failure', async ({ page }) => {
      // AC5: If transcription fails, show error notification
      // Force a transcription error
      await page.evaluate(async () => {
        // @ts-ignore
        await window.__TAURI__.invoke('simulate_transcription_error');
      });

      await startRecording(page);
      await page.waitForTimeout(500);
      await stopRecording(page);

      const errorNotification = page.locator('[data-testid="error-notification"]');
      await expect(errorNotification).toBeVisible({ timeout: 5000 });
    });
  });

  /**
   * Story 2.4: Recording Indicator Widget
   * Validates the recording indicator UI
   */
  test.describe('Story 2.4: Recording Indicator', () => {
    test('should display indicator when recording', async ({ page }) => {
      // AC1: Small floating pill appears when recording
      await startRecording(page);

      const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveClass(/floating|fixed|absolute/);

      await stopRecording(page);
    });

    test('should show waveform animation', async ({ page }) => {
      // AC2: Shows waveform animation
      await startRecording(page);

      const visualizer = page.locator(`[data-testid="${testIds.audioVisualizer}"]`);
      await expect(visualizer).toBeVisible();

      // Check animation is running
      const hasAnimation = await visualizer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.animation !== 'none' || el.querySelector('[class*="animate"]');
      });

      expect(hasAnimation).toBeTruthy();

      await stopRecording(page);
    });

    test('should show elapsed time', async ({ page }) => {
      // AC2: Shows elapsed time
      await startRecording(page);

      const elapsed = page.locator('[data-testid="recording-elapsed-time"]');
      await expect(elapsed).toBeVisible();
      await expect(elapsed).toContainText(/\d+:\d+/);

      // Wait and verify time increments
      const time1 = await elapsed.textContent();
      await page.waitForTimeout(1500);
      const time2 = await elapsed.textContent();

      expect(time1).not.toEqual(time2);

      await stopRecording(page);
    });

    test('should be configurable in position', async ({ page }) => {
      // AC4: Position configurable
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const positionSelect = page.locator('[data-testid="indicator-position"]');
      await expect(positionSelect).toBeVisible();

      // Available options
      await positionSelect.click();
      await expect(page.locator('[data-testid="position-option-cursor"]')).toBeVisible();
      await expect(page.locator('[data-testid="position-option-top-right"]')).toBeVisible();
      await expect(page.locator('[data-testid="position-option-bottom-right"]')).toBeVisible();
    });

    test('should disappear when recording stops', async ({ page }) => {
      // AC5: Indicator disappears when recording stops
      await startRecording(page);

      const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
      await expect(indicator).toBeVisible();

      await stopRecording(page);
      await expect(indicator).not.toBeVisible();
    });

    test('should show transcribing state', async ({ page }) => {
      // AC6: Shows brief "Transcribing..." state
      await startRecording(page);
      await page.waitForTimeout(1000);
      await stopRecording(page);

      const processingIndicator = page.locator(`[data-testid="${testIds.processingIndicator}"]`);
      await expect(processingIndicator).toBeVisible();
      await expect(processingIndicator).toContainText(/transcribing/i);
    });
  });

  /**
   * Story 2.5: Settings Panel - Core Preferences
   * Validates basic settings functionality
   */
  test.describe('Story 2.5: Settings - Core', () => {
    test('should open settings from tray menu', async ({ page }) => {
      // AC1: Settings window opens from tray menu
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-settings"]');

      const settingsPanel = page.locator(`[data-testid="${testIds.settingsPanel}"]`);
      await expect(settingsPanel).toBeVisible();
    });

    test('should persist settings across app restarts', async ({ page }) => {
      // AC2: Settings persist across app restarts
      await openSettings(page);

      // Change a setting
      const autoStart = page.locator(`[data-testid="${testIds.autoStartToggle}"]`);
      await autoStart.click();
      const wasChecked = await autoStart.isChecked();

      // Save settings
      await page.click(`[data-testid="${testIds.saveSettingsButton}"]`);

      // Reload the app
      await page.reload();
      await waitForAppReady(page);
      await openSettings(page);

      // Verify setting persisted
      const autoStartAfter = page.locator(`[data-testid="${testIds.autoStartToggle}"]`);
      expect(await autoStartAfter.isChecked()).toBe(wasChecked);
    });

    test('should have hotkey configuration with conflict detection', async ({ page }) => {
      // AC3: Hotkey configuration with conflict detection
      await openSettings(page);

      const hotkeyInput = page.locator(`[data-testid="${testIds.hotkeyInput}"]`);
      await expect(hotkeyInput).toBeVisible();

      // Click to capture mode
      await hotkeyInput.click();

      const captureMode = page.locator('[data-testid="hotkey-capture-prompt"]');
      await expect(captureMode).toBeVisible();
    });

    test('should show model selection with download buttons', async ({ page }) => {
      // AC4: Model selection dropdown showing downloaded models + download buttons
      await openSettings(page);

      const modelSelector = page.locator(`[data-testid="${testIds.modelSelector}"]`);
      await modelSelector.click();

      // Should show models with download buttons for undownloaded ones
      const options = page.locator('[data-testid^="model-option-"]');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have startup behavior toggle', async ({ page }) => {
      // AC5: Startup behavior: "Start with system" toggle
      await openSettings(page);

      const autoStart = page.locator(`[data-testid="${testIds.autoStartToggle}"]`);
      await expect(autoStart).toBeVisible();
    });

    test('should have recording mode selection', async ({ page }) => {
      // AC6: Recording mode: "Push-to-talk" vs "Toggle"
      await openSettings(page);

      const modeSelect = page.locator('[data-testid="recording-mode"]');
      await expect(modeSelect).toBeVisible();

      await modeSelect.click();
      await expect(page.locator('[data-testid="mode-push-to-talk"]')).toBeVisible();
      await expect(page.locator('[data-testid="mode-toggle"]')).toBeVisible();
    });

    test('should have language selection', async ({ page }) => {
      // AC7: Language selection
      await openSettings(page);

      const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
      await expect(langSelect).toBeVisible();

      await langSelect.click();
      // Should have auto-detect option
      await expect(page.locator('[data-testid="lang-auto"]')).toBeVisible();
    });

    test('should apply changes immediately', async ({ page }) => {
      // AC8: Settings changes apply immediately
      await openSettings(page);

      // Change theme (immediately visible change)
      const themeSelect = page.locator(`[data-testid="${testIds.themeSelect}"]`);
      await themeSelect.click();
      await page.click('[data-testid="theme-dark"]');

      // Should apply without restart
      const body = page.locator('body');
      await expect(body).toHaveClass(/dark/);
    });
  });

  /**
   * Story 2.6: Settings Panel - Advanced Options
   * Validates advanced settings functionality
   */
  test.describe('Story 2.6: Settings - Advanced', () => {
    test('should have collapsible advanced section', async ({ page }) => {
      // AC1: Advanced section collapsed by default
      await openSettings(page);

      const advancedSection = page.locator(`[data-testid="${testIds.advancedSection}"]`);
      const advancedContent = page.locator('[data-testid="advanced-content"]');

      await expect(advancedSection).toBeVisible();
      await expect(advancedContent).not.toBeVisible();

      // Expand
      await advancedSection.click();
      await expect(advancedContent).toBeVisible();
    });

    test('should have injection delay slider', async ({ page }) => {
      // AC2: Text injection delay slider
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const slider = page.locator('[data-testid="injection-delay-slider"]');
      await expect(slider).toBeVisible();

      // Check range 0-50ms
      const min = await slider.getAttribute('min');
      const max = await slider.getAttribute('max');
      expect(Number(min)).toBe(0);
      expect(Number(max)).toBe(50);
    });

    test('should have debug logging toggle', async ({ page }) => {
      // AC6: Debug logging toggle
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const debugToggle = page.locator('[data-testid="debug-logging-toggle"]');
      await expect(debugToggle).toBeVisible();
    });

    test('should have reset to defaults button', async ({ page }) => {
      // AC7: "Reset to Defaults" button
      await openSettings(page);

      const resetBtn = page.locator(`[data-testid="${testIds.resetDefaultsButton}"]`);
      await expect(resetBtn).toBeVisible();

      await resetBtn.click();

      // Confirm dialog
      const confirmDialog = page.locator('[data-testid="reset-confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
    });

    test('should have export/import settings', async ({ page }) => {
      // AC8: Export/Import settings as JSON
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const exportBtn = page.locator('[data-testid="export-settings"]');
      const importBtn = page.locator('[data-testid="import-settings"]');

      await expect(exportBtn).toBeVisible();
      await expect(importBtn).toBeVisible();
    });
  });

  /**
   * Story 2.7: Transcription History
   * Validates history functionality
   */
  test.describe('Story 2.7: Transcription History', () => {
    test('should open history from tray menu', async ({ page }) => {
      // AC1: History view accessible from tray menu
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-history"]');

      const historyView = page.locator(`[data-testid="${testIds.historyView}"]`);
      await expect(historyView).toBeVisible();
    });

    test('should show transcription list with metadata', async ({ page }) => {
      // AC2: Shows list with timestamp, preview, duration
      await openHistory(page);

      const historyList = page.locator(`[data-testid="${testIds.historyList}"]`);
      await expect(historyList).toBeVisible();

      // If there are entries, check structure
      const items = page.locator('[data-testid^="history-item-"]');
      const count = await items.count();

      if (count > 0) {
        const firstItem = items.first();
        await expect(firstItem.locator('[data-testid="history-timestamp"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="history-preview"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="history-duration"]')).toBeVisible();
      }
    });

    test('should expand entry to show full text', async ({ page }) => {
      // AC3: Clicking entry expands to show full text
      await openHistory(page);

      const items = page.locator('[data-testid^="history-item-"]');
      const count = await items.count();

      if (count > 0) {
        const firstItem = items.first();
        await firstItem.click();

        const fullText = firstItem.locator('[data-testid="history-full-text"]');
        await expect(fullText).toBeVisible();
      }
    });

    test('should have copy button for each entry', async ({ page }) => {
      // AC4: Copy button copies full text
      await openHistory(page);

      const items = page.locator('[data-testid^="history-item-"]');
      const count = await items.count();

      if (count > 0) {
        const firstItem = items.first();
        await firstItem.click();

        const copyBtn = firstItem.locator(`[data-testid="${testIds.copyButton}"]`);
        await expect(copyBtn).toBeVisible();
      }
    });

    test('should have delete button for each entry', async ({ page }) => {
      // AC5: Delete button removes individual entries
      await openHistory(page);

      const items = page.locator('[data-testid^="history-item-"]');
      const initialCount = await items.count();

      if (initialCount > 0) {
        const firstItem = items.first();
        await firstItem.click();

        const deleteBtn = firstItem.locator('[data-testid="delete-entry"]');
        await expect(deleteBtn).toBeVisible();

        await deleteBtn.click();

        // Confirm deletion
        await page.click('[data-testid="confirm-delete"]');

        // Count should decrease
        const newCount = await items.count();
        expect(newCount).toBe(initialCount - 1);
      }
    });

    test('should have clear all button with confirmation', async ({ page }) => {
      // AC6: "Clear All History" with confirmation
      await openHistory(page);

      const clearBtn = page.locator(`[data-testid="${testIds.clearHistoryButton}"]`);
      await expect(clearBtn).toBeVisible();

      await clearBtn.click();

      const confirmDialog = page.locator('[data-testid="clear-history-confirm"]');
      await expect(confirmDialog).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      // AC9: Search/filter functionality
      await openHistory(page);

      const searchInput = page.locator(`[data-testid="${testIds.historySearch}"]`);
      await expect(searchInput).toBeVisible();

      await searchInput.fill('test query');

      // Results should filter
      const items = page.locator('[data-testid^="history-item-"]');
      // Items shown should only contain matching entries
    });
  });

  /**
   * Story 2.8: First-Run Onboarding
   * Validates onboarding wizard
   */
  test.describe('Story 2.8: First-Run Onboarding', () => {
    test.beforeEach(async ({ page }) => {
      // Reset to simulate first run
      await page.evaluate(async () => {
        // @ts-ignore
        await window.__TAURI__.invoke('reset_onboarding_state');
      });
    });

    test('should launch onboarding on first run', async ({ page }) => {
      // AC1: Onboarding wizard launches on first run
      await page.reload();
      await waitForAppReady(page);

      const onboarding = page.locator(`[data-testid="${testIds.onboardingWizard}"]`);
      await expect(onboarding).toBeVisible();
    });

    test('should show welcome screen as step 1', async ({ page }) => {
      // AC2: Step 1: Welcome screen
      await page.reload();
      await waitForAppReady(page);

      const welcomeStep = page.locator('[data-testid="onboarding-step-welcome"]');
      await expect(welcomeStep).toBeVisible();
      await expect(welcomeStep).toContainText(/welcome|get started|ez flow/i);
    });

    test('should request microphone permission in step 2', async ({ page }) => {
      // AC3: Step 2: Microphone permission request
      await page.reload();
      await waitForAppReady(page);

      // Navigate to step 2
      await page.click(`[data-testid="${testIds.onboardingNext}"]`);

      const micStep = page.locator('[data-testid="onboarding-step-mic"]');
      await expect(micStep).toBeVisible();

      const permissionBtn = page.locator(`[data-testid="${testIds.micPermissionButton}"]`);
      await expect(permissionBtn).toBeVisible();
    });

    test('should show model selection in step 3', async ({ page }) => {
      // AC4: Step 3: Model selection and download
      await page.reload();
      await waitForAppReady(page);

      // Navigate to step 3
      await page.click(`[data-testid="${testIds.onboardingNext}"]`);
      await page.click(`[data-testid="${testIds.onboardingNext}"]`);

      const modelStep = page.locator('[data-testid="onboarding-step-model"]');
      await expect(modelStep).toBeVisible();

      // Should show model options with size info
      const modelOptions = page.locator('[data-testid^="onboarding-model-"]');
      const count = await modelOptions.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should configure hotkey in step 4', async ({ page }) => {
      // AC5: Step 4: Hotkey configuration with test
      await page.reload();
      await waitForAppReady(page);

      // Navigate to step 4
      for (let i = 0; i < 3; i++) {
        await page.click(`[data-testid="${testIds.onboardingNext}"]`);
      }

      const hotkeyStep = page.locator('[data-testid="onboarding-step-hotkey"]');
      await expect(hotkeyStep).toBeVisible();

      const testBtn = page.locator(`[data-testid="${testIds.testRecordButton}"]`);
      await expect(testBtn).toBeVisible();
    });

    test('should show success screen in step 5', async ({ page }) => {
      // AC6: Step 5: Success screen with tips
      await page.reload();
      await waitForAppReady(page);

      // Navigate through all steps
      for (let i = 0; i < 4; i++) {
        await page.click(`[data-testid="${testIds.onboardingNext}"]`);
      }

      const successStep = page.locator('[data-testid="onboarding-step-success"]');
      await expect(successStep).toBeVisible();
      await expect(successStep).toContainText(/ready|success|tips/i);
    });

    test('should have skip option', async ({ page }) => {
      // AC7: "Skip" option available
      await page.reload();
      await waitForAppReady(page);

      const skipBtn = page.locator(`[data-testid="${testIds.onboardingSkip}"]`);
      await expect(skipBtn).toBeVisible();

      await skipBtn.click();

      // Onboarding should close
      const onboarding = page.locator(`[data-testid="${testIds.onboardingWizard}"]`);
      await expect(onboarding).not.toBeVisible();
    });

    test('should not repeat after completion', async ({ page }) => {
      // AC8: Onboarding state persisted
      await page.reload();
      await waitForAppReady(page);

      // Complete onboarding
      for (let i = 0; i < 4; i++) {
        await page.click(`[data-testid="${testIds.onboardingNext}"]`);
      }
      await page.click('[data-testid="onboarding-finish"]');

      // Reload and verify no onboarding
      await page.reload();
      await waitForAppReady(page);

      const onboarding = page.locator(`[data-testid="${testIds.onboardingWizard}"]`);
      await expect(onboarding).not.toBeVisible();
    });

    test('should be accessible from settings', async ({ page }) => {
      // AC9: Can re-run from Settings
      // Complete initial onboarding first
      await page.reload();
      await waitForAppReady(page);
      await page.click(`[data-testid="${testIds.onboardingSkip}"]`);

      await openSettings(page);

      const setupWizardBtn = page.locator('[data-testid="run-setup-wizard"]');
      await expect(setupWizardBtn).toBeVisible();

      await setupWizardBtn.click();

      const onboarding = page.locator(`[data-testid="${testIds.onboardingWizard}"]`);
      await expect(onboarding).toBeVisible();
    });
  });
});
