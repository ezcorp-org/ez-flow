/**
 * Text injection service for injecting transcribed text at cursor position
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Inject text at the current cursor position
 * Uses platform-specific clipboard + paste simulation
 */
export async function injectText(text: string): Promise<void> {
	return invoke('inject_text', { text });
}

/**
 * Set the delay between keystrokes for text injection
 * @param delayMs Delay in milliseconds (0-50ms)
 */
export async function setInjectionDelay(delayMs: number): Promise<void> {
	return invoke('set_injection_delay', { delayMs: Math.min(Math.max(0, delayMs), 50) });
}

/**
 * Get platform-specific permission instructions if needed
 * Returns null if no special permissions are required
 */
export async function getInjectionPermissionInstructions(): Promise<string | null> {
	return invoke<string | null>('get_injection_permission_instructions');
}

/**
 * Inject text with optional delay setting
 */
export async function injectTextWithDelay(text: string, delayMs?: number): Promise<void> {
	if (delayMs !== undefined && delayMs > 0) {
		await setInjectionDelay(delayMs);
	}
	return injectText(text);
}
