import { test, expect, describe, mock } from 'bun:test';

// Mock Tauri modules before importing hotkeys (which imports from Tauri)
mock.module('@tauri-apps/api/core', () => ({
	invoke: mock(() => Promise.resolve()),
	transformCallback: mock(() => 0)
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mock(() => Promise.resolve(() => {}))
}));

import { formatHotkey, parseHotkey, HOTKEY_OPTIONS, MAC_HOTKEY_OPTIONS } from './hotkeys';

describe('formatHotkey', () => {
	test('formats hotkey for non-Mac platform', () => {
		// Mock non-Mac platform
		Object.defineProperty(globalThis, 'navigator', {
			value: { platform: 'Win32' },
			writable: true
		});

		const result = formatHotkey('Ctrl+Shift+Space');
		expect(result).toBe('Ctrl + Shift + Space');
	});

	test('formats Cmd for Mac platform', () => {
		Object.defineProperty(globalThis, 'navigator', {
			value: { platform: 'MacIntel' },
			writable: true
		});

		const result = formatHotkey('Cmd+Shift+Space');
		expect(result).toBe('⌘ + ⇧ + Space');
	});

	test('formats Ctrl as ⌃ on Mac', () => {
		Object.defineProperty(globalThis, 'navigator', {
			value: { platform: 'MacIntel' },
			writable: true
		});

		const result = formatHotkey('Ctrl+Alt+R');
		expect(result).toBe('⌃ + ⌥ + R');
	});

	test('formats Alt as ⌥ on Mac', () => {
		Object.defineProperty(globalThis, 'navigator', {
			value: { platform: 'MacIntel' },
			writable: true
		});

		const result = formatHotkey('Alt+Space');
		expect(result).toBe('⌥ + Space');
	});
});

describe('parseHotkey', () => {
	test('parses Mac symbols back to standard format', () => {
		const result = parseHotkey('⌘ + ⇧ + Space');
		expect(result).toBe('Cmd+Shift+Space');
	});

	test('parses Ctrl symbol', () => {
		const result = parseHotkey('⌃ + Space');
		expect(result).toBe('Ctrl+Space');
	});

	test('parses Alt symbol', () => {
		const result = parseHotkey('⌥ + R');
		expect(result).toBe('Alt+R');
	});

	test('roundtrip: format then parse returns original (Mac)', () => {
		Object.defineProperty(globalThis, 'navigator', {
			value: { platform: 'MacIntel' },
			writable: true
		});

		const original = 'Cmd+Shift+Space';
		const formatted = formatHotkey(original);
		const parsed = parseHotkey(formatted);
		expect(parsed).toBe(original);
	});
});

describe('HOTKEY_OPTIONS', () => {
	test('contains expected number of options', () => {
		expect(HOTKEY_OPTIONS.length).toBe(6);
	});

	test('includes Ctrl+Shift+Space', () => {
		expect(HOTKEY_OPTIONS).toContain('Ctrl+Shift+Space');
	});

	test('includes function keys', () => {
		expect(HOTKEY_OPTIONS).toContain('F9');
		expect(HOTKEY_OPTIONS).toContain('F10');
	});
});

describe('MAC_HOTKEY_OPTIONS', () => {
	test('contains expected number of options', () => {
		expect(MAC_HOTKEY_OPTIONS.length).toBe(6);
	});

	test('includes Cmd+Shift+Space', () => {
		expect(MAC_HOTKEY_OPTIONS).toContain('Cmd+Shift+Space');
	});

	test('Mac options use Cmd instead of Ctrl', () => {
		const hasCmd = MAC_HOTKEY_OPTIONS.some((opt) => opt.includes('Cmd'));
		expect(hasCmd).toBe(true);
	});
});
