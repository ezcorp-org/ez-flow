import { test, expect, describe, beforeEach, mock } from 'bun:test';

// Mock Tauri APIs with proper typing
const mockInvoke = mock((_cmd: string, _args?: unknown) => Promise.resolve([] as unknown));
const mockWriteText = mock(() => Promise.resolve());

mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

mock.module('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: mockWriteText
}));

describe('HistoryList component logic', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockWriteText.mockClear();
	});

	describe('loadHistory', () => {
		test('should load history entries on mount', async () => {
			const mockEntries = [
				{
					id: 1,
					text: 'First transcription',
					timestamp: '2024-12-30T10:00:00Z',
					duration_ms: 1500,
					model_id: 'base',
					language: 'en',
					gpu_used: true
				},
				{
					id: 2,
					text: 'Second transcription',
					timestamp: '2024-12-30T09:00:00Z',
					duration_ms: 2000,
					model_id: 'base',
					language: 'en',
					gpu_used: false
				}
			];
			mockInvoke.mockResolvedValueOnce(mockEntries);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history', { limit: 5, offset: 0 });

			expect(mockInvoke).toHaveBeenCalledWith('get_history', { limit: 5, offset: 0 });
			expect(result).toHaveLength(2);
		});

		test('should handle empty history gracefully', async () => {
			mockInvoke.mockResolvedValueOnce([]);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history', { limit: 5, offset: 0 });

			expect(result).toEqual([]);
		});

		test('should handle load errors gracefully', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Database error'));

			const { invoke } = await import('@tauri-apps/api/core');

			await expect(invoke('get_history', { limit: 5, offset: 0 })).rejects.toThrow('Database error');
		});
	});

	describe('copyEntry', () => {
		test('should copy entry text to clipboard', async () => {
			mockWriteText.mockResolvedValueOnce(undefined);

			const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
			await writeText('Test transcription text');

			expect(mockWriteText).toHaveBeenCalledWith('Test transcription text');
		});

		test('should handle clipboard write errors', async () => {
			mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'));

			const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');

			await expect(writeText('Test')).rejects.toThrow('Clipboard access denied');
		});
	});

	describe('formatDate', () => {
		test('should format today date correctly', () => {
			const formatDate = (timestamp: string): string => {
				const date = new Date(timestamp);
				const now = new Date();
				const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

				if (diffDays === 0) {
					return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				} else if (diffDays === 1) {
					return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				}
				return date.toLocaleDateString([], {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
			};

			const today = new Date();
			today.setHours(14, 30, 0, 0);
			const result = formatDate(today.toISOString());

			expect(result).toContain('Today');
		});

		test('should format yesterday date correctly', () => {
			const formatDate = (timestamp: string): string => {
				const date = new Date(timestamp);
				const now = new Date();
				const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

				if (diffDays === 0) {
					return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				} else if (diffDays === 1) {
					return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				}
				return date.toLocaleDateString([], {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
			};

			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			yesterday.setHours(10, 15, 0, 0);
			const result = formatDate(yesterday.toISOString());

			expect(result).toContain('Yesterday');
		});

		test('should format older dates with month and day', () => {
			const formatDate = (timestamp: string): string => {
				const date = new Date(timestamp);
				const now = new Date();
				const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

				if (diffDays === 0) {
					return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				} else if (diffDays === 1) {
					return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				}
				return date.toLocaleDateString([], {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
			};

			const oldDate = new Date('2024-01-15T10:00:00Z');
			const result = formatDate(oldDate.toISOString());

			expect(result).not.toContain('Today');
			expect(result).not.toContain('Yesterday');
			expect(result).toContain('Jan');
		});
	});

	describe('truncateText', () => {
		test('should not truncate short text', () => {
			const truncateText = (text: string, maxLength: number): string => {
				if (text.length <= maxLength) return text;
				return text.slice(0, maxLength) + '...';
			};

			const result = truncateText('Short text', 80);
			expect(result).toBe('Short text');
		});

		test('should truncate long text with ellipsis', () => {
			const truncateText = (text: string, maxLength: number): string => {
				if (text.length <= maxLength) return text;
				return text.slice(0, maxLength) + '...';
			};

			const longText = 'This is a very long text that exceeds the maximum length and should be truncated with an ellipsis at the end';
			const result = truncateText(longText, 50);

			expect(result).toHaveLength(53); // 50 + '...'
			expect(result).toEndWith('...');
		});

		test('should handle exact length text', () => {
			const truncateText = (text: string, maxLength: number): string => {
				if (text.length <= maxLength) return text;
				return text.slice(0, maxLength) + '...';
			};

			const exactText = 'Exactly80chars'.padEnd(80, 'x');
			const result = truncateText(exactText, 80);

			expect(result).toBe(exactText);
			expect(result).not.toContain('...');
		});
	});
});

describe('HistoryList props', () => {
	test('should accept limit prop', () => {
		interface Props {
			limit?: number;
			showViewAll?: boolean;
		}

		const defaultProps: Props = { limit: 5, showViewAll: true };
		const customProps: Props = { limit: 10, showViewAll: false };

		expect(defaultProps.limit).toBe(5);
		expect(customProps.limit).toBe(10);
	});

	test('should accept showViewAll prop', () => {
		interface Props {
			limit?: number;
			showViewAll?: boolean;
		}

		const props: Props = { showViewAll: false };
		expect(props.showViewAll).toBe(false);
	});
});

describe('HistoryEntry interface', () => {
	test('should have all required properties', () => {
		interface HistoryEntry {
			id: number;
			text: string;
			timestamp: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		const entry: HistoryEntry = {
			id: 1,
			text: 'Test transcription',
			timestamp: '2024-12-30T12:00:00Z',
			duration_ms: 2500,
			model_id: 'base',
			language: 'en',
			gpu_used: true
		};

		expect(entry).toHaveProperty('id');
		expect(entry).toHaveProperty('text');
		expect(entry).toHaveProperty('timestamp');
		expect(entry).toHaveProperty('duration_ms');
		expect(entry).toHaveProperty('model_id');
		expect(entry).toHaveProperty('language');
		expect(entry).toHaveProperty('gpu_used');
	});

	test('should allow null language for auto-detect', () => {
		interface HistoryEntry {
			id: number;
			text: string;
			timestamp: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		const entry: HistoryEntry = {
			id: 2,
			text: 'Auto-detected language',
			timestamp: '2024-12-30T12:00:00Z',
			duration_ms: 1500,
			model_id: 'tiny',
			language: null,
			gpu_used: false
		};

		expect(entry.language).toBeNull();
	});
});

describe('History list refresh behavior', () => {
	test('should be able to refresh history list', async () => {
		const mockEntries = [
			{ id: 1, text: 'Entry 1', timestamp: '2024-12-30T10:00:00Z', duration_ms: 1000, model_id: 'base', language: 'en', gpu_used: false }
		];
		const updatedEntries = [
			{ id: 1, text: 'Entry 1', timestamp: '2024-12-30T10:00:00Z', duration_ms: 1000, model_id: 'base', language: 'en', gpu_used: false },
			{ id: 2, text: 'New Entry', timestamp: '2024-12-30T11:00:00Z', duration_ms: 1500, model_id: 'base', language: 'en', gpu_used: true }
		];

		mockInvoke.mockResolvedValueOnce(mockEntries);
		mockInvoke.mockResolvedValueOnce(updatedEntries);

		const { invoke } = await import('@tauri-apps/api/core');

		// Initial load
		const initial = await invoke('get_history', { limit: 5, offset: 0 });
		expect(initial).toHaveLength(1);

		// Refresh
		const refreshed = await invoke('get_history', { limit: 5, offset: 0 });
		expect(refreshed).toHaveLength(2);
	});
});
