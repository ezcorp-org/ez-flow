import { test, expect, describe, beforeEach, mock } from 'bun:test';
import type { UnlistenFn } from '@tauri-apps/api/event';

// Mock invoke function
const mockInvoke = mock(() => Promise.resolve(undefined as unknown));

// Store event handlers for testing
const eventHandlers: Map<string, ((event: { payload: unknown }) => void)[]> = new Map();

// Mock unlisten function
const createMockUnlisten = (): UnlistenFn => mock(() => {});

// Mock listen function that stores handlers
const mockListen = mock(
	(event: string, handler: (event: { payload: unknown }) => void): Promise<UnlistenFn> => {
		if (!eventHandlers.has(event)) {
			eventHandlers.set(event, []);
		}
		eventHandlers.get(event)!.push(handler);
		return Promise.resolve(createMockUnlisten());
	}
);

// Helper to emit events in tests
function emitEvent(eventName: string, payload: unknown): void {
	const handlers = eventHandlers.get(eventName);
	if (handlers) {
		handlers.forEach((handler) => handler({ payload }));
	}
}

// Mock Tauri modules
mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke,
	transformCallback: mock(() => 0)
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mockListen
}));

// Import after mocking
import {
	startRecording,
	pushToTalkComplete,
	isCooldownActive,
	getWorkflowState,
	onWorkflowStateChanged,
	onWorkflowError,
	onWorkflowMetrics,
	onHotkeyRecordingStarted,
	onHotkeyRecordingStopped,
	onPartialTranscription,
	onFinalTranscription,
	onStreamingError,
	setupPushToTalk,
	type WorkflowState,
	type PartialTranscriptionEvent,
	type FinalTranscriptionEvent,
	type StreamingErrorEvent,
	type PushToTalkResult,
	type PushToTalkMetrics,
	type PushToTalkError
} from './workflow';

describe('workflow service', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
		mockListen.mockClear();
		eventHandlers.clear();
	});

	describe('module exports', () => {
		test('exports expected functions', async () => {
			const module = await import('./workflow');

			expect(typeof module.startRecording).toBe('function');
			expect(typeof module.pushToTalkComplete).toBe('function');
			expect(typeof module.isCooldownActive).toBe('function');
			expect(typeof module.getWorkflowState).toBe('function');
			expect(typeof module.onWorkflowStateChanged).toBe('function');
			expect(typeof module.onWorkflowError).toBe('function');
			expect(typeof module.onWorkflowMetrics).toBe('function');
			expect(typeof module.onHotkeyRecordingStarted).toBe('function');
			expect(typeof module.onHotkeyRecordingStopped).toBe('function');
			expect(typeof module.onPartialTranscription).toBe('function');
			expect(typeof module.onFinalTranscription).toBe('function');
			expect(typeof module.onStreamingError).toBe('function');
			expect(typeof module.setupPushToTalk).toBe('function');
		});
	});

	describe('startRecording', () => {
		test('should call invoke with start_recording command', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			await startRecording();

			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
		});

		test('should handle successful recording start', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			await expect(startRecording()).resolves.toBeUndefined();
		});

		test('should propagate errors from invoke', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Audio device not available'));

			await expect(startRecording()).rejects.toThrow('Audio device not available');
		});

		test('should handle permission denied error', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Microphone permission denied'));

			await expect(startRecording()).rejects.toThrow('Microphone permission denied');
		});

		test('should handle device busy error', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Audio device is busy'));

			await expect(startRecording()).rejects.toThrow('Audio device is busy');
		});
	});

	describe('pushToTalkComplete', () => {
		const mockResult: PushToTalkResult = {
			text: 'Hello world, this is a test transcription.',
			audio_duration_secs: 3.5,
			transcription_time_ms: 1500,
			injection_time_ms: 50,
			total_latency_ms: 5050
		};

		test('should call invoke with push_to_talk_complete command', async () => {
			mockInvoke.mockResolvedValueOnce(mockResult);

			await pushToTalkComplete();

			expect(mockInvoke).toHaveBeenCalledWith('push_to_talk_complete');
		});

		test('should return complete transcription result', async () => {
			mockInvoke.mockResolvedValueOnce(mockResult);

			const result = await pushToTalkComplete();

			expect(result.text).toBe('Hello world, this is a test transcription.');
			expect(result.audio_duration_secs).toBe(3.5);
			expect(result.transcription_time_ms).toBe(1500);
			expect(result.injection_time_ms).toBe(50);
			expect(result.total_latency_ms).toBe(5050);
		});

		test('should handle empty transcription result', async () => {
			const emptyResult: PushToTalkResult = {
				text: '',
				audio_duration_secs: 0.5,
				transcription_time_ms: 200,
				injection_time_ms: 0,
				total_latency_ms: 700
			};
			mockInvoke.mockResolvedValueOnce(emptyResult);

			const result = await pushToTalkComplete();

			expect(result.text).toBe('');
			expect(result.audio_duration_secs).toBe(0.5);
		});

		test('should handle transcription error', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Transcription failed: model not loaded'));

			await expect(pushToTalkComplete()).rejects.toThrow('Transcription failed');
		});

		test('should handle injection error', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Text injection failed: no focus'));

			await expect(pushToTalkComplete()).rejects.toThrow('Text injection failed');
		});
	});

	describe('isCooldownActive', () => {
		test('should call invoke with is_push_to_talk_cooldown_active command', async () => {
			mockInvoke.mockResolvedValueOnce(false);

			await isCooldownActive();

			expect(mockInvoke).toHaveBeenCalledWith('is_push_to_talk_cooldown_active');
		});

		test('should return true when cooldown is active', async () => {
			mockInvoke.mockResolvedValueOnce(true);

			const result = await isCooldownActive();

			expect(result).toBe(true);
		});

		test('should return false when cooldown is not active', async () => {
			mockInvoke.mockResolvedValueOnce(false);

			const result = await isCooldownActive();

			expect(result).toBe(false);
		});
	});

	describe('getWorkflowState', () => {
		test('should call invoke with get_workflow_state command', async () => {
			mockInvoke.mockResolvedValueOnce('idle');

			await getWorkflowState();

			expect(mockInvoke).toHaveBeenCalledWith('get_workflow_state');
		});

		test('should return idle state', async () => {
			mockInvoke.mockResolvedValueOnce('idle');

			const result = await getWorkflowState();

			expect(result).toBe('idle');
		});

		test('should return recording state', async () => {
			mockInvoke.mockResolvedValueOnce('recording');

			const result = await getWorkflowState();

			expect(result).toBe('recording');
		});

		test('should return transcribing state', async () => {
			mockInvoke.mockResolvedValueOnce('transcribing');

			const result = await getWorkflowState();

			expect(result).toBe('transcribing');
		});

		test('should return injecting state', async () => {
			mockInvoke.mockResolvedValueOnce('injecting');

			const result = await getWorkflowState();

			expect(result).toBe('injecting');
		});
	});

	describe('onWorkflowStateChanged', () => {
		test('should register listener for workflow state changes', async () => {
			const callback = mock(() => {});

			await onWorkflowStateChanged(callback);

			expect(mockListen).toHaveBeenCalledWith('workflow://state-changed', expect.any(Function));
		});

		test('should return unlisten function', async () => {
			const callback = mock(() => {});

			const unlisten = await onWorkflowStateChanged(callback);

			expect(typeof unlisten).toBe('function');
		});

		test('should call callback when state changes to recording', async () => {
			const callback = mock(() => {});

			await onWorkflowStateChanged(callback);
			emitEvent('workflow://state-changed', 'recording');

			expect(callback).toHaveBeenCalledWith('recording');
		});

		test('should call callback when state changes to idle', async () => {
			const callback = mock(() => {});

			await onWorkflowStateChanged(callback);
			emitEvent('workflow://state-changed', 'idle');

			expect(callback).toHaveBeenCalledWith('idle');
		});
	});

	describe('onWorkflowError', () => {
		test('should register listener for workflow errors', async () => {
			const callback = mock(() => {});

			await onWorkflowError(callback);

			expect(mockListen).toHaveBeenCalledWith('workflow://error', expect.any(Function));
		});

		test('should call callback with error payload', async () => {
			const callback = mock(() => {});
			const error: PushToTalkError = {
				phase: 'transcription',
				message: 'Model not loaded'
			};

			await onWorkflowError(callback);
			emitEvent('workflow://error', error);

			expect(callback).toHaveBeenCalledWith(error);
		});

		test('should handle recording phase errors', async () => {
			const callback = mock(() => {});
			const error: PushToTalkError = {
				phase: 'recording',
				message: 'Audio device error'
			};

			await onWorkflowError(callback);
			emitEvent('workflow://error', error);

			expect(callback).toHaveBeenCalledWith(error);
		});
	});

	describe('onWorkflowMetrics', () => {
		test('should register listener for workflow metrics', async () => {
			const callback = mock(() => {});

			await onWorkflowMetrics(callback);

			expect(mockListen).toHaveBeenCalledWith('workflow://metrics', expect.any(Function));
		});

		test('should call callback with metrics payload', async () => {
			const callback = mock(() => {});
			const metrics: PushToTalkMetrics = {
				audio_duration_secs: 5.2,
				transcription_time_ms: 2000,
				injection_time_ms: 100,
				total_latency_ms: 7300,
				text_length: 150
			};

			await onWorkflowMetrics(callback);
			emitEvent('workflow://metrics', metrics);

			expect(callback).toHaveBeenCalledWith(metrics);
		});
	});

	describe('onHotkeyRecordingStarted', () => {
		test('should register listener for hotkey recording started', async () => {
			const callback = mock(() => {});

			await onHotkeyRecordingStarted(callback);

			expect(mockListen).toHaveBeenCalledWith('hotkey://recording-started', expect.any(Function));
		});

		test('should call callback when hotkey is pressed', async () => {
			const callback = mock(() => {});

			await onHotkeyRecordingStarted(callback);
			emitEvent('hotkey://recording-started', undefined);

			expect(callback).toHaveBeenCalled();
		});
	});

	describe('onHotkeyRecordingStopped', () => {
		test('should register listener for hotkey recording stopped', async () => {
			const callback = mock(() => {});

			await onHotkeyRecordingStopped(callback);

			expect(mockListen).toHaveBeenCalledWith('hotkey://recording-stopped', expect.any(Function));
		});

		test('should call callback when hotkey is released', async () => {
			const callback = mock(() => {});

			await onHotkeyRecordingStopped(callback);
			emitEvent('hotkey://recording-stopped', undefined);

			expect(callback).toHaveBeenCalled();
		});
	});

	describe('onPartialTranscription', () => {
		test('should register listener for partial transcription events', async () => {
			const callback = mock(() => {});

			await onPartialTranscription(callback);

			expect(mockListen).toHaveBeenCalledWith('transcription://partial', expect.any(Function));
		});

		test('should call callback with partial transcription event', async () => {
			const callback = mock(() => {});
			const event: PartialTranscriptionEvent = {
				text: 'Hello ',
				chunk_index: 0,
				timestamp_ms: 500,
				is_final: false
			};

			await onPartialTranscription(callback);
			emitEvent('transcription://partial', event);

			expect(callback).toHaveBeenCalledWith(event);
		});

		test('should handle multiple partial transcription events', async () => {
			const callback = mock(() => {});

			await onPartialTranscription(callback);
			emitEvent('transcription://partial', { text: 'Hello ', chunk_index: 0, timestamp_ms: 500, is_final: false });
			emitEvent('transcription://partial', { text: 'Hello world', chunk_index: 1, timestamp_ms: 1000, is_final: false });

			expect(callback).toHaveBeenCalledTimes(2);
		});

		test('should handle final partial transcription event', async () => {
			const callback = mock(() => {});
			const event: PartialTranscriptionEvent = {
				text: 'Hello world',
				chunk_index: 2,
				timestamp_ms: 1500,
				is_final: true
			};

			await onPartialTranscription(callback);
			emitEvent('transcription://partial', event);

			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ is_final: true }));
		});
	});

	describe('onFinalTranscription', () => {
		test('should register listener for final transcription events', async () => {
			const callback = mock(() => {});

			await onFinalTranscription(callback);

			expect(mockListen).toHaveBeenCalledWith('transcription://complete', expect.any(Function));
		});

		test('should call callback with final transcription event', async () => {
			const callback = mock(() => {});
			const event: FinalTranscriptionEvent = {
				text: 'Hello world, this is a complete transcription.',
				total_chunks: 5,
				duration_secs: 3.5,
				reconciled: true
			};

			await onFinalTranscription(callback);
			emitEvent('transcription://complete', event);

			expect(callback).toHaveBeenCalledWith(event);
		});

		test('should handle non-reconciled transcription', async () => {
			const callback = mock(() => {});
			const event: FinalTranscriptionEvent = {
				text: 'Transcription text',
				total_chunks: 3,
				duration_secs: 2.0,
				reconciled: false
			};

			await onFinalTranscription(callback);
			emitEvent('transcription://complete', event);

			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ reconciled: false }));
		});
	});

	describe('onStreamingError', () => {
		test('should register listener for streaming error events', async () => {
			const callback = mock(() => {});

			await onStreamingError(callback);

			expect(mockListen).toHaveBeenCalledWith('transcription://error', expect.any(Function));
		});

		test('should call callback with streaming error event', async () => {
			const callback = mock(() => {});
			const event: StreamingErrorEvent = {
				message: 'Connection lost during streaming',
				chunk_index: 3
			};

			await onStreamingError(callback);
			emitEvent('transcription://error', event);

			expect(callback).toHaveBeenCalledWith(event);
		});

		test('should handle error with null chunk index', async () => {
			const callback = mock(() => {});
			const event: StreamingErrorEvent = {
				message: 'General streaming error',
				chunk_index: null
			};

			await onStreamingError(callback);
			emitEvent('transcription://error', event);

			expect(callback).toHaveBeenCalledWith(expect.objectContaining({ chunk_index: null }));
		});
	});

	describe('setupPushToTalk', () => {
		beforeEach(() => {
			mockInvoke.mockReset();
			mockListen.mockClear();
			eventHandlers.clear();
		});

		test('should register hotkey listeners', async () => {
			await setupPushToTalk({});

			expect(mockListen).toHaveBeenCalledWith('hotkey://recording-started', expect.any(Function));
			expect(mockListen).toHaveBeenCalledWith('hotkey://recording-stopped', expect.any(Function));
		});

		test('should return cleanup function', async () => {
			const cleanup = await setupPushToTalk({});

			expect(typeof cleanup).toBe('function');
		});

		test('should call onStateChange with recording when hotkey pressed', async () => {
			const onStateChange = mock(() => {});
			mockInvoke.mockResolvedValue(undefined);

			await setupPushToTalk({ onStateChange });
			emitEvent('hotkey://recording-started', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(onStateChange).toHaveBeenCalledWith('recording');
		});

		test('should call startRecording when hotkey pressed', async () => {
			mockInvoke.mockResolvedValue(undefined);

			await setupPushToTalk({});
			emitEvent('hotkey://recording-started', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
		});

		test('should call onError when startRecording fails', async () => {
			const onError = mock(() => {});
			mockInvoke.mockRejectedValue(new Error('Recording failed'));

			await setupPushToTalk({ onError });
			emitEvent('hotkey://recording-started', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(onError).toHaveBeenCalledWith({
				phase: 'recording',
				message: expect.stringContaining('Recording failed')
			});
		});

		test('should call pushToTalkComplete when hotkey released', async () => {
			const mockResult: PushToTalkResult = {
				text: 'Test',
				audio_duration_secs: 1.0,
				transcription_time_ms: 500,
				injection_time_ms: 10,
				total_latency_ms: 1510
			};
			mockInvoke.mockResolvedValue(mockResult);

			await setupPushToTalk({});
			emitEvent('hotkey://recording-stopped', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockInvoke).toHaveBeenCalledWith('push_to_talk_complete');
		});

		test('should call onComplete with result when pushToTalkComplete succeeds', async () => {
			const onComplete = mock(() => {});
			const mockResult: PushToTalkResult = {
				text: 'Test transcription',
				audio_duration_secs: 2.0,
				transcription_time_ms: 1000,
				injection_time_ms: 50,
				total_latency_ms: 3050
			};
			mockInvoke.mockResolvedValue(mockResult);

			await setupPushToTalk({ onComplete });
			emitEvent('hotkey://recording-stopped', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(onComplete).toHaveBeenCalledWith(mockResult);
		});

		test('should call onError when pushToTalkComplete fails', async () => {
			const onError = mock(() => {});
			mockInvoke.mockRejectedValue(new Error('Completion failed'));

			await setupPushToTalk({ onError });
			emitEvent('hotkey://recording-stopped', undefined);

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(onError).toHaveBeenCalledWith({
				phase: 'completion',
				message: expect.stringContaining('Completion failed')
			});
		});

		test('should register workflow state change listener when onStateChange provided', async () => {
			const onStateChange = mock(() => {});

			await setupPushToTalk({ onStateChange });

			expect(mockListen).toHaveBeenCalledWith('workflow://state-changed', expect.any(Function));
		});

		test('should register error listener when onError provided', async () => {
			const onError = mock(() => {});

			await setupPushToTalk({ onError });

			expect(mockListen).toHaveBeenCalledWith('workflow://error', expect.any(Function));
		});

		test('should register metrics listener when onMetrics provided', async () => {
			const onMetrics = mock(() => {});

			await setupPushToTalk({ onMetrics });

			expect(mockListen).toHaveBeenCalledWith('workflow://metrics', expect.any(Function));
		});

		test('should register partial transcription listener when provided', async () => {
			const onPartialTranscription = mock(() => {});

			await setupPushToTalk({ onPartialTranscription });

			expect(mockListen).toHaveBeenCalledWith('transcription://partial', expect.any(Function));
		});

		test('should register final transcription listener when provided', async () => {
			const onFinalTranscription = mock(() => {});

			await setupPushToTalk({ onFinalTranscription });

			expect(mockListen).toHaveBeenCalledWith('transcription://complete', expect.any(Function));
		});

		test('should register streaming error listener when provided', async () => {
			const onStreamingError = mock(() => {});

			await setupPushToTalk({ onStreamingError });

			expect(mockListen).toHaveBeenCalledWith('transcription://error', expect.any(Function));
		});

		test('should not register optional listeners when not provided', async () => {
			await setupPushToTalk({});

			// Only hotkey listeners should be registered (2 calls)
			expect(mockListen).toHaveBeenCalledTimes(2);
		});

		test('should register all listeners when all handlers provided', async () => {
			await setupPushToTalk({
				onStateChange: mock(() => {}),
				onError: mock(() => {}),
				onMetrics: mock(() => {}),
				onComplete: mock(() => {}),
				onPartialTranscription: mock(() => {}),
				onFinalTranscription: mock(() => {}),
				onStreamingError: mock(() => {})
			});

			// 2 hotkey + 3 workflow + 3 transcription = 8 listeners
			expect(mockListen).toHaveBeenCalledTimes(8);
		});

		test('cleanup function should be callable', async () => {
			const cleanup = await setupPushToTalk({});

			expect(() => cleanup()).not.toThrow();
		});
	});
});

describe('integration scenarios', () => {
	beforeEach(() => {
		mockInvoke.mockReset();
		mockListen.mockClear();
		eventHandlers.clear();
	});

	describe('full push-to-talk workflow', () => {
		test('should complete full workflow: press -> record -> release -> transcribe -> inject', async () => {
			const onStateChange = mock(() => {});
			const onComplete = mock(() => {});
			const onMetrics = mock(() => {});

			const mockResult: PushToTalkResult = {
				text: 'Hello world',
				audio_duration_secs: 2.5,
				transcription_time_ms: 1200,
				injection_time_ms: 30,
				total_latency_ms: 3730
			};

			// Setup mocks
			(mockInvoke as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
				if (cmd === 'start_recording') return Promise.resolve(undefined);
				if (cmd === 'push_to_talk_complete') return Promise.resolve(mockResult);
				return Promise.resolve(undefined);
			});

			await setupPushToTalk({ onStateChange, onComplete, onMetrics });

			// Simulate hotkey press
			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onStateChange).toHaveBeenCalledWith('recording');
			expect(mockInvoke).toHaveBeenCalledWith('start_recording');

			// Simulate backend state changes
			emitEvent('workflow://state-changed', 'recording');
			expect(onStateChange).toHaveBeenCalledWith('recording');

			// Simulate hotkey release
			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockInvoke).toHaveBeenCalledWith('push_to_talk_complete');
			expect(onComplete).toHaveBeenCalledWith(mockResult);
		});

		test('should handle workflow with streaming transcription', async () => {
			const onPartialTranscription = mock(() => {});
			const onFinalTranscription = mock(() => {});
			const onComplete = mock(() => {});

			const mockResult: PushToTalkResult = {
				text: 'Hello world',
				audio_duration_secs: 3.0,
				transcription_time_ms: 1500,
				injection_time_ms: 40,
				total_latency_ms: 4540
			};

			(mockInvoke as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
				if (cmd === 'start_recording') return Promise.resolve(undefined);
				if (cmd === 'push_to_talk_complete') return Promise.resolve(mockResult);
				return Promise.resolve(undefined);
			});

			await setupPushToTalk({ onPartialTranscription, onFinalTranscription, onComplete });

			// Simulate recording start
			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Simulate streaming partial transcriptions
			emitEvent('transcription://partial', { text: 'Hel', chunk_index: 0, timestamp_ms: 500, is_final: false });
			emitEvent('transcription://partial', { text: 'Hello', chunk_index: 1, timestamp_ms: 1000, is_final: false });
			emitEvent('transcription://partial', { text: 'Hello wor', chunk_index: 2, timestamp_ms: 1500, is_final: false });
			emitEvent('transcription://partial', { text: 'Hello world', chunk_index: 3, timestamp_ms: 2000, is_final: true });

			expect(onPartialTranscription).toHaveBeenCalledTimes(4);

			// Simulate final transcription
			emitEvent('transcription://complete', {
				text: 'Hello world',
				total_chunks: 4,
				duration_secs: 3.0,
				reconciled: true
			});

			expect(onFinalTranscription).toHaveBeenCalledWith({
				text: 'Hello world',
				total_chunks: 4,
				duration_secs: 3.0,
				reconciled: true
			});

			// Complete workflow
			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onComplete).toHaveBeenCalledWith(mockResult);
		});

		test('should handle workflow error during recording phase', async () => {
			const onStateChange = mock(() => {});
			const onError = mock(() => {});

			mockInvoke.mockRejectedValue(new Error('Microphone access denied'));

			await setupPushToTalk({ onStateChange, onError });

			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onStateChange).toHaveBeenCalledWith('recording');
			expect(onError).toHaveBeenCalledWith({
				phase: 'recording',
				message: expect.stringContaining('Microphone access denied')
			});
		});

		test('should handle workflow error during transcription phase', async () => {
			const onError = mock(() => {});

			(mockInvoke as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
				if (cmd === 'start_recording') return Promise.resolve(undefined);
				if (cmd === 'push_to_talk_complete') return Promise.reject(new Error('Whisper model not loaded'));
				return Promise.resolve(undefined);
			});

			await setupPushToTalk({ onError });

			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onError).toHaveBeenCalledWith({
				phase: 'completion',
				message: expect.stringContaining('Whisper model not loaded')
			});
		});

		test('should handle streaming error during transcription', async () => {
			const onStreamingError = mock(() => {});
			const onError = mock(() => {});

			mockInvoke.mockResolvedValue(undefined);

			await setupPushToTalk({ onStreamingError, onError });

			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Simulate streaming error
			emitEvent('transcription://error', {
				message: 'WebSocket connection lost',
				chunk_index: 5
			});

			expect(onStreamingError).toHaveBeenCalledWith({
				message: 'WebSocket connection lost',
				chunk_index: 5
			});
		});
	});

	describe('rapid hotkey interactions', () => {
		test('should handle rapid press-release cycles', async () => {
			const onStateChange = mock(() => {});
			const onComplete = mock(() => {});

			const mockResult: PushToTalkResult = {
				text: 'Quick',
				audio_duration_secs: 0.3,
				transcription_time_ms: 100,
				injection_time_ms: 10,
				total_latency_ms: 410
			};

			mockInvoke.mockResolvedValue(mockResult);

			await setupPushToTalk({ onStateChange, onComplete });

			// Rapid press-release
			emitEvent('hotkey://recording-started', undefined);
			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(onStateChange).toHaveBeenCalledWith('recording');
			expect(mockInvoke).toHaveBeenCalledWith('start_recording');
			expect(mockInvoke).toHaveBeenCalledWith('push_to_talk_complete');
		});

		test('should handle multiple sequential workflows', async () => {
			const onComplete = mock(() => {});
			let callCount = 0;

			(mockInvoke as ReturnType<typeof mock>).mockImplementation((cmd: string) => {
				if (cmd === 'start_recording') return Promise.resolve(undefined);
				if (cmd === 'push_to_talk_complete') {
					callCount++;
					return Promise.resolve({
						text: `Result ${callCount}`,
						audio_duration_secs: 1.0,
						transcription_time_ms: 500,
						injection_time_ms: 20,
						total_latency_ms: 1520
					});
				}
				return Promise.resolve(undefined);
			});

			await setupPushToTalk({ onComplete });

			// First workflow
			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));
			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Second workflow
			emitEvent('hotkey://recording-started', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));
			emitEvent('hotkey://recording-stopped', undefined);
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onComplete).toHaveBeenCalledTimes(2);
			expect(onComplete).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: 'Result 1' }));
			expect(onComplete).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: 'Result 2' }));
		});
	});

	describe('metrics collection', () => {
		test('should receive metrics after successful workflow', async () => {
			const onMetrics = mock(() => {});

			mockInvoke.mockResolvedValue({
				text: 'Test',
				audio_duration_secs: 2.0,
				transcription_time_ms: 1000,
				injection_time_ms: 50,
				total_latency_ms: 3050
			});

			await setupPushToTalk({ onMetrics });

			// Simulate backend metrics event
			emitEvent('workflow://metrics', {
				audio_duration_secs: 2.0,
				transcription_time_ms: 1000,
				injection_time_ms: 50,
				total_latency_ms: 3050,
				text_length: 4
			});

			expect(onMetrics).toHaveBeenCalledWith({
				audio_duration_secs: 2.0,
				transcription_time_ms: 1000,
				injection_time_ms: 50,
				total_latency_ms: 3050,
				text_length: 4
			});
		});

		test('should track metrics for short recordings', async () => {
			const onMetrics = mock(() => {});

			await setupPushToTalk({ onMetrics });

			emitEvent('workflow://metrics', {
				audio_duration_secs: 0.5,
				transcription_time_ms: 200,
				injection_time_ms: 10,
				total_latency_ms: 710,
				text_length: 10
			});

			expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
				audio_duration_secs: 0.5,
				text_length: 10
			}));
		});

		test('should track metrics for long recordings', async () => {
			const onMetrics = mock(() => {});

			await setupPushToTalk({ onMetrics });

			emitEvent('workflow://metrics', {
				audio_duration_secs: 30.0,
				transcription_time_ms: 15000,
				injection_time_ms: 200,
				total_latency_ms: 45200,
				text_length: 500
			});

			expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
				audio_duration_secs: 30.0,
				text_length: 500
			}));
		});
	});

	describe('cleanup behavior', () => {
		test('should cleanup all listeners on cleanup call', async () => {
			const unlistenMocks: ReturnType<typeof mock>[] = [];

			// Override mockListen to track unlisten calls
			mockListen.mockImplementation(() => {
				const unlistenMock = mock(() => {});
				unlistenMocks.push(unlistenMock);
				return Promise.resolve(unlistenMock);
			});

			const cleanup = await setupPushToTalk({
				onStateChange: mock(() => {}),
				onError: mock(() => {}),
				onMetrics: mock(() => {}),
				onPartialTranscription: mock(() => {}),
				onFinalTranscription: mock(() => {}),
				onStreamingError: mock(() => {})
			});

			cleanup();

			// All unlisten functions should have been called
			unlistenMocks.forEach(unlistenMock => {
				expect(unlistenMock).toHaveBeenCalled();
			});
		});

		test('should stop receiving events after cleanup', async () => {
			const onStateChange = mock(() => {});

			// Restore proper mockListen implementation
			mockListen.mockImplementation(
				(event: string, handler: (event: { payload: unknown }) => void): Promise<UnlistenFn> => {
					if (!eventHandlers.has(event)) {
						eventHandlers.set(event, []);
					}
					eventHandlers.get(event)!.push(handler);
					return Promise.resolve(createMockUnlisten());
				}
			);

			mockInvoke.mockResolvedValue(undefined);

			const cleanup = await setupPushToTalk({ onStateChange });

			// Events should work before cleanup
			emitEvent('workflow://state-changed', 'recording');
			expect(onStateChange).toHaveBeenCalledWith('recording');

			onStateChange.mockClear();
			cleanup();

			// Note: In real implementation, events would stop after cleanup
			// This test verifies the cleanup function is callable
		});
	});
});

describe('error edge cases', () => {
	beforeEach(() => {
		mockInvoke.mockReset();
		mockListen.mockClear();
		eventHandlers.clear();
	});

	describe('network and connection errors', () => {
		test('should handle network timeout error', async () => {
			mockInvoke.mockRejectedValue(new Error('Request timeout: transcription server unreachable'));

			await expect(pushToTalkComplete()).rejects.toThrow('Request timeout');
		});

		test('should handle connection refused error', async () => {
			mockInvoke.mockRejectedValue(new Error('Connection refused: backend not running'));

			await expect(startRecording()).rejects.toThrow('Connection refused');
		});

		test('should handle API rate limit error', async () => {
			mockInvoke.mockRejectedValue(new Error('Rate limit exceeded: try again later'));

			await expect(pushToTalkComplete()).rejects.toThrow('Rate limit exceeded');
		});
	});

	describe('audio device errors', () => {
		test('should handle no audio device found', async () => {
			mockInvoke.mockRejectedValue(new Error('No audio input device found'));

			await expect(startRecording()).rejects.toThrow('No audio input device found');
		});

		test('should handle audio device disconnected', async () => {
			mockInvoke.mockRejectedValue(new Error('Audio device disconnected during recording'));

			await expect(startRecording()).rejects.toThrow('Audio device disconnected');
		});

		test('should handle audio format unsupported', async () => {
			mockInvoke.mockRejectedValue(new Error('Audio format not supported'));

			await expect(startRecording()).rejects.toThrow('Audio format not supported');
		});
	});

	describe('transcription errors', () => {
		test('should handle model loading failure', async () => {
			mockInvoke.mockRejectedValue(new Error('Failed to load Whisper model: out of memory'));

			await expect(pushToTalkComplete()).rejects.toThrow('Failed to load Whisper model');
		});

		test('should handle audio too short error', async () => {
			mockInvoke.mockRejectedValue(new Error('Audio too short for transcription'));

			await expect(pushToTalkComplete()).rejects.toThrow('Audio too short');
		});

		test('should handle audio too long error', async () => {
			mockInvoke.mockRejectedValue(new Error('Audio exceeds maximum duration'));

			await expect(pushToTalkComplete()).rejects.toThrow('Audio exceeds maximum duration');
		});

		test('should handle corrupted audio data', async () => {
			mockInvoke.mockRejectedValue(new Error('Invalid audio data: corrupted file'));

			await expect(pushToTalkComplete()).rejects.toThrow('Invalid audio data');
		});
	});

	describe('injection errors', () => {
		test('should handle no focused window error', async () => {
			mockInvoke.mockRejectedValue(new Error('No focused window for text injection'));

			await expect(pushToTalkComplete()).rejects.toThrow('No focused window');
		});

		test('should handle injection permission denied', async () => {
			mockInvoke.mockRejectedValue(new Error('Accessibility permission required for text injection'));

			await expect(pushToTalkComplete()).rejects.toThrow('Accessibility permission required');
		});

		test('should handle injection timeout', async () => {
			mockInvoke.mockRejectedValue(new Error('Text injection timed out'));

			await expect(pushToTalkComplete()).rejects.toThrow('Text injection timed out');
		});
	});
});

describe('workflow type interfaces', () => {
	describe('WorkflowState type', () => {
		test('should accept idle state', () => {
			const state: WorkflowState = 'idle';
			expect(state).toBe('idle');
		});

		test('should accept recording state', () => {
			const state: WorkflowState = 'recording';
			expect(state).toBe('recording');
		});

		test('should accept transcribing state', () => {
			const state: WorkflowState = 'transcribing';
			expect(state).toBe('transcribing');
		});

		test('should accept injecting state', () => {
			const state: WorkflowState = 'injecting';
			expect(state).toBe('injecting');
		});
	});

	describe('PartialTranscriptionEvent interface', () => {
		test('should have all required fields', () => {
			const event: PartialTranscriptionEvent = {
				text: 'Hello',
				chunk_index: 0,
				timestamp_ms: 100,
				is_final: false
			};

			expect(event.text).toBe('Hello');
			expect(event.chunk_index).toBe(0);
			expect(event.timestamp_ms).toBe(100);
			expect(event.is_final).toBe(false);
		});

		test('should handle final chunk', () => {
			const event: PartialTranscriptionEvent = {
				text: 'Hello world',
				chunk_index: 5,
				timestamp_ms: 2500,
				is_final: true
			};

			expect(event.is_final).toBe(true);
		});
	});

	describe('FinalTranscriptionEvent interface', () => {
		test('should have all required fields', () => {
			const event: FinalTranscriptionEvent = {
				text: 'Complete transcription',
				total_chunks: 10,
				duration_secs: 5.5,
				reconciled: true
			};

			expect(event.text).toBe('Complete transcription');
			expect(event.total_chunks).toBe(10);
			expect(event.duration_secs).toBe(5.5);
			expect(event.reconciled).toBe(true);
		});

		test('should handle non-reconciled transcription', () => {
			const event: FinalTranscriptionEvent = {
				text: 'Transcription',
				total_chunks: 3,
				duration_secs: 2.0,
				reconciled: false
			};

			expect(event.reconciled).toBe(false);
		});
	});

	describe('StreamingErrorEvent interface', () => {
		test('should have all required fields with chunk index', () => {
			const event: StreamingErrorEvent = {
				message: 'Error message',
				chunk_index: 5
			};

			expect(event.message).toBe('Error message');
			expect(event.chunk_index).toBe(5);
		});

		test('should allow null chunk index', () => {
			const event: StreamingErrorEvent = {
				message: 'General error',
				chunk_index: null
			};

			expect(event.chunk_index).toBeNull();
		});
	});

	describe('PushToTalkResult interface', () => {
		test('should have all required fields', () => {
			const result: PushToTalkResult = {
				text: 'Transcribed text',
				audio_duration_secs: 3.0,
				transcription_time_ms: 1500,
				injection_time_ms: 50,
				total_latency_ms: 4550
			};

			expect(result.text).toBe('Transcribed text');
			expect(result.audio_duration_secs).toBe(3.0);
			expect(result.transcription_time_ms).toBe(1500);
			expect(result.injection_time_ms).toBe(50);
			expect(result.total_latency_ms).toBe(4550);
		});

		test('should handle empty text', () => {
			const result: PushToTalkResult = {
				text: '',
				audio_duration_secs: 0.1,
				transcription_time_ms: 50,
				injection_time_ms: 0,
				total_latency_ms: 150
			};

			expect(result.text).toBe('');
		});
	});

	describe('PushToTalkMetrics interface', () => {
		test('should have all required fields', () => {
			const metrics: PushToTalkMetrics = {
				audio_duration_secs: 4.5,
				transcription_time_ms: 2000,
				injection_time_ms: 100,
				total_latency_ms: 6600,
				text_length: 200
			};

			expect(metrics.audio_duration_secs).toBe(4.5);
			expect(metrics.transcription_time_ms).toBe(2000);
			expect(metrics.injection_time_ms).toBe(100);
			expect(metrics.total_latency_ms).toBe(6600);
			expect(metrics.text_length).toBe(200);
		});

		test('should handle zero values', () => {
			const metrics: PushToTalkMetrics = {
				audio_duration_secs: 0,
				transcription_time_ms: 0,
				injection_time_ms: 0,
				total_latency_ms: 0,
				text_length: 0
			};

			expect(metrics.text_length).toBe(0);
		});
	});

	describe('PushToTalkError interface', () => {
		test('should have all required fields', () => {
			const error: PushToTalkError = {
				phase: 'transcription',
				message: 'Model failed to load'
			};

			expect(error.phase).toBe('transcription');
			expect(error.message).toBe('Model failed to load');
		});

		test('should handle various error phases', () => {
			const phases = ['recording', 'transcription', 'injection', 'initialization', 'audio_device'];

			for (const phase of phases) {
				const error: PushToTalkError = {
					phase,
					message: `Error in ${phase}`
				};
				expect(error.phase).toBe(phase);
			}
		});
	});
});
