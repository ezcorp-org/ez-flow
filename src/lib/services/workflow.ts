/**
 * Push-to-talk workflow service
 *
 * Orchestrates the complete push-to-talk flow:
 * hotkey press -> start recording -> hotkey release -> stop -> transcribe -> inject
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Workflow states
 */
export type WorkflowState = 'idle' | 'recording' | 'transcribing' | 'injecting';

/**
 * Partial transcription event payload
 */
export interface PartialTranscriptionEvent {
	text: string;
	chunk_index: number;
	timestamp_ms: number;
	is_final: boolean;
}

/**
 * Final transcription event payload
 */
export interface FinalTranscriptionEvent {
	text: string;
	total_chunks: number;
	duration_secs: number;
	reconciled: boolean;
}

/**
 * Streaming error event payload
 */
export interface StreamingErrorEvent {
	message: string;
	chunk_index: number | null;
}

/**
 * Push-to-talk result
 */
export interface PushToTalkResult {
	text: string;
	audio_duration_secs: number;
	transcription_time_ms: number;
	injection_time_ms: number;
	total_latency_ms: number;
}

/**
 * Push-to-talk metrics
 */
export interface PushToTalkMetrics {
	audio_duration_secs: number;
	transcription_time_ms: number;
	injection_time_ms: number;
	total_latency_ms: number;
	text_length: number;
}

/**
 * Push-to-talk error
 */
export interface PushToTalkError {
	phase: string;
	message: string;
}

/**
 * Start recording (called when hotkey is pressed)
 */
export async function startRecording(): Promise<void> {
	return invoke('start_recording');
}

/**
 * Complete the push-to-talk flow (stop recording -> transcribe -> inject)
 */
export async function pushToTalkComplete(): Promise<PushToTalkResult> {
	return invoke<PushToTalkResult>('push_to_talk_complete');
}

/**
 * Check if cooldown is active
 */
export async function isCooldownActive(): Promise<boolean> {
	return invoke<boolean>('is_push_to_talk_cooldown_active');
}

/**
 * Get current workflow state
 */
export async function getWorkflowState(): Promise<WorkflowState> {
	return invoke<WorkflowState>('get_workflow_state');
}

/**
 * Listen for workflow state changes
 */
export async function onWorkflowStateChanged(
	callback: (state: WorkflowState) => void
): Promise<UnlistenFn> {
	return listen<WorkflowState>('workflow://state-changed', (event) => callback(event.payload));
}

/**
 * Listen for workflow errors
 */
export async function onWorkflowError(
	callback: (error: PushToTalkError) => void
): Promise<UnlistenFn> {
	return listen<PushToTalkError>('workflow://error', (event) => callback(event.payload));
}

/**
 * Listen for workflow metrics
 */
export async function onWorkflowMetrics(
	callback: (metrics: PushToTalkMetrics) => void
): Promise<UnlistenFn> {
	return listen<PushToTalkMetrics>('workflow://metrics', (event) => callback(event.payload));
}

/**
 * Listen for hotkey recording started
 */
export async function onHotkeyRecordingStarted(callback: () => void): Promise<UnlistenFn> {
	return listen('hotkey://recording-started', callback);
}

/**
 * Listen for hotkey recording stopped
 */
export async function onHotkeyRecordingStopped(callback: () => void): Promise<UnlistenFn> {
	return listen('hotkey://recording-stopped', callback);
}

/**
 * Listen for partial transcription events (streaming)
 */
export async function onPartialTranscription(
	callback: (event: PartialTranscriptionEvent) => void
): Promise<UnlistenFn> {
	return listen<PartialTranscriptionEvent>('transcription://partial', (e) => callback(e.payload));
}

/**
 * Listen for final transcription events (streaming)
 */
export async function onFinalTranscription(
	callback: (event: FinalTranscriptionEvent) => void
): Promise<UnlistenFn> {
	return listen<FinalTranscriptionEvent>('transcription://complete', (e) => callback(e.payload));
}

/**
 * Listen for streaming transcription errors
 */
export async function onStreamingError(
	callback: (event: StreamingErrorEvent) => void
): Promise<UnlistenFn> {
	return listen<StreamingErrorEvent>('transcription://error', (e) => callback(e.payload));
}

/**
 * Setup push-to-talk event handlers
 * Returns a cleanup function to remove all listeners
 */
export async function setupPushToTalk(handlers: {
	onStateChange?: (state: WorkflowState) => void;
	onError?: (error: PushToTalkError) => void;
	onMetrics?: (metrics: PushToTalkMetrics) => void;
	onComplete?: (result: PushToTalkResult) => void;
	onPartialTranscription?: (event: PartialTranscriptionEvent) => void;
	onFinalTranscription?: (event: FinalTranscriptionEvent) => void;
	onStreamingError?: (event: StreamingErrorEvent) => void;
}): Promise<() => void> {
	const unlisteners: UnlistenFn[] = [];

	// Handle hotkey press -> start recording
	unlisteners.push(
		await onHotkeyRecordingStarted(async () => {
			handlers.onStateChange?.('recording');
			try {
				await startRecording();
			} catch (error) {
				handlers.onError?.({
					phase: 'recording',
					message: String(error)
				});
			}
		})
	);

	// Handle hotkey release -> complete flow
	unlisteners.push(
		await onHotkeyRecordingStopped(async () => {
			try {
				const result = await pushToTalkComplete();
				handlers.onComplete?.(result);
			} catch (error) {
				handlers.onError?.({
					phase: 'completion',
					message: String(error)
				});
			}
		})
	);

	// Listen for state changes from backend
	if (handlers.onStateChange) {
		unlisteners.push(await onWorkflowStateChanged(handlers.onStateChange));
	}

	// Listen for errors from backend
	if (handlers.onError) {
		unlisteners.push(await onWorkflowError(handlers.onError));
	}

	// Listen for metrics from backend
	if (handlers.onMetrics) {
		unlisteners.push(await onWorkflowMetrics(handlers.onMetrics));
	}

	// Listen for streaming transcription events
	if (handlers.onPartialTranscription) {
		unlisteners.push(await onPartialTranscription(handlers.onPartialTranscription));
	}

	if (handlers.onFinalTranscription) {
		unlisteners.push(await onFinalTranscription(handlers.onFinalTranscription));
	}

	if (handlers.onStreamingError) {
		unlisteners.push(await onStreamingError(handlers.onStreamingError));
	}

	// Return cleanup function
	return () => {
		unlisteners.forEach((unlisten) => unlisten());
	};
}
