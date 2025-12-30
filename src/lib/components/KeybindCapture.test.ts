import { describe, test, expect } from 'bun:test';
import {
	normalizeKeyboardEventKey,
	isModifierKey,
	validateHotkey,
	buildHotkeyString,
	parseHotkeyString
} from '$lib/services/keybind';

/**
 * Tests for KeybindCapture component logic
 */

describe('KeybindCapture Logic', () => {
	describe('normalizeKeyboardEventKey', () => {
		test('should normalize Control to Ctrl', () => {
			const event = { key: 'Control', code: 'ControlLeft' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('Ctrl');
		});

		test('should normalize Meta to Cmd', () => {
			const event = { key: 'Meta', code: 'MetaLeft' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('Cmd');
		});

		test('should keep Alt as Alt', () => {
			const event = { key: 'Alt', code: 'AltLeft' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('Alt');
		});

		test('should keep Shift as Shift', () => {
			const event = { key: 'Shift', code: 'ShiftLeft' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('Shift');
		});

		test('should normalize space to Space', () => {
			const event = { key: ' ', code: 'Space' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('Space');
		});

		test('should return null for Escape', () => {
			const event = { key: 'Escape', code: 'Escape' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe(null);
		});

		test('should uppercase letter keys', () => {
			const event = { key: 'a', code: 'KeyA' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('A');
		});

		test('should keep number keys as-is', () => {
			const event = { key: '1', code: 'Digit1' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('1');
		});

		test('should recognize function keys', () => {
			const event = { key: 'F1', code: 'F1' } as KeyboardEvent;
			expect(normalizeKeyboardEventKey(event)).toBe('F1');
		});

		test('should normalize arrow keys', () => {
			expect(normalizeKeyboardEventKey({ key: 'ArrowUp', code: 'ArrowUp' } as KeyboardEvent)).toBe('Up');
			expect(normalizeKeyboardEventKey({ key: 'ArrowDown', code: 'ArrowDown' } as KeyboardEvent)).toBe('Down');
			expect(normalizeKeyboardEventKey({ key: 'ArrowLeft', code: 'ArrowLeft' } as KeyboardEvent)).toBe('Left');
			expect(normalizeKeyboardEventKey({ key: 'ArrowRight', code: 'ArrowRight' } as KeyboardEvent)).toBe('Right');
		});

		test('should normalize special keys', () => {
			expect(normalizeKeyboardEventKey({ key: 'Tab', code: 'Tab' } as KeyboardEvent)).toBe('Tab');
			expect(normalizeKeyboardEventKey({ key: 'Enter', code: 'Enter' } as KeyboardEvent)).toBe('Enter');
			expect(normalizeKeyboardEventKey({ key: 'Backspace', code: 'Backspace' } as KeyboardEvent)).toBe('Backspace');
			expect(normalizeKeyboardEventKey({ key: 'Delete', code: 'Delete' } as KeyboardEvent)).toBe('Delete');
		});
	});

	describe('isModifierKey', () => {
		test('should identify Ctrl as modifier', () => {
			expect(isModifierKey('Ctrl')).toBe(true);
		});

		test('should identify Cmd as modifier', () => {
			expect(isModifierKey('Cmd')).toBe(true);
		});

		test('should identify Alt as modifier', () => {
			expect(isModifierKey('Alt')).toBe(true);
		});

		test('should identify Shift as modifier', () => {
			expect(isModifierKey('Shift')).toBe(true);
		});

		test('should not identify regular keys as modifiers', () => {
			expect(isModifierKey('A')).toBe(false);
			expect(isModifierKey('Space')).toBe(false);
			expect(isModifierKey('Enter')).toBe(false);
			expect(isModifierKey('F1')).toBe(false);
		});
	});

	describe('validateHotkey', () => {
		test('should accept valid hotkey with modifier and key', () => {
			expect(validateHotkey('Ctrl+A')).toBe(null);
			expect(validateHotkey('Ctrl+Shift+A')).toBe(null);
			expect(validateHotkey('Alt+Tab')).toBe(null);
		});

		test('should accept function keys without modifier', () => {
			expect(validateHotkey('F1')).toBe(null);
			expect(validateHotkey('F12')).toBe(null);
		});

		test('should reject empty hotkey', () => {
			expect(validateHotkey('')).not.toBe(null);
			expect(validateHotkey('  ')).not.toBe(null);
		});

		test('should reject hotkey without modifier (unless function key)', () => {
			const error = validateHotkey('A');
			expect(error).not.toBe(null);
			expect(error).toContain('modifier');
		});

		test('should reject hotkey with only modifiers', () => {
			const error = validateHotkey('Ctrl+Shift');
			expect(error).not.toBe(null);
			expect(error).toContain('non-modifier');
		});

		test('should reject hotkey with multiple non-modifier keys', () => {
			const error = validateHotkey('Ctrl+A+B');
			expect(error).not.toBe(null);
			expect(error).toContain('one main key');
		});
	});

	describe('buildHotkeyString', () => {
		test('should build hotkey with single modifier', () => {
			const modifiers = new Set(['Ctrl']);
			expect(buildHotkeyString(modifiers, 'A')).toBe('Ctrl+A');
		});

		test('should build hotkey with multiple modifiers in correct order', () => {
			const modifiers = new Set(['Shift', 'Ctrl', 'Alt']);
			expect(buildHotkeyString(modifiers, 'A')).toBe('Ctrl+Alt+Shift+A');
		});

		test('should build hotkey with Cmd', () => {
			const modifiers = new Set(['Cmd', 'Shift']);
			expect(buildHotkeyString(modifiers, 'Space')).toBe('Cmd+Shift+Space');
		});

		test('should return only modifiers if no main key', () => {
			const modifiers = new Set(['Ctrl', 'Shift']);
			expect(buildHotkeyString(modifiers)).toBe('Ctrl+Shift');
		});

		test('should return empty string if no modifiers and no main key', () => {
			const modifiers = new Set<string>();
			expect(buildHotkeyString(modifiers)).toBe('');
		});

		test('should return just main key if no modifiers', () => {
			const modifiers = new Set<string>();
			expect(buildHotkeyString(modifiers, 'F1')).toBe('F1');
		});
	});

	describe('parseHotkeyString', () => {
		test('should parse simple hotkey', () => {
			const result = parseHotkeyString('Ctrl+A');
			expect(result.modifiers).toEqual(['Ctrl']);
			expect(result.mainKey).toBe('A');
		});

		test('should parse complex hotkey', () => {
			const result = parseHotkeyString('Ctrl+Shift+Space');
			expect(result.modifiers).toEqual(['Ctrl', 'Shift']);
			expect(result.mainKey).toBe('Space');
		});

		test('should parse function key', () => {
			const result = parseHotkeyString('F1');
			expect(result.modifiers).toEqual([]);
			expect(result.mainKey).toBe('F1');
		});

		test('should handle modifiers only', () => {
			const result = parseHotkeyString('Ctrl+Shift');
			expect(result.modifiers).toEqual(['Ctrl', 'Shift']);
			expect(result.mainKey).toBe(null);
		});
	});
});

describe('Keybind Capture State Machine', () => {
	// Simulates the state machine behavior in KeybindCapture.svelte

	interface CaptureState {
		isCapturing: boolean;
		capturedKeys: string[];
		activeModifiers: Set<string>;
		error: string | null;
	}

	function createInitialState(): CaptureState {
		return {
			isCapturing: false,
			capturedKeys: [],
			activeModifiers: new Set(),
			error: null
		};
	}

	function startCapture(state: CaptureState): CaptureState {
		return {
			...state,
			isCapturing: true,
			capturedKeys: [],
			activeModifiers: new Set(),
			error: null
		};
	}

	function cancelCapture(state: CaptureState): CaptureState {
		return {
			...state,
			isCapturing: false,
			capturedKeys: [],
			activeModifiers: new Set()
		};
	}

	function handleKeyDown(state: CaptureState, key: string): CaptureState {
		if (!state.isCapturing) return state;

		if (isModifierKey(key)) {
			const newModifiers = new Set([...state.activeModifiers, key]);
			const hotkeyString = buildHotkeyString(newModifiers);
			return {
				...state,
				activeModifiers: newModifiers,
				capturedKeys: hotkeyString ? hotkeyString.split('+') : []
			};
		} else {
			// Non-modifier key - finalize
			const hotkeyString = buildHotkeyString(state.activeModifiers, key);
			return {
				...state,
				capturedKeys: hotkeyString ? hotkeyString.split('+') : []
			};
		}
	}

	function handleKeyUp(state: CaptureState, key: string): CaptureState {
		if (!state.isCapturing) return state;

		if (isModifierKey(key)) {
			const newModifiers = new Set([...state.activeModifiers].filter(k => k !== key));
			const hotkeyString = buildHotkeyString(newModifiers);
			return {
				...state,
				activeModifiers: newModifiers,
				capturedKeys: hotkeyString ? hotkeyString.split('+') : []
			};
		}
		return state;
	}

	test('should start in non-capturing state', () => {
		const state = createInitialState();
		expect(state.isCapturing).toBe(false);
		expect(state.capturedKeys).toEqual([]);
	});

	test('should enter capturing state when started', () => {
		let state = createInitialState();
		state = startCapture(state);
		expect(state.isCapturing).toBe(true);
		expect(state.capturedKeys).toEqual([]);
	});

	test('should capture modifier keys on keydown', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		expect(state.activeModifiers.has('Ctrl')).toBe(true);
		expect(state.capturedKeys).toEqual(['Ctrl']);
	});

	test('should capture multiple modifiers', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		state = handleKeyDown(state, 'Shift');
		expect(state.activeModifiers.has('Ctrl')).toBe(true);
		expect(state.activeModifiers.has('Shift')).toBe(true);
		expect(state.capturedKeys).toEqual(['Ctrl', 'Shift']);
	});

	test('should build final hotkey when main key pressed', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		state = handleKeyDown(state, 'Shift');
		state = handleKeyDown(state, 'A');
		expect(state.capturedKeys).toEqual(['Ctrl', 'Shift', 'A']);
	});

	test('should remove modifier on keyup', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		state = handleKeyDown(state, 'Shift');
		state = handleKeyUp(state, 'Ctrl');
		expect(state.activeModifiers.has('Ctrl')).toBe(false);
		expect(state.activeModifiers.has('Shift')).toBe(true);
		expect(state.capturedKeys).toEqual(['Shift']);
	});

	test('should cancel capture', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		state = cancelCapture(state);
		expect(state.isCapturing).toBe(false);
		expect(state.capturedKeys).toEqual([]);
		expect(state.activeModifiers.size).toBe(0);
	});

	test('should ignore keydown when not capturing', () => {
		let state = createInitialState();
		state = handleKeyDown(state, 'Ctrl');
		expect(state.capturedKeys).toEqual([]);
		expect(state.activeModifiers.size).toBe(0);
	});

	test('should handle function key as main key', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'F1');
		expect(state.capturedKeys).toEqual(['F1']);
	});

	test('should handle Ctrl+Shift+Space sequence', () => {
		let state = createInitialState();
		state = startCapture(state);
		state = handleKeyDown(state, 'Ctrl');
		expect(state.capturedKeys).toEqual(['Ctrl']);
		state = handleKeyDown(state, 'Shift');
		expect(state.capturedKeys).toEqual(['Ctrl', 'Shift']);
		state = handleKeyDown(state, 'Space');
		expect(state.capturedKeys).toEqual(['Ctrl', 'Shift', 'Space']);
	});
});
