import { test, expect } from '@playwright/test';
import { waitForAppReady, openSettings } from './helpers';

/**
 * E2E Tests for Keybind Settings UI
 *
 * Tests the keyboard shortcut capture and configuration functionality
 * in the settings panel.
 */

test.describe('Keybind Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('tauri://localhost');
		await waitForAppReady(page);
		await openSettings(page);
	});

	test.describe('Keybind Capture Component', () => {
		test('should display current hotkey value', async ({ page }) => {
			const keybindCapture = page.locator('[data-testid="keybind-capture"]');
			await expect(keybindCapture).toBeVisible();

			// Should show formatted hotkey
			const keybindValue = keybindCapture.locator('.keybind-value');
			await expect(keybindValue).toBeVisible();
			// Default should be Ctrl+Shift+Space (or Cmd+Shift+Space on Mac)
			await expect(keybindValue).toContainText(/Ctrl|Cmd|Space/);
		});

		test('should show "Click to change" hint', async ({ page }) => {
			const keybindCapture = page.locator('[data-testid="keybind-capture"]');
			const editHint = keybindCapture.locator('.edit-hint');
			await expect(editHint).toBeVisible();
			await expect(editHint).toHaveText('Click to change');
		});

		test('should enter capture mode on click', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Should show capturing state
			await expect(keybindButton).toHaveClass(/capturing/);

			// Should show "Press Esc to cancel" hint
			const captureHint = keybindButton.locator('.capture-hint');
			await expect(captureHint).toBeVisible();
			await expect(captureHint).toHaveText('Press Esc to cancel');
		});

		test('should show "Press keys..." when capturing', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			const keybindValue = keybindButton.locator('.keybind-value');
			await expect(keybindValue).toHaveText('Press keys...');
		});

		test('should cancel capture on Escape', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Should be in capturing state
			await expect(keybindButton).toHaveClass(/capturing/);

			// Press Escape
			await keybindButton.press('Escape');

			// Should exit capturing state
			await expect(keybindButton).not.toHaveClass(/capturing/);
		});

		test('should cancel capture on blur', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Should be in capturing state
			await expect(keybindButton).toHaveClass(/capturing/);

			// Click elsewhere to blur
			await page.click('body');

			// Should exit capturing state
			await expect(keybindButton).not.toHaveClass(/capturing/);
		});

		test('should capture modifier keys', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Press Ctrl
			await page.keyboard.down('Control');

			const keybindValue = keybindButton.locator('.keybind-value');
			// Should show Ctrl (formatted)
			await expect(keybindValue).toContainText(/Ctrl|⌃/);

			await page.keyboard.up('Control');
		});

		test('should capture key combination Ctrl+Shift+A', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Press Ctrl+Shift+A
			await page.keyboard.down('Control');
			await page.keyboard.down('Shift');
			await page.keyboard.press('KeyA');

			// Should have captured and exited capture mode
			await expect(keybindButton).not.toHaveClass(/capturing/);

			// Should show the new hotkey
			const keybindValue = keybindButton.locator('.keybind-value');
			await expect(keybindValue).toContainText(/Ctrl|⌃/);
			await expect(keybindValue).toContainText(/Shift|⇧/);
			await expect(keybindValue).toContainText('A');
		});

		test('should capture function key F9', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Press F9 (function keys don't need modifiers)
			await page.keyboard.press('F9');

			// Should have captured and exited capture mode
			await expect(keybindButton).not.toHaveClass(/capturing/);

			// Should show F9
			const keybindValue = keybindButton.locator('.keybind-value');
			await expect(keybindValue).toContainText('F9');
		});

		test('should show error for key without modifier', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();

			// Press just 'A' without modifier
			await page.keyboard.press('KeyA');

			// Should show error
			const errorElement = page.locator('[data-testid="keybind-error"]');
			await expect(errorElement).toBeVisible();
			await expect(errorElement).toContainText(/modifier/i);
		});
	});

	test.describe('Hotkey Persistence', () => {
		test('should allow re-selecting the same hotkey', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			const keybindValue = keybindButton.locator('.keybind-value');

			// Get the current hotkey value
			const originalHotkey = await keybindValue.textContent();

			// Click to enter capture mode
			await keybindButton.click();
			await expect(keybindButton).toHaveClass(/capturing/);

			// Capture the same hotkey (default is Ctrl+Shift+Space)
			await page.keyboard.down('Control');
			await page.keyboard.down('Shift');
			await page.keyboard.press('Space');

			// Should NOT show error - re-selecting same hotkey is valid
			const errorElement = page.locator('[data-testid="keybind-error"]');
			await expect(errorElement).not.toBeVisible();

			// Should exit capture mode
			await expect(keybindButton).not.toHaveClass(/capturing/);

			// Should still show the same hotkey
			await expect(keybindValue).toHaveText(originalHotkey!);
		});

		test('should save new hotkey to settings', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');

			// Capture a new hotkey
			await keybindButton.click();
			await page.keyboard.down('Control');
			await page.keyboard.down('Alt');
			await page.keyboard.press('KeyR');

			// Wait for save (settings update is async)
			await page.waitForTimeout(500);

			// Reload page
			await page.reload();
			await waitForAppReady(page);
			await openSettings(page);

			// Should show the saved hotkey
			const keybindValue = page.locator('[data-testid="keybind-button"] .keybind-value');
			await expect(keybindValue).toContainText(/Ctrl|⌃/);
			await expect(keybindValue).toContainText(/Alt|⌥/);
			await expect(keybindValue).toContainText('R');
		});

		test('should persist hotkey change across navigation', async ({ page }) => {
			const keybindButton = page.locator('[data-testid="keybind-button"]');

			// Capture a new hotkey
			await keybindButton.click();
			await page.keyboard.down('Control');
			await page.keyboard.down('Alt');
			await page.keyboard.press('KeyP');

			// Should show the new hotkey
			const keybindValue = keybindButton.locator('.keybind-value');
			await expect(keybindValue).toContainText(/Ctrl|⌃/);
			await expect(keybindValue).toContainText(/Alt|⌥/);
			await expect(keybindValue).toContainText('P');

			// Wait for save
			await page.waitForTimeout(500);

			// Navigate to Home and back
			await page.click('[data-testid="nav-main"]');
			await page.waitForTimeout(300);
			await openSettings(page);

			// Should still show the new hotkey
			const keybindValueAfter = page.locator('[data-testid="keybind-button"] .keybind-value');
			await expect(keybindValueAfter).toContainText('P');
		});

		test('should reset hotkey when resetting settings', async ({ page }) => {
			// First change the hotkey
			const keybindButton = page.locator('[data-testid="keybind-button"]');
			await keybindButton.click();
			await page.keyboard.down('Control');
			await page.keyboard.down('Alt');
			await page.keyboard.press('KeyR');

			// Expand advanced section
			await page.click('[data-testid="advanced-toggle"]');

			// Click reset button
			await page.click('[data-testid="reset-button"]');

			// Confirm reset
			const confirmButton = page.locator('.danger-button').filter({ hasText: 'Yes, Reset' });
			await confirmButton.click();

			// Wait for reset
			await page.waitForTimeout(500);

			// Should show default hotkey again
			const keybindValue = page.locator('[data-testid="keybind-button"] .keybind-value');
			await expect(keybindValue).toContainText(/Space/);
		});
	});

	test.describe('Recording Mode Integration', () => {
		test('should have recording mode options next to hotkey', async ({ page }) => {
			const recordingModeRadio = page.locator('[data-testid="recording-mode-radio"]');
			await expect(recordingModeRadio).toBeVisible();

			// Should have push-to-talk option
			const pushToTalk = recordingModeRadio.locator('text=Push-to-talk');
			await expect(pushToTalk).toBeVisible();

			// Should have toggle option
			const toggle = recordingModeRadio.locator('text=Toggle');
			await expect(toggle).toBeVisible();
		});

		test('should allow selecting push-to-talk mode', async ({ page }) => {
			const pushToTalkRadio = page.locator('input[name="recording_mode"][value="push_to_talk"]');
			await pushToTalkRadio.check();
			await expect(pushToTalkRadio).toBeChecked();
		});

		test('should allow selecting toggle mode', async ({ page }) => {
			const toggleRadio = page.locator('input[name="recording_mode"][value="toggle"]');
			await toggleRadio.check();
			await expect(toggleRadio).toBeChecked();
		});
	});
});

/**
 * Tests for global hotkey functionality
 * Note: These tests verify the hotkey registration status,
 * actual global hotkey triggering requires native interaction
 */
test.describe('Global Hotkey Registration', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('tauri://localhost');
		await waitForAppReady(page);
	});

	test('should show hotkey status in HotkeyDisplay component', async ({ page }) => {
		// Look for the HotkeyDisplay component if present
		const hotkeyDisplay = page.locator('[data-testid="hotkey-display"]');

		// If HotkeyDisplay is visible, check its status
		if (await hotkeyDisplay.isVisible()) {
			// Should show the hotkey value
			const hotkeyValue = hotkeyDisplay.locator('.hotkey-value');
			await expect(hotkeyValue).toBeVisible();
			await expect(hotkeyValue).toContainText(/Ctrl|Cmd|Space|F\d+/);
		}
	});

	test('should check hotkey registration status via backend', async ({ page }) => {
		const isRegistered = await page.evaluate(async () => {
			// @ts-expect-error - Tauri invoke
			return await window.__TAURI__.invoke('is_hotkey_registered');
		});

		// Hotkey should be registered on startup
		expect(typeof isRegistered).toBe('boolean');
	});

	test('should get current hotkey from backend', async ({ page }) => {
		const currentHotkey = await page.evaluate(async () => {
			// @ts-expect-error - Tauri invoke
			return await window.__TAURI__.invoke('get_current_hotkey');
		});

		// Should return a hotkey string or null
		expect(currentHotkey === null || typeof currentHotkey === 'string').toBe(true);
		if (currentHotkey) {
			expect(currentHotkey).toMatch(/\+|F\d+/);
		}
	});

	test('should update hotkey via settings and re-register', async ({ page }) => {
		// Open settings
		await openSettings(page);

		// Change hotkey to Ctrl+Alt+R
		const keybindButton = page.locator('[data-testid="keybind-button"]');
		await keybindButton.click();
		await page.keyboard.down('Control');
		await page.keyboard.down('Alt');
		await page.keyboard.press('KeyR');

		// Wait for backend to register
		await page.waitForTimeout(500);

		// Verify the hotkey was registered on backend
		const currentHotkey = await page.evaluate(async () => {
			// @ts-expect-error - Tauri invoke
			return await window.__TAURI__.invoke('get_current_hotkey');
		});

		expect(currentHotkey).toBe('Ctrl+Alt+R');
	});
});
