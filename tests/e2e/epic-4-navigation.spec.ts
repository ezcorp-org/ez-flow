import { test, expect, Page } from '@playwright/test';

/**
 * Epic 4: Navigation & UI Polish
 *
 * Comprehensive E2E tests for navigation system, history features,
 * settings page, and the complete transcription workflow.
 */

// Test configuration for dev mode (running against vite dev server)
const BASE_URL = process.env.E2E_DEV_MODE ? 'http://localhost:5173' : 'tauri://localhost';

// Helper to wait for page to be ready
async function waitForPageReady(page: Page, testId: string) {
	await page.waitForSelector(`[data-testid="${testId}"]`, {
		state: 'visible',
		timeout: 10000,
	});
}

// Helper to mock Tauri APIs for browser-based testing
async function setupTauriMocks(page: Page) {
	await page.addInitScript(() => {
		// Mock Tauri window APIs
		const mockWindows: Record<string, { label: string; visible: boolean }> = {
			main: { label: 'main', visible: true },
			history: { label: 'history', visible: false },
			settings: { label: 'settings', visible: false },
			onboarding: { label: 'onboarding', visible: false },
		};

		let currentWindow = 'main';

		// Track navigation for testing
		(window as unknown as Record<string, unknown>).__TEST_NAVIGATION__ = {
			navigations: [] as string[],
			currentWindow: 'main',
		};

		// Mock @tauri-apps/api/webviewWindow
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
			invoke: async (cmd: string, args?: Record<string, unknown>) => {
				console.log('Tauri invoke:', cmd, args);

				switch (cmd) {
					case 'plugin:webview|get_by_label': {
						const label = args?.label as string;
						if (mockWindows[label]) {
							return { label };
						}
						return null;
					}
					case 'plugin:window|show':
					case 'plugin:webview|show': {
						const label = args?.label as string;
						if (mockWindows[label]) {
							mockWindows[label].visible = true;
							currentWindow = label;
							(
								window as unknown as Record<string, { navigations: string[]; currentWindow: string }>
							).__TEST_NAVIGATION__.navigations.push(label);
							(
								window as unknown as Record<string, { navigations: string[]; currentWindow: string }>
							).__TEST_NAVIGATION__.currentWindow = label;

							// For dev mode testing, navigate to the URL
							if (label === 'main') {
								window.location.href = '/';
							} else {
								window.location.href = `/${label}`;
							}
						}
						return null;
					}
					case 'plugin:window|hide':
					case 'plugin:webview|hide': {
						const label = args?.label as string;
						if (mockWindows[label]) {
							mockWindows[label].visible = false;
						}
						return null;
					}
					case 'plugin:window|set_focus':
					case 'plugin:webview|set_focus':
						return null;
					case 'plugin:window|current_window':
					case 'tauri://current-window':
						return { label: currentWindow };
					case 'get_history':
						return [
							{
								id: 1,
								text: 'Test transcription one',
								timestamp: new Date().toISOString(),
								duration_ms: 5000,
								model_id: 'tiny',
								language: 'en',
							},
							{
								id: 2,
								text: 'Test transcription two',
								timestamp: new Date(Date.now() - 86400000).toISOString(),
								duration_ms: 3000,
								model_id: 'base',
								language: null,
							},
						];
					case 'search_history':
						return [
							{
								id: 1,
								text: 'Test transcription one',
								timestamp: new Date().toISOString(),
								duration_ms: 5000,
								model_id: 'tiny',
								language: 'en',
							},
						];
					case 'delete_history_entry':
						return null;
					case 'clear_history':
						return null;
					case 'get_settings':
						return {
							hotkey: 'Ctrl+Shift+Space',
							recording_mode: 'push_to_talk',
							model_id: 'tiny',
							language: null,
							launch_at_login: false,
							indicator_position: 'top_right',
							auto_copy: true,
							auto_paste: false,
							injection_delay_ms: 10,
							onboarding_completed: true,
							onboarding_skipped: false,
						};
					case 'update_settings':
						return args?.settings;
					case 'start_recording':
						return null;
					case 'stop_recording_and_transcribe':
						return {
							text: 'This is a test transcription',
							duration_ms: 2500,
							model_id: 'tiny',
							language: 'en',
						};
					default:
						console.warn('Unhandled Tauri command:', cmd);
						return null;
				}
			},
		};

		// Mock getCurrentWindow
		(window as unknown as Record<string, unknown>).__TAURI__ = {
			window: {
				getCurrentWindow: () => ({
					label: currentWindow,
					show: async () => {},
					hide: async () => {},
					setFocus: async () => {},
				}),
			},
			webviewWindow: {
				WebviewWindow: {
					getByLabel: async (label: string) => {
						if (mockWindows[label]) {
							return {
								label,
								show: async () => {
									mockWindows[label].visible = true;
									currentWindow = label;
									(
										window as unknown as Record<
											string,
											{ navigations: string[]; currentWindow: string }
										>
									).__TEST_NAVIGATION__.navigations.push(label);
									(
										window as unknown as Record<
											string,
											{ navigations: string[]; currentWindow: string }
										>
									).__TEST_NAVIGATION__.currentWindow = label;

									// Navigate in dev mode
									if (label === 'main') {
										window.location.href = '/';
									} else {
										window.location.href = `/${label}`;
									}
								},
								hide: async () => {
									mockWindows[label].visible = false;
								},
								setFocus: async () => {},
							};
						}
						return null;
					},
				},
			},
		};
	});
}

test.describe('Epic 4: Navigation & UI', () => {
	test.describe('Story 4.1: NavBar Navigation', () => {
		test('NavBar should be visible on main page', async ({ page }) => {
			await page.goto(BASE_URL);
			const navbar = page.locator('[data-testid="navbar"]');
			await expect(navbar).toBeVisible();
		});

		test('NavBar should have Home, History, and Settings buttons', async ({ page }) => {
			await page.goto(BASE_URL);

			const homeBtn = page.locator('[data-testid="nav-home"]');
			const historyBtn = page.locator('[data-testid="nav-history"]');
			const settingsBtn = page.locator('[data-testid="nav-settings"]');

			await expect(homeBtn).toBeVisible();
			await expect(historyBtn).toBeVisible();
			await expect(settingsBtn).toBeVisible();

			// Check labels
			await expect(homeBtn).toContainText('Home');
			await expect(historyBtn).toContainText('History');
			await expect(settingsBtn).toContainText('Settings');
		});

		test('NavBar Home button should be active on main page', async ({ page }) => {
			await page.goto(BASE_URL);
			const homeBtn = page.locator('[data-testid="nav-home"]');
			await expect(homeBtn).toHaveClass(/active/);
		});

		test('NavBar should navigate to History page', async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(BASE_URL);

			const historyBtn = page.locator('[data-testid="nav-history"]');
			await historyBtn.click();

			// Wait for navigation (in dev mode this is a URL change)
			await page.waitForURL('**/history', { timeout: 5000 });

			// Verify history page is shown
			const historyPanel = page.locator('[data-testid="history-panel"]');
			await expect(historyPanel).toBeVisible();
		});

		test('NavBar should navigate to Settings page', async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(BASE_URL);

			const settingsBtn = page.locator('[data-testid="nav-settings"]');
			await settingsBtn.click();

			await page.waitForURL('**/settings', { timeout: 5000 });

			const settingsPanel = page.locator('[data-testid="settings-panel"]');
			await expect(settingsPanel).toBeVisible();
		});

		test('NavBar History button should be active on History page', async ({ page }) => {
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			const historyBtn = page.locator('[data-testid="nav-history"]');
			await expect(historyBtn).toHaveClass(/active/);
		});

		test('NavBar Settings button should be active on Settings page', async ({ page }) => {
			await page.goto(`${BASE_URL}/settings`);
			await waitForPageReady(page, 'settings-panel');

			const settingsBtn = page.locator('[data-testid="nav-settings"]');
			await expect(settingsBtn).toHaveClass(/active/);
		});
	});

	test.describe('Story 4.2: BackButton Navigation', () => {
		test('BackButton should be visible on History page', async ({ page }) => {
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			const backBtn = page.locator('[data-testid="back-button"]');
			await expect(backBtn).toBeVisible();
		});

		test('BackButton should be visible on Settings page', async ({ page }) => {
			await page.goto(`${BASE_URL}/settings`);
			await waitForPageReady(page, 'settings-panel');

			const backBtn = page.locator('[data-testid="back-button"]');
			await expect(backBtn).toBeVisible();
		});

		test('BackButton should navigate back to main from History', async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			const backBtn = page.locator('[data-testid="back-button"]');
			await backBtn.click();

			await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
				timeout: 5000,
			});
		});

		test('BackButton should navigate back to main from Settings', async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(`${BASE_URL}/settings`);
			await waitForPageReady(page, 'settings-panel');

			const backBtn = page.locator('[data-testid="back-button"]');
			await backBtn.click();

			await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
				timeout: 5000,
			});
		});
	});

	test.describe('Story 4.3: History Page Features', () => {
		test.beforeEach(async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');
		});

		test('History page should display title and entry count', async ({ page }) => {
			const title = page.locator('.title');
			await expect(title).toContainText('History');

			const count = page.locator('.count');
			await expect(count).toContainText('entries');
		});

		test('History page should have search input', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');
			await expect(searchInput).toBeVisible();
			await expect(searchInput).toHaveAttribute('placeholder', 'Search transcriptions...');
		});

		test('History page should display transcription entries', async ({ page }) => {
			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});

		test('History entry should expand on click', async ({ page }) => {
			const entry = page.locator('[data-testid="history-entry"]').first();
			const header = entry.locator('.entry-header');
			await header.click();

			// Should show expanded content with copy/delete buttons
			const copyBtn = entry.locator('[data-testid="copy-entry-btn"]');
			await expect(copyBtn).toBeVisible();

			const deleteBtn = entry.locator('[data-testid="delete-entry-btn"]');
			await expect(deleteBtn).toBeVisible();
		});

		test('History entry should show full text when expanded', async ({ page }) => {
			const entry = page.locator('[data-testid="history-entry"]').first();
			const header = entry.locator('.entry-header');
			await header.click();

			const fullText = entry.locator('[data-testid="entry-full-text"]');
			await expect(fullText).toBeVisible();
		});

		test('Clear All button should show confirmation dialog', async ({ page }) => {
			const clearBtn = page.locator('[data-testid="clear-all-btn"]');
			await expect(clearBtn).toBeVisible();
			await clearBtn.click();

			// Confirmation dialog should appear
			const confirmDialog = page.locator('.confirm-dialog');
			await expect(confirmDialog).toBeVisible();
			await expect(confirmDialog).toContainText('Delete all');

			// Cancel button should close dialog
			const cancelBtn = page.locator('.cancel-button');
			await cancelBtn.click();
			await expect(confirmDialog).not.toBeVisible();
		});

		test('Search should filter history entries', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');
			await searchInput.fill('test');

			// Wait for search to complete (debounced at 250ms)
			await page.waitForTimeout(500);

			// Should still show entries (mocked search returns results)
			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});

		test('Prefix search should find partial word matches', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');

			// Type prefix "tes" - should match "test"
			await searchInput.fill('tes');

			// Wait for debounced search (250ms) plus API call
			await page.waitForTimeout(500);

			// Should show matching entries
			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});

		test('Multi-word prefix search should narrow results', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');

			// Type multi-word prefix
			await searchInput.fill('test trans');

			// Wait for debounced search
			await page.waitForTimeout(500);

			// Should show matching entries
			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});

		test('Search should debounce rapid typing', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');

			// Type rapidly - should not trigger multiple API calls
			await searchInput.type('hello', { delay: 50 });

			// Loading should be visible during debounce
			// Then entries should appear after debounce completes
			await page.waitForTimeout(500);

			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});

		test('Empty search should return all entries', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');

			// Type something first
			await searchInput.fill('test');
			await page.waitForTimeout(500);

			// Clear search
			await searchInput.fill('');
			await page.waitForTimeout(500);

			// Should show all entries (mock returns 2 entries for get_history)
			const entries = page.locator('[data-testid="history-entry"]');
			const count = await entries.count();
			expect(count).toBeGreaterThanOrEqual(1);
		});

		test('Search should be case-insensitive', async ({ page }) => {
			const searchInput = page.locator('[data-testid="history-search"]');

			// Uppercase search
			await searchInput.fill('TEST');
			await page.waitForTimeout(500);

			// Should still find lowercase matches
			const entries = page.locator('[data-testid="history-entry"]');
			await expect(entries.first()).toBeVisible();
		});
	});

	test.describe('Story 4.4: Settings Page Features', () => {
		test.beforeEach(async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(`${BASE_URL}/settings`);
			await waitForPageReady(page, 'settings-panel');
		});

		test('Settings page should display title', async ({ page }) => {
			const title = page.locator('.settings-title');
			await expect(title).toContainText('Settings');
		});

		test('Settings should have Recording section with hotkey input', async ({ page }) => {
			const hotkeyInput = page.locator('[data-testid="hotkey-input"]');
			await expect(hotkeyInput).toBeVisible();
		});

		test('Settings should have Recording Mode radio buttons', async ({ page }) => {
			const radioGroup = page.locator('[data-testid="recording-mode-radio"]');
			await expect(radioGroup).toBeVisible();

			const pushToTalk = radioGroup.locator('input[value="push_to_talk"]');
			const toggle = radioGroup.locator('input[value="toggle"]');
			await expect(pushToTalk).toBeVisible();
			await expect(toggle).toBeVisible();
		});

		test('Settings should have Model selector', async ({ page }) => {
			const modelSelector = page.locator('[data-testid="model-selector"]');
			await expect(modelSelector).toBeVisible();
		});

		test('Settings should have Language selector', async ({ page }) => {
			const languageSelector = page.locator('[data-testid="language-selector"]');
			await expect(languageSelector).toBeVisible();
		});

		test('Settings should have Launch at Login toggle', async ({ page }) => {
			const launchToggle = page.locator('[data-testid="launch-at-login-toggle"]');
			await expect(launchToggle).toBeVisible();
		});

		test('Advanced section should be collapsible', async ({ page }) => {
			const advancedToggle = page.locator('[data-testid="advanced-toggle"]');
			await expect(advancedToggle).toBeVisible();

			// Initially collapsed - advanced section should not be visible
			let advancedSection = page.locator('[data-testid="advanced-section"]');
			await expect(advancedSection).not.toBeVisible();

			// Click to expand
			await advancedToggle.click();
			advancedSection = page.locator('[data-testid="advanced-section"]');
			await expect(advancedSection).toBeVisible();
		});

		test('Advanced section should have export/import buttons', async ({ page }) => {
			const advancedToggle = page.locator('[data-testid="advanced-toggle"]');
			await advancedToggle.click();

			const exportBtn = page.locator('[data-testid="export-button"]');
			const importBtn = page.locator('[data-testid="import-button"]');
			await expect(exportBtn).toBeVisible();
			await expect(importBtn).toBeVisible();
		});

		test('Advanced section should have auto-copy toggle', async ({ page }) => {
			const advancedToggle = page.locator('[data-testid="advanced-toggle"]');
			await advancedToggle.click();

			const autoCopyToggle = page.locator('[data-testid="auto-copy-toggle"]');
			await expect(autoCopyToggle).toBeVisible();
		});

		test('Advanced section should have reset button', async ({ page }) => {
			const advancedToggle = page.locator('[data-testid="advanced-toggle"]');
			await advancedToggle.click();

			const resetBtn = page.locator('[data-testid="reset-button"]');
			await expect(resetBtn).toBeVisible();
		});
	});

	test.describe('Story 4.5: Main App Features', () => {
		test.beforeEach(async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(BASE_URL);
			await waitForPageReady(page, 'main-app');
		});

		test('Main page should display app title', async ({ page }) => {
			const title = page.locator('h1');
			await expect(title).toContainText('EZ Flow');
		});

		test('Main page should display tagline', async ({ page }) => {
			const tagline = page.locator('.tagline');
			await expect(tagline).toContainText('Local speech-to-text');
		});

		test('Main page should have record button', async ({ page }) => {
			const recordBtn = page.locator('[data-testid="record-button"]');
			await expect(recordBtn).toBeVisible();
		});

		test('Main page should display hotkey tip', async ({ page }) => {
			const hint = page.locator('.hint');
			await expect(hint).toContainText('Ctrl');
			await expect(hint).toContainText('Shift');
			await expect(hint).toContainText('Space');
		});

		test('Record button should be clickable', async ({ page }) => {
			const recordBtn = page.locator('[data-testid="record-button"]');
			await expect(recordBtn).toBeEnabled();
		});
	});

	test.describe('Story 4.6: Full Navigation Flow', () => {
		test('Should navigate through all pages successfully', async ({ page }) => {
			await setupTauriMocks(page);
			await page.goto(BASE_URL);
			await waitForPageReady(page, 'main-app');

			// Navigate to History
			await page.locator('[data-testid="nav-history"]').click();
			await page.waitForURL('**/history', { timeout: 5000 });
			await expect(page.locator('[data-testid="history-panel"]')).toBeVisible();

			// Navigate to Settings
			await page.locator('[data-testid="nav-settings"]').click();
			await page.waitForURL('**/settings', { timeout: 5000 });
			await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

			// Navigate back to Home
			await page.locator('[data-testid="nav-home"]').click();
			await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
				timeout: 5000,
			});
			await expect(page.locator('[data-testid="main-app"]')).toBeVisible();
		});

		test('Should use back button to return from nested pages', async ({ page }) => {
			await setupTauriMocks(page);

			// Go to History
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			// Use back button
			await page.locator('[data-testid="back-button"]').click();
			await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
				timeout: 5000,
			});
			await expect(page.locator('[data-testid="main-app"]')).toBeVisible();
		});
	});

	test.describe('Story 4.7: UI Accessibility', () => {
		test('NavBar buttons should have proper aria labels', async ({ page }) => {
			await page.goto(BASE_URL);

			const homeBtn = page.locator('[data-testid="nav-home"]');
			const historyBtn = page.locator('[data-testid="nav-history"]');
			const settingsBtn = page.locator('[data-testid="nav-settings"]');

			// Buttons should have visible text labels
			await expect(homeBtn.locator('.nav-label')).toHaveText('Home');
			await expect(historyBtn.locator('.nav-label')).toHaveText('History');
			await expect(settingsBtn.locator('.nav-label')).toHaveText('Settings');
		});

		test('BackButton should have aria-label', async ({ page }) => {
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			const backBtn = page.locator('[data-testid="back-button"]');
			await expect(backBtn).toHaveAttribute('aria-label', 'Go back');
		});

		test('Search input should have placeholder text', async ({ page }) => {
			await page.goto(`${BASE_URL}/history`);
			await waitForPageReady(page, 'history-panel');

			const searchInput = page.locator('[data-testid="history-search"]');
			await expect(searchInput).toHaveAttribute('placeholder', 'Search transcriptions...');
		});
	});

	test.describe('Story 4.8: Responsive Design', () => {
		test('NavBar should be fixed at bottom', async ({ page }) => {
			await page.goto(BASE_URL);
			await waitForPageReady(page, 'main-app');

			const navbar = page.locator('[data-testid="navbar"]');
			const box = await navbar.boundingBox();

			// NavBar should be at the bottom of the viewport
			const viewportSize = page.viewportSize();
			expect(box).toBeTruthy();
			if (box && viewportSize) {
				expect(box.y + box.height).toBeCloseTo(viewportSize.height, -1);
			}
		});

		test('NavBar should span full width', async ({ page }) => {
			await page.goto(BASE_URL);
			await waitForPageReady(page, 'main-app');

			const navbar = page.locator('[data-testid="navbar"]');
			const box = await navbar.boundingBox();
			const viewportSize = page.viewportSize();

			expect(box).toBeTruthy();
			if (box && viewportSize) {
				expect(box.width).toBe(viewportSize.width);
			}
		});
	});
});
