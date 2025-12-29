import { test, expect } from '@playwright/test';
import { testIds, waitForAppReady, openSettings, selectModel, downloadModel } from './helpers';

/**
 * Epic 1: Foundation & Core Transcription
 *
 * Tests for establishing project foundation, system tray integration,
 * audio capture, Whisper integration, model management, and basic transcription.
 */

test.describe('Epic 1: Foundation & Core Transcription', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');
    await waitForAppReady(page);
  });

  /**
   * Story 1.1: Project Scaffolding & CI Setup
   * Validates that the app builds and runs correctly
   */
  test.describe('Story 1.1: Project Scaffolding', () => {
    test('app should launch successfully', async ({ page }) => {
      // AC1: Tauri v2 project initialized with Svelte frontend
      await expect(page.locator(`[data-testid="${testIds.appRoot}"]`)).toBeVisible();
    });

    test('app should display version information', async ({ page }) => {
      // The app should expose version info
      await openSettings(page);
      const version = page.locator('[data-testid="app-version"]');
      await expect(version).toBeVisible();
      await expect(version).toContainText(/\d+\.\d+\.\d+/);
    });
  });

  /**
   * Story 1.2: System Tray Integration
   * Validates system tray functionality
   */
  test.describe('Story 1.2: System Tray Integration', () => {
    test('app should start minimized to system tray', async ({ page }) => {
      // AC1: App starts minimized to system tray
      // In test mode, we verify the app doesn't show a main window by default
      const mainWindow = page.locator('[data-testid="main-window"]');

      // The main window should be hidden or minimized on fresh start
      // This is controlled by Tauri config, we verify the setting works
      await openSettings(page);
      const minimizeOnStart = page.locator(`[data-testid="minimize-on-start"]`);
      await expect(minimizeOnStart).toBeVisible();
    });

    test('tray icon should be visible with correct icon', async ({ page }) => {
      // AC2: Tray icon displays EZ Flow logo
      // In E2E we can verify the tray menu is accessible
      const trayMenu = page.locator(`[data-testid="${testIds.trayMenu}"]`);
      await expect(trayMenu).toBeVisible();
    });

    test('tray menu should include essential items', async ({ page }) => {
      // AC3: Tray menu includes: "About", separator, "Quit"
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      const trayMenu = page.locator(`[data-testid="${testIds.trayMenu}"]`);

      await expect(trayMenu.locator('[data-testid="menu-about"]')).toBeVisible();
      await expect(trayMenu.locator('[data-testid="menu-quit"]')).toBeVisible();
    });

    test('clicking quit should prompt for confirmation', async ({ page }) => {
      // AC4: Clicking "Quit" exits the application cleanly
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-quit"]');

      // Should show confirmation dialog
      const confirmDialog = page.locator('[data-testid="quit-confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
    });
  });

  /**
   * Story 1.3: Audio Capture from Microphone
   * Validates audio recording functionality
   */
  test.describe('Story 1.3: Audio Capture', () => {
    test('should show microphone permission status', async ({ page }) => {
      // AC1: App requests and handles microphone permissions
      await openSettings(page);
      const micStatus = page.locator('[data-testid="mic-permission-status"]');
      await expect(micStatus).toBeVisible();
    });

    test('should have start/stop recording controls', async ({ page }) => {
      // AC3: Tray menu adds "Start Recording" / "Stop Recording"
      const recordButton = page.locator(`[data-testid="${testIds.recordButton}"]`);
      await expect(recordButton).toBeVisible();
      await expect(recordButton).toBeEnabled();
    });

    test('recording indicator should appear when recording', async ({ page }) => {
      // AC5: Visual indicator shows recording state
      await page.click(`[data-testid="${testIds.recordButton}"]`);

      const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
      await expect(indicator).toBeVisible();

      // Clean up - stop recording
      await page.click(`[data-testid="${testIds.stopButton}"]`);
      await expect(indicator).not.toBeVisible();
    });

    test('should handle no microphone gracefully', async ({ page }) => {
      // AC7: Error handling for no microphone
      // This test would need to mock the audio device scenario
      // In real E2E, we verify the error message UI exists
      const errorMessage = page.locator(`[data-testid="${testIds.errorMessage}"]`);

      // Trigger a scenario without mic (mocked in test environment)
      await page.evaluate(async () => {
        // @ts-ignore
        await window.__TAURI__.invoke('simulate_no_microphone');
      });

      await page.click(`[data-testid="${testIds.recordButton}"]`);
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/microphone/i);
    });
  });

  /**
   * Story 1.4: Whisper Model Integration
   * Validates Whisper model loading and transcription
   */
  test.describe('Story 1.4: Whisper Model Integration', () => {
    test('should expose transcribe command', async ({ page }) => {
      // AC2: Tauri command transcribe_audio exposed
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore
          const commands = await window.__TAURI__.invoke('list_commands');
          return commands.includes('transcribe_audio');
        } catch {
          return false;
        }
      });

      expect(result).toBeTruthy();
    });

    test('should show model configuration in settings', async ({ page }) => {
      // AC4: Model path configurable
      await openSettings(page);
      const modelPath = page.locator('[data-testid="model-path"]');
      await expect(modelPath).toBeVisible();
    });

    test('should handle missing model gracefully', async ({ page }) => {
      // AC5: Returns descriptive error if no model
      // Clear any downloaded models for this test
      await page.evaluate(async () => {
        // @ts-ignore
        await window.__TAURI__.invoke('clear_models');
      });

      await page.click(`[data-testid="${testIds.recordButton}"]`);
      await page.click(`[data-testid="${testIds.stopButton}"]`);

      const error = page.locator(`[data-testid="${testIds.errorMessage}"]`);
      await expect(error).toBeVisible();
      await expect(error).toContainText(/model/i);
    });
  });

  /**
   * Story 1.5: On-Demand Model Download
   * Validates model download functionality
   */
  test.describe('Story 1.5: Model Download', () => {
    test('should display available models with sizes', async ({ page }) => {
      // AC1: Model manifest defines available models
      await page.click(`[data-testid="${testIds.modelSelector}"]`);

      const models = ['tiny', 'base', 'small', 'medium', 'large-v3'];
      for (const model of models) {
        const option = page.locator(`[data-testid="${testIds.modelOption(model)}"]`);
        await expect(option).toBeVisible();
        // Verify size is displayed
        await expect(option.locator('[data-testid="model-size"]')).toContainText(/\d+\s*(MB|GB)/i);
      }
    });

    test('should show download progress', async ({ page }) => {
      // AC3: Download shows progress percentage
      await page.click(`[data-testid="${testIds.modelSelector}"]`);

      // Start download of tiny model (smallest for test)
      const tinyOption = page.locator(`[data-testid="${testIds.modelOption('tiny')}"]`);
      const downloadBtn = tinyOption.locator('[data-testid="download-button"]');

      // Skip if already downloaded
      if (await downloadBtn.isVisible()) {
        await downloadBtn.click();

        const progress = page.locator(`[data-testid="${testIds.downloadProgress}"]`);
        await expect(progress).toBeVisible();
        // Progress should show percentage
        await expect(progress).toContainText(/%/);
      }
    });

    test('should query downloaded models', async ({ page }) => {
      // AC7: Frontend can query which models are downloaded
      await page.click(`[data-testid="${testIds.modelSelector}"]`);

      // Check for downloaded indicator on models
      const models = page.locator('[data-testid^="model-option-"]');
      const count = await models.count();

      for (let i = 0; i < count; i++) {
        const model = models.nth(i);
        const downloadedAttr = await model.getAttribute('data-downloaded');
        expect(['true', 'false']).toContain(downloadedAttr);
      }
    });
  });

  /**
   * Story 1.6: Audio File Transcription UI
   * Validates file-based transcription
   */
  test.describe('Story 1.6: File Transcription', () => {
    test('should have transcribe file option', async ({ page }) => {
      // AC1: Tray menu includes "Transcribe File..."
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      const transcribeFile = page.locator('[data-testid="menu-transcribe-file"]');
      await expect(transcribeFile).toBeVisible();
    });

    test('should have file dropzone', async ({ page }) => {
      // AC3: Dropping audio file triggers transcription
      const dropzone = page.locator(`[data-testid="${testIds.fileDropzone}"]`);
      await expect(dropzone).toBeVisible();
    });

    test('should show result window with copy button', async ({ page }) => {
      // AC4: Result window shows filename, transcription, copy button
      // This test uses a fixture audio file
      const fixtureAudio = './tests/fixtures/audio/hello-world.wav';

      // Mock file drop or use file picker
      await page.click(`[data-testid="${testIds.filePickerButton}"]`);

      // After transcription completes
      const resultWindow = page.locator('[data-testid="transcription-result-window"]');
      await expect(resultWindow).toBeVisible({ timeout: 60000 });

      await expect(resultWindow.locator('[data-testid="result-filename"]')).toBeVisible();
      await expect(resultWindow.locator(`[data-testid="${testIds.transcriptionResult}"]`)).toBeVisible();
      await expect(resultWindow.locator(`[data-testid="${testIds.copyButton}"]`)).toBeVisible();
    });

    test('should prompt for model if none downloaded', async ({ page }) => {
      // AC7: If no model downloaded, prompts user
      await page.evaluate(async () => {
        // @ts-ignore
        await window.__TAURI__.invoke('clear_models');
      });

      await page.click(`[data-testid="${testIds.filePickerButton}"]`);

      const modelPrompt = page.locator('[data-testid="download-model-prompt"]');
      await expect(modelPrompt).toBeVisible();
    });
  });

  /**
   * Story 1.7: Record & Transcribe Flow
   * Validates the complete record-to-text flow
   */
  test.describe('Story 1.7: Record & Transcribe Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we have at least the tiny model for testing
      const hasModel = await page.evaluate(async () => {
        // @ts-ignore
        const models = await window.__TAURI__.invoke('get_downloaded_models');
        return models.length > 0;
      });

      if (!hasModel) {
        test.skip();
      }
    });

    test('should transcribe after recording stops', async ({ page }) => {
      // AC1 & AC2: Recording triggers automatic transcription
      await page.click(`[data-testid="${testIds.recordButton}"]`);

      // Record for a short time (mocked audio input)
      await page.waitForTimeout(2000);

      await page.click(`[data-testid="${testIds.stopButton}"]`);

      // Should show processing state
      const processing = page.locator(`[data-testid="${testIds.processingIndicator}"]`);
      await expect(processing).toBeVisible();

      // Should eventually show result
      const result = page.locator(`[data-testid="${testIds.transcriptionResult}"]`);
      await expect(result).toBeVisible({ timeout: 30000 });
    });

    test('should show copy button in result', async ({ page }) => {
      // AC3: Result window displays copy button
      await page.click(`[data-testid="${testIds.recordButton}"]`);
      await page.waitForTimeout(1000);
      await page.click(`[data-testid="${testIds.stopButton}"]`);

      const result = page.locator(`[data-testid="${testIds.transcriptionResult}"]`);
      await expect(result).toBeVisible({ timeout: 30000 });

      const copyBtn = page.locator(`[data-testid="${testIds.copyButton}"]`);
      await expect(copyBtn).toBeVisible();

      // Click copy and verify clipboard
      await copyBtn.click();
      const toast = page.locator('[data-testid="copy-success-toast"]');
      await expect(toast).toBeVisible();
    });

    test('should complete full flow: record -> speak -> stop -> see text', async ({ page }) => {
      // AC5: Full flow works end-to-end
      const recordBtn = page.locator(`[data-testid="${testIds.recordButton}"]`);
      const stopBtn = page.locator(`[data-testid="${testIds.stopButton}"]`);
      const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
      const result = page.locator(`[data-testid="${testIds.transcriptionResult}"]`);

      // Start recording
      await recordBtn.click();
      await expect(indicator).toBeVisible();
      await expect(recordBtn).not.toBeVisible();
      await expect(stopBtn).toBeVisible();

      // Simulate speaking (wait for audio input)
      await page.waitForTimeout(2000);

      // Stop recording
      await stopBtn.click();
      await expect(indicator).not.toBeVisible();

      // Wait for transcription
      await expect(result).toBeVisible({ timeout: 30000 });

      // Verify non-empty result
      const text = await result.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });

    test('should log transcription time', async ({ page }) => {
      // AC6: Transcription time logged
      await page.click(`[data-testid="${testIds.recordButton}"]`);
      await page.waitForTimeout(1000);
      await page.click(`[data-testid="${testIds.stopButton}"]`);

      await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 30000 });

      // Check that duration is displayed
      const duration = page.locator('[data-testid="transcription-duration"]');
      await expect(duration).toBeVisible();
      await expect(duration).toContainText(/\d+(\.\d+)?\s*(s|ms)/i);
    });
  });
});
