import { test, expect, describe, beforeEach, mock, afterEach, spyOn } from 'bun:test';

// Mock Tauri APIs
const mockInvoke = mock(() => Promise.resolve(undefined as unknown));
const mockWriteText = mock(() => Promise.resolve());
const mockOpen = mock(() => Promise.resolve(null as string | null | { path: string }));

// Store event listeners for testing
type EventCallback = (event: { payload: string | unknown }) => void | Promise<void>;
const eventListeners: Map<string, EventCallback[]> = new Map();
const mockUnlistenFns: Array<() => void> = [];

const mockListen = mock(async (event: string, callback: EventCallback) => {
	if (!eventListeners.has(event)) {
		eventListeners.set(event, []);
	}
	eventListeners.get(event)!.push(callback);
	const unlisten = () => {
		const listeners = eventListeners.get(event);
		if (listeners) {
			const idx = listeners.indexOf(callback);
			if (idx > -1) listeners.splice(idx, 1);
		}
	};
	mockUnlistenFns.push(unlisten);
	return unlisten;
});

// Helper to emit events in tests
function emitEvent(event: string, payload: unknown) {
	const listeners = eventListeners.get(event);
	if (listeners) {
		listeners.forEach((cb) => cb({ payload }));
	}
}

// Mock modules
mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke,
	transformCallback: mock(() => 0)
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mockListen
}));

mock.module('@tauri-apps/plugin-dialog', () => ({
	open: mockOpen
}));

mock.module('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: mockWriteText
}));

// Import the module once - tests must work with shared state
import {
	startRecording,
	stopRecording,
	initTrayEventListeners,
	cleanupTrayEventListeners
} from './trayEvents';

describe('trayEvents service', () => {
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let consoleLogSpy: ReturnType<typeof spyOn>;

	beforeEach(async () => {
		// Clear all mocks
		mockInvoke.mockClear();
		mockListen.mockClear();
		mockWriteText.mockClear();
		mockOpen.mockClear();

		// Clear event listeners
		eventListeners.clear();
		mockUnlistenFns.length = 0;

		// Spy on console methods
		consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
		consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		consoleLogSpy.mockRestore();
	});

	describe('startRecording', () => {
		test('should call invoke to start recording when not already recording', async () => {
			// Ensure we're not recording by calling stopRecording first (resets isRecording)
			mockInvoke.mockResolvedValue(undefined);
			await stopRecording(); // This will set isRecording to false if not recording
			mockInvoke.mockClear();

			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce(undefined);

			await startRecording();

			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
		});

		test('should show recording indicator after starting', async () => {
			// Reset by stopping first
			mockInvoke.mockResolvedValue(undefined);
			await stopRecording();
			mockInvoke.mockClear();

			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce(undefined);

			await startRecording();

			expect(mockInvoke).toHaveBeenCalledWith('show_recording_indicator');
		});

		test('should not start recording if already recording', async () => {
			mockInvoke.mockResolvedValue(undefined);

			// Ensure we're in a recording state
			await stopRecording();
			mockInvoke.mockClear();
			await startRecording();
			// Verify calls were made for the first recording
			expect(mockInvoke.mock.calls.length).toBeGreaterThan(0);

			// Try to start second recording
			mockInvoke.mockClear();
			await startRecording();

			// Should not have made any calls
			expect(mockInvoke.mock.calls.length).toBe(0);
		});

		test('should handle start recording error gracefully', async () => {
			// Reset state first
			mockInvoke.mockResolvedValue(undefined);
			await stopRecording();
			mockInvoke.mockClear();

			mockInvoke.mockRejectedValueOnce(new Error('Audio device not available'));

			await startRecording();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to start recording:',
				expect.any(Error)
			);
		});
	});

	describe('stopRecording', () => {
		test('should log message if not currently recording', async () => {
			// Make sure we're not recording
			mockInvoke.mockResolvedValue(undefined);
			await stopRecording(); // Reset to not recording
			consoleLogSpy.mockClear();

			await stopRecording();

			expect(consoleLogSpy).toHaveBeenCalledWith('Not currently recording');
		});

		test('should hide recording indicator when stopping', async () => {
			mockInvoke.mockResolvedValue(undefined);

			// Start recording first
			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();

			// Mock transcription result
			mockInvoke.mockResolvedValueOnce(undefined); // hide_recording_indicator
			mockInvoke.mockResolvedValueOnce({ text: 'Hello world' }); // stop_recording_and_transcribe

			await stopRecording();

			expect(mockInvoke).toHaveBeenCalledWith('hide_recording_indicator');
		});

		test('should call stop_recording_and_transcribe', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();

			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce({ text: 'Transcribed text' });

			await stopRecording();

			expect(mockInvoke).toHaveBeenCalledWith('stop_recording_and_transcribe');
		});

		test('should copy transcription to clipboard', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();

			const transcribedText = 'This is my transcription';
			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce({ text: transcribedText });

			await stopRecording();

			expect(mockWriteText).toHaveBeenCalledWith(transcribedText);
		});

		test('should handle empty transcription result', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();
			mockWriteText.mockClear();

			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce({ text: '' });

			await stopRecording();

			// Should not copy empty text
			expect(mockWriteText).not.toHaveBeenCalled();
		});

		test('should handle null transcription result', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();
			mockWriteText.mockClear();

			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce(null);

			await stopRecording();

			expect(mockWriteText).not.toHaveBeenCalled();
		});

		test('should handle stop recording error gracefully', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockClear();

			mockInvoke.mockRejectedValueOnce(new Error('Transcription failed'));

			await stopRecording();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to stop and transcribe:',
				expect.any(Error)
			);
		});

		test('should reset isRecording flag on error and allow new recording', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await stopRecording(); // Reset
			await startRecording();
			mockInvoke.mockRejectedValueOnce(new Error('Error'));

			await stopRecording();

			// Should be able to start recording again
			mockInvoke.mockClear();
			mockInvoke.mockResolvedValue(undefined);
			await startRecording();

			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
		});
	});

	describe('initTrayEventListeners', () => {
		test('should register transcription-complete listener', async () => {
			await initTrayEventListeners();

			expect(mockListen).toHaveBeenCalledWith(
				'tray://transcription-complete',
				expect.any(Function)
			);

			cleanupTrayEventListeners();
		});

		test('should register transcription-error listener', async () => {
			await initTrayEventListeners();

			expect(mockListen).toHaveBeenCalledWith('tray://transcription-error', expect.any(Function));

			cleanupTrayEventListeners();
		});

		test('should register recording-started listener', async () => {
			await initTrayEventListeners();

			expect(mockListen).toHaveBeenCalledWith('tray://recording-started', expect.any(Function));

			cleanupTrayEventListeners();
		});

		test('should register transcribe-file listener', async () => {
			await initTrayEventListeners();

			expect(mockListen).toHaveBeenCalledWith('tray://transcribe-file', expect.any(Function));

			cleanupTrayEventListeners();
		});

		test('should copy text on transcription-complete event', async () => {
			await initTrayEventListeners();

			const transcribedText = 'Event transcription';
			emitEvent('tray://transcription-complete', transcribedText);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockWriteText).toHaveBeenCalledWith(transcribedText);

			cleanupTrayEventListeners();
		});

		test('should log error on transcription-error event', async () => {
			await initTrayEventListeners();

			const errorMessage = 'Whisper model failed';
			emitEvent('tray://transcription-error', errorMessage);

			expect(consoleErrorSpy).toHaveBeenCalledWith('Transcription error:', errorMessage);

			cleanupTrayEventListeners();
		});

		test('should show indicator on recording-started event', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await initTrayEventListeners();

			emitEvent('tray://recording-started', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockInvoke).toHaveBeenCalledWith('show_recording_indicator');

			cleanupTrayEventListeners();
		});

		test('should handle clipboard write error on transcription-complete', async () => {
			mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'));

			await initTrayEventListeners();

			emitEvent('tray://transcription-complete', 'Some text');

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to copy transcription to clipboard:',
				expect.any(Error)
			);

			cleanupTrayEventListeners();
		});

		test('should handle show indicator error on recording-started', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Indicator window failed'));

			await initTrayEventListeners();

			emitEvent('tray://recording-started', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to show indicator:',
				expect.any(Error)
			);

			cleanupTrayEventListeners();
		});
	});

	describe('cleanupTrayEventListeners', () => {
		test('should log cleanup message', async () => {
			await initTrayEventListeners();

			cleanupTrayEventListeners();

			expect(consoleLogSpy).toHaveBeenCalledWith('Tray event listeners cleaned up');
		});

		test('should have registered listeners before cleanup', async () => {
			await initTrayEventListeners();

			// Verify listeners were added
			expect(eventListeners.size).toBeGreaterThan(0);

			cleanupTrayEventListeners();
		});

		test('should handle cleanup when no listeners registered', () => {
			// Should not throw when cleaning up with empty unlisteners array
			expect(() => cleanupTrayEventListeners()).not.toThrow();
			expect(consoleLogSpy).toHaveBeenCalledWith('Tray event listeners cleaned up');
		});
	});

	describe('transcribeFile (via tray event)', () => {
		test('should open file dialog with audio filters', async () => {
			mockOpen.mockResolvedValueOnce(null);

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockOpen).toHaveBeenCalledWith({
				multiple: false,
				filters: [
					{
						name: 'Audio Files',
						extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm']
					}
				]
			});

			cleanupTrayEventListeners();
		});

		test('should log message when no file selected', async () => {
			mockOpen.mockResolvedValueOnce(null);

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(consoleLogSpy).toHaveBeenCalledWith('No file selected');

			cleanupTrayEventListeners();
		});

		test('should transcribe selected file (string path)', async () => {
			const filePath = '/path/to/audio.wav';
			mockOpen.mockResolvedValueOnce(filePath);
			mockInvoke.mockResolvedValueOnce({ text: 'File transcription' });

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', { filePath });

			cleanupTrayEventListeners();
		});

		test('should transcribe selected file (object path)', async () => {
			const filePath = '/path/to/audio.mp3';
			mockOpen.mockResolvedValueOnce({ path: filePath });
			mockInvoke.mockResolvedValueOnce({ text: 'Object path transcription' });

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', { filePath });

			cleanupTrayEventListeners();
		});

		test('should copy file transcription to clipboard', async () => {
			const filePath = '/path/to/audio.flac';
			const transcribedText = 'File transcription result';
			mockOpen.mockResolvedValueOnce(filePath);
			mockInvoke.mockResolvedValueOnce({ text: transcribedText });

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockWriteText).toHaveBeenCalledWith(transcribedText);

			cleanupTrayEventListeners();
		});

		test('should handle file transcription error', async () => {
			mockOpen.mockResolvedValueOnce('/path/to/corrupt.wav');
			mockInvoke.mockRejectedValueOnce(new Error('Invalid audio format'));

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to transcribe file:',
				expect.any(Error)
			);

			cleanupTrayEventListeners();
		});

		test('should not copy empty transcription from file', async () => {
			mockOpen.mockResolvedValueOnce('/path/to/silent.wav');
			mockInvoke.mockResolvedValueOnce({ text: '' });
			mockWriteText.mockClear();

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should not copy empty text
			expect(mockWriteText).not.toHaveBeenCalled();

			cleanupTrayEventListeners();
		});

		test('should handle null result from file transcription', async () => {
			mockOpen.mockResolvedValueOnce('/path/to/audio.ogg');
			mockInvoke.mockResolvedValueOnce(null);
			mockWriteText.mockClear();

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockWriteText).not.toHaveBeenCalled();

			cleanupTrayEventListeners();
		});

		test('should log the file path being transcribed', async () => {
			const filePath = '/path/to/my-audio.wav';
			mockOpen.mockResolvedValueOnce(filePath);
			mockInvoke.mockResolvedValueOnce({ text: 'Transcription' });

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(consoleLogSpy).toHaveBeenCalledWith('Transcribing file:', filePath);

			cleanupTrayEventListeners();
		});

		test('should log success message after file transcription', async () => {
			const transcribedText = 'Audio content transcribed';
			mockOpen.mockResolvedValueOnce('/path/to/audio.wav');
			mockInvoke.mockResolvedValueOnce({ text: transcribedText });

			await initTrayEventListeners();

			emitEvent('tray://transcribe-file', null);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'File transcription copied to clipboard:',
				transcribedText
			);

			cleanupTrayEventListeners();
		});
	});

	describe('module exports', () => {
		test('should export startRecording function', () => {
			expect(typeof startRecording).toBe('function');
		});

		test('should export stopRecording function', () => {
			expect(typeof stopRecording).toBe('function');
		});

		test('should export initTrayEventListeners function', () => {
			expect(typeof initTrayEventListeners).toBe('function');
		});

		test('should export cleanupTrayEventListeners function', () => {
			expect(typeof cleanupTrayEventListeners).toBe('function');
		});
	});

	describe('recording state management', () => {
		test('should set isRecording to true via tray://recording-started event', async () => {
			mockInvoke.mockResolvedValue(undefined);

			// Reset state
			await stopRecording();
			mockInvoke.mockClear();

			await initTrayEventListeners();

			// Emit recording-started event
			emitEvent('tray://recording-started', null);
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Now stopRecording should work (not say "Not currently recording")
			consoleLogSpy.mockClear();
			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce({ text: 'test' });
			await stopRecording();

			// Should have called hide_recording_indicator (meaning isRecording was true)
			expect(mockInvoke).toHaveBeenCalledWith('hide_recording_indicator');

			cleanupTrayEventListeners();
		});

		test('should complete full recording workflow', async () => {
			mockInvoke.mockResolvedValue(undefined);

			// Reset state
			await stopRecording();
			mockInvoke.mockClear();
			mockWriteText.mockClear();

			// Start recording
			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce(undefined);
			await startRecording();

			// Verify start_recording was called
			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
			expect(mockInvoke).toHaveBeenCalledWith('show_recording_indicator');

			// Stop recording and transcribe
			mockInvoke.mockClear();
			const transcription = 'Full workflow transcription';
			mockInvoke.mockResolvedValueOnce(undefined);
			mockInvoke.mockResolvedValueOnce({ text: transcription });

			await stopRecording();

			expect(mockInvoke).toHaveBeenCalledWith('hide_recording_indicator');
			expect(mockInvoke).toHaveBeenCalledWith('stop_recording_and_transcribe');
			expect(mockWriteText).toHaveBeenCalledWith(transcription);
		});
	});
});
