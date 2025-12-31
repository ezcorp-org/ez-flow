import { test, expect, describe, beforeEach, mock } from 'bun:test';

// Mock Tauri invoke API
const mockInvoke = mock(() => Promise.resolve(undefined as unknown));

mock.module('@tauri-apps/api/core', () => ({
	invoke: mockInvoke
}));

/**
 * Tests for textInjection service
 *
 * This service handles:
 * - Injecting text at cursor position via Tauri backend
 * - Setting injection delay between keystrokes
 * - Getting platform-specific permission instructions
 * - Combined inject with delay functionality
 */

describe('textInjection service', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
	});

	test('module exports expected functions', async () => {
		const module = await import('./textInjection');

		expect(typeof module.injectText).toBe('function');
		expect(typeof module.setInjectionDelay).toBe('function');
		expect(typeof module.getInjectionPermissionInstructions).toBe('function');
		expect(typeof module.injectTextWithDelay).toBe('function');
	});

	describe('injectText behavior', () => {
		test('should call inject_text command with text parameter', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { injectText } = await import('./textInjection');
			await injectText('Hello world');

			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: 'Hello world' });
		});

		test('should handle empty text', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { injectText } = await import('./textInjection');
			await injectText('');

			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: '' });
		});

		test('should handle text with special characters', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { injectText } = await import('./textInjection');
			const specialText = 'Hello! @#$%^&*() "quotes" and newlines\n\ttabs';
			await injectText(specialText);

			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: specialText });
		});

		test('should handle unicode text', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { injectText } = await import('./textInjection');
			await injectText('Hello 世界 🌍');

			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: 'Hello 世界 🌍' });
		});

		test('should propagate errors from invoke', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Injection failed: No focus'));

			const { injectText } = await import('./textInjection');

			await expect(injectText('test')).rejects.toThrow('Injection failed: No focus');
		});

		test('should handle very long text', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { injectText } = await import('./textInjection');
			const longText = 'a'.repeat(10000);
			await injectText(longText);

			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: longText });
		});
	});

	describe('setInjectionDelay validation', () => {
		test('should call set_injection_delay with valid delay', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(25);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 25 });
		});

		test('should clamp delay to minimum of 0', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(-10);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 0 });
		});

		test('should clamp delay to maximum of 50ms', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(100);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 50 });
		});

		test('should accept zero delay', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(0);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 0 });
		});

		test('should accept maximum valid delay (50ms)', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(50);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 50 });
		});

		test('should handle boundary value at max', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(51);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 50 });
		});

		test('should handle very large negative value', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			const { setInjectionDelay } = await import('./textInjection');
			await setInjectionDelay(-1000);

			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 0 });
		});

		test('should propagate errors', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Failed to set delay'));

			const { setInjectionDelay } = await import('./textInjection');

			await expect(setInjectionDelay(10)).rejects.toThrow('Failed to set delay');
		});
	});

	describe('injectTextWithDelay integration', () => {
		test('should inject text without setting delay when delayMs is undefined', async () => {
			mockInvoke.mockResolvedValue(undefined);

			const { injectTextWithDelay } = await import('./textInjection');
			await injectTextWithDelay('test text');

			// Should only call inject_text, not set_injection_delay
			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: 'test text' });
			expect(mockInvoke).not.toHaveBeenCalledWith('set_injection_delay', expect.any(Object));
		});

		test('should inject text without setting delay when delayMs is 0', async () => {
			mockInvoke.mockResolvedValue(undefined);

			const { injectTextWithDelay } = await import('./textInjection');
			await injectTextWithDelay('test text', 0);

			// Should only call inject_text since delay is 0
			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: 'test text' });
		});

		test('should set delay before injecting when delayMs > 0', async () => {
			mockInvoke.mockResolvedValue(undefined);

			const { injectTextWithDelay } = await import('./textInjection');
			await injectTextWithDelay('delayed text', 30);

			// Should call set_injection_delay first, then inject_text
			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 30 });
			expect(mockInvoke).toHaveBeenCalledWith('inject_text', { text: 'delayed text' });
		});

		test('should respect delay clamping in combined call', async () => {
			mockInvoke.mockResolvedValue(undefined);

			const { injectTextWithDelay } = await import('./textInjection');
			await injectTextWithDelay('text', 100);

			// Delay should be clamped to 50
			expect(mockInvoke).toHaveBeenCalledWith('set_injection_delay', { delayMs: 50 });
		});

		test('should propagate delay setting errors', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Delay setting failed'));

			const { injectTextWithDelay } = await import('./textInjection');

			await expect(injectTextWithDelay('text', 20)).rejects.toThrow('Delay setting failed');
		});

		test('should propagate injection errors after delay is set', async () => {
			mockInvoke
				.mockResolvedValueOnce(undefined) // set_injection_delay succeeds
				.mockRejectedValueOnce(new Error('Injection failed'));

			const { injectTextWithDelay } = await import('./textInjection');

			await expect(injectTextWithDelay('text', 10)).rejects.toThrow('Injection failed');
		});
	});

	describe('getInjectionPermissionInstructions', () => {
		test('should call get_injection_permission_instructions command', async () => {
			mockInvoke.mockResolvedValueOnce('Enable Accessibility in System Preferences');

			const { getInjectionPermissionInstructions } = await import('./textInjection');
			const result = await getInjectionPermissionInstructions();

			expect(mockInvoke).toHaveBeenCalledWith('get_injection_permission_instructions');
			expect(result).toBe('Enable Accessibility in System Preferences');
		});

		test('should return null when no permissions needed', async () => {
			mockInvoke.mockResolvedValueOnce(null);

			const { getInjectionPermissionInstructions } = await import('./textInjection');
			const result = await getInjectionPermissionInstructions();

			expect(result).toBeNull();
		});

		test('should propagate errors', async () => {
			mockInvoke.mockRejectedValueOnce(new Error('Permission check failed'));

			const { getInjectionPermissionInstructions } = await import('./textInjection');

			await expect(getInjectionPermissionInstructions()).rejects.toThrow(
				'Permission check failed'
			);
		});
	});

	describe('delay clamping logic', () => {
		test('should clamp correctly with Math.min/max', () => {
			const clamp = (delayMs: number) => Math.min(Math.max(0, delayMs), 50);

			expect(clamp(-50)).toBe(0);
			expect(clamp(0)).toBe(0);
			expect(clamp(25)).toBe(25);
			expect(clamp(50)).toBe(50);
			expect(clamp(100)).toBe(50);
			expect(clamp(1000)).toBe(50);
		});
	});
});

describe('textInjection error scenarios', () => {
	beforeEach(() => {
		mockInvoke.mockClear();
	});

	test('should handle permission denied error', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Permission denied: Accessibility access required'));

		const { injectText } = await import('./textInjection');

		await expect(injectText('test')).rejects.toThrow('Accessibility access required');
	});

	test('should handle no active window error', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('No active text input found'));

		const { injectText } = await import('./textInjection');

		await expect(injectText('test')).rejects.toThrow('No active text input found');
	});

	test('should handle clipboard access error', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Clipboard access failed'));

		const { injectText } = await import('./textInjection');

		await expect(injectText('test')).rejects.toThrow('Clipboard access failed');
	});
});
