import { test, expect } from '@playwright/test';
import { testIds, waitForAppReady, openSettings, startRecording, stopRecording } from './helpers';

/**
 * Epic 3: Polish, Performance & Developer Tools
 *
 * Tests for GPU acceleration, CLI interface, multi-language support,
 * auto-update, production installers, and performance optimization.
 */

test.describe('Epic 3: Polish, Performance & Developer Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');
    await waitForAppReady(page);
  });

  /**
   * Story 3.1: GPU Acceleration - CUDA (NVIDIA)
   * Validates CUDA GPU acceleration
   */
  test.describe('Story 3.1: GPU Acceleration - CUDA', () => {
    test('should detect NVIDIA GPU availability', async ({ page }) => {
      // AC1: Detect NVIDIA GPU and CUDA availability
      const gpuInfo = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_gpu_info');
      });

      expect(gpuInfo).toHaveProperty('cuda_available');
    });

    test('should have GPU acceleration toggle in settings', async ({ page }) => {
      // AC3: Settings toggle for GPU acceleration
      await openSettings(page);

      const gpuToggle = page.locator(`[data-testid="${testIds.gpuToggle}"]`);
      await expect(gpuToggle).toBeVisible();
    });

    test('should show GPU memory usage in settings', async ({ page }) => {
      // AC6: GPU memory usage displayed
      await openSettings(page);

      const gpuMemory = page.locator('[data-testid="gpu-memory-usage"]');
      // Only visible if GPU is available
      const gpuAvailable = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        const info = await window.__TAURI__.invoke('get_gpu_info');
        return info.cuda_available || info.metal_available;
      });

      if (gpuAvailable) {
        await expect(gpuMemory).toBeVisible();
      }
    });

    test('should show performance metrics comparing GPU vs CPU', async ({ page }) => {
      // AC7: Performance metrics in history
      await startRecording(page);
      await page.waitForTimeout(1000);
      await stopRecording(page);

      // Wait for transcription
      await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 30000 });

      // Check for acceleration badge
      const accelerationBadge = page.locator('[data-testid="acceleration-type"]');
      await expect(accelerationBadge).toBeVisible();
      await expect(accelerationBadge).toContainText(/GPU|CPU|CUDA|Metal/i);
    });

    test('should fallback to CPU if CUDA fails', async ({ page }) => {
      // AC5: Graceful fallback to CPU
      // Simulate CUDA failure
      await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        await window.__TAURI__.invoke('simulate_cuda_failure');
      });

      await startRecording(page);
      await page.waitForTimeout(1000);
      await stopRecording(page);

      // Should still complete transcription
      const result = page.locator(`[data-testid="${testIds.transcriptionResult}"]`);
      await expect(result).toBeVisible({ timeout: 60000 });

      // Should indicate CPU fallback
      const accelerationBadge = page.locator('[data-testid="acceleration-type"]');
      await expect(accelerationBadge).toContainText(/CPU|fallback/i);
    });
  });

  /**
   * Story 3.2: GPU Acceleration - Metal (Apple Silicon)
   * Validates Metal GPU acceleration on macOS
   */
  test.describe('Story 3.2: GPU Acceleration - Metal', () => {
    test('should detect Apple Silicon and Metal availability', async ({ page }) => {
      // AC1: Detect Apple Silicon and Metal
      const gpuInfo = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_gpu_info');
      });

      expect(gpuInfo).toHaveProperty('metal_available');
      expect(gpuInfo).toHaveProperty('is_apple_silicon');
    });

    test('should use Metal automatically when available', async ({ page }) => {
      // AC3: Automatically uses Metal when available
      const gpuInfo = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_gpu_info');
      });

      if (gpuInfo.metal_available) {
        await startRecording(page);
        await page.waitForTimeout(1000);
        await stopRecording(page);

        await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 30000 });

        const accelerationBadge = page.locator('[data-testid="acceleration-type"]');
        await expect(accelerationBadge).toContainText(/Metal/i);
      }
    });
  });

  /**
   * Story 3.3: CLI Interface
   * Validates CLI commands (tested via Tauri backend commands)
   */
  test.describe('Story 3.3: CLI Interface', () => {
    test('should have transcribe command available', async ({ page }) => {
      // AC2: ezflow transcribe <audio_file>
      const commands = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('list_cli_commands');
      });

      expect(commands).toContain('transcribe');
    });

    test('should have models list command', async ({ page }) => {
      // AC2: ezflow models list
      const commands = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('list_cli_commands');
      });

      expect(commands).toContain('models');
    });

    test('should have version information', async ({ page }) => {
      // AC2: ezflow --version
      const version = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_cli_version');
      });

      expect(version).toMatch(/\d+\.\d+\.\d+/);
    });

    test('CLI and GUI should share model directory', async ({ page }) => {
      // AC6: Shares model directory with GUI app
      const paths = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_model_paths');
      });

      expect(paths.cli_path).toBe(paths.gui_path);
    });
  });

  /**
   * Story 3.4: Multi-Language Support
   * Validates language selection and transcription
   */
  test.describe('Story 3.4: Multi-Language Support', () => {
    test('should have language selector with all supported languages', async ({ page }) => {
      // AC1: Language selector with all Whisper-supported languages
      await openSettings(page);

      const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
      await langSelect.click();

      // Check for common languages
      await expect(page.locator('[data-testid="lang-en"]')).toBeVisible();
      await expect(page.locator('[data-testid="lang-es"]')).toBeVisible();
      await expect(page.locator('[data-testid="lang-zh"]')).toBeVisible();
      await expect(page.locator('[data-testid="lang-ja"]')).toBeVisible();
    });

    test('should have auto-detect option as default', async ({ page }) => {
      // AC2: "Auto-detect" option as default
      await openSettings(page);

      const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
      const value = await langSelect.locator('[data-testid="selected-value"]').textContent();

      expect(value).toMatch(/auto|detect/i);
    });

    test('should show common languages at top of list', async ({ page }) => {
      // AC5: Common languages surfaced at top
      await openSettings(page);

      const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
      await langSelect.click();

      const options = page.locator('[data-testid^="lang-"]');
      const firstFew = await options.evaluateAll((els) =>
        els.slice(0, 5).map(el => el.getAttribute('data-testid'))
      );

      // Auto and English should be at top
      expect(firstFew).toContain('lang-auto');
      expect(firstFew.slice(1, 5)).toContain('lang-en');
    });

    test('should display language in history entry', async ({ page }) => {
      // AC6: Language displayed in transcription history
      await openSettings(page);

      // Set a specific language
      const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
      await langSelect.click();
      await page.click('[data-testid="lang-es"]');

      // Record and transcribe
      await page.click('[data-testid="close-settings"]');
      await startRecording(page);
      await page.waitForTimeout(1000);
      await stopRecording(page);

      await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 30000 });

      // Check history
      await page.click(`[data-testid="${testIds.historyButton}"]`);
      const historyItem = page.locator('[data-testid="history-item-0"]');
      await expect(historyItem.locator('[data-testid="history-language"]')).toContainText(/spanish|es/i);
    });
  });

  /**
   * Story 3.5: Auto-Update System
   * Validates automatic update functionality
   */
  test.describe('Story 3.5: Auto-Update System', () => {
    test('should have check for updates option', async ({ page }) => {
      // AC7: Manual "Check for Updates" option
      await page.click(`[data-testid="${testIds.trayIcon}"]`);

      const checkUpdates = page.locator('[data-testid="menu-check-updates"]');
      await expect(checkUpdates).toBeVisible();
    });

    test('should have auto-update toggle in settings', async ({ page }) => {
      // AC6: Settings toggle for auto-update
      await openSettings(page);

      const autoUpdateToggle = page.locator('[data-testid="auto-update-toggle"]');
      await expect(autoUpdateToggle).toBeVisible();
    });

    test('should show update dialog when update available', async ({ page }) => {
      // AC3: Notification when update available
      // Mock an available update
      await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        await window.__TAURI__.invoke('simulate_update_available', {
          version: '99.0.0',
          notes: 'Test release notes'
        });
      });

      // Trigger update check
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-check-updates"]');

      const updateDialog = page.locator('[data-testid="update-dialog"]');
      await expect(updateDialog).toBeVisible();
      await expect(updateDialog).toContainText(/99\.0\.0/);
    });

    test('should show release notes before update', async ({ page }) => {
      // AC5: Release notes displayed
      await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        await window.__TAURI__.invoke('simulate_update_available', {
          version: '99.0.0',
          notes: 'New feature: Better transcription accuracy'
        });
      });

      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-check-updates"]');

      const releaseNotes = page.locator('[data-testid="update-release-notes"]');
      await expect(releaseNotes).toBeVisible();
      await expect(releaseNotes).toContainText(/Better transcription accuracy/);
    });
  });

  /**
   * Story 3.6: Production Installers - Windows
   * Story 3.7: Production Installers - macOS
   * Story 3.8: Production Installers - Linux
   *
   * These are build/packaging tests, verified through build process
   */
  test.describe('Story 3.6-3.8: Production Installers', () => {
    test('should provide platform information', async ({ page }) => {
      const platform = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_platform');
      });

      expect(['windows', 'macos', 'linux']).toContain(platform);
    });

    test('should show app info with build details', async ({ page }) => {
      await openSettings(page);

      const appInfo = page.locator('[data-testid="app-info"]');
      await expect(appInfo).toBeVisible();

      // Should show version and build info
      await expect(appInfo.locator('[data-testid="app-version"]')).toBeVisible();
      await expect(appInfo.locator('[data-testid="build-date"]')).toBeVisible();
    });
  });

  /**
   * Story 3.9: Performance Optimization & Telemetry
   * Validates performance characteristics
   */
  test.describe('Story 3.9: Performance Optimization', () => {
    test('should have low idle memory usage', async ({ page }) => {
      // AC1: Idle memory usage < 50MB
      const memoryUsage = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_memory_usage');
      });

      // Memory in bytes, 50MB = 52428800
      expect(memoryUsage.idle_mb).toBeLessThan(50);
    });

    test('should lazy-load model on first transcription', async ({ page }) => {
      // AC2: Model lazy-loaded on first transcription
      const modelLoadedBefore = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('is_model_loaded');
      });

      expect(modelLoadedBefore).toBe(false);

      // Trigger transcription
      await startRecording(page);
      await page.waitForTimeout(500);
      await stopRecording(page);

      await page.locator(`[data-testid="${testIds.transcriptionResult}"]`).waitFor({ timeout: 30000 });

      const modelLoadedAfter = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('is_model_loaded');
      });

      expect(modelLoadedAfter).toBe(true);
    });

    test('should have fast startup time', async ({ page }) => {
      // AC4: Startup time < 3 seconds
      const startTime = Date.now();

      await page.reload();
      await waitForAppReady(page);

      const endTime = Date.now();
      const startupTime = endTime - startTime;

      expect(startupTime).toBeLessThan(3000);
    });

    test('should have low CPU usage when idle', async ({ page }) => {
      // AC5: CPU usage near 0% when idle
      // Wait for app to settle
      await page.waitForTimeout(2000);

      const cpuUsage = await page.evaluate(async () => {
        // @ts-expect-error - Tauri invoke
        return await window.__TAURI__.invoke('get_cpu_usage');
      });

      expect(cpuUsage.percent).toBeLessThan(5);
    });

    test('should have optional telemetry setting', async ({ page }) => {
      // AC6: Optional anonymous usage telemetry
      await openSettings(page);
      await page.click(`[data-testid="${testIds.advancedSection}"]`);

      const telemetryToggle = page.locator('[data-testid="telemetry-toggle"]');
      await expect(telemetryToggle).toBeVisible();

      // Should be off by default
      expect(await telemetryToggle.isChecked()).toBe(false);
    });
  });

  /**
   * Story 3.10: Documentation & Community Setup
   * Validates documentation accessibility
   */
  test.describe('Story 3.10: Documentation', () => {
    test('should have help/documentation link', async ({ page }) => {
      await page.click(`[data-testid="${testIds.trayIcon}"]`);

      const helpLink = page.locator('[data-testid="menu-help"]');
      await expect(helpLink).toBeVisible();
    });

    test('should show about dialog with links', async ({ page }) => {
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-about"]');

      const aboutDialog = page.locator('[data-testid="about-dialog"]');
      await expect(aboutDialog).toBeVisible();

      // Should have links to repo, docs
      await expect(aboutDialog.locator('[data-testid="github-link"]')).toBeVisible();
      await expect(aboutDialog.locator('[data-testid="docs-link"]')).toBeVisible();
    });

    test('should display license information', async ({ page }) => {
      await page.click(`[data-testid="${testIds.trayIcon}"]`);
      await page.click('[data-testid="menu-about"]');

      const license = page.locator('[data-testid="license-info"]');
      await expect(license).toBeVisible();
      await expect(license).toContainText(/MIT/i);
    });
  });
});

/**
 * Cross-cutting E2E tests that span multiple epics
 */
test.describe('Cross-Epic Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('tauri://localhost');
    await waitForAppReady(page);
  });

  test('complete user journey: first launch to first transcription', async ({ page }) => {
    // Simulate fresh install
    await page.evaluate(async () => {
      // @ts-expect-error - Tauri invoke
      await window.__TAURI__.invoke('reset_all_state');
    });

    await page.reload();
    await waitForAppReady(page);

    // 1. Onboarding should appear
    const onboarding = page.locator(`[data-testid="${testIds.onboardingWizard}"]`);
    await expect(onboarding).toBeVisible();

    // 2. Go through onboarding
    await page.click(`[data-testid="${testIds.onboardingNext}"]`); // Welcome
    await page.click(`[data-testid="${testIds.micPermissionButton}"]`); // Mic permission
    await page.click(`[data-testid="${testIds.onboardingNext}"]`); // After permission

    // 3. Download a model
    await page.click('[data-testid="onboarding-model-tiny"]');
    await page.locator('[data-testid="model-download-complete"]').waitFor({ timeout: 120000 });
    await page.click(`[data-testid="${testIds.onboardingNext}"]`);

    // 4. Configure hotkey
    await page.click(`[data-testid="${testIds.onboardingNext}"]`); // Use default

    // 5. Complete onboarding
    await page.click('[data-testid="onboarding-finish"]');

    // 6. Main app should be ready
    await expect(onboarding).not.toBeVisible();
    const recordBtn = page.locator(`[data-testid="${testIds.recordButton}"]`);
    await expect(recordBtn).toBeVisible();

    // 7. Make first transcription
    await startRecording(page);
    await page.waitForTimeout(2000);
    await stopRecording(page);

    const result = page.locator(`[data-testid="${testIds.transcriptionResult}"]`);
    await expect(result).toBeVisible({ timeout: 30000 });

    // 8. Verify it appears in history
    await page.click(`[data-testid="${testIds.historyButton}"]`);
    const historyItems = page.locator('[data-testid^="history-item-"]');
    await expect(historyItems).toHaveCount(1);
  });

  test('settings changes persist and apply across app', async ({ page }) => {
    await openSettings(page);

    // Change multiple settings
    const themeSelect = page.locator(`[data-testid="${testIds.themeSelect}"]`);
    await themeSelect.click();
    await page.click('[data-testid="theme-dark"]');

    const langSelect = page.locator(`[data-testid="${testIds.languageSelect}"]`);
    await langSelect.click();
    await page.click('[data-testid="lang-es"]');

    await page.click(`[data-testid="${testIds.saveSettingsButton}"]`);

    // Reload and verify
    await page.reload();
    await waitForAppReady(page);

    // Theme should persist
    await expect(page.locator('body')).toHaveClass(/dark/);

    // Language should persist
    await openSettings(page);
    const selectedLang = await page.locator(`[data-testid="${testIds.languageSelect}"] [data-testid="selected-value"]`).textContent();
    expect(selectedLang).toMatch(/spanish|es/i);
  });

  test('error recovery: handles model deletion gracefully', async ({ page }) => {
    // Ensure model is downloaded first
    await openSettings(page);
    const modelSelector = page.locator(`[data-testid="${testIds.modelSelector}"]`);
    await modelSelector.click();

    const tinyOption = page.locator(`[data-testid="${testIds.modelOption('tiny')}"]`);
    if (!(await tinyOption.getAttribute('data-downloaded'))) {
      test.skip();
    }

    // Delete the model externally
    await page.evaluate(async () => {
      // @ts-expect-error - Tauri invoke
      await window.__TAURI__.invoke('delete_model', { modelId: 'tiny' });
    });

    // Close settings
    await page.click('[data-testid="close-settings"]');

    // Try to transcribe
    await startRecording(page);
    await page.waitForTimeout(500);
    await stopRecording(page);

    // Should show helpful error, not crash
    const error = page.locator(`[data-testid="${testIds.errorMessage}"]`);
    await expect(error).toBeVisible();
    await expect(error).toContainText(/model|download/i);

    // Should offer to re-download
    const downloadPrompt = page.locator('[data-testid="download-model-prompt"]');
    await expect(downloadPrompt).toBeVisible();
  });
});
