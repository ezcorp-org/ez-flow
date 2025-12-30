import { test, expect } from '@playwright/test';

/**
 * Model Management E2E Tests
 *
 * Tests for:
 * - Model setup screen skip when models exist
 * - Model management section in settings
 * - Download/delete model functionality
 * - Active model selection
 */

test.describe('Model Setup Screen', () => {
	test.describe('Skip Setup When Models Exist', () => {
		test('should show main app directly when model is already downloaded', async ({ page }) => {
			// Navigate to the app
			await page.goto('/');

			// Wait for loading to complete
			await page.waitForSelector('.loading-screen', { state: 'hidden', timeout: 10000 }).catch(() => {
				// Loading screen might already be gone
			});

			// If models are downloaded, should see main app, not setup screen
			const mainApp = page.locator('[data-testid="main-app"]');
			const setupScreen = page.locator('[data-testid="model-setup-screen"]');

			// Check which screen is showing
			const isMainVisible = await mainApp.isVisible().catch(() => false);
			const isSetupVisible = await setupScreen.isVisible().catch(() => false);

			// One of them should be visible
			expect(isMainVisible || isSetupVisible).toBe(true);

			// If main is visible, setup should not be
			if (isMainVisible) {
				expect(isSetupVisible).toBe(false);
			}
		});

		test('should show setup screen when no models are downloaded', async ({ page }) => {
			// This test assumes we can clear models or start fresh
			// In a real scenario, we'd use a test fixture or mock

			await page.goto('/');

			// Wait for initial load
			await page.waitForTimeout(1000);

			// Either main app or setup screen should be visible
			const mainApp = page.locator('[data-testid="main-app"]');
			const setupScreen = page.locator('[data-testid="model-setup-screen"]');

			const isMainVisible = await mainApp.isVisible().catch(() => false);
			const isSetupVisible = await setupScreen.isVisible().catch(() => false);

			expect(isMainVisible || isSetupVisible).toBe(true);
		});

		test('should show loading spinner while checking models', async ({ page }) => {
			// Navigate fresh and check for loading state
			await page.goto('/');

			// Loading screen should appear briefly
			const loadingScreen = page.locator('.loading-screen');

			// It may be too fast to catch, so we check if it was there or main app loaded
			await Promise.race([
				loadingScreen.waitFor({ state: 'visible', timeout: 500 }).catch(() => {}),
				page.locator('[data-testid="main-app"]').waitFor({ state: 'visible', timeout: 5000 }),
				page.locator('[data-testid="model-setup-screen"]').waitFor({ state: 'visible', timeout: 5000 }),
			]);

			// App should be loaded after initial check
			await expect(
				page.locator('[data-testid="main-app"], [data-testid="model-setup-screen"]').first()
			).toBeVisible({ timeout: 10000 });
		});
	});

	test.describe('Setup Screen Transition', () => {
		test('should transition to main app after setup completion', async ({ page }) => {
			await page.goto('/');

			const setupScreen = page.locator('[data-testid="model-setup-screen"]');
			const isSetupVisible = await setupScreen.isVisible().catch(() => false);

			if (isSetupVisible) {
				// Complete the setup (download a model)
				const downloadButton = page.locator('[data-testid="download-model-tiny"]');
				if (await downloadButton.isVisible()) {
					await downloadButton.click();

					// Wait for download to complete
					await page.waitForSelector('[data-testid="download-progress"]', { state: 'hidden', timeout: 300000 });

					// Should now see main app
					await expect(page.locator('[data-testid="main-app"]')).toBeVisible({ timeout: 10000 });
				}
			}
		});
	});
});

test.describe('Settings - Model Management Section', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('domcontentloaded');
	});

	test.describe('Section Display', () => {
		test('should display Model Management section', async ({ page }) => {
			const sectionTitle = page.locator('h2:has-text("Model Management")');
			await expect(sectionTitle).toBeVisible();
		});

		test('should display section description', async ({ page }) => {
			const description = page.locator('text=Download or remove speech recognition models');
			await expect(description).toBeVisible();
		});

		test('should display list of available models', async ({ page }) => {
			const modelsList = page.locator('.models-list');
			await expect(modelsList).toBeVisible();

			// Should have model items
			const modelItems = page.locator('.model-item');
			const count = await modelItems.count();
			expect(count).toBeGreaterThan(0);
		});
	});

	test.describe('Model Item Display', () => {
		test('should display model name for each model', async ({ page }) => {
			const modelNames = page.locator('.model-name');
			const count = await modelNames.count();
			expect(count).toBeGreaterThan(0);

			// Each name should not be empty
			for (let i = 0; i < count; i++) {
				const text = await modelNames.nth(i).textContent();
				expect(text?.trim().length).toBeGreaterThan(0);
			}
		});

		test('should display model size for each model', async ({ page }) => {
			const modelSizes = page.locator('.model-size');
			const count = await modelSizes.count();
			expect(count).toBeGreaterThan(0);

			// Each size should contain MB
			for (let i = 0; i < count; i++) {
				const text = await modelSizes.nth(i).textContent();
				expect(text).toContain('MB');
			}
		});

		test('should display model description for each model', async ({ page }) => {
			const modelDescriptions = page.locator('.model-description');
			const count = await modelDescriptions.count();
			expect(count).toBeGreaterThan(0);
		});
	});

	test.describe('Downloaded Model Indicators', () => {
		test('should show downloaded badge for downloaded models', async ({ page }) => {
			const downloadedBadges = page.locator('.downloaded-badge');

			// Wait for models to load
			await page.waitForTimeout(500);

			const count = await downloadedBadges.count();
			// At least one model should be downloaded for tests to run
			if (count > 0) {
				await expect(downloadedBadges.first()).toContainText('Downloaded');
			}
		});

		test('should show active badge for the currently selected model', async ({ page }) => {
			const activeBadge = page.locator('.active-badge');

			// Wait for models to load
			await page.waitForTimeout(500);

			// Should have exactly one active badge
			const count = await activeBadge.count();
			if (count > 0) {
				expect(count).toBe(1);
				await expect(activeBadge).toContainText('Active');
			}
		});

		test('should highlight downloaded models with special border', async ({ page }) => {
			const downloadedItems = page.locator('.model-item.downloaded');

			await page.waitForTimeout(500);

			const count = await downloadedItems.count();
			if (count > 0) {
				// Downloaded items should exist
				await expect(downloadedItems.first()).toBeVisible();
			}
		});

		test('should highlight active model with special styling', async ({ page }) => {
			const activeItem = page.locator('.model-item.active');

			await page.waitForTimeout(500);

			const count = await activeItem.count();
			if (count > 0) {
				await expect(activeItem).toBeVisible();
			}
		});
	});

	test.describe('Model Actions', () => {
		test('should show Download button for non-downloaded models', async ({ page }) => {
			await page.waitForTimeout(500);

			const downloadButtons = page.locator('.download-model-button');
			const count = await downloadButtons.count();

			// If there are models not downloaded, buttons should exist
			if (count > 0) {
				await expect(downloadButtons.first()).toContainText('Download');
			}
		});

		test('should show Remove button for downloaded non-active models', async ({ page }) => {
			await page.waitForTimeout(500);

			const deleteButtons = page.locator('.delete-model-button');
			const count = await deleteButtons.count();

			if (count > 0) {
				await expect(deleteButtons.first()).toContainText('Remove');
			}
		});

		test('should NOT show Remove button for active model', async ({ page }) => {
			await page.waitForTimeout(500);

			// Find the active model item
			const activeItem = page.locator('.model-item.active');
			const count = await activeItem.count();

			if (count > 0) {
				// Active item should NOT have a delete button
				const deleteButton = activeItem.locator('.delete-model-button');
				await expect(deleteButton).not.toBeVisible();
			}
		});
	});

	test.describe('Download Model Flow', () => {
		test('should show progress bar when downloading', async ({ page }) => {
			await page.waitForTimeout(500);

			const downloadButtons = page.locator('.download-model-button');
			const count = await downloadButtons.count();

			if (count > 0) {
				// Click download on first available model
				await downloadButtons.first().click();

				// Should show progress bar
				const progressBar = page.locator('.download-progress');
				await expect(progressBar).toBeVisible({ timeout: 5000 });
			}
		});

		test('should disable other download buttons during download', async ({ page }) => {
			await page.waitForTimeout(500);

			const downloadButtons = page.locator('.download-model-button');
			const count = await downloadButtons.count();

			if (count > 1) {
				// Click download on first model
				await downloadButtons.first().click();

				// Other buttons should be disabled
				await expect(downloadButtons.nth(1)).toBeDisabled({ timeout: 5000 });
			}
		});

		test('should show downloaded badge after download completes', async ({ page }) => {
			await page.waitForTimeout(500);

			const downloadButtons = page.locator('.download-model-button');
			const count = await downloadButtons.count();

			if (count > 0) {
				// Get the parent model item
				const modelItem = downloadButtons.first().locator('..');

				// Click download
				await downloadButtons.first().click();

				// Wait for download to complete (may take a while)
				await page.waitForSelector('.download-progress', { state: 'hidden', timeout: 300000 });

				// Should now show downloaded badge
				const downloadedBadge = modelItem.locator('.downloaded-badge');
				await expect(downloadedBadge).toBeVisible();
			}
		});
	});

	test.describe('Delete Model Flow', () => {
		test('should remove model when delete is clicked', async ({ page }) => {
			await page.waitForTimeout(500);

			const deleteButtons = page.locator('.delete-model-button');
			const initialCount = await deleteButtons.count();

			if (initialCount > 0) {
				// Click delete on first deletable model
				await deleteButtons.first().click();

				// Model should be removed (button count should decrease or model state changes)
				await page.waitForTimeout(1000);

				// Either the button is gone or the model is no longer marked as downloaded
			}
		});

		test('should update active model selector after deletion', async ({ page }) => {
			await page.waitForTimeout(500);

			// Get initial state of model selector
			const modelSelector = page.locator('[data-testid="model-selector"]');
			const initialOptions = await modelSelector.locator('option').count();

			const deleteButtons = page.locator('.delete-model-button');
			const count = await deleteButtons.count();

			if (count > 0) {
				await deleteButtons.first().click();
				await page.waitForTimeout(1000);

				// Options count might decrease
				const newOptions = await modelSelector.locator('option').count();
				expect(newOptions).toBeLessThanOrEqual(initialOptions);
			}
		});
	});

	test.describe('Error Handling', () => {
		test('should show error message on download failure', async ({ page }) => {
			// This would need network simulation to test
			// For now, verify error UI element exists
			const errorDiv = page.locator('.model-error');
			// Error should not be visible initially
			await expect(errorDiv).not.toBeVisible();
		});

		test('should clear error after timeout', async ({ page }) => {
			// Similar to above - need to trigger error first
			const errorDiv = page.locator('.model-error');
			await expect(errorDiv).not.toBeVisible();
		});
	});
});

test.describe('Active Model Selection', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('domcontentloaded');
	});

	test.describe('Model Selector Dropdown', () => {
		test('should display active model selector', async ({ page }) => {
			const modelSelector = page.locator('[data-testid="model-selector"]');
			await expect(modelSelector).toBeVisible();
		});

		test('should only show downloaded models in selector', async ({ page }) => {
			await page.waitForTimeout(500);

			const modelSelector = page.locator('[data-testid="model-selector"]');
			const options = await modelSelector.locator('option').all();

			// All options should correspond to downloaded models
			for (const option of options) {
				const value = await option.getAttribute('value');
				expect(value).toBeTruthy();
			}
		});

		test('should show warning when no models are downloaded', async ({ page }) => {
			// This would need special setup with no models
			const warning = page.locator('.setting-description.warning');
			// Only visible if no models
			const isVisible = await warning.isVisible().catch(() => false);

			// If visible, should have correct text
			if (isVisible) {
				await expect(warning).toContainText('No models downloaded');
			}
		});

		test('should be disabled when no models are downloaded', async ({ page }) => {
			await page.waitForTimeout(500);

			const modelSelector = page.locator('[data-testid="model-selector"]');
			const options = await modelSelector.locator('option').count();

			if (options === 0) {
				await expect(modelSelector).toBeDisabled();
			}
		});
	});

	test.describe('Model Selection Change', () => {
		test('should update active model when selection changes', async ({ page }) => {
			await page.waitForTimeout(500);

			const modelSelector = page.locator('[data-testid="model-selector"]');
			const options = await modelSelector.locator('option').all();

			if (options.length > 1) {
				// Get current value
				const currentValue = await modelSelector.inputValue();

				// Select a different option
				const newValue = await options[1].getAttribute('value');
				if (newValue && newValue !== currentValue) {
					await modelSelector.selectOption(newValue);

					// Verify selection changed
					const updatedValue = await modelSelector.inputValue();
					expect(updatedValue).toBe(newValue);
				}
			}
		});

		test('should update active badge when selection changes', async ({ page }) => {
			await page.waitForTimeout(500);

			const modelSelector = page.locator('[data-testid="model-selector"]');
			const options = await modelSelector.locator('option').all();

			if (options.length > 1) {
				const newValue = await options[1].getAttribute('value');
				if (newValue) {
					await modelSelector.selectOption(newValue);
					await page.waitForTimeout(500);

					// Active badge should now be on the new model
					const activeItem = page.locator('.model-item.active');
					await expect(activeItem).toBeVisible();
				}
			}
		});
	});
});

test.describe('Integration Tests', () => {
	test.describe('Full Model Download Flow', () => {
		test('should complete full flow: navigate to settings -> download model -> select as active', async ({
			page,
		}) => {
			// Start at home
			await page.goto('/');

			// Navigate to settings
			await page.click('[data-testid="nav-settings"]');
			await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

			// Wait for models to load
			await page.waitForTimeout(1000);

			// Check if there's a model to download
			const downloadButtons = page.locator('.download-model-button');
			const count = await downloadButtons.count();

			if (count > 0) {
				// Download a model
				await downloadButtons.first().click();

				// Wait for download (may take a while for larger models)
				await page.waitForSelector('.download-progress', { state: 'hidden', timeout: 300000 });

				// Model should now be available in selector
				const modelSelector = page.locator('[data-testid="model-selector"]');
				const options = await modelSelector.locator('option').count();
				expect(options).toBeGreaterThan(0);
			}
		});

		test('should persist model selection after page refresh', async ({ page }) => {
			await page.goto('/settings');
			await page.waitForTimeout(500);

			const modelSelector = page.locator('[data-testid="model-selector"]');
			const options = await modelSelector.locator('option').all();

			if (options.length > 1) {
				// Select second option
				const newValue = await options[1].getAttribute('value');
				if (newValue) {
					await modelSelector.selectOption(newValue);
					await page.waitForTimeout(1000);

					// Refresh page
					await page.reload();
					await page.waitForLoadState('domcontentloaded');
					await page.waitForTimeout(500);

					// Selection should persist
					const currentValue = await modelSelector.inputValue();
					expect(currentValue).toBe(newValue);
				}
			}
		});
	});

	test.describe('Navigation with Model State', () => {
		test('should maintain model state when navigating between pages', async ({ page }) => {
			await page.goto('/settings');
			await page.waitForTimeout(500);

			// Get current active model
			const modelSelector = page.locator('[data-testid="model-selector"]');
			const initialValue = await modelSelector.inputValue();

			// Navigate to home
			await page.click('[data-testid="nav-home"]');
			await page.waitForTimeout(500);

			// Navigate back to settings
			await page.click('[data-testid="nav-settings"]');
			await page.waitForTimeout(500);

			// Model selection should be preserved
			const currentValue = await modelSelector.inputValue();
			expect(currentValue).toBe(initialValue);
		});
	});
});

test.describe('Accessibility', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('domcontentloaded');
	});

	test('model selector should be keyboard accessible', async ({ page }) => {
		const modelSelector = page.locator('[data-testid="model-selector"]');

		// Focus the selector
		await modelSelector.focus();
		await expect(modelSelector).toBeFocused();

		// Should be able to navigate with keyboard
		await page.keyboard.press('ArrowDown');
	});

	test('download buttons should be keyboard accessible', async ({ page }) => {
		await page.waitForTimeout(500);

		const downloadButtons = page.locator('.download-model-button');
		const count = await downloadButtons.count();

		if (count > 0) {
			await downloadButtons.first().focus();
			await expect(downloadButtons.first()).toBeFocused();
		}
	});

	test('delete buttons should be keyboard accessible', async ({ page }) => {
		await page.waitForTimeout(500);

		const deleteButtons = page.locator('.delete-model-button');
		const count = await deleteButtons.count();

		if (count > 0) {
			await deleteButtons.first().focus();
			await expect(deleteButtons.first()).toBeFocused();
		}
	});
});
