/**
 * Keybind capture utility functions
 *
 * Handles normalizing keyboard events to Tauri global shortcut format
 */

/**
 * Normalize a keyboard event key to Tauri shortcut format
 * Returns null for keys that should be ignored (like Escape for cancellation)
 */
export function normalizeKeyboardEventKey(e: KeyboardEvent): string | null {
	const key = e.key;
	const code = e.code;

	// Modifier keys
	if (key === 'Control') return 'Ctrl';
	if (key === 'Meta') return 'Cmd';
	if (key === 'Alt') return 'Alt';
	if (key === 'Shift') return 'Shift';

	// Special keys
	if (key === ' ') return 'Space';
	if (key === 'Escape') return null; // Cancel
	if (key === 'Tab') return 'Tab';
	if (key === 'Enter') return 'Enter';
	if (key === 'Backspace') return 'Backspace';
	if (key === 'Delete') return 'Delete';
	if (key === 'ArrowUp') return 'Up';
	if (key === 'ArrowDown') return 'Down';
	if (key === 'ArrowLeft') return 'Left';
	if (key === 'ArrowRight') return 'Right';

	// Function keys
	if (code.startsWith('F') && /^F\d+$/.test(code)) {
		return code;
	}

	// Regular keys - use uppercase for single characters
	if (key.length === 1 && key.match(/[a-z]/i)) {
		return key.toUpperCase();
	}

	// Number keys
	if (key.match(/^[0-9]$/)) {
		return key;
	}

	return null;
}

/**
 * Check if a key is a modifier key
 */
export function isModifierKey(key: string): boolean {
	return ['Ctrl', 'Cmd', 'Alt', 'Shift'].includes(key);
}

/**
 * Validate a hotkey string
 * Returns an error message if invalid, null if valid
 */
export function validateHotkey(hotkey: string): string | null {
	if (!hotkey || hotkey.trim() === '') {
		return 'Hotkey cannot be empty';
	}

	const parts = hotkey.split('+');
	if (parts.length === 0) {
		return 'Invalid hotkey format';
	}

	const hasModifier = parts.some(p => isModifierKey(p));
	const isFunctionKey = parts.some(p => /^F\d+$/.test(p));
	const nonModifiers = parts.filter(p => !isModifierKey(p));

	// Must have at least one non-modifier key
	if (nonModifiers.length === 0) {
		return 'Hotkey must include a non-modifier key';
	}

	// Must have a modifier unless it's a function key
	if (!hasModifier && !isFunctionKey) {
		return 'Hotkey must include a modifier key (Ctrl, Alt, Shift) or be a function key';
	}

	// Should not have more than one non-modifier key
	if (nonModifiers.length > 1) {
		return 'Hotkey can only have one main key';
	}

	return null;
}

/**
 * Build a hotkey string from modifiers and a main key
 * Modifiers are ordered: Ctrl, Cmd, Alt, Shift
 */
export function buildHotkeyString(modifiers: Set<string>, mainKey?: string): string {
	const modifierOrder = ['Ctrl', 'Cmd', 'Alt', 'Shift'];
	const orderedModifiers = modifierOrder.filter(m => modifiers.has(m));

	if (mainKey) {
		return [...orderedModifiers, mainKey].join('+');
	}
	return orderedModifiers.join('+');
}

/**
 * Parse a hotkey string into its components
 */
export function parseHotkeyString(hotkey: string): { modifiers: string[]; mainKey: string | null } {
	const parts = hotkey.split('+');
	const modifiers = parts.filter(p => isModifierKey(p));
	const mainKey = parts.find(p => !isModifierKey(p)) || null;
	return { modifiers, mainKey };
}
