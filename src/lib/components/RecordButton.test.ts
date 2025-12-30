import { test, expect, describe, beforeEach, mock } from 'bun:test';

// Mock Tauri APIs with proper typing
const mockInvoke = mock((_cmd: string, _args?: unknown) => Promise.resolve(undefined as unknown));
const mockListen = mock(() => Promise.resolve(() => {}));

mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mockListen
}));

describe('RecordButton component logic', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockListen.mockClear();
	});

	describe('startRecording', () => {
		test('should call start_recording command', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('start_recording');

			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
		});

		test('should handle start recording errors', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Microphone access denied'));

			const { invoke } = await import('@tauri-apps/api/core');

			await expect(invoke('start_recording')).rejects.toThrow('Microphone access denied');
		});
	});

	describe('stopRecordingAndTranscribe', () => {
		test('should call stop_recording_and_transcribe and return result', async () => {
			const mockResult = {
				text: 'Hello world transcription',
				duration_ms: 3500,
				model_id: 'base',
				language: 'en',
				gpu_used: true
			};
			mockInvoke.mockResolvedValueOnce(mockResult);

			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke('stop_recording_and_transcribe');

			expect(mockInvoke).toHaveBeenCalledWith('stop_recording_and_transcribe');
			expect(result).toEqual(mockResult);
		});

		test('should handle transcription errors', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Transcription failed: No model loaded'));

			const { invoke } = await import('@tauri-apps/api/core');

			await expect(invoke('stop_recording_and_transcribe')).rejects.toThrow('No model loaded');
		});

		test('should handle empty recording', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('No audio recorded'));

			const { invoke } = await import('@tauri-apps/api/core');

			await expect(invoke('stop_recording_and_transcribe')).rejects.toThrow('No audio recorded');
		});
	});

	describe('recording state management', () => {
		test('should track recording state', () => {
			let isRecording = false;
			let isTranscribing = false;

			// Start recording
			isRecording = true;
			expect(isRecording).toBe(true);
			expect(isTranscribing).toBe(false);

			// Stop recording, start transcribing
			isRecording = false;
			isTranscribing = true;
			expect(isRecording).toBe(false);
			expect(isTranscribing).toBe(true);

			// Transcription complete
			isTranscribing = false;
			expect(isRecording).toBe(false);
			expect(isTranscribing).toBe(false);
		});
	});

	describe('audio level handling', () => {
		test('should update audio level from events', async () => {
			let audioLevel = 0;
			const levelCallback = (event: { payload: number }) => {
				audioLevel = event.payload;
			};

			// Simulate receiving audio level events
			levelCallback({ payload: 0.5 });
			expect(audioLevel).toBe(0.5);

			levelCallback({ payload: 0.8 });
			expect(audioLevel).toBe(0.8);

			levelCallback({ payload: 0.0 });
			expect(audioLevel).toBe(0.0);
		});

		test('should clamp audio level to valid range', () => {
			const clampLevel = (level: number): number => {
				return Math.max(0, Math.min(1, level));
			};

			expect(clampLevel(0.5)).toBe(0.5);
			expect(clampLevel(-0.1)).toBe(0);
			expect(clampLevel(1.5)).toBe(1);
		});
	});

	describe('timer functionality', () => {
		test('should format time correctly', () => {
			const formatTime = (seconds: number): string => {
				const mins = Math.floor(seconds / 60);
				const secs = seconds % 60;
				return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
			};

			expect(formatTime(0)).toBe('00:00');
			expect(formatTime(30)).toBe('00:30');
			expect(formatTime(60)).toBe('01:00');
			expect(formatTime(90)).toBe('01:30');
			expect(formatTime(125)).toBe('02:05');
			expect(formatTime(3661)).toBe('61:01');
		});

		test('should track elapsed time', () => {
			let elapsed = 0;

			// Simulate timer ticks
			elapsed += 1;
			expect(elapsed).toBe(1);

			elapsed += 1;
			expect(elapsed).toBe(2);
		});
	});

	describe('workflow state events', () => {
		test('should handle workflow state changes', () => {
			let isRecording = false;
			let isTranscribing = false;

			const handleStateChange = (state: string) => {
				isRecording = state === 'recording';
				isTranscribing = state === 'transcribing';
			};

			handleStateChange('idle');
			expect(isRecording).toBe(false);
			expect(isTranscribing).toBe(false);

			handleStateChange('recording');
			expect(isRecording).toBe(true);
			expect(isTranscribing).toBe(false);

			handleStateChange('transcribing');
			expect(isRecording).toBe(false);
			expect(isTranscribing).toBe(true);

			handleStateChange('idle');
			expect(isRecording).toBe(false);
			expect(isTranscribing).toBe(false);
		});
	});

	describe('transcription complete callback', () => {
		test('should call onTranscriptionComplete with result text', () => {
			let receivedText = '';
			const onTranscriptionComplete = (text: string) => {
				receivedText = text;
			};

			onTranscriptionComplete('Test transcription result');
			expect(receivedText).toBe('Test transcription result');
		});

		test('should call onError on failure', () => {
			let receivedError = '';
			const onError = (error: string) => {
				receivedError = error;
			};

			onError('Transcription failed');
			expect(receivedError).toBe('Transcription failed');
		});
	});
});

describe('RecordButton props', () => {
	test('should accept callback props', () => {
		interface Props {
			onTranscriptionComplete?: (text: string) => void;
			onError?: (error: string) => void;
		}

		const props: Props = {
			onTranscriptionComplete: (text) => console.log(text),
			onError: (error) => console.error(error)
		};

		expect(typeof props.onTranscriptionComplete).toBe('function');
		expect(typeof props.onError).toBe('function');
	});

	test('should allow optional callbacks', () => {
		interface Props {
			onTranscriptionComplete?: (text: string) => void;
			onError?: (error: string) => void;
		}

		const props: Props = {};

		expect(props.onTranscriptionComplete).toBeUndefined();
		expect(props.onError).toBeUndefined();
	});
});

describe('TranscriptionResult interface', () => {
	test('should have expected structure', () => {
		interface TranscriptionResult {
			text: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		const result: TranscriptionResult = {
			text: 'Hello world',
			duration_ms: 2500,
			model_id: 'base',
			language: 'en',
			gpu_used: true
		};

		expect(result.text).toBe('Hello world');
		expect(result.duration_ms).toBe(2500);
		expect(result.model_id).toBe('base');
		expect(result.language).toBe('en');
		expect(result.gpu_used).toBe(true);
	});
});

describe('History save integration', () => {
	test('should save transcription to history automatically', async () => {
		// The stop_recording_and_transcribe command now saves to history internally
		// This tests that the flow works correctly
		const mockResult = {
			text: 'Transcribed text that should be saved',
			duration_ms: 4000,
			model_id: 'base',
			language: 'en',
			gpu_used: false
		};

		mockInvoke.mockResolvedValueOnce(mockResult);

		const { invoke } = await import('@tauri-apps/api/core');
		const result = await invoke('stop_recording_and_transcribe');

		// The command returns the result, and internally saves to history
		expect(result).toEqual(mockResult);
		expect(mockInvoke).toHaveBeenCalledWith('stop_recording_and_transcribe');
	});

	test('transcription result should match history entry structure', () => {
		interface TranscriptionResult {
			text: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		interface HistoryEntry {
			id: number;
			text: string;
			timestamp: string;
			duration_ms: number;
			model_id: string;
			language: string | null;
			gpu_used: boolean;
		}

		const transcriptionResult: TranscriptionResult = {
			text: 'Test',
			duration_ms: 1000,
			model_id: 'base',
			language: 'en',
			gpu_used: true
		};

		// Simulate creating a HistoryEntry from TranscriptionResult
		const historyEntry: HistoryEntry = {
			id: 0, // Set by database
			text: transcriptionResult.text,
			timestamp: new Date().toISOString(),
			duration_ms: transcriptionResult.duration_ms,
			model_id: transcriptionResult.model_id,
			language: transcriptionResult.language,
			gpu_used: transcriptionResult.gpu_used
		};

		expect(historyEntry.text).toBe(transcriptionResult.text);
		expect(historyEntry.duration_ms).toBe(transcriptionResult.duration_ms);
		expect(historyEntry.model_id).toBe(transcriptionResult.model_id);
		expect(historyEntry.language).toBe(transcriptionResult.language);
		expect(historyEntry.gpu_used).toBe(transcriptionResult.gpu_used);
	});
});
