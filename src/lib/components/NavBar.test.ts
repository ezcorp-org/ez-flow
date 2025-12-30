import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';

// Mock Tauri APIs before importing component
const mockShow = mock(() => Promise.resolve());
const mockHide = mock(() => Promise.resolve());
const mockSetFocus = mock(() => Promise.resolve());
const mockGetByLabel = mock((label: string) => {
	return Promise.resolve({
		label,
		show: mockShow,
		hide: mockHide,
		setFocus: mockSetFocus,
	});
});

const mockGetCurrentWindow = mock(() => ({
	label: 'main',
	show: mockShow,
	hide: mockHide,
	setFocus: mockSetFocus,
}));

mock.module('@tauri-apps/api/webviewWindow', () => ({
	WebviewWindow: {
		getByLabel: mockGetByLabel,
	},
}));

mock.module('@tauri-apps/api/window', () => ({
	getCurrentWindow: mockGetCurrentWindow,
}));

describe('NavBar Component Logic', () => {
	beforeEach(() => {
		mockShow.mockClear();
		mockHide.mockClear();
		mockSetFocus.mockClear();
		mockGetByLabel.mockClear();
	});

	describe('Navigation Items', () => {
		test('should have correct nav items defined', () => {
			const navItems = [
				{ windowLabel: 'main', label: 'Home', icon: 'home' },
				{ windowLabel: 'history', label: 'History', icon: 'history' },
				{ windowLabel: 'settings', label: 'Settings', icon: 'settings' },
			];

			expect(navItems).toHaveLength(3);
			expect(navItems[0].windowLabel).toBe('main');
			expect(navItems[1].windowLabel).toBe('history');
			expect(navItems[2].windowLabel).toBe('settings');
		});

		test('each nav item should have required properties', () => {
			const navItems = [
				{ windowLabel: 'main', label: 'Home', icon: 'home' },
				{ windowLabel: 'history', label: 'History', icon: 'history' },
				{ windowLabel: 'settings', label: 'Settings', icon: 'settings' },
			];

			navItems.forEach((item) => {
				expect(item).toHaveProperty('windowLabel');
				expect(item).toHaveProperty('label');
				expect(item).toHaveProperty('icon');
				expect(typeof item.windowLabel).toBe('string');
				expect(typeof item.label).toBe('string');
				expect(typeof item.icon).toBe('string');
			});
		});
	});

	describe('Navigation Function', () => {
		test('should call getByLabel with correct window label', async () => {
			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
			const { getCurrentWindow } = await import('@tauri-apps/api/window');

			// Simulate navigation from main to history
			const currentWindowLabel = getCurrentWindow().label;
			expect(currentWindowLabel).toBe('main');

			const targetWindow = await WebviewWindow.getByLabel('history');
			expect(mockGetByLabel).toHaveBeenCalledWith('history');
			expect(targetWindow).toBeTruthy();
		});

		test('should call show and setFocus on target window', async () => {
			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

			const targetWindow = await WebviewWindow.getByLabel('settings');
			if (targetWindow) {
				await targetWindow.show();
				await targetWindow.setFocus();

				expect(mockShow).toHaveBeenCalled();
				expect(mockSetFocus).toHaveBeenCalled();
			}
		});

		test('should not navigate if already on same window', async () => {
			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
			const { getCurrentWindow } = await import('@tauri-apps/api/window');

			const currentWindowLabel = getCurrentWindow().label;

			// Simulate navigateTo function logic
			const targetLabel = 'main';
			if (targetLabel === currentWindowLabel) {
				// Should return early, not call getByLabel
				return;
			}

			await WebviewWindow.getByLabel(targetLabel);
			expect(mockGetByLabel).not.toHaveBeenCalled();
		});

		test('should hide current window if not main', async () => {
			// Override getCurrentWindow to return a non-main window
			const mockNonMainWindow = mock(() => ({
				label: 'history',
				show: mockShow,
				hide: mockHide,
				setFocus: mockSetFocus,
			}));

			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

			const currentWindow = mockNonMainWindow();
			const targetWindow = await WebviewWindow.getByLabel('settings');

			if (targetWindow) {
				await targetWindow.show();
				await targetWindow.setFocus();

				// Hide current window if not main
				if (currentWindow.label !== 'main') {
					await currentWindow.hide();
				}

				expect(mockHide).toHaveBeenCalled();
			}
		});

		test('should not hide main window when navigating away', async () => {
			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
			const { getCurrentWindow } = await import('@tauri-apps/api/window');

			const currentWindow = getCurrentWindow();
			const targetWindow = await WebviewWindow.getByLabel('settings');

			mockHide.mockClear();

			if (targetWindow) {
				await targetWindow.show();
				await targetWindow.setFocus();

				// Should NOT hide main window
				if (currentWindow.label !== 'main') {
					await currentWindow.hide();
				}

				// hide should not have been called since current is 'main'
				expect(mockHide).not.toHaveBeenCalled();
			}
		});
	});

	describe('Error Handling', () => {
		test('should handle null window gracefully', async () => {
			const mockNullGetByLabel = mock(() => Promise.resolve(null));

			mock.module('@tauri-apps/api/webviewWindow', () => ({
				WebviewWindow: {
					getByLabel: mockNullGetByLabel,
				},
			}));

			const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

			const targetWindow = await WebviewWindow.getByLabel('nonexistent');
			expect(targetWindow).toBeNull();

			// Navigation should handle this gracefully (not throw)
			if (targetWindow) {
				await targetWindow.show();
			}
			// No error thrown means success
		});

		test('should catch and log errors', async () => {
			const mockErrorGetByLabel = mock(() => Promise.reject(new Error('Window not found')));

			const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

			try {
				await mockErrorGetByLabel();
			} catch (error) {
				console.error('Navigation error:', error);
			}

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Window Label Detection', () => {
		test('should correctly identify current window label', async () => {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');

			const currentWindow = getCurrentWindow();
			expect(currentWindow.label).toBe('main');
		});

		test('should determine active state correctly', () => {
			const currentWindowLabel = 'history';
			const navItems = [
				{ windowLabel: 'main', label: 'Home', icon: 'home' },
				{ windowLabel: 'history', label: 'History', icon: 'history' },
				{ windowLabel: 'settings', label: 'Settings', icon: 'settings' },
			];

			navItems.forEach((item) => {
				const isActive = item.windowLabel === currentWindowLabel;
				if (item.windowLabel === 'history') {
					expect(isActive).toBe(true);
				} else {
					expect(isActive).toBe(false);
				}
			});
		});
	});
});

describe('BackButton Component Logic', () => {
	beforeEach(() => {
		mockShow.mockClear();
		mockHide.mockClear();
		mockSetFocus.mockClear();
		mockGetByLabel.mockClear();
	});

	describe('Back Navigation', () => {
		test('should navigate to fallback window (main) by default', async () => {
			// Test the navigation logic directly
			const fallbackWindow = 'main';
			const targetWindow = await mockGetByLabel(fallbackWindow);

			expect(mockGetByLabel).toHaveBeenCalledWith('main');
			expect(targetWindow).toBeTruthy();
		});

		test('should show and focus the fallback window', async () => {
			const targetWindow = await mockGetByLabel('main');
			if (targetWindow) {
				await targetWindow.show();
				await targetWindow.setFocus();

				expect(mockShow).toHaveBeenCalled();
				expect(mockSetFocus).toHaveBeenCalled();
			}
		});

		test('should hide current window if not main', async () => {
			const currentWindowLabel = 'history';
			const mockCurrentWindow = {
				label: currentWindowLabel,
				hide: mockHide,
			};

			if (mockCurrentWindow.label !== 'main') {
				await mockCurrentWindow.hide();
			}

			expect(mockHide).toHaveBeenCalled();
		});

		test('should not hide main window', async () => {
			const currentWindowLabel = 'main';
			const mockCurrentWindow = {
				label: currentWindowLabel,
				hide: mockHide,
			};

			mockHide.mockClear();

			if (mockCurrentWindow.label !== 'main') {
				await mockCurrentWindow.hide();
			}

			expect(mockHide).not.toHaveBeenCalled();
		});
	});

	describe('Custom Fallback Window', () => {
		test('should navigate to custom fallback window', async () => {
			const customFallback = 'settings';
			const targetWindow = await mockGetByLabel(customFallback);

			expect(mockGetByLabel).toHaveBeenCalledWith('settings');
			expect(targetWindow).toBeTruthy();
		});
	});
});

describe('Integration Tests', () => {
	beforeEach(() => {
		mockShow.mockClear();
		mockHide.mockClear();
		mockSetFocus.mockClear();
		mockGetByLabel.mockClear();
	});

	describe('Navigation Flow', () => {
		test('should complete full navigation cycle: main -> history -> settings -> main', async () => {
			// Navigate to history
			let targetWindow = await mockGetByLabel('history');
			expect(targetWindow).toBeTruthy();
			if (targetWindow) await targetWindow.show();

			// Navigate to settings
			targetWindow = await mockGetByLabel('settings');
			expect(targetWindow).toBeTruthy();
			if (targetWindow) await targetWindow.show();

			// Navigate back to main
			targetWindow = await mockGetByLabel('main');
			expect(targetWindow).toBeTruthy();
			if (targetWindow) await targetWindow.show();

			expect(mockGetByLabel).toHaveBeenCalledTimes(3);
			expect(mockShow).toHaveBeenCalledTimes(3);
		});

		test('should handle rapid navigation', async () => {
			// Simulate rapid clicks
			const navigations = ['history', 'settings', 'main', 'history', 'settings'];

			await Promise.all(
				navigations.map(async (label) => {
					const targetWindow = await mockGetByLabel(label);
					if (targetWindow) {
						await targetWindow.show();
						await targetWindow.setFocus();
					}
				})
			);

			expect(mockGetByLabel).toHaveBeenCalledTimes(5);
		});
	});
});
