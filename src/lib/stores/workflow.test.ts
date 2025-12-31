import { test, expect, describe } from 'bun:test';
import { get } from 'svelte/store';
import {
	workflowState,
	lastError,
	lastMetrics,
	isRecording,
	isTranscribing,
	isInjecting,
	isBusy,
	setWorkflowState,
	setError,
	setMetrics,
	resetWorkflow
} from './workflow';
import type { WorkflowState, PushToTalkMetrics, PushToTalkError } from '$lib/services/workflow';

/**
 * Tests for Workflow store
 *
 * This store manages push-to-talk workflow state including:
 * - Current state (idle, recording, transcribing, injecting)
 * - Error tracking
 * - Metrics from completed flows
 * - Derived boolean states
 */

describe('Workflow store state management', () => {
	describe('workflowState store', () => {
		test('should initialize to idle', () => {
			resetWorkflow(); // Ensure clean state
			expect(get(workflowState)).toBe('idle');
		});

		test('should update to recording', () => {
			setWorkflowState('recording');
			expect(get(workflowState)).toBe('recording');
			resetWorkflow();
		});

		test('should update to transcribing', () => {
			setWorkflowState('transcribing');
			expect(get(workflowState)).toBe('transcribing');
			resetWorkflow();
		});

		test('should update to injecting', () => {
			setWorkflowState('injecting');
			expect(get(workflowState)).toBe('injecting');
			resetWorkflow();
		});

		test('should return to idle', () => {
			setWorkflowState('recording');
			setWorkflowState('idle');
			expect(get(workflowState)).toBe('idle');
		});
	});

	describe('lastError store', () => {
		test('should initialize to null', () => {
			resetWorkflow();
			expect(get(lastError)).toBeNull();
		});

		test('should store error object', () => {
			const error: PushToTalkError = {
				phase: 'transcription',
				message: 'Failed to transcribe audio'
			};
			setError(error);

			const stored = get(lastError);
			expect(stored?.phase).toBe('transcription');
			expect(stored?.message).toBe('Failed to transcribe audio');
			resetWorkflow();
		});

		test('should reset state to idle when error is set', () => {
			setWorkflowState('transcribing');
			setError({ phase: 'transcription', message: 'Test' });

			expect(get(workflowState)).toBe('idle');
			resetWorkflow();
		});
	});

	describe('lastMetrics store', () => {
		test('should initialize to null', () => {
			expect(get(lastMetrics)).toBeNull();
		});

		test('should store metrics object', () => {
			const metrics: PushToTalkMetrics = {
				audio_duration_secs: 5,
				transcription_time_ms: 1500,
				injection_time_ms: 100,
				total_latency_ms: 6600,
				text_length: 150
			};
			setMetrics(metrics);

			const stored = get(lastMetrics);
			expect(stored?.audio_duration_secs).toBe(5);
			expect(stored?.transcription_time_ms).toBe(1500);
			expect(stored?.text_length).toBe(150);
		});
	});

	describe('setWorkflowState clears error on recording', () => {
		test('should clear lastError when starting recording', () => {
			setError({ phase: 'recording', message: 'Old error' });
			expect(get(lastError)).not.toBeNull();

			setWorkflowState('recording');

			expect(get(lastError)).toBeNull();
			resetWorkflow();
		});

		test('should not clear error for other states', () => {
			setError({ phase: 'transcription', message: 'Error' });
			setWorkflowState('transcribing');

			expect(get(lastError)).not.toBeNull();
			resetWorkflow();
		});
	});

	describe('resetWorkflow function', () => {
		test('should reset state to idle', () => {
			setWorkflowState('injecting');
			resetWorkflow();
			expect(get(workflowState)).toBe('idle');
		});

		test('should clear lastError', () => {
			setError({ phase: 'injection', message: 'Error' });
			resetWorkflow();
			expect(get(lastError)).toBeNull();
		});
	});
});

describe('Workflow derived stores', () => {
	describe('isRecording derived store', () => {
		test('should be true when state is recording', () => {
			setWorkflowState('recording');
			expect(get(isRecording)).toBe(true);
			resetWorkflow();
		});

		test('should be false when state is idle', () => {
			resetWorkflow();
			expect(get(isRecording)).toBe(false);
		});

		test('should be false when state is transcribing', () => {
			setWorkflowState('transcribing');
			expect(get(isRecording)).toBe(false);
			resetWorkflow();
		});

		test('should be false when state is injecting', () => {
			setWorkflowState('injecting');
			expect(get(isRecording)).toBe(false);
			resetWorkflow();
		});
	});

	describe('isTranscribing derived store', () => {
		test('should be true when state is transcribing', () => {
			setWorkflowState('transcribing');
			expect(get(isTranscribing)).toBe(true);
			resetWorkflow();
		});

		test('should be false when state is idle', () => {
			resetWorkflow();
			expect(get(isTranscribing)).toBe(false);
		});

		test('should be false when state is recording', () => {
			setWorkflowState('recording');
			expect(get(isTranscribing)).toBe(false);
			resetWorkflow();
		});
	});

	describe('isInjecting derived store', () => {
		test('should be true when state is injecting', () => {
			setWorkflowState('injecting');
			expect(get(isInjecting)).toBe(true);
			resetWorkflow();
		});

		test('should be false when state is idle', () => {
			resetWorkflow();
			expect(get(isInjecting)).toBe(false);
		});

		test('should be false when state is recording', () => {
			setWorkflowState('recording');
			expect(get(isInjecting)).toBe(false);
			resetWorkflow();
		});
	});

	describe('isBusy derived store', () => {
		test('should be false when idle', () => {
			resetWorkflow();
			expect(get(isBusy)).toBe(false);
		});

		test('should be true when recording', () => {
			setWorkflowState('recording');
			expect(get(isBusy)).toBe(true);
			resetWorkflow();
		});

		test('should be true when transcribing', () => {
			setWorkflowState('transcribing');
			expect(get(isBusy)).toBe(true);
			resetWorkflow();
		});

		test('should be true when injecting', () => {
			setWorkflowState('injecting');
			expect(get(isBusy)).toBe(true);
			resetWorkflow();
		});
	});
});

describe('Workflow state transitions', () => {
	test('should transition idle -> recording -> transcribing -> injecting -> idle', () => {
		resetWorkflow();
		expect(get(workflowState)).toBe('idle');

		setWorkflowState('recording');
		expect(get(workflowState)).toBe('recording');

		setWorkflowState('transcribing');
		expect(get(workflowState)).toBe('transcribing');

		setWorkflowState('injecting');
		expect(get(workflowState)).toBe('injecting');

		setWorkflowState('idle');
		expect(get(workflowState)).toBe('idle');
	});

	test('should handle error transition from any state', () => {
		const states: WorkflowState[] = ['recording', 'transcribing', 'injecting'];

		for (const state of states) {
			setWorkflowState(state);
			setError({ phase: state, message: `Error during ${state}` });

			expect(get(workflowState)).toBe('idle');
			expect(get(lastError)?.message).toContain(state);
			resetWorkflow();
		}
	});
});

describe('Workflow metrics tracking', () => {
	test('should store complete metrics object', () => {
		const metrics: PushToTalkMetrics = {
			audio_duration_secs: 3.5,
			transcription_time_ms: 2000,
			injection_time_ms: 50,
			total_latency_ms: 5550,
			text_length: 85
		};

		setMetrics(metrics);

		const stored = get(lastMetrics);
		expect(stored).toEqual(metrics);
	});

	test('should overwrite previous metrics', () => {
		setMetrics({
			audio_duration_secs: 1,
			transcription_time_ms: 500,
			injection_time_ms: 10,
			total_latency_ms: 1510,
			text_length: 20
		});

		setMetrics({
			audio_duration_secs: 5,
			transcription_time_ms: 2500,
			injection_time_ms: 100,
			total_latency_ms: 7600,
			text_length: 200
		});

		const stored = get(lastMetrics);
		expect(stored?.audio_duration_secs).toBe(5);
		expect(stored?.text_length).toBe(200);
	});
});

describe('Workflow error handling', () => {
	test('should store error with phase and message', () => {
		const error: PushToTalkError = {
			phase: 'transcription',
			message: 'Whisper model is not loaded'
		};

		setError(error);

		const stored = get(lastError);
		expect(stored?.phase).toBe('transcription');
		expect(stored?.message).toBe('Whisper model is not loaded');
		resetWorkflow();
	});

	test('should handle various error phases', () => {
		const errorPhases = [
			'recording',
			'transcription',
			'injection',
			'initialization',
			'audio_device'
		];

		for (const phase of errorPhases) {
			setError({ phase, message: `Test error: ${phase}` });
			expect(get(lastError)?.phase).toBe(phase);
			resetWorkflow();
		}
	});
});
