import { test, expect, describe, mock } from 'bun:test';
import { formatHotkey, parseHotkey, HOTKEY_OPTIONS, MAC_HOTKEY_OPTIONS } from '$lib/services/hotkeys';

// Mock Tauri modules before dynamic import of component
mock.module('@tauri-apps/api/core', () => ({
	invoke: mock(() => Promise.resolve()),
	transformCallback: mock(() => 0)
}));

mock.module('@tauri-apps/api/event', () => ({
	listen: mock(() => Promise.resolve(() => {}))
}));

/**
 * Tests for HotkeyDisplay component logic
 */

describe('HotkeyDisplay', () => {
	test('should be importable', async () => {
		const module = await import('./HotkeyDisplay.svelte');
		expect(module.default).toBeDefined();
	});

	describe('formatHotkey', () => {
		describe('non-Mac platform formatting', () => {
			// Note: In test environment, navigator.platform is not Mac, so Ctrl stays as Ctrl
			test('should format Ctrl+Shift+Space', () => {
				const result = formatHotkey('Ctrl+Shift+Space');
				expect(result).toBe('Ctrl + Shift + Space');
			});

			test('should format Alt+Tab', () => {
				const result = formatHotkey('Alt+Tab');
				expect(result).toBe('Alt + Tab');
			});

			test('should format single modifier with key', () => {
				const result = formatHotkey('Ctrl+A');
				expect(result).toBe('Ctrl + A');
			});

			test('should format function key alone', () => {
				const result = formatHotkey('F9');
				expect(result).toBe('F9');
			});

			test('should format F10', () => {
				const result = formatHotkey('F10');
				expect(result).toBe('F10');
			});

			test('should format complex multi-modifier hotkey', () => {
				const result = formatHotkey('Ctrl+Alt+Shift+R');
				expect(result).toBe('Ctrl + Alt + Shift + R');
			});

			test('should handle hotkey with Cmd (converts to Ctrl on non-Mac)', () => {
				const result = formatHotkey('Cmd+Shift+Space');
				expect(result).toBe('Ctrl + Shift + Space');
			});

			test('should format Ctrl+Alt+Space', () => {
				const result = formatHotkey('Ctrl+Alt+Space');
				expect(result).toBe('Ctrl + Alt + Space');
			});

			test('should format Ctrl+Shift+R', () => {
				const result = formatHotkey('Ctrl+Shift+R');
				expect(result).toBe('Ctrl + Shift + R');
			});

			test('should format Alt+Shift+R', () => {
				const result = formatHotkey('Alt+Shift+R');
				expect(result).toBe('Alt + Shift + R');
			});
		});

		describe('edge cases', () => {
			test('should handle empty string', () => {
				const result = formatHotkey('');
				expect(result).toBe('');
			});

			test('should handle single key without modifiers', () => {
				const result = formatHotkey('A');
				expect(result).toBe('A');
			});

			test('should handle Space key alone', () => {
				const result = formatHotkey('Space');
				expect(result).toBe('Space');
			});

			test('should handle Enter key', () => {
				const result = formatHotkey('Enter');
				expect(result).toBe('Enter');
			});

			test('should handle arrow keys', () => {
				expect(formatHotkey('Ctrl+Up')).toBe('Ctrl + Up');
				expect(formatHotkey('Ctrl+Down')).toBe('Ctrl + Down');
				expect(formatHotkey('Ctrl+Left')).toBe('Ctrl + Left');
				expect(formatHotkey('Ctrl+Right')).toBe('Ctrl + Right');
			});

			test('should handle multiple plus signs correctly', () => {
				const result = formatHotkey('Ctrl+Shift+Alt+Delete');
				expect(result).toBe('Ctrl + Shift + Alt + Delete');
			});

			test('should handle Tab key', () => {
				expect(formatHotkey('Ctrl+Tab')).toBe('Ctrl + Tab');
				expect(formatHotkey('Alt+Tab')).toBe('Alt + Tab');
			});

			test('should handle Escape key', () => {
				expect(formatHotkey('Ctrl+Escape')).toBe('Ctrl + Escape');
			});

			test('should handle Backspace key', () => {
				expect(formatHotkey('Ctrl+Backspace')).toBe('Ctrl + Backspace');
			});

			test('should handle Delete key', () => {
				expect(formatHotkey('Ctrl+Delete')).toBe('Ctrl + Delete');
			});

			test('should handle Home and End keys', () => {
				expect(formatHotkey('Ctrl+Home')).toBe('Ctrl + Home');
				expect(formatHotkey('Ctrl+End')).toBe('Ctrl + End');
			});

			test('should handle PageUp and PageDown keys', () => {
				expect(formatHotkey('Ctrl+PageUp')).toBe('Ctrl + PageUp');
				expect(formatHotkey('Ctrl+PageDown')).toBe('Ctrl + PageDown');
			});

			test('should handle numeric keys', () => {
				expect(formatHotkey('Ctrl+1')).toBe('Ctrl + 1');
				expect(formatHotkey('Alt+0')).toBe('Alt + 0');
				expect(formatHotkey('Ctrl+Shift+5')).toBe('Ctrl + Shift + 5');
			});

			test('should handle numpad keys', () => {
				expect(formatHotkey('Ctrl+Numpad0')).toBe('Ctrl + Numpad0');
				expect(formatHotkey('Ctrl+NumpadAdd')).toBe('Ctrl + NumpadAdd');
			});
		});

		describe('Mac platform symbol formatting simulation', () => {
			// These tests simulate what the formatHotkey function would return on Mac
			// by manually applying the Mac symbol replacements

			function simulateMacFormat(hotkey: string): string {
				return hotkey
					.replace(/Cmd/g, '\u2318')
					.replace(/Ctrl/g, '\u2303')
					.replace(/Shift/g, '\u21E7')
					.replace(/Alt/g, '\u2325')
					.replace(/\+/g, ' + ');
			}

			test('should format Cmd to Mac command symbol', () => {
				const result = simulateMacFormat('Cmd+Space');
				expect(result).toBe('\u2318 + Space');
			});

			test('should format Ctrl to Mac control symbol', () => {
				const result = simulateMacFormat('Ctrl+A');
				expect(result).toBe('\u2303 + A');
			});

			test('should format Shift to Mac shift symbol', () => {
				const result = simulateMacFormat('Shift+Tab');
				expect(result).toBe('\u21E7 + Tab');
			});

			test('should format Alt to Mac option symbol', () => {
				const result = simulateMacFormat('Alt+F4');
				expect(result).toBe('\u2325 + F4');
			});

			test('should format complex Mac hotkey with multiple modifiers', () => {
				const result = simulateMacFormat('Cmd+Shift+Space');
				expect(result).toBe('\u2318 + \u21E7 + Space');
			});

			test('should format Cmd+Alt+Space for Mac', () => {
				const result = simulateMacFormat('Cmd+Alt+Space');
				expect(result).toBe('\u2318 + \u2325 + Space');
			});

			test('should not modify function keys on Mac', () => {
				const result = simulateMacFormat('F9');
				expect(result).toBe('F9');
			});

			test('should handle all Mac modifier combinations', () => {
				const result = simulateMacFormat('Cmd+Ctrl+Alt+Shift+A');
				expect(result).toBe('\u2318 + \u2303 + \u2325 + \u21E7 + A');
			});
		});
	});

	describe('parseHotkey', () => {
		test('should parse display format back to internal format', () => {
			const display = 'Ctrl + Shift + Space';
			const result = parseHotkey(display);
			expect(result).toBe('Ctrl+Shift+Space');
		});

		test('should parse Mac symbols back to modifiers', () => {
			expect(parseHotkey('⌘')).toBe('Cmd');
			expect(parseHotkey('⌃')).toBe('Ctrl');
			expect(parseHotkey('⇧')).toBe('Shift');
			expect(parseHotkey('⌥')).toBe('Alt');
		});

		test('should parse complex Mac hotkey', () => {
			const display = '⌘ + ⇧ + Space';
			const result = parseHotkey(display);
			expect(result).toBe('Cmd+Shift+Space');
		});

		test('should handle function keys', () => {
			const display = 'F9';
			const result = parseHotkey(display);
			expect(result).toBe('F9');
		});

		test('should handle empty string', () => {
			const result = parseHotkey('');
			expect(result).toBe('');
		});

		test('should parse Alt + Tab back to Alt+Tab', () => {
			const result = parseHotkey('Alt + Tab');
			expect(result).toBe('Alt+Tab');
		});
	});

	describe('formatHotkey and parseHotkey roundtrip', () => {
		test('should roundtrip Ctrl+Shift+Space', () => {
			const original = 'Ctrl+Shift+Space';
			const formatted = formatHotkey(original);
			const parsed = parseHotkey(formatted);
			expect(parsed).toBe(original);
		});

		test('should roundtrip F9', () => {
			const original = 'F9';
			const formatted = formatHotkey(original);
			const parsed = parseHotkey(formatted);
			expect(parsed).toBe(original);
		});

		test('should roundtrip Alt+Shift+R', () => {
			const original = 'Alt+Shift+R';
			const formatted = formatHotkey(original);
			const parsed = parseHotkey(formatted);
			expect(parsed).toBe(original);
		});

		test('should roundtrip all HOTKEY_OPTIONS', () => {
			for (const hotkey of HOTKEY_OPTIONS) {
				const formatted = formatHotkey(hotkey);
				const parsed = parseHotkey(formatted);
				expect(parsed).toBe(hotkey);
			}
		});
	});

	describe('HOTKEY_OPTIONS constants', () => {
		test('should have expected default options', () => {
			expect(HOTKEY_OPTIONS).toContain('Ctrl+Shift+Space');
			expect(HOTKEY_OPTIONS).toContain('Ctrl+Alt+Space');
			expect(HOTKEY_OPTIONS).toContain('Ctrl+Shift+R');
			expect(HOTKEY_OPTIONS).toContain('Alt+Shift+R');
			expect(HOTKEY_OPTIONS).toContain('F9');
			expect(HOTKEY_OPTIONS).toContain('F10');
		});

		test('should have 6 options', () => {
			expect(HOTKEY_OPTIONS.length).toBe(6);
		});

		test('MAC_HOTKEY_OPTIONS should use Cmd instead of Ctrl', () => {
			expect(MAC_HOTKEY_OPTIONS).toContain('Cmd+Shift+Space');
			expect(MAC_HOTKEY_OPTIONS).toContain('Cmd+Alt+Space');
			expect(MAC_HOTKEY_OPTIONS).toContain('Cmd+Shift+R');
		});

		test('MAC_HOTKEY_OPTIONS should have same length as HOTKEY_OPTIONS', () => {
			expect(MAC_HOTKEY_OPTIONS.length).toBe(HOTKEY_OPTIONS.length);
		});

		test('MAC_HOTKEY_OPTIONS should share function keys with HOTKEY_OPTIONS', () => {
			expect(MAC_HOTKEY_OPTIONS).toContain('F9');
			expect(MAC_HOTKEY_OPTIONS).toContain('F10');
			expect(MAC_HOTKEY_OPTIONS).toContain('Alt+Shift+R');
		});
	});

	describe('display state logic', () => {
		interface DisplayState {
			hotkey: string | null;
			isRegistered: boolean;
			error: string | null;
		}

		function getDisplayHotkey(state: DisplayState): string {
			return state.hotkey ? formatHotkey(state.hotkey) : 'Not set';
		}

		function shouldShowInactive(state: DisplayState): boolean {
			return !state.isRegistered;
		}

		function shouldShowError(state: DisplayState): boolean {
			return state.error !== null;
		}

		test('should display "Not set" when hotkey is null', () => {
			const state: DisplayState = {
				hotkey: null,
				isRegistered: false,
				error: null
			};
			expect(getDisplayHotkey(state)).toBe('Not set');
		});

		test('should display formatted hotkey when set', () => {
			const state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: true,
				error: null
			};
			expect(getDisplayHotkey(state)).toBe('Ctrl + Shift + Space');
		});

		test('should show inactive when not registered', () => {
			const state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: false,
				error: null
			};
			expect(shouldShowInactive(state)).toBe(true);
		});

		test('should not show inactive when registered', () => {
			const state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: true,
				error: null
			};
			expect(shouldShowInactive(state)).toBe(false);
		});

		test('should show error indicator when error exists', () => {
			const state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: false,
				error: 'Hotkey already in use by another application'
			};
			expect(shouldShowError(state)).toBe(true);
		});

		test('should not show error indicator when no error', () => {
			const state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: true,
				error: null
			};
			expect(shouldShowError(state)).toBe(false);
		});

		test('should handle registration success state transition', () => {
			let state: DisplayState = {
				hotkey: null,
				isRegistered: false,
				error: null
			};

			// Simulate successful registration
			state = {
				...state,
				hotkey: 'F9',
				isRegistered: true,
				error: null
			};

			expect(getDisplayHotkey(state)).toBe('F9');
			expect(shouldShowInactive(state)).toBe(false);
			expect(shouldShowError(state)).toBe(false);
		});

		test('should handle registration failure state transition', () => {
			let state: DisplayState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: true,
				error: null
			};

			// Simulate registration failure
			state = {
				...state,
				isRegistered: false,
				error: 'Failed to register hotkey'
			};

			expect(getDisplayHotkey(state)).toBe('Ctrl + Shift + Space');
			expect(shouldShowInactive(state)).toBe(true);
			expect(shouldShowError(state)).toBe(true);
		});
	});

	describe('event handling simulation', () => {
		interface EventState {
			hotkey: string | null;
			isRegistered: boolean;
			error: string | null;
		}

		function handleHotkeyRegistered(_state: EventState, newHotkey: string): EventState {
			return {
				hotkey: newHotkey,
				isRegistered: true,
				error: null
			};
		}

		function handleRegistrationFailed(state: EventState, errorMsg: string): EventState {
			return {
				...state,
				error: errorMsg,
				isRegistered: false
			};
		}

		test('should update state on hotkey registered event', () => {
			const state: EventState = {
				hotkey: null,
				isRegistered: false,
				error: null
			};

			const newState = handleHotkeyRegistered(state, 'Ctrl+Shift+Space');

			expect(newState.hotkey).toBe('Ctrl+Shift+Space');
			expect(newState.isRegistered).toBe(true);
			expect(newState.error).toBe(null);
		});

		test('should update state on registration failed event', () => {
			const state: EventState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: true,
				error: null
			};

			const newState = handleRegistrationFailed(state, 'Hotkey conflict detected');

			expect(newState.hotkey).toBe('Ctrl+Shift+Space');
			expect(newState.isRegistered).toBe(false);
			expect(newState.error).toBe('Hotkey conflict detected');
		});

		test('should clear error when new hotkey registered', () => {
			const state: EventState = {
				hotkey: 'Ctrl+Shift+Space',
				isRegistered: false,
				error: 'Previous error'
			};

			const newState = handleHotkeyRegistered(state, 'F9');

			expect(newState.hotkey).toBe('F9');
			expect(newState.isRegistered).toBe(true);
			expect(newState.error).toBe(null);
		});

		test('should preserve hotkey when registration fails', () => {
			const state: EventState = {
				hotkey: 'Ctrl+Alt+Space',
				isRegistered: true,
				error: null
			};

			const newState = handleRegistrationFailed(state, 'System error');

			expect(newState.hotkey).toBe('Ctrl+Alt+Space');
		});
	});
});
