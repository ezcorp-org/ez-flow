import { test, expect, describe } from 'bun:test';

// Test the module structure - actual invoke calls require Tauri runtime
describe('textInjection service', () => {
	test('module exports expected functions', async () => {
		const module = await import('./textInjection');

		expect(typeof module.injectText).toBe('function');
		expect(typeof module.setInjectionDelay).toBe('function');
		expect(typeof module.getInjectionPermissionInstructions).toBe('function');
		expect(typeof module.injectTextWithDelay).toBe('function');
	});
});
