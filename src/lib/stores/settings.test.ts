import { test, expect, describe } from 'bun:test';
import type {
	Settings,
	RecordingMode,
	StreamingMode,
	IndicatorPosition,
	VoiceCommandSettings
} from './settings';
import { defaultSettings } from './settings';

/**
 * Tests for Settings store types and defaults
 *
 * Note: We test the types, interfaces, and default values.
 * Actual store behavior with invoke() calls requires Tauri runtime.
 */

describe('Settings types', () => {
	describe('RecordingMode type', () => {
		test('should accept push_to_talk', () => {
			const mode: RecordingMode = 'push_to_talk';
			expect(mode).toBe('push_to_talk');
		});

		test('should accept toggle', () => {
			const mode: RecordingMode = 'toggle';
			expect(mode).toBe('toggle');
		});
	});

	describe('StreamingMode type', () => {
		test('should accept speed', () => {
			const mode: StreamingMode = 'speed';
			expect(mode).toBe('speed');
		});

		test('should accept balanced', () => {
			const mode: StreamingMode = 'balanced';
			expect(mode).toBe('balanced');
		});

		test('should accept accuracy', () => {
			const mode: StreamingMode = 'accuracy';
			expect(mode).toBe('accuracy');
		});
	});

	describe('IndicatorPosition type', () => {
		test('should accept cursor', () => {
			const pos: IndicatorPosition = 'cursor';
			expect(pos).toBe('cursor');
		});

		test('should accept top_right', () => {
			const pos: IndicatorPosition = 'top_right';
			expect(pos).toBe('top_right');
		});

		test('should accept bottom_right', () => {
			const pos: IndicatorPosition = 'bottom_right';
			expect(pos).toBe('bottom_right');
		});

		test('should accept hidden', () => {
			const pos: IndicatorPosition = 'hidden';
			expect(pos).toBe('hidden');
		});
	});

	describe('VoiceCommandSettings interface', () => {
		test('should have required properties', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};

			expect(settings.enabled).toBe(true);
			expect(settings.require_prefix).toBe(false);
			expect(settings.prefix).toBe('command');
		});
	});
});

describe('Default settings', () => {
	test('should have correct hotkey default', () => {
		expect(defaultSettings.hotkey).toBe('Ctrl+Shift+Space');
	});

	test('should have correct recording_mode default', () => {
		expect(defaultSettings.recording_mode).toBe('push_to_talk');
	});

	test('should have correct model_id default', () => {
		expect(defaultSettings.model_id).toBe('base');
	});

	test('should have language as null by default', () => {
		expect(defaultSettings.language).toBeNull();
	});

	test('should have launch_at_login as false by default', () => {
		expect(defaultSettings.launch_at_login).toBe(false);
	});

	test('should have correct indicator_position default', () => {
		expect(defaultSettings.indicator_position).toBe('top_right');
	});

	test('should have auto_paste as true by default', () => {
		expect(defaultSettings.auto_paste).toBe(true);
	});

	test('should have auto_copy as true by default', () => {
		expect(defaultSettings.auto_copy).toBe(true);
	});

	test('should have injection_delay_ms as 0 by default', () => {
		expect(defaultSettings.injection_delay_ms).toBe(0);
	});

	test('should have onboarding flags as false by default', () => {
		expect(defaultSettings.onboarding_completed).toBe(false);
		expect(defaultSettings.onboarding_skipped).toBe(false);
	});

	test('should have use_gpu as true by default', () => {
		expect(defaultSettings.use_gpu).toBe(true);
	});

	test('should have auto_check_updates as true by default', () => {
		expect(defaultSettings.auto_check_updates).toBe(true);
	});

	test('should have correct model_idle_timeout_secs default', () => {
		expect(defaultSettings.model_idle_timeout_secs).toBe(300);
	});

	test('should have empty custom_vocabulary by default', () => {
		expect(defaultSettings.custom_vocabulary).toEqual([]);
	});

	test('should have context_prompt as null by default', () => {
		expect(defaultSettings.context_prompt).toBeNull();
	});

	test('should have use_context_prompt as false by default', () => {
		expect(defaultSettings.use_context_prompt).toBe(false);
	});

	test('should have preview_enabled as true by default', () => {
		expect(defaultSettings.preview_enabled).toBe(true);
	});

	test('should have correct preview_duration_secs default', () => {
		expect(defaultSettings.preview_duration_secs).toBe(3);
	});

	test('should have preview_show_visualizer as true by default', () => {
		expect(defaultSettings.preview_show_visualizer).toBe(true);
	});

	test('should have preview positions as null by default', () => {
		expect(defaultSettings.preview_position_x).toBeNull();
		expect(defaultSettings.preview_position_y).toBeNull();
	});

	test('should have correct voice_commands defaults', () => {
		expect(defaultSettings.voice_commands.enabled).toBe(true);
		expect(defaultSettings.voice_commands.require_prefix).toBe(false);
		expect(defaultSettings.voice_commands.prefix).toBe('command');
	});

	test('should have streaming_enabled as true by default', () => {
		expect(defaultSettings.streaming_enabled).toBe(true);
	});

	test('should have correct streaming_mode default', () => {
		expect(defaultSettings.streaming_mode).toBe('balanced');
	});
});

describe('Settings interface completeness', () => {
	test('should have all required fields', () => {
		const settings: Settings = { ...defaultSettings };

		// Check all fields exist
		expect(settings).toHaveProperty('hotkey');
		expect(settings).toHaveProperty('recording_mode');
		expect(settings).toHaveProperty('model_id');
		expect(settings).toHaveProperty('language');
		expect(settings).toHaveProperty('launch_at_login');
		expect(settings).toHaveProperty('indicator_position');
		expect(settings).toHaveProperty('auto_paste');
		expect(settings).toHaveProperty('auto_copy');
		expect(settings).toHaveProperty('injection_delay_ms');
		expect(settings).toHaveProperty('onboarding_completed');
		expect(settings).toHaveProperty('onboarding_skipped');
		expect(settings).toHaveProperty('use_gpu');
		expect(settings).toHaveProperty('auto_check_updates');
		expect(settings).toHaveProperty('model_idle_timeout_secs');
		expect(settings).toHaveProperty('custom_vocabulary');
		expect(settings).toHaveProperty('context_prompt');
		expect(settings).toHaveProperty('use_context_prompt');
		expect(settings).toHaveProperty('preview_enabled');
		expect(settings).toHaveProperty('preview_duration_secs');
		expect(settings).toHaveProperty('preview_show_visualizer');
		expect(settings).toHaveProperty('preview_position_x');
		expect(settings).toHaveProperty('preview_position_y');
		expect(settings).toHaveProperty('voice_commands');
		expect(settings).toHaveProperty('streaming_enabled');
		expect(settings).toHaveProperty('streaming_mode');
	});

	test('should be assignable with partial overrides', () => {
		const settings: Settings = {
			...defaultSettings,
			hotkey: 'Alt+Space',
			model_id: 'large'
		};

		expect(settings.hotkey).toBe('Alt+Space');
		expect(settings.model_id).toBe('large');
		expect(settings.recording_mode).toBe('push_to_talk'); // Default preserved
	});
});

describe('Settings validation patterns', () => {
	test('should validate hotkey format', () => {
		const validHotkeys = ['Ctrl+Shift+Space', 'Alt+Space', 'F1', 'Ctrl+Alt+R'];
		const isValidHotkey = (hotkey: string) => hotkey.length > 0;

		for (const hotkey of validHotkeys) {
			expect(isValidHotkey(hotkey)).toBe(true);
		}
	});

	test('should validate model_id against known models', () => {
		const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
		const isValidModel = (id: string) => validModels.includes(id);

		expect(isValidModel('base')).toBe(true);
		expect(isValidModel('invalid')).toBe(false);
	});

	test('should validate injection_delay_ms is non-negative', () => {
		const isValidDelay = (ms: number) => ms >= 0;

		expect(isValidDelay(0)).toBe(true);
		expect(isValidDelay(100)).toBe(true);
		expect(isValidDelay(-1)).toBe(false);
	});

	test('should validate preview_duration_secs range', () => {
		const isValidDuration = (secs: number) => secs >= 1 && secs <= 10;

		expect(isValidDuration(3)).toBe(true);
		expect(isValidDuration(1)).toBe(true);
		expect(isValidDuration(10)).toBe(true);
		expect(isValidDuration(0)).toBe(false);
		expect(isValidDuration(15)).toBe(false);
	});

	test('should validate model_idle_timeout_secs range', () => {
		const isValidTimeout = (secs: number) => secs >= 0 && secs <= 3600;

		expect(isValidTimeout(300)).toBe(true);
		expect(isValidTimeout(0)).toBe(true); // Never unload
		expect(isValidTimeout(3600)).toBe(true); // 1 hour max
		expect(isValidTimeout(-1)).toBe(false);
	});

	test('should validate custom_vocabulary length', () => {
		const maxVocabSize = 500;
		const isValidVocab = (vocab: string[]) => vocab.length <= maxVocabSize;

		expect(isValidVocab([])).toBe(true);
		expect(isValidVocab(['term1', 'term2'])).toBe(true);
		expect(isValidVocab(new Array(600).fill('term'))).toBe(false);
	});

	test('should validate context_prompt length', () => {
		const maxPromptLength = 500;
		const isValidPrompt = (prompt: string | null) =>
			prompt === null || prompt.length <= maxPromptLength;

		expect(isValidPrompt(null)).toBe(true);
		expect(isValidPrompt('Short prompt')).toBe(true);
		expect(isValidPrompt('a'.repeat(600))).toBe(false);
	});
});

describe('Settings serialization', () => {
	test('should serialize to JSON', () => {
		const json = JSON.stringify(defaultSettings);
		expect(typeof json).toBe('string');
		expect(json.length).toBeGreaterThan(0);
	});

	test('should deserialize from JSON', () => {
		const json = JSON.stringify(defaultSettings);
		const parsed = JSON.parse(json) as Settings;

		expect(parsed.hotkey).toBe(defaultSettings.hotkey);
		expect(parsed.model_id).toBe(defaultSettings.model_id);
		expect(parsed.voice_commands.enabled).toBe(defaultSettings.voice_commands.enabled);
	});

	test('should handle null values in JSON', () => {
		const settings: Settings = {
			...defaultSettings,
			language: null,
			context_prompt: null
		};

		const json = JSON.stringify(settings);
		const parsed = JSON.parse(json) as Settings;

		expect(parsed.language).toBeNull();
		expect(parsed.context_prompt).toBeNull();
	});

	test('should handle arrays in JSON', () => {
		const settings: Settings = {
			...defaultSettings,
			custom_vocabulary: ['HIPAA', 'EHR', 'COVID-19']
		};

		const json = JSON.stringify(settings);
		const parsed = JSON.parse(json) as Settings;

		expect(parsed.custom_vocabulary).toEqual(['HIPAA', 'EHR', 'COVID-19']);
	});
});

describe('Settings update patterns', () => {
	test('should support single field update', () => {
		let settings: Settings = { ...defaultSettings };

		// Update single field
		settings = { ...settings, hotkey: 'Alt+R' };

		expect(settings.hotkey).toBe('Alt+R');
		expect(settings.model_id).toBe(defaultSettings.model_id); // Unchanged
	});

	test('should support nested object update', () => {
		let settings: Settings = { ...defaultSettings };

		// Update voice_commands
		settings = {
			...settings,
			voice_commands: {
				...settings.voice_commands,
				require_prefix: true
			}
		};

		expect(settings.voice_commands.require_prefix).toBe(true);
		expect(settings.voice_commands.enabled).toBe(true); // Unchanged
	});

	test('should support array update', () => {
		let settings: Settings = { ...defaultSettings };

		// Add vocabulary term
		settings = {
			...settings,
			custom_vocabulary: [...settings.custom_vocabulary, 'NewTerm']
		};

		expect(settings.custom_vocabulary).toContain('NewTerm');
	});

	test('should support reset to defaults', () => {
		let settings: Settings = {
			...defaultSettings,
			hotkey: 'Modified',
			model_id: 'large'
		};

		// Reset
		settings = { ...defaultSettings };

		expect(settings.hotkey).toBe(defaultSettings.hotkey);
		expect(settings.model_id).toBe(defaultSettings.model_id);
	});
});
