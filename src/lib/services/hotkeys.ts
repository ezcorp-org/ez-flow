/**
 * Hotkey service for managing global keyboard shortcuts
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Format a hotkey string for display based on platform
 */
export function formatHotkey(hotkey: string): string {
	const isMac =
		typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

	return hotkey
		.replace(/Cmd/g, isMac ? '⌘' : 'Ctrl')
		.replace(/Ctrl/g, isMac ? '⌃' : 'Ctrl')
		.replace(/Shift/g, isMac ? '⇧' : 'Shift')
		.replace(/Alt/g, isMac ? '⌥' : 'Alt')
		.replace(/\+/g, ' + ');
}

/**
 * Parse a display hotkey back to the internal format
 */
export function parseHotkey(display: string): string {
	return display
		.replace(/⌘/g, 'Cmd')
		.replace(/⌃/g, 'Ctrl')
		.replace(/⇧/g, 'Shift')
		.replace(/⌥/g, 'Alt')
		.replace(/ \+ /g, '+');
}

/**
 * Get the currently registered hotkey
 */
export async function getCurrentHotkey(): Promise<string | null> {
	return invoke<string | null>('get_current_hotkey');
}

/**
 * Get the default hotkey for this platform
 */
export async function getDefaultHotkey(): Promise<string> {
	return invoke<string>('get_platform_default_hotkey');
}

/**
 * Set a new global hotkey
 */
export async function setHotkey(hotkey: string): Promise<void> {
	return invoke('set_hotkey', { hotkey });
}

/**
 * Clear the current hotkey
 */
export async function clearHotkey(): Promise<void> {
	return invoke('clear_hotkey');
}

/**
 * Check if a hotkey is available (not conflicting)
 */
export async function checkHotkeyAvailable(hotkey: string): Promise<boolean> {
	return invoke<boolean>('check_hotkey_available', { hotkey });
}

/**
 * Check if a hotkey is currently registered
 */
export async function isHotkeyRegistered(): Promise<boolean> {
	return invoke<boolean>('is_hotkey_registered');
}

/**
 * Get the last hotkey error if any
 */
export async function getHotkeyError(): Promise<string | null> {
	return invoke<string | null>('get_hotkey_error');
}

/**
 * Listen for hotkey recording started events
 */
export async function onHotkeyRecordingStarted(
	callback: () => void
): Promise<UnlistenFn> {
	return listen('hotkey://recording-started', callback);
}

/**
 * Listen for hotkey recording stopped events
 */
export async function onHotkeyRecordingStopped(
	callback: () => void
): Promise<UnlistenFn> {
	return listen('hotkey://recording-stopped', callback);
}

/**
 * Listen for hotkey registration events
 */
export async function onHotkeyRegistered(
	callback: (hotkey: string) => void
): Promise<UnlistenFn> {
	return listen<string>('hotkey://registered', (event) =>
		callback(event.payload)
	);
}

/**
 * Listen for hotkey registration failure events
 */
export async function onHotkeyRegistrationFailed(
	callback: (error: string) => void
): Promise<UnlistenFn> {
	return listen<string>('hotkey://registration-failed', (event) =>
		callback(event.payload)
	);
}

/**
 * Common hotkey options for configuration
 */
export const HOTKEY_OPTIONS = [
	'Ctrl+Shift+Space',
	'Ctrl+Alt+Space',
	'Ctrl+Shift+R',
	'Alt+Shift+R',
	'F9',
	'F10'
] as const;

/**
 * Mac-specific hotkey options
 */
export const MAC_HOTKEY_OPTIONS = [
	'Cmd+Shift+Space',
	'Cmd+Alt+Space',
	'Cmd+Shift+R',
	'Alt+Shift+R',
	'F9',
	'F10'
] as const;
