import { test, expect, describe } from 'bun:test';

describe('workflow service', () => {
	test('module exports expected functions', async () => {
		const module = await import('./workflow');

		expect(typeof module.startRecording).toBe('function');
		expect(typeof module.pushToTalkComplete).toBe('function');
		expect(typeof module.isCooldownActive).toBe('function');
		expect(typeof module.getWorkflowState).toBe('function');
		expect(typeof module.onWorkflowStateChanged).toBe('function');
		expect(typeof module.onWorkflowError).toBe('function');
		expect(typeof module.onWorkflowMetrics).toBe('function');
		expect(typeof module.setupPushToTalk).toBe('function');
	});
});

describe('workflow store', () => {
	test('module exports expected stores and functions', async () => {
		const module = await import('$lib/stores/workflow');

		expect(module.workflowState).toBeDefined();
		expect(module.lastError).toBeDefined();
		expect(module.lastMetrics).toBeDefined();
		expect(module.isRecording).toBeDefined();
		expect(module.isTranscribing).toBeDefined();
		expect(module.isInjecting).toBeDefined();
		expect(module.isBusy).toBeDefined();
		expect(typeof module.setWorkflowState).toBe('function');
		expect(typeof module.setError).toBe('function');
		expect(typeof module.setMetrics).toBe('function');
		expect(typeof module.resetWorkflow).toBe('function');
	});
});
