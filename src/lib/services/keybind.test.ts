import { test, expect, describe } from 'bun:test';
import {
	normalizeKeyboardEventKey,
	isModifierKey,
	validateHotkey,
	buildHotkeyString,
	parseHotkeyString
} from './keybind';

// Mock KeyboardEvent for testing
function createMockKeyboardEvent(key: string, code: string): KeyboardEvent {
	return { key, code } as KeyboardEvent;
}

describe('normalizeKeyboardEventKey', () => {
	test('normalizes Control to Ctrl', () => {
		const event = createMockKeyboardEvent('Control', 'ControlLeft');
		expect(normalizeKeyboardEventKey(event)).toBe('Ctrl');
	});

	test('normalizes Meta to Cmd', () => {
		const event = createMockKeyboardEvent('Meta', 'MetaLeft');
		expect(normalizeKeyboardEventKey(event)).toBe('Cmd');
	});

	test('normalizes Alt key', () => {
		const event = createMockKeyboardEvent('Alt', 'AltLeft');
		expect(normalizeKeyboardEventKey(event)).toBe('Alt');
	});

	test('normalizes Shift key', () => {
		const event = createMockKeyboardEvent('Shift', 'ShiftLeft');
		expect(normalizeKeyboardEventKey(event)).toBe('Shift');
	});

	test('normalizes Space key', () => {
		const event = createMockKeyboardEvent(' ', 'Space');
		expect(normalizeKeyboardEventKey(event)).toBe('Space');
	});

	test('returns null for Escape (cancel)', () => {
		const event = createMockKeyboardEvent('Escape', 'Escape');
		expect(normalizeKeyboardEventKey(event)).toBeNull();
	});

	test('normalizes arrow keys', () => {
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('ArrowUp', 'ArrowUp'))).toBe('Up');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('ArrowDown', 'ArrowDown'))).toBe(
			'Down'
		);
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('ArrowLeft', 'ArrowLeft'))).toBe(
			'Left'
		);
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('ArrowRight', 'ArrowRight'))).toBe(
			'Right'
		);
	});

	test('normalizes function keys', () => {
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('F1', 'F1'))).toBe('F1');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('F9', 'F9'))).toBe('F9');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('F10', 'F10'))).toBe('F10');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('F12', 'F12'))).toBe('F12');
	});

	test('normalizes letter keys to uppercase', () => {
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('a', 'KeyA'))).toBe('A');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('z', 'KeyZ'))).toBe('Z');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('A', 'KeyA'))).toBe('A');
	});

	test('normalizes number keys', () => {
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('1', 'Digit1'))).toBe('1');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('9', 'Digit9'))).toBe('9');
	});

	test('normalizes special keys', () => {
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('Tab', 'Tab'))).toBe('Tab');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('Enter', 'Enter'))).toBe('Enter');
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('Backspace', 'Backspace'))).toBe(
			'Backspace'
		);
		expect(normalizeKeyboardEventKey(createMockKeyboardEvent('Delete', 'Delete'))).toBe('Delete');
	});
});

describe('isModifierKey', () => {
	test('identifies modifier keys', () => {
		expect(isModifierKey('Ctrl')).toBe(true);
		expect(isModifierKey('Cmd')).toBe(true);
		expect(isModifierKey('Alt')).toBe(true);
		expect(isModifierKey('Shift')).toBe(true);
	});

	test('rejects non-modifier keys', () => {
		expect(isModifierKey('Space')).toBe(false);
		expect(isModifierKey('A')).toBe(false);
		expect(isModifierKey('F1')).toBe(false);
		expect(isModifierKey('Enter')).toBe(false);
	});
});

describe('validateHotkey', () => {
	test('accepts valid hotkey with modifier', () => {
		expect(validateHotkey('Ctrl+Shift+Space')).toBeNull();
		expect(validateHotkey('Cmd+Shift+R')).toBeNull();
		expect(validateHotkey('Alt+A')).toBeNull();
		expect(validateHotkey('Ctrl+1')).toBeNull();
	});

	test('accepts function keys without modifiers', () => {
		expect(validateHotkey('F9')).toBeNull();
		expect(validateHotkey('F10')).toBeNull();
		expect(validateHotkey('F12')).toBeNull();
	});

	test('accepts function keys with modifiers', () => {
		expect(validateHotkey('Ctrl+F9')).toBeNull();
		expect(validateHotkey('Shift+F1')).toBeNull();
	});

	test('rejects empty hotkey', () => {
		expect(validateHotkey('')).toBe('Hotkey cannot be empty');
		expect(validateHotkey('   ')).toBe('Hotkey cannot be empty');
	});

	test('rejects modifier-only hotkey', () => {
		expect(validateHotkey('Ctrl')).toBe('Hotkey must include a non-modifier key');
		expect(validateHotkey('Ctrl+Shift')).toBe('Hotkey must include a non-modifier key');
	});

	test('rejects non-modifier key without modifier (except function keys)', () => {
		expect(validateHotkey('Space')).toBe(
			'Hotkey must include a modifier key (Ctrl, Alt, Shift) or be a function key'
		);
		expect(validateHotkey('A')).toBe(
			'Hotkey must include a modifier key (Ctrl, Alt, Shift) or be a function key'
		);
	});
});

describe('buildHotkeyString', () => {
	test('builds string with modifiers in correct order', () => {
		const modifiers = new Set(['Shift', 'Ctrl', 'Alt']);
		expect(buildHotkeyString(modifiers, 'Space')).toBe('Ctrl+Alt+Shift+Space');
	});

	test('builds string with single modifier', () => {
		const modifiers = new Set(['Ctrl']);
		expect(buildHotkeyString(modifiers, 'A')).toBe('Ctrl+A');
	});

	test('builds string without main key', () => {
		const modifiers = new Set(['Ctrl', 'Shift']);
		expect(buildHotkeyString(modifiers)).toBe('Ctrl+Shift');
	});

	test('builds string with main key only', () => {
		const modifiers = new Set<string>();
		expect(buildHotkeyString(modifiers, 'F9')).toBe('F9');
	});
});

describe('parseHotkeyString', () => {
	test('parses hotkey with modifiers', () => {
		const result = parseHotkeyString('Ctrl+Shift+Space');
		expect(result.modifiers).toEqual(['Ctrl', 'Shift']);
		expect(result.mainKey).toBe('Space');
	});

	test('parses function key only', () => {
		const result = parseHotkeyString('F9');
		expect(result.modifiers).toEqual([]);
		expect(result.mainKey).toBe('F9');
	});

	test('parses single modifier with main key', () => {
		const result = parseHotkeyString('Alt+R');
		expect(result.modifiers).toEqual(['Alt']);
		expect(result.mainKey).toBe('R');
	});

	test('parses Cmd modifier (macOS)', () => {
		const result = parseHotkeyString('Cmd+Shift+Space');
		expect(result.modifiers).toEqual(['Cmd', 'Shift']);
		expect(result.mainKey).toBe('Space');
	});
});
