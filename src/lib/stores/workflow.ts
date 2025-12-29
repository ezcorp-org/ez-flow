/**
 * Workflow state store for push-to-talk
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { WorkflowState, PushToTalkMetrics, PushToTalkError } from '$lib/services/workflow';

/** Current workflow state */
export const workflowState = writable<WorkflowState>('idle');

/** Last error if any */
export const lastError = writable<PushToTalkError | null>(null);

/** Last metrics from completed flow */
export const lastMetrics = writable<PushToTalkMetrics | null>(null);

/** Whether currently recording */
export const isRecording: Readable<boolean> = derived(
	workflowState,
	($state) => $state === 'recording'
);

/** Whether transcribing */
export const isTranscribing: Readable<boolean> = derived(
	workflowState,
	($state) => $state === 'transcribing'
);

/** Whether injecting */
export const isInjecting: Readable<boolean> = derived(
	workflowState,
	($state) => $state === 'injecting'
);

/** Whether busy (not idle) */
export const isBusy: Readable<boolean> = derived(workflowState, ($state) => $state !== 'idle');

/** Set workflow state */
export function setWorkflowState(state: WorkflowState): void {
	workflowState.set(state);
	// Clear error when starting a new operation
	if (state === 'recording') {
		lastError.set(null);
	}
}

/** Set error */
export function setError(error: PushToTalkError): void {
	lastError.set(error);
	workflowState.set('idle');
}

/** Set metrics */
export function setMetrics(metrics: PushToTalkMetrics): void {
	lastMetrics.set(metrics);
}

/** Reset to idle state */
export function resetWorkflow(): void {
	workflowState.set('idle');
	lastError.set(null);
}
