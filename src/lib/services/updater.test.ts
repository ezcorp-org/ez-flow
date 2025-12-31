import { test, expect, describe, beforeEach, mock, spyOn } from 'bun:test';

// Mock the Tauri API and updater plugin
const mockInvoke = mock(() => Promise.resolve({ auto_check_updates: true }));
const mockCheck = mock(() => Promise.resolve(null as unknown));
const mockDownloadAndInstall = mock(() => Promise.resolve());

// Create mock Update object
const createMockUpdate = (available: boolean, version = '2.0.0') => ({
	available,
	version,
	body: 'Release notes for version 2.0.0',
	date: '2024-12-15T10:00:00Z',
	downloadAndInstall: mockDownloadAndInstall
});

// Mock @tauri-apps/api/core
mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

// Mock @tauri-apps/plugin-updater
mock.module('@tauri-apps/plugin-updater', () => ({
	check: mockCheck
}));

// Mock @tauri-apps/api/app
const mockGetVersion = mock(() => Promise.resolve('1.0.0'));
mock.module('@tauri-apps/api/app', () => ({
	getVersion: mockGetVersion
}));

describe('updater service', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockCheck.mockClear();
		mockDownloadAndInstall.mockClear();
		mockGetVersion.mockClear();
		// Reset to default behavior
		mockInvoke.mockResolvedValue({ auto_check_updates: true });
		mockCheck.mockResolvedValue(null);
		mockGetVersion.mockResolvedValue('1.0.0');
	});

	describe('isAutoUpdateEnabled', () => {
		test('should return true when auto_check_updates is enabled', async () => {
			mockInvoke.mockResolvedValueOnce({ auto_check_updates: true });

			const { isAutoUpdateEnabled } = await import('./updater');
			const result = await isAutoUpdateEnabled();

			expect(mockInvoke).toHaveBeenCalledWith('get_settings');
			expect(result).toBe(true);
		});

		test('should return false when auto_check_updates is disabled', async () => {
			mockInvoke.mockResolvedValueOnce({ auto_check_updates: false });

			const { isAutoUpdateEnabled } = await import('./updater');
			const result = await isAutoUpdateEnabled();

			expect(result).toBe(false);
		});

		test('should return true as default when settings retrieval fails', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Settings not available'));

			const { isAutoUpdateEnabled } = await import('./updater');
			const result = await isAutoUpdateEnabled();

			expect(result).toBe(true);
		});
	});

	describe('checkForUpdates', () => {
		test('should return update info when update is available', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates } = await import('./updater');
			const result = await checkForUpdates();

			expect(mockCheck).toHaveBeenCalled();
			expect(result).toEqual({
				version: '2.0.0',
				notes: 'Release notes for version 2.0.0',
				date: '2024-12-15T10:00:00Z'
			});
		});

		test('should return null when no update is available', async () => {
			mockCheck.mockResolvedValueOnce(null);

			const { checkForUpdates } = await import('./updater');
			const result = await checkForUpdates();

			expect(mockCheck).toHaveBeenCalled();
			expect(result).toBeNull();
		});

		test('should return null when update.available is false', async () => {
			const mockUpdate = createMockUpdate(false);
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates } = await import('./updater');
			const result = await checkForUpdates();

			expect(result).toBeNull();
		});

		test('should handle null body and date fields', async () => {
			const mockUpdate = {
				available: true,
				version: '2.1.0',
				body: undefined,
				date: undefined,
				downloadAndInstall: mockDownloadAndInstall
			};
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates } = await import('./updater');
			const result = await checkForUpdates();

			expect(result).toEqual({
				version: '2.1.0',
				notes: null,
				date: null
			});
		});

		test('should return null and log error when check fails', async () => {
			const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
			mockCheck.mockRejectedValueOnce(new Error('Network error'));

			const { checkForUpdates } = await import('./updater');
			const result = await checkForUpdates();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith('Update check failed:', expect.any(Error));
			consoleSpy.mockRestore();
		});
	});

	describe('downloadAndInstall', () => {
		test('should download and install pending update', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			// First check for updates to set currentUpdate
			await checkForUpdates();

			await downloadAndInstall();

			expect(mockDownloadAndInstall).toHaveBeenCalled();
		});

		test('should call progress callback with Started event', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			(mockDownloadAndInstall as ReturnType<typeof mock>).mockImplementationOnce((callback: (event: unknown) => void) => {
				callback({
					event: 'Started',
					data: { contentLength: 10485760 }
				});
				return Promise.resolve();
			});
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			const progressCallback = mock(() => {});
			await downloadAndInstall(progressCallback);

			expect(progressCallback).toHaveBeenCalledWith({
				downloaded: 0,
				total: 10485760
			});
		});

		test('should call progress callback with Progress event', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			(mockDownloadAndInstall as ReturnType<typeof mock>).mockImplementationOnce((callback: (event: unknown) => void) => {
				callback({
					event: 'Progress',
					data: { chunkLength: 1024 }
				});
				return Promise.resolve();
			});
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			const progressCallback = mock(() => {});
			await downloadAndInstall(progressCallback);

			expect(progressCallback).toHaveBeenCalledWith({
				downloaded: 1024,
				total: null
			});
		});

		test('should handle Started event with null contentLength', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			(mockDownloadAndInstall as ReturnType<typeof mock>).mockImplementationOnce((callback: (event: unknown) => void) => {
				callback({
					event: 'Started',
					data: { contentLength: null }
				});
				return Promise.resolve();
			});
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			const progressCallback = mock(() => {});
			await downloadAndInstall(progressCallback);

			expect(progressCallback).toHaveBeenCalledWith({
				downloaded: 0,
				total: null
			});
		});

		test('should check for updates if no pending update and install if available', async () => {
			// The module maintains currentUpdate state, so we need to ensure
			// the update check returns an available update when downloadAndInstall is called
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValue(mockUpdate);

			const { downloadAndInstall } = await import('./updater');
			await downloadAndInstall();

			expect(mockDownloadAndInstall).toHaveBeenCalled();
		});

		test('should log and rethrow error when installation fails', async () => {
			const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockDownloadAndInstall.mockRejectedValueOnce(new Error('Installation failed'));
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			await expect(downloadAndInstall()).rejects.toThrow('Installation failed');
			expect(consoleSpy).toHaveBeenCalledWith('Update installation failed:', expect.any(Error));
			consoleSpy.mockRestore();
		});

		test('should work without progress callback', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			// Should not throw when callback is undefined
			await expect(downloadAndInstall()).resolves.toBeUndefined();
		});

		test('should handle multiple progress events', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			(mockDownloadAndInstall as ReturnType<typeof mock>).mockImplementationOnce((callback: (event: unknown) => void) => {
				callback({ event: 'Started', data: { contentLength: 5000 } });
				callback({ event: 'Progress', data: { chunkLength: 1000 } });
				callback({ event: 'Progress', data: { chunkLength: 2000 } });
				callback({ event: 'Progress', data: { chunkLength: 2000 } });
				return Promise.resolve();
			});
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			const progressCallback = mock(() => {});
			await downloadAndInstall(progressCallback);

			expect(progressCallback).toHaveBeenCalledTimes(4);
		});

		test('should ignore unknown event types', async () => {
			const mockUpdate = createMockUpdate(true, '2.0.0');
			(mockDownloadAndInstall as ReturnType<typeof mock>).mockImplementationOnce((callback: (event: unknown) => void) => {
				callback({ event: 'Unknown', data: {} });
				callback({ event: 'Finished', data: {} });
				return Promise.resolve();
			});
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkForUpdates, downloadAndInstall } = await import('./updater');
			await checkForUpdates();

			const progressCallback = mock(() => {});
			await downloadAndInstall(progressCallback);

			// Only Started and Progress events should trigger callback
			expect(progressCallback).not.toHaveBeenCalled();
		});
	});

	describe('checkOnStartup', () => {
		test('should check for updates when auto-update is enabled', async () => {
			mockInvoke.mockResolvedValueOnce({ auto_check_updates: true });
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkOnStartup } = await import('./updater');
			const result = await checkOnStartup();

			expect(mockInvoke).toHaveBeenCalledWith('get_settings');
			expect(mockCheck).toHaveBeenCalled();
			expect(result).toEqual({
				version: '2.0.0',
				notes: 'Release notes for version 2.0.0',
				date: '2024-12-15T10:00:00Z'
			});
		});

		test('should return null when auto-update is disabled', async () => {
			const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
			mockInvoke.mockResolvedValueOnce({ auto_check_updates: false });

			const { checkOnStartup } = await import('./updater');
			const result = await checkOnStartup();

			expect(mockInvoke).toHaveBeenCalledWith('get_settings');
			expect(consoleSpy).toHaveBeenCalledWith('Auto-update check disabled');
			expect(result).toBeNull();
			consoleSpy.mockRestore();
		});

		test('should propagate update info when available on startup', async () => {
			mockInvoke.mockResolvedValueOnce({ auto_check_updates: true });
			const mockUpdate = createMockUpdate(true, '3.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkOnStartup } = await import('./updater');
			const result = await checkOnStartup();

			expect(result?.version).toBe('3.0.0');
		});

		test('should handle settings error and still check for updates', async () => {
			// When settings fail, isAutoUpdateEnabled returns true (default)
			mockInvoke.mockRejectedValueOnce(new Error('Settings error'));
			const mockUpdate = createMockUpdate(true, '2.0.0');
			mockCheck.mockResolvedValueOnce(mockUpdate);

			const { checkOnStartup } = await import('./updater');
			const result = await checkOnStartup();

			expect(result).not.toBeNull();
			expect(result?.version).toBe('2.0.0');
		});
	});

	describe('getCurrentVersion', () => {
		test('should return current app version', async () => {
			mockGetVersion.mockResolvedValueOnce('1.2.3');

			const { getCurrentVersion } = await import('./updater');
			const result = await getCurrentVersion();

			expect(result).toBe('1.2.3');
		});

		test('should return 0.0.0 as fallback when version retrieval fails', async () => {
			mockGetVersion.mockRejectedValueOnce(new Error('Version not available'));

			const { getCurrentVersion } = await import('./updater');
			const result = await getCurrentVersion();

			expect(result).toBe('0.0.0');
		});

		test('should handle various version formats', async () => {
			const versions = ['0.1.0', '1.0.0-beta', '2.5.10', '10.20.30'];

			for (const version of versions) {
				mockGetVersion.mockResolvedValueOnce(version);

				const { getCurrentVersion } = await import('./updater');
				const result = await getCurrentVersion();

				expect(result).toBe(version);
			}
		});

		test('should handle pre-release version strings', async () => {
			mockGetVersion.mockResolvedValueOnce('2.0.0-alpha.1');

			const { getCurrentVersion } = await import('./updater');
			const result = await getCurrentVersion();

			expect(result).toBe('2.0.0-alpha.1');
		});

		test('should handle version with build metadata', async () => {
			mockGetVersion.mockResolvedValueOnce('1.0.0+build.123');

			const { getCurrentVersion } = await import('./updater');
			const result = await getCurrentVersion();

			expect(result).toBe('1.0.0+build.123');
		});
	});

	describe('UpdateInfo interface', () => {
		test('should have correct structure', () => {
			interface UpdateInfo {
				version: string;
				notes: string | null;
				date: string | null;
			}

			const info: UpdateInfo = {
				version: '2.0.0',
				notes: 'New features',
				date: '2024-12-15'
			};

			expect(info.version).toBe('2.0.0');
			expect(info.notes).toBe('New features');
			expect(info.date).toBe('2024-12-15');
		});

		test('should allow null notes and date', () => {
			interface UpdateInfo {
				version: string;
				notes: string | null;
				date: string | null;
			}

			const info: UpdateInfo = {
				version: '2.0.0',
				notes: null,
				date: null
			};

			expect(info.notes).toBeNull();
			expect(info.date).toBeNull();
		});

		test('should support markdown in notes', () => {
			interface UpdateInfo {
				version: string;
				notes: string | null;
				date: string | null;
			}

			const info: UpdateInfo = {
				version: '2.0.0',
				notes: '## Changes\n- Bug fixes\n- Performance improvements',
				date: '2024-12-15'
			};

			expect(info.notes).toContain('## Changes');
			expect(info.notes).toContain('- Bug fixes');
		});
	});

	describe('DownloadProgress interface', () => {
		test('should have correct structure', () => {
			interface DownloadProgress {
				downloaded: number;
				total: number | null;
			}

			const progress: DownloadProgress = {
				downloaded: 5242880,
				total: 10485760
			};

			expect(progress.downloaded).toBe(5242880);
			expect(progress.total).toBe(10485760);
		});

		test('should allow null total', () => {
			interface DownloadProgress {
				downloaded: number;
				total: number | null;
			}

			const progress: DownloadProgress = {
				downloaded: 1024,
				total: null
			};

			expect(progress.downloaded).toBe(1024);
			expect(progress.total).toBeNull();
		});

		test('should track progress percentages correctly', () => {
			interface DownloadProgress {
				downloaded: number;
				total: number | null;
			}

			const progress: DownloadProgress = {
				downloaded: 5242880,
				total: 10485760
			};

			const percentage =
				progress.total !== null ? Math.round((progress.downloaded / progress.total) * 100) : null;

			expect(percentage).toBe(50);
		});

		test('should handle zero downloaded', () => {
			interface DownloadProgress {
				downloaded: number;
				total: number | null;
			}

			const progress: DownloadProgress = {
				downloaded: 0,
				total: 10485760
			};

			expect(progress.downloaded).toBe(0);
			expect(progress.total).toBe(10485760);
		});
	});
});

describe('module exports', () => {
	test('should export all expected functions', async () => {
		const module = await import('./updater');

		expect(typeof module.isAutoUpdateEnabled).toBe('function');
		expect(typeof module.checkForUpdates).toBe('function');
		expect(typeof module.downloadAndInstall).toBe('function');
		expect(typeof module.checkOnStartup).toBe('function');
		expect(typeof module.getCurrentVersion).toBe('function');
	});

	test('should export UpdateInfo type', async () => {
		const module = await import('./updater');

		// TypeScript type exports are verified at compile time
		// We verify the functions return the expected shape
		const mockUpdate = createMockUpdate(true, '2.0.0');
		mockCheck.mockResolvedValueOnce(mockUpdate);

		const result = await module.checkForUpdates();

		expect(result).toHaveProperty('version');
		expect(result).toHaveProperty('notes');
		expect(result).toHaveProperty('date');
	});
});

describe('error handling edge cases', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockCheck.mockClear();
		mockDownloadAndInstall.mockClear();
		mockGetVersion.mockClear();
	});

	test('should handle network timeout during update check', async () => {
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
		mockCheck.mockRejectedValueOnce(new Error('Network timeout'));

		const { checkForUpdates } = await import('./updater');
		const result = await checkForUpdates();

		expect(result).toBeNull();
		consoleSpy.mockRestore();
	});

	test('should handle corrupted update response', async () => {
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
		mockCheck.mockRejectedValueOnce(new Error('Invalid JSON response'));

		const { checkForUpdates } = await import('./updater');
		const result = await checkForUpdates();

		expect(result).toBeNull();
		consoleSpy.mockRestore();
	});

	test('should handle partial download failure', async () => {
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
		const mockUpdate = createMockUpdate(true, '2.0.0');
		mockDownloadAndInstall.mockRejectedValueOnce(new Error('Download interrupted'));
		mockCheck.mockResolvedValueOnce(mockUpdate);

		const { checkForUpdates, downloadAndInstall } = await import('./updater');
		await checkForUpdates();

		await expect(downloadAndInstall()).rejects.toThrow('Download interrupted');
		consoleSpy.mockRestore();
	});

	test('should handle permission denied during installation', async () => {
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
		const mockUpdate = createMockUpdate(true, '2.0.0');
		mockDownloadAndInstall.mockRejectedValueOnce(new Error('Permission denied'));
		mockCheck.mockResolvedValueOnce(mockUpdate);

		const { checkForUpdates, downloadAndInstall } = await import('./updater');
		await checkForUpdates();

		await expect(downloadAndInstall()).rejects.toThrow('Permission denied');
		consoleSpy.mockRestore();
	});

	test('should handle disk space error during installation', async () => {
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
		const mockUpdate = createMockUpdate(true, '2.0.0');
		mockDownloadAndInstall.mockRejectedValueOnce(new Error('Insufficient disk space'));
		mockCheck.mockResolvedValueOnce(mockUpdate);

		const { checkForUpdates, downloadAndInstall } = await import('./updater');
		await checkForUpdates();

		await expect(downloadAndInstall()).rejects.toThrow('Insufficient disk space');
		consoleSpy.mockRestore();
	});
});
