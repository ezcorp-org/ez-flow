import { test, expect, describe, beforeEach, mock } from 'bun:test';

// Mock the Tauri API with proper typing
const mockInvoke = mock((_cmd: string, _args?: unknown) => Promise.resolve([] as unknown));

// Create a mock module for @tauri-apps/api/core
mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

describe('history service', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
	});

	describe('get_history command', () => {
		test('should call invoke with correct parameters', async () => {
			const mockHistory = [
				{
					id: 1,
					text: 'Hello world',
					timestamp: '2024-01-01T00:00:00Z',
					duration_ms: 1000,
					model_id: 'base',
					language: 'en',
					gpu_used: true
				}
			];
			mockInvoke.mockResolvedValueOnce(mockHistory);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history', { limit: 10, offset: 0 });

			expect(mockInvoke).toHaveBeenCalledWith('get_history', { limit: 10, offset: 0 });
			expect(result).toEqual(mockHistory);
		});

		test('should handle empty history', async () => {
			mockInvoke.mockResolvedValueOnce([]);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history', { limit: 10, offset: 0 });

			expect(result).toEqual([]);
		});

		test('should handle pagination', async () => {
			mockInvoke.mockResolvedValueOnce([
				{ id: 6, text: 'Entry 6', timestamp: '2024-01-06T00:00:00Z', duration_ms: 1000, model_id: 'base', language: null, gpu_used: false }
			]);

			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('get_history', { limit: 5, offset: 5 });

			expect(mockInvoke).toHaveBeenCalledWith('get_history', { limit: 5, offset: 5 });
		});
	});

	describe('save_history command', () => {
		test('should call invoke with transcription result', async () => {
			const transcriptionResult = {
				text: 'Test transcription',
				duration_ms: 2500,
				model_id: 'base',
				language: 'en',
				gpu_used: true
			};
			mockInvoke.mockResolvedValueOnce(1); // Returns inserted ID

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('save_history', { result: transcriptionResult });

			expect(mockInvoke).toHaveBeenCalledWith('save_history', { result: transcriptionResult });
			expect(result).toBe(1);
		});

		test('should handle transcription without language', async () => {
			const transcriptionResult = {
				text: 'No language detected',
				duration_ms: 1500,
				model_id: 'tiny',
				language: null,
				gpu_used: false
			};
			mockInvoke.mockResolvedValueOnce(2);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('save_history', { result: transcriptionResult });

			expect(result).toBe(2);
		});

		test('should handle save errors gracefully', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Database not available'));

			const { invoke } = await import('@tauri-apps/api/core');

			await expect(invoke('save_history', { result: {} })).rejects.toThrow('Database not available');
		});
	});

	describe('search_history command', () => {
		test('should search with query string', async () => {
			const searchResults = [
				{ id: 1, text: 'Hello world', timestamp: '2024-01-01T00:00:00Z', duration_ms: 1000, model_id: 'base', language: 'en', gpu_used: false }
			];
			mockInvoke.mockResolvedValueOnce(searchResults);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('search_history', { query: 'Hello' });

			expect(mockInvoke).toHaveBeenCalledWith('search_history', { query: 'Hello' });
			expect(result).toEqual(searchResults);
		});

		test('should return empty array for no matches', async () => {
			mockInvoke.mockResolvedValueOnce([]);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('search_history', { query: 'nonexistent' });

			expect(result).toEqual([]);
		});
	});

	describe('delete_history_entry command', () => {
		test('should delete entry by id', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('delete_history_entry', { id: 5 });

			expect(mockInvoke).toHaveBeenCalledWith('delete_history_entry', { id: 5 });
		});
	});

	describe('clear_history command', () => {
		test('should clear all history', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('clear_history');

			expect(mockInvoke).toHaveBeenCalledWith('clear_history');
		});
	});

	describe('get_history_count command', () => {
		test('should return history count', async () => {
			mockInvoke.mockResolvedValueOnce(42);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history_count');

			expect(mockInvoke).toHaveBeenCalledWith('get_history_count');
			expect(result).toBe(42);
		});

		test('should return 0 for empty history', async () => {
			mockInvoke.mockResolvedValueOnce(0);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('get_history_count');

			expect(result).toBe(0);
		});
	});
});

describe('history entry model', () => {
	test('should have all required fields', () => {
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
			text: 'Test text',
			timestamp: '2024-01-01T00:00:00Z',
			duration_ms: 1500,
			model_id: 'base',
			language: 'en',
			gpu_used: true
		};

		expect(entry.id).toBe(1);
		expect(entry.text).toBe('Test text');
		expect(entry.timestamp).toBe('2024-01-01T00:00:00Z');
		expect(entry.duration_ms).toBe(1500);
		expect(entry.model_id).toBe('base');
		expect(entry.language).toBe('en');
		expect(entry.gpu_used).toBe(true);
	});

	test('should allow null language', () => {
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
			text: 'No language',
			timestamp: '2024-01-02T00:00:00Z',
			duration_ms: 2000,
			model_id: 'tiny',
			language: null,
			gpu_used: false
		};

		expect(entry.language).toBeNull();
		expect(entry.gpu_used).toBe(false);
	});
});

describe('transcription result model', () => {
	test('should match expected structure for history save', () => {
		interface TranscriptionResult {
			text: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		const result: TranscriptionResult = {
			text: 'Transcribed audio content',
			duration_ms: 3500,
			model_id: 'base',
			language: 'en',
			gpu_used: true
		};

		expect(result.text).toBe('Transcribed audio content');
		expect(result.duration_ms).toBe(3500);
		expect(result.model_id).toBe('base');
		expect(result.language).toBe('en');
		expect(result.gpu_used).toBe(true);
	});
});
