import { Page } from '@playwright/test';

/**
 * Test helper utilities for EZ Flow E2E tests
 */

// Test data IDs for consistent element selection
export const testIds = {
  // App root
  appRoot: 'app-root',

  // System tray (simulated in test mode)
  trayMenu: 'tray-menu',
  trayIcon: 'tray-icon',

  // Main views
  mainView: 'main-view',
  settingsPanel: 'settings-panel',
  historyView: 'history-view',
  onboardingWizard: 'onboarding-wizard',

  // Recording
  recordButton: 'record-button',
  stopButton: 'stop-button',
  recordingIndicator: 'recording-indicator',
  audioVisualizer: 'audio-visualizer',

  // Transcription
  transcriptionDisplay: 'transcription-display',
  transcriptionResult: 'transcription-result',
  copyButton: 'copy-button',
  processingIndicator: 'processing-indicator',

  // Models
  modelSelector: 'model-selector',
  modelOption: (id: string) => `model-option-${id}`,
  downloadProgress: 'download-progress',
  activeModel: 'active-model',
  downloadModelButton: (id: string) => `download-model-${id}`,
  deleteModelButton: (id: string) => `delete-model-${id}`,
  modelSetupScreen: 'model-setup-screen',
  mainApp: 'main-app',

  // Settings
  settingsButton: 'settings-button',
  hotkeyInput: 'hotkey-input',
  languageSelect: 'language-select',
  autoStartToggle: 'auto-start-toggle',
  gpuToggle: 'gpu-toggle',
  themeSelect: 'theme-select',
  advancedSection: 'advanced-section',
  saveSettingsButton: 'save-settings',
  resetDefaultsButton: 'reset-defaults',

  // History
  historyButton: 'history-button',
  historyList: 'history-list',
  historyItem: (index: number) => `history-item-${index}`,
  historySearch: 'history-search',
  clearHistoryButton: 'clear-history',

  // Onboarding
  onboardingNext: 'onboarding-next',
  onboardingSkip: 'onboarding-skip',
  onboardingBack: 'onboarding-back',
  micPermissionButton: 'mic-permission-button',
  testRecordButton: 'test-record-button',

  // File transcription
  fileDropzone: 'file-dropzone',
  filePickerButton: 'file-picker-button',

  // Status
  statusIndicator: 'status-indicator',
  errorMessage: 'error-message',
};

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector(`[data-testid="${testIds.appRoot}"]`, {
    state: 'visible',
    timeout: 10000,
  });
}

/**
 * Navigate to the settings panel
 */
export async function openSettings(page: Page): Promise<void> {
  await page.click(`[data-testid="${testIds.settingsButton}"]`);
  await page.waitForSelector(`[data-testid="${testIds.settingsPanel}"]`, {
    state: 'visible',
  });
}

/**
 * Navigate to the history view
 */
export async function openHistory(page: Page): Promise<void> {
  await page.click(`[data-testid="${testIds.historyButton}"]`);
  await page.waitForSelector(`[data-testid="${testIds.historyView}"]`, {
    state: 'visible',
  });
}

/**
 * Start recording via UI button
 */
export async function startRecording(page: Page): Promise<void> {
  await page.click(`[data-testid="${testIds.recordButton}"]`);
  await page.waitForSelector(`[data-testid="${testIds.recordingIndicator}"]`, {
    state: 'visible',
  });
}

/**
 * Stop recording via UI button
 */
export async function stopRecording(page: Page): Promise<void> {
  await page.click(`[data-testid="${testIds.stopButton}"]`);
  await page.waitForSelector(`[data-testid="${testIds.recordingIndicator}"]`, {
    state: 'hidden',
  });
}

/**
 * Wait for transcription to complete
 */
export async function waitForTranscription(page: Page, timeout = 30000): Promise<string> {
  // Wait for processing to start
  await page.waitForSelector(`[data-testid="${testIds.processingIndicator}"]`, {
    state: 'visible',
    timeout: 5000,
  }).catch(() => {
    // Processing might be too fast to catch
  });

  // Wait for result
  await page.waitForSelector(`[data-testid="${testIds.transcriptionResult}"]`, {
    state: 'visible',
    timeout,
  });

  return page.locator(`[data-testid="${testIds.transcriptionResult}"]`).textContent() ?? '';
}

/**
 * Select a Whisper model
 */
export async function selectModel(page: Page, modelId: string): Promise<void> {
  await page.click(`[data-testid="${testIds.modelSelector}"]`);
  await page.click(`[data-testid="${testIds.modelOption(modelId)}"]`);
}

/**
 * Check if a model is downloaded
 */
export async function isModelDownloaded(page: Page, modelId: string): Promise<boolean> {
  await page.click(`[data-testid="${testIds.modelSelector}"]`);
  const option = page.locator(`[data-testid="${testIds.modelOption(modelId)}"]`);
  const hasDownloaded = await option.getAttribute('data-downloaded');
  return hasDownloaded === 'true';
}

/**
 * Download a model and wait for completion
 */
export async function downloadModel(page: Page, modelId: string, timeout = 300000): Promise<void> {
  await page.click(`[data-testid="${testIds.modelSelector}"]`);
  await page.click(`[data-testid="${testIds.modelOption(modelId)}"] [data-testid="download-button"]`);

  // Wait for download to complete
  await page.waitForSelector(
    `[data-testid="${testIds.modelOption(modelId)}"][data-downloaded="true"]`,
    { timeout }
  );
}

/**
 * Simulate a file drop for audio transcription
 */
export async function dropAudioFile(page: Page, filePath: string): Promise<void> {
  const dropzone = page.locator(`[data-testid="${testIds.fileDropzone}"]`);

  // Create a file input and trigger the drop
  await dropzone.evaluate((el, path) => {
    const dt = new DataTransfer();
    const file = new File([''], path.split('/').pop() || 'audio.wav', { type: 'audio/wav' });
    dt.items.add(file);

    const dropEvent = new DragEvent('drop', {
      dataTransfer: dt,
      bubbles: true,
    });
    el.dispatchEvent(dropEvent);
  }, filePath);
}

/**
 * Get the current recording state
 */
export async function getRecordingState(page: Page): Promise<'idle' | 'recording' | 'processing'> {
  const indicator = page.locator(`[data-testid="${testIds.recordingIndicator}"]`);
  const processing = page.locator(`[data-testid="${testIds.processingIndicator}"]`);

  if (await processing.isVisible()) {
    return 'processing';
  }
  if (await indicator.isVisible()) {
    return 'recording';
  }
  return 'idle';
}

/**
 * Get transcription history entries
 */
export async function getHistoryEntries(page: Page): Promise<{ text: string; timestamp: string }[]> {
  await openHistory(page);

  const entries: { text: string; timestamp: string }[] = [];
  const items = page.locator(`[data-testid^="history-item-"]`);
  const count = await items.count();

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = await item.locator('[data-testid="history-text"]').textContent() ?? '';
    const timestamp = await item.locator('[data-testid="history-timestamp"]').textContent() ?? '';
    entries.push({ text, timestamp });
  }

  return entries;
}

/**
 * Clear all settings to default
 */
export async function resetSettings(page: Page): Promise<void> {
  await openSettings(page);
  await page.click(`[data-testid="${testIds.resetDefaultsButton}"]`);
  // Confirm reset dialog
  await page.click('[data-testid="confirm-reset"]');
}

/**
 * Mock audio input for testing
 * Uses a test fixture audio file
 */
export async function mockAudioInput(page: Page, audioFile: string): Promise<void> {
  // This would interact with the Tauri backend to mock audio input
  await page.evaluate(async (file) => {
    // @ts-expect-error - Tauri invoke
    await window.__TAURI__.invoke('mock_audio_input', { file });
  }, audioFile);
}
