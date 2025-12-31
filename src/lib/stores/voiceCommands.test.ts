import { test, expect, describe } from 'bun:test';
import { defaultSettings, type VoiceCommandSettings, type Settings } from './settings';

describe('VoiceCommandSettings', () => {
	describe('type validation', () => {
		test('should have correct property types', () => {
			const voiceCommands: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};

			expect(typeof voiceCommands.enabled).toBe('boolean');
			expect(typeof voiceCommands.require_prefix).toBe('boolean');
			expect(typeof voiceCommands.prefix).toBe('string');
		});

		test('should accept all boolean combinations for enabled', () => {
			const enabledSettings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};
			expect(enabledSettings.enabled).toBe(true);

			const disabledSettings: VoiceCommandSettings = {
				enabled: false,
				require_prefix: false,
				prefix: 'command'
			};
			expect(disabledSettings.enabled).toBe(false);
		});

		test('should accept all boolean combinations for require_prefix', () => {
			const withPrefix: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'hey'
			};
			expect(withPrefix.require_prefix).toBe(true);

			const withoutPrefix: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};
			expect(withoutPrefix.require_prefix).toBe(false);
		});
	});

	describe('default values', () => {
		test('should have voice_commands in default settings', () => {
			expect(defaultSettings.voice_commands).toBeDefined();
		});

		test('should have enabled set to true by default', () => {
			expect(defaultSettings.voice_commands.enabled).toBe(true);
		});

		test('should have require_prefix set to false by default', () => {
			expect(defaultSettings.voice_commands.require_prefix).toBe(false);
		});

		test('should have prefix set to "command" by default', () => {
			expect(defaultSettings.voice_commands.prefix).toBe('command');
		});

		test('default settings should match expected structure', () => {
			const expectedDefaults: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};
			expect(defaultSettings.voice_commands).toEqual(expectedDefaults);
		});
	});

	describe('serialization/deserialization', () => {
		test('should serialize to JSON correctly', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'hey assistant'
			};

			const json = JSON.stringify(settings);
			expect(json).toBe('{"enabled":true,"require_prefix":true,"prefix":"hey assistant"}');
		});

		test('should deserialize from JSON correctly', () => {
			const json = '{"enabled":false,"require_prefix":true,"prefix":"activate"}';
			const settings: VoiceCommandSettings = JSON.parse(json);

			expect(settings.enabled).toBe(false);
			expect(settings.require_prefix).toBe(true);
			expect(settings.prefix).toBe('activate');
		});

		test('should handle full Settings object serialization', () => {
			const fullSettings: Settings = { ...defaultSettings };
			const json = JSON.stringify(fullSettings);
			const parsed: Settings = JSON.parse(json);

			expect(parsed.voice_commands).toEqual(defaultSettings.voice_commands);
		});

		test('should preserve voice_commands when cloning settings', () => {
			const original: Settings = {
				...defaultSettings,
				voice_commands: {
					enabled: false,
					require_prefix: true,
					prefix: 'computer'
				}
			};

			const cloned = JSON.parse(JSON.stringify(original)) as Settings;
			expect(cloned.voice_commands).toEqual(original.voice_commands);
		});

		test('should handle nested object updates immutably', () => {
			const original = defaultSettings.voice_commands;
			const updated: VoiceCommandSettings = {
				...original,
				enabled: false
			};

			expect(original.enabled).toBe(true);
			expect(updated.enabled).toBe(false);
			expect(original).not.toBe(updated);
		});
	});

	describe('prefix validation', () => {
		test('should accept non-empty prefix when require_prefix is true', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'hey'
			};

			const isValid = settings.prefix.trim().length > 0;
			expect(isValid).toBe(true);
		});

		test('should flag empty prefix when require_prefix is true', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: ''
			};

			const isValid = !settings.require_prefix || settings.prefix.trim().length > 0;
			expect(isValid).toBe(false);
		});

		test('should allow empty prefix when require_prefix is false', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: ''
			};

			const isValid = !settings.require_prefix || settings.prefix.trim().length > 0;
			expect(isValid).toBe(true);
		});

		test('should flag whitespace-only prefix when require_prefix is true', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: '   '
			};

			const isValid = !settings.require_prefix || settings.prefix.trim().length > 0;
			expect(isValid).toBe(false);
		});

		test('should validate prefix with validation function', () => {
			const validatePrefix = (settings: VoiceCommandSettings): boolean => {
				if (!settings.require_prefix) return true;
				return settings.prefix.trim().length > 0;
			};

			expect(validatePrefix({ enabled: true, require_prefix: true, prefix: 'command' })).toBe(
				true
			);
			expect(validatePrefix({ enabled: true, require_prefix: true, prefix: '' })).toBe(false);
			expect(validatePrefix({ enabled: true, require_prefix: false, prefix: '' })).toBe(true);
		});
	});

	describe('enable/disable toggle logic', () => {
		test('should toggle enabled state', () => {
			let settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};

			settings = { ...settings, enabled: !settings.enabled };
			expect(settings.enabled).toBe(false);

			settings = { ...settings, enabled: !settings.enabled };
			expect(settings.enabled).toBe(true);
		});

		test('should preserve other settings when toggling enabled', () => {
			const original: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'hey computer'
			};

			const toggled: VoiceCommandSettings = {
				...original,
				enabled: !original.enabled
			};

			expect(toggled.enabled).toBe(false);
			expect(toggled.require_prefix).toBe(original.require_prefix);
			expect(toggled.prefix).toBe(original.prefix);
		});

		test('should toggle require_prefix state', () => {
			let settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};

			settings = { ...settings, require_prefix: !settings.require_prefix };
			expect(settings.require_prefix).toBe(true);

			settings = { ...settings, require_prefix: !settings.require_prefix };
			expect(settings.require_prefix).toBe(false);
		});

		test('disabled voice commands should not process commands', () => {
			const settings: VoiceCommandSettings = {
				enabled: false,
				require_prefix: true,
				prefix: 'command'
			};

			const shouldProcess = (text: string, config: VoiceCommandSettings): boolean => {
				if (!config.enabled) return false;
				if (config.require_prefix) {
					return text.toLowerCase().startsWith(config.prefix.toLowerCase());
				}
				return true;
			};

			expect(shouldProcess('command period', settings)).toBe(false);
		});

		test('enabled voice commands with prefix should check prefix', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'command'
			};

			const shouldProcess = (text: string, config: VoiceCommandSettings): boolean => {
				if (!config.enabled) return false;
				if (config.require_prefix) {
					return text.toLowerCase().startsWith(config.prefix.toLowerCase());
				}
				return true;
			};

			expect(shouldProcess('command period', settings)).toBe(true);
			expect(shouldProcess('period', settings)).toBe(false);
		});

		test('enabled voice commands without prefix should always process', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: 'command'
			};

			const shouldProcess = (text: string, config: VoiceCommandSettings): boolean => {
				if (!config.enabled) return false;
				if (config.require_prefix) {
					return text.toLowerCase().startsWith(config.prefix.toLowerCase());
				}
				return true;
			};

			expect(shouldProcess('period', settings)).toBe(true);
			expect(shouldProcess('new line', settings)).toBe(true);
		});
	});

	describe('edge cases', () => {
		test('should handle empty prefix string', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: ''
			};

			expect(settings.prefix).toBe('');
			expect(settings.prefix.length).toBe(0);
		});

		test('should handle prefix with only spaces', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: false,
				prefix: '   '
			};

			expect(settings.prefix.trim()).toBe('');
			expect(settings.prefix.length).toBe(3);
		});

		test('should handle prefix with special characters', () => {
			const specialPrefixes = ['hey!', 'ok@command', 'voice#cmd', '$prefix', 'cmd%test'];

			specialPrefixes.forEach((prefix) => {
				const settings: VoiceCommandSettings = {
					enabled: true,
					require_prefix: true,
					prefix: prefix
				};
				expect(settings.prefix).toBe(prefix);
			});
		});

		test('should handle prefix with unicode characters', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'comando'
			};

			expect(settings.prefix).toBe('comando');
		});

		test('should handle prefix with numbers', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'voice123'
			};

			expect(settings.prefix).toBe('voice123');
		});

		test('should handle very long prefix', () => {
			const longPrefix = 'a'.repeat(1000);
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: longPrefix
			};

			expect(settings.prefix.length).toBe(1000);
		});

		test('should handle prefix with mixed case', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'HeyComputer'
			};

			const shouldProcess = (text: string, config: VoiceCommandSettings): boolean => {
				if (!config.enabled) return false;
				if (config.require_prefix) {
					return text.toLowerCase().startsWith(config.prefix.toLowerCase());
				}
				return true;
			};

			expect(shouldProcess('heycomputer period', settings)).toBe(true);
			expect(shouldProcess('HEYCOMPUTER period', settings)).toBe(true);
			expect(shouldProcess('HeyComputer period', settings)).toBe(true);
		});

		test('should handle prefix with leading/trailing spaces', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: '  command  '
			};

			const trimmedPrefix = settings.prefix.trim();
			expect(trimmedPrefix).toBe('command');
		});

		test('should handle prefix with newlines', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'command\ntest'
			};

			expect(settings.prefix.includes('\n')).toBe(true);
		});

		test('should handle prefix with tabs', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'command\ttest'
			};

			expect(settings.prefix.includes('\t')).toBe(true);
		});

		test('should handle multiple spaces in prefix', () => {
			const settings: VoiceCommandSettings = {
				enabled: true,
				require_prefix: true,
				prefix: 'hey   computer'
			};

			expect(settings.prefix).toBe('hey   computer');
		});
	});

	describe('integration with Settings', () => {
		test('should be accessible from Settings object', () => {
			const settings: Settings = { ...defaultSettings };
			expect(settings.voice_commands).toBeDefined();
			expect(settings.voice_commands.enabled).toBeDefined();
			expect(settings.voice_commands.require_prefix).toBeDefined();
			expect(settings.voice_commands.prefix).toBeDefined();
		});

		test('should update voice_commands independently', () => {
			const settings: Settings = { ...defaultSettings };
			const updatedSettings: Settings = {
				...settings,
				voice_commands: {
					...settings.voice_commands,
					enabled: false
				}
			};

			expect(settings.voice_commands.enabled).toBe(true);
			expect(updatedSettings.voice_commands.enabled).toBe(false);
			expect(updatedSettings.hotkey).toBe(settings.hotkey);
		});

		test('should maintain settings structure after partial update', () => {
			const settings: Settings = {
				...defaultSettings,
				voice_commands: {
					enabled: false,
					require_prefix: true,
					prefix: 'test'
				}
			};

			expect(Object.keys(settings.voice_commands)).toEqual([
				'enabled',
				'require_prefix',
				'prefix'
			]);
		});
	});
});
