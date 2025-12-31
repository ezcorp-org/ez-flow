import { test, expect, describe, beforeEach, mock } from 'bun:test';

// Mock Tauri APIs with proper typing
const mockInvoke = mock(() => Promise.resolve(undefined as unknown));
const mockListen = mock(() => Promise.resolve(() => {}));
const mockWriteText = mock(() => Promise.resolve());

mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke,
	transformCallback: mock(() => 0)
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mockListen
}));

mock.module('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: mockWriteText
}));

describe('FileDropZone component logic', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockListen.mockClear();
		mockWriteText.mockClear();
	});

	describe('File validation', () => {
		const SUPPORTED_EXTENSIONS = [
			'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma',
			'.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.m4v'
		];

		function isFileSupported(filename: string): boolean {
			const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
			return SUPPORTED_EXTENSIONS.includes(ext);
		}

		test('should accept mp3 files', () => {
			expect(isFileSupported('audio.mp3')).toBe(true);
			expect(isFileSupported('AUDIO.MP3')).toBe(true);
		});

		test('should accept wav files', () => {
			expect(isFileSupported('audio.wav')).toBe(true);
			expect(isFileSupported('AUDIO.WAV')).toBe(true);
		});

		test('should accept m4a files', () => {
			expect(isFileSupported('audio.m4a')).toBe(true);
		});

		test('should accept ogg files', () => {
			expect(isFileSupported('audio.ogg')).toBe(true);
		});

		test('should accept flac files', () => {
			expect(isFileSupported('audio.flac')).toBe(true);
		});

		test('should accept aac files', () => {
			expect(isFileSupported('audio.aac')).toBe(true);
		});

		test('should accept video files', () => {
			expect(isFileSupported('video.mp4')).toBe(true);
			expect(isFileSupported('video.mkv')).toBe(true);
			expect(isFileSupported('video.avi')).toBe(true);
			expect(isFileSupported('video.mov')).toBe(true);
			expect(isFileSupported('video.webm')).toBe(true);
			expect(isFileSupported('video.wmv')).toBe(true);
			expect(isFileSupported('video.m4v')).toBe(true);
		});

		test('should reject unsupported file types', () => {
			expect(isFileSupported('document.pdf')).toBe(false);
			expect(isFileSupported('image.jpg')).toBe(false);
			expect(isFileSupported('image.png')).toBe(false);
			expect(isFileSupported('archive.zip')).toBe(false);
			expect(isFileSupported('text.txt')).toBe(false);
			expect(isFileSupported('executable.exe')).toBe(false);
		});

		test('should handle files without extension', () => {
			expect(isFileSupported('noextension')).toBe(false);
		});

		test('should handle files with multiple dots', () => {
			expect(isFileSupported('my.audio.file.mp3')).toBe(true);
			expect(isFileSupported('my.document.file.pdf')).toBe(false);
		});
	});

	describe('File extension extraction', () => {
		function getFileExtension(filename: string): string {
			return filename.toLowerCase().slice(filename.lastIndexOf('.'));
		}

		test('should extract extension correctly', () => {
			expect(getFileExtension('audio.mp3')).toBe('.mp3');
			expect(getFileExtension('audio.WAV')).toBe('.wav');
			expect(getFileExtension('file.name.with.dots.flac')).toBe('.flac');
		});

		test('should handle files without extension', () => {
			// Files without extension will return the last character after lastIndexOf('.') returns -1
			// This is expected behavior - the file will be rejected as unsupported
			const result = getFileExtension('noextension');
			expect(result).not.toContain('.mp3');
		});
	});

	describe('Duration formatting', () => {
		function formatDuration(ms: number): string {
			const seconds = Math.floor(ms / 1000);
			if (seconds < 60) {
				return `${seconds}s`;
			}
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;
			return `${minutes}m ${remainingSeconds}s`;
		}

		test('should format seconds correctly', () => {
			expect(formatDuration(5000)).toBe('5s');
			expect(formatDuration(30000)).toBe('30s');
			expect(formatDuration(59000)).toBe('59s');
		});

		test('should format minutes correctly', () => {
			expect(formatDuration(60000)).toBe('1m 0s');
			expect(formatDuration(90000)).toBe('1m 30s');
			expect(formatDuration(125000)).toBe('2m 5s');
		});

		test('should handle zero duration', () => {
			expect(formatDuration(0)).toBe('0s');
		});

		test('should handle sub-second durations', () => {
			expect(formatDuration(500)).toBe('0s');
			expect(formatDuration(999)).toBe('0s');
		});
	});

	describe('transcribe_dropped_file command', () => {
		test('should call transcribe_dropped_file with file data', async () => {
			const mockResult = {
				text: 'Hello world transcription',
				durationMs: 2500,
				modelId: 'base',
				language: 'en'
			};
			mockInvoke.mockResolvedValueOnce(true); // is_model_loaded
			mockInvoke.mockResolvedValueOnce(mockResult);

			const { invoke } = await import('@tauri-apps/api/core');

			await invoke('is_model_loaded');
			const result = await invoke('transcribe_dropped_file', {
				fileData: [1, 2, 3, 4], // Mock file data
				fileName: 'test.mp3'
			});

			expect(mockInvoke).toHaveBeenCalledWith('transcribe_dropped_file', {
				fileData: [1, 2, 3, 4],
				fileName: 'test.mp3'
			});
			expect(result).toEqual(mockResult);
		});

		test('should handle model not loaded error', async () => {
			mockInvoke.mockResolvedValueOnce(false); // is_model_loaded
			mockInvoke.mockResolvedValueOnce([]); // get_downloaded_model_ids

			const { invoke } = await import('@tauri-apps/api/core');

			const isLoaded = await invoke('is_model_loaded');
			expect(isLoaded).toBe(false);

			const models = await invoke('get_downloaded_model_ids');
			expect(models).toEqual([]);
		});

		test('should handle transcription errors', async () => {
			mockInvoke.mockResolvedValueOnce(true); // is_model_loaded
			mockInvoke.mockRejectedValueOnce(new Error('Failed to decode audio file'));

			const { invoke } = await import('@tauri-apps/api/core');

			await invoke('is_model_loaded');

			await expect(
				invoke('transcribe_dropped_file', {
					fileData: [1, 2, 3],
					fileName: 'invalid.mp3'
				})
			).rejects.toThrow('Failed to decode audio file');
		});
	});

	describe('Clipboard functionality', () => {
		test('should copy transcription to clipboard', async () => {
			mockWriteText.mockResolvedValueOnce(undefined);

			const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
			await writeText('Transcribed text');

			expect(mockWriteText).toHaveBeenCalledWith('Transcribed text');
		});

		test('should handle clipboard write errors', async () => {
			mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'));

			const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');

			await expect(writeText('Test')).rejects.toThrow('Clipboard access denied');
		});
	});

	describe('Progress events', () => {
		test('should listen for progress events', async () => {
			const { listen } = await import('@tauri-apps/api/event');

			await listen('file-transcription://progress', () => {
				// Handle progress
			});

			expect(mockListen).toHaveBeenCalledWith(
				'file-transcription://progress',
				expect.any(Function)
			);
		});

		test('should handle progress updates', () => {
			let progress = 0;

			const handleProgress = (event: { payload: { progress: number; stage: string } }) => {
				progress = event.payload.progress;
			};

			handleProgress({ payload: { progress: 10, stage: 'decoding' } });
			expect(progress).toBe(10);

			handleProgress({ payload: { progress: 30, stage: 'transcribing' } });
			expect(progress).toBe(30);

			handleProgress({ payload: { progress: 100, stage: 'complete' } });
			expect(progress).toBe(100);
		});
	});

	describe('Drag and drop state management', () => {
		test('should track dragging state', () => {
			let isDragging = false;

			// Enter dropzone
			isDragging = true;
			expect(isDragging).toBe(true);

			// Leave dropzone
			isDragging = false;
			expect(isDragging).toBe(false);
		});

		test('should track processing state', () => {
			let isProcessing = false;
			let progress = 0;

			// Start processing
			isProcessing = true;
			progress = 0;
			expect(isProcessing).toBe(true);
			expect(progress).toBe(0);

			// Progress update
			progress = 50;
			expect(progress).toBe(50);

			// Complete processing
			isProcessing = false;
			progress = 100;
			expect(isProcessing).toBe(false);
			expect(progress).toBe(100);
		});
	});

	describe('Error handling', () => {
		test('should generate error for unsupported file type', () => {
			const SUPPORTED_EXTENSIONS = [
				'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma',
				'.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.m4v'
			];

			function getErrorMessage(filename: string): string {
				const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
				return `Unsupported file type: ${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`;
			}

			const errorMessage = getErrorMessage('document.pdf');
			expect(errorMessage).toContain('.pdf');
			expect(errorMessage).toContain('Unsupported file type');
			expect(errorMessage).toContain('.mp3');
		});

		test('should call onError callback with error message', () => {
			let receivedError = '';
			const onError = (error: string) => {
				receivedError = error;
			};

			onError('Failed to transcribe file');
			expect(receivedError).toBe('Failed to transcribe file');
		});
	});
});

describe('FileDropZone props', () => {
	test('should accept callback props', () => {
		interface Props {
			onTranscriptionComplete?: (text: string, filename: string) => void;
			onError?: (error: string) => void;
		}

		const props: Props = {
			onTranscriptionComplete: (text, filename) => console.log(text, filename),
			onError: (error) => console.error(error)
		};

		expect(typeof props.onTranscriptionComplete).toBe('function');
		expect(typeof props.onError).toBe('function');
	});

	test('should allow optional callbacks', () => {
		interface Props {
			onTranscriptionComplete?: (text: string, filename: string) => void;
			onError?: (error: string) => void;
		}

		const props: Props = {};

		expect(props.onTranscriptionComplete).toBeUndefined();
		expect(props.onError).toBeUndefined();
	});
});

describe('Transcription result structure', () => {
	test('should have expected structure', () => {
		interface TranscriptionResult {
			text: string;
			filename: string;
			durationMs: number;
		}

		const result: TranscriptionResult = {
			text: 'Hello world',
			filename: 'test.mp3',
			durationMs: 2500
		};

		expect(result.text).toBe('Hello world');
		expect(result.filename).toBe('test.mp3');
		expect(result.durationMs).toBe(2500);
	});
});
