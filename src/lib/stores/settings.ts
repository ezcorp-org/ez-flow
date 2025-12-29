/**
 * Settings store for managing user preferences
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

/**
 * Recording mode options
 */
export type RecordingMode = 'push_to_talk' | 'toggle';

/**
 * Indicator position options
 */
export type IndicatorPosition = 'cursor' | 'top_right' | 'bottom_right' | 'hidden';

/**
 * Settings interface matching Rust struct
 */
export interface Settings {
	hotkey: string;
	recording_mode: RecordingMode;
	model_id: string;
	language: string | null;
	launch_at_login: boolean;
	indicator_position: IndicatorPosition;
	auto_paste: boolean;
	auto_copy: boolean;
	injection_delay_ms: number;
	onboarding_completed: boolean;
	onboarding_skipped: boolean;
}

/**
 * Default settings
 */
export const defaultSettings: Settings = {
	hotkey: 'Ctrl+Shift+Space',
	recording_mode: 'push_to_talk',
	model_id: 'base',
	language: null,
	launch_at_login: false,
	indicator_position: 'top_right',
	auto_paste: true,
	auto_copy: true,
	injection_delay_ms: 0,
	onboarding_completed: false,
	onboarding_skipped: false
};

/**
 * Settings store
 */
function createSettingsStore() {
	const { subscribe, set, update }: Writable<Settings> = writable(defaultSettings);

	let initialized = false;

	return {
		subscribe,

		/**
		 * Initialize settings from backend
		 */
		async init(): Promise<void> {
			if (initialized) return;
			try {
				const settings = await invoke<Settings>('get_settings');
				set(settings);
				initialized = true;
			} catch (error) {
				console.error('Failed to load settings:', error);
			}
		},

		/**
		 * Update a single setting
		 */
		async updateField<K extends keyof Settings>(
			key: K,
			value: Settings[K]
		): Promise<void> {
			try {
				const updated = await invoke<Settings>('update_setting', {
					key,
					value
				});
				set(updated);
			} catch (error) {
				console.error(`Failed to update setting ${key}:`, error);
				throw error;
			}
		},

		/**
		 * Update all settings
		 */
		async updateAll(settings: Settings): Promise<void> {
			try {
				await invoke('update_settings', { settings });
				set(settings);
			} catch (error) {
				console.error('Failed to update settings:', error);
				throw error;
			}
		},

		/**
		 * Reset to defaults
		 */
		async reset(): Promise<void> {
			try {
				const defaults = await invoke<Settings>('reset_settings');
				set(defaults);
			} catch (error) {
				console.error('Failed to reset settings:', error);
				throw error;
			}
		},

		/**
		 * Local update (no persistence)
		 */
		localUpdate: update
	};
}

export const settings = createSettingsStore();

/**
 * Derived stores for individual settings
 */
export const hotkey: Readable<string> = derived(settings, ($s) => $s.hotkey);
export const recordingMode: Readable<RecordingMode> = derived(settings, ($s) => $s.recording_mode);
export const modelId: Readable<string> = derived(settings, ($s) => $s.model_id);
export const language: Readable<string | null> = derived(settings, ($s) => $s.language);
export const launchAtLogin: Readable<boolean> = derived(settings, ($s) => $s.launch_at_login);
export const indicatorPosition: Readable<IndicatorPosition> = derived(
	settings,
	($s) => $s.indicator_position
);
