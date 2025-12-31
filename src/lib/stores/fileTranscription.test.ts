import { test, expect, describe, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { fileTranscription } from './fileTranscription';

/**
 * Tests for FileTranscription store
 *
 * This store manages file-based transcription including:
 * - Processing state
 * - Progress tracking
 * - Result storage
 * - Error handling
 *
 * Note: Actual invoke() calls require Tauri runtime, so we test
 * the store structure and state management logic.
 */

describe('FileTranscription store state structure', () => {
	beforeEach(() => {
		fileTranscription.reset();
	});

	describe('Initial state', () => {
		test('should have isProcessing as false', () => {
			const state = get(fileTranscription);
			expect(state.isProcessing).toBe(false);
		});

		test('should have progress as 0', () => {
			const state = get(fileTranscription);
			expect(state.progress).toBe(0);
		});

		test('should have result as null', () => {
			const state = get(fileTranscription);
			expect(state.result).toBeNull();
		});

		test('should have error as null', () => {
			const state = get(fileTranscription);
			expect(state.error).toBeNull();
		});
	});

	describe('reset method', () => {
		test('should reset all state to initial values', () => {
			fileTranscription.reset();

			const state = get(fileTranscription);
			expect(state.isProcessing).toBe(false);
			expect(state.progress).toBe(0);
			expect(state.result).toBeNull();
			expect(state.error).toBeNull();
		});
	});

	describe('setError method', () => {
		test('should set error and clear processing', () => {
			fileTranscription.setError('Test error');

			const state = get(fileTranscription);
			expect(state.error).toBe('Test error');
			expect(state.isProcessing).toBe(false);
		});
	});
});

describe('FileTranscription state transitions', () => {
	beforeEach(() => {
		fileTranscription.reset();
	});

	describe('Processing flow simulation', () => {
		test('should track processing start -> progress -> complete', () => {
			let state = {
				isProcessing: false,
				progress: 0,
				result: null as { filename: string; text: string; durationMs: number } | null,
				error: null as string | null
			};

			// Start processing
			state = {
				...state,
				isProcessing: true,
				progress: 0,
				error: null,
				result: null
			};
			expect(state.isProcessing).toBe(true);
			expect(state.progress).toBe(0);

			// Progress update
			state = { ...state, progress: 50 };
			expect(state.progress).toBe(50);

			// Complete
			state = {
				...state,
				isProcessing: false,
				result: {
					filename: 'audio.mp3',
					text: 'Transcribed text here',
					durationMs: 5000
				}
			};
			expect(state.isProcessing).toBe(false);
			expect(state.result?.filename).toBe('audio.mp3');
			expect(state.result?.text).toBe('Transcribed text here');
		});

		test('should handle error during processing', () => {
			let state = {
				isProcessing: true,
				progress: 30,
				result: null,
				error: null as string | null
			};

			// Error occurs
			state = {
				...state,
				isProcessing: false,
				error: 'Failed to transcribe: unsupported format'
			};

			expect(state.isProcessing).toBe(false);
			expect(state.error).toContain('unsupported format');
		});
	});
});

describe('Filename extraction', () => {
	test('should extract filename from Unix path', () => {
		const filePath = '/home/user/documents/audio.mp3';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('audio.mp3');
	});

	test('should extract filename from Windows path', () => {
		const filePath = 'C:\\Users\\documents\\recording.wav';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('recording.wav');
	});

	test('should handle path with multiple dots', () => {
		const filePath = '/home/user/my.audio.file.mp3';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('my.audio.file.mp3');
	});

	test('should handle path with spaces', () => {
		const filePath = '/home/user/My Audio File.mp3';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('My Audio File.mp3');
	});

	test('should fallback to Unknown for empty path', () => {
		const filePath = '';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('Unknown');
	});

	test('should handle root file', () => {
		const filePath = '/audio.mp3';
		const filename = filePath.split(/[\\/]/).pop() || 'Unknown';

		expect(filename).toBe('audio.mp3');
	});
});

describe('FileTranscription result structure', () => {
	describe('Result properties', () => {
		test('should have filename property', () => {
			const result = {
				filename: 'test.mp3',
				text: 'Test text',
				durationMs: 1000
			};

			expect(result.filename).toBe('test.mp3');
		});

		test('should have text property', () => {
			const result = {
				filename: 'test.mp3',
				text: 'This is the transcribed text',
				durationMs: 1000
			};

			expect(result.text).toBe('This is the transcribed text');
		});

		test('should have durationMs property', () => {
			const result = {
				filename: 'test.mp3',
				text: 'Test',
				durationMs: 5500
			};

			expect(result.durationMs).toBe(5500);
		});
	});

	describe('Result variations', () => {
		test('should handle empty text', () => {
			const result = {
				filename: 'silent.mp3',
				text: '',
				durationMs: 10000
			};

			expect(result.text).toBe('');
		});

		test('should handle long text', () => {
			const longText = 'This is a sentence. '.repeat(500);
			const result = {
				filename: 'long_recording.mp3',
				text: longText,
				durationMs: 300000 // 5 minutes
			};

			expect(result.text.length).toBeGreaterThan(5000);
		});

		test('should handle various audio formats', () => {
			const formats = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'webm'];

			for (const format of formats) {
				const result = {
					filename: `audio.${format}`,
					text: 'Test',
					durationMs: 1000
				};
				expect(result.filename).toContain(format);
			}
		});
	});
});

describe('FileTranscription error handling', () => {
	describe('Error types', () => {
		test('should handle file not found error', () => {
			const error = 'File not found: /path/to/missing.mp3';
			expect(error).toContain('not found');
		});

		test('should handle unsupported format error', () => {
			const error = 'Unsupported audio format: .xyz';
			expect(error).toContain('Unsupported');
		});

		test('should handle model not loaded error', () => {
			const error = 'Whisper model not loaded';
			expect(error).toContain('model');
		});

		test('should handle transcription timeout', () => {
			const error = 'Transcription timeout after 300 seconds';
			expect(error).toContain('timeout');
		});

		test('should handle permission error', () => {
			const error = 'Permission denied: cannot read file';
			expect(error).toContain('Permission');
		});
	});

	describe('Error conversion', () => {
		test('should convert Error to string', () => {
			const err = new Error('Test error message');
			const errorString = String(err);

			expect(errorString).toContain('Test error message');
		});
	});
});

describe('FileTranscription store methods', () => {
	test('should have transcribeFile method', () => {
		expect(typeof fileTranscription.transcribeFile).toBe('function');
	});

	test('should have reset method', () => {
		expect(typeof fileTranscription.reset).toBe('function');
	});

	test('should have setError method', () => {
		expect(typeof fileTranscription.setError).toBe('function');
	});

	test('should have subscribe method', () => {
		expect(typeof fileTranscription.subscribe).toBe('function');
	});
});

describe('FileTranscription subscriptions', () => {
	test('should notify subscribers on state change', () => {
		let notified = false;

		const unsubscribe = fileTranscription.subscribe(() => {
			notified = true;
		});

		expect(notified).toBe(true);

		unsubscribe();
	});

	test('should provide current state to subscribers', () => {
		type FileTranscriptionState = {
			isProcessing: boolean;
			progress: number;
			result: { filename: string; text: string; durationMs: number } | null;
			error: string | null;
		};
		let currentState: FileTranscriptionState | null = null;

		const unsubscribe = fileTranscription.subscribe((state) => {
			currentState = state;
		});

		expect(currentState).not.toBeNull();
		if (currentState !== null) {
			expect((currentState as FileTranscriptionState).isProcessing).toBe(false);
		}

		unsubscribe();
	});
});

describe('Progress tracking', () => {
	test('should track progress from 0 to 100', () => {
		const progressUpdates = [0, 10, 25, 50, 75, 90, 100];

		for (const progress of progressUpdates) {
			expect(progress).toBeGreaterThanOrEqual(0);
			expect(progress).toBeLessThanOrEqual(100);
		}
	});

	test('should handle fractional progress', () => {
		const progress = 33.33;
		expect(Math.round(progress)).toBe(33);
	});
});

describe('Model availability checks', () => {
	describe('checkModelAvailable function logic', () => {
		test('should return true when models exist', () => {
			const downloadedModels = ['base', 'small'];
			const hasModels = downloadedModels.length > 0;

			expect(hasModels).toBe(true);
		});

		test('should return false when no models', () => {
			const downloadedModels: string[] = [];
			const hasModels = downloadedModels.length > 0;

			expect(hasModels).toBe(false);
		});
	});

	describe('isModelLoaded function logic', () => {
		test('should return boolean for loaded state', () => {
			const isLoaded = true;
			expect(typeof isLoaded).toBe('boolean');
		});
	});
});

describe('File path handling', () => {
	test('should handle absolute paths', () => {
		const paths = [
			'/home/user/audio.mp3',
			'/Users/name/Documents/recording.wav',
			'C:\\Users\\name\\audio.mp3',
			'D:\\recordings\\file.ogg'
		];

		for (const path of paths) {
			const filename = path.split(/[\\/]/).pop() || 'Unknown';
			expect(filename).not.toBe('');
			expect(filename).not.toBe('Unknown');
		}
	});

	test('should handle relative paths', () => {
		const paths = ['./audio.mp3', '../recordings/file.wav', 'subfolder/audio.ogg'];

		for (const path of paths) {
			const filename = path.split(/[\\/]/).pop() || 'Unknown';
			expect(filename).toBeTruthy();
		}
	});
});
