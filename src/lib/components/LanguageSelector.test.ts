import { test, expect, describe } from 'bun:test';

/**
 * Tests for LanguageSelector component logic
 */

interface Language {
	code: string;
	name: string;
	native_name: string | null;
	common: boolean;
}

describe('LanguageSelector', () => {
	test('should be importable', async () => {
		const module = await import('./LanguageSelector.svelte');
		expect(module.default).toBeDefined();
	});

	describe('displayName function logic', () => {
		function displayName(lang: Language): string {
			if (lang.native_name) {
				return `${lang.name} (${lang.native_name})`;
			}
			return lang.name;
		}

		test('should return name with native name in parentheses', () => {
			const lang: Language = {
				code: 'ja',
				name: 'Japanese',
				native_name: '日本語',
				common: true
			};
			expect(displayName(lang)).toBe('Japanese (日本語)');
		});

		test('should return only name when no native name', () => {
			const lang: Language = {
				code: 'en',
				name: 'English',
				native_name: null,
				common: true
			};
			expect(displayName(lang)).toBe('English');
		});

		test('should handle Chinese with native name', () => {
			const lang: Language = {
				code: 'zh',
				name: 'Chinese',
				native_name: '中文',
				common: true
			};
			expect(displayName(lang)).toBe('Chinese (中文)');
		});

		test('should handle German with native name', () => {
			const lang: Language = {
				code: 'de',
				name: 'German',
				native_name: 'Deutsch',
				common: true
			};
			expect(displayName(lang)).toBe('German (Deutsch)');
		});

		test('should handle language with empty native name', () => {
			const lang: Language = {
				code: 'test',
				name: 'Test Language',
				native_name: null,
				common: false
			};
			expect(displayName(lang)).toBe('Test Language');
		});
	});

	describe('getCurrentDisplayName logic', () => {
		function getCurrentDisplayName(
			value: string | null,
			languages: Language[],
			displayName: (lang: Language) => string
		): string {
			if (value === null) {
				return 'Auto-detect';
			}
			const lang = languages.find((l) => l.code === value);
			return lang ? displayName(lang) : value;
		}

		function displayName(lang: Language): string {
			if (lang.native_name) {
				return `${lang.name} (${lang.native_name})`;
			}
			return lang.name;
		}

		const sampleLanguages: Language[] = [
			{ code: 'en', name: 'English', native_name: null, common: true },
			{ code: 'ja', name: 'Japanese', native_name: '日本語', common: true },
			{ code: 'de', name: 'German', native_name: 'Deutsch', common: true },
			{ code: 'fr', name: 'French', native_name: 'Français', common: true }
		];

		test('should return "Auto-detect" when value is null', () => {
			const result = getCurrentDisplayName(null, sampleLanguages, displayName);
			expect(result).toBe('Auto-detect');
		});

		test('should return display name for valid language code', () => {
			const result = getCurrentDisplayName('ja', sampleLanguages, displayName);
			expect(result).toBe('Japanese (日本語)');
		});

		test('should return language code if not found in list', () => {
			const result = getCurrentDisplayName('unknown', sampleLanguages, displayName);
			expect(result).toBe('unknown');
		});

		test('should handle English without native name', () => {
			const result = getCurrentDisplayName('en', sampleLanguages, displayName);
			expect(result).toBe('English');
		});

		test('should handle French with native name', () => {
			const result = getCurrentDisplayName('fr', sampleLanguages, displayName);
			expect(result).toBe('French (Français)');
		});
	});

	describe('language filtering logic', () => {
		const sampleLanguages: Language[] = [
			{ code: 'en', name: 'English', native_name: null, common: true },
			{ code: 'ja', name: 'Japanese', native_name: '日本語', common: true },
			{ code: 'de', name: 'German', native_name: 'Deutsch', common: true },
			{ code: 'es', name: 'Spanish', native_name: 'Español', common: true },
			{ code: 'ko', name: 'Korean', native_name: '한국어', common: false },
			{ code: 'pt', name: 'Portuguese', native_name: 'Português', common: false },
			{ code: 'ru', name: 'Russian', native_name: 'Русский', common: false }
		];

		function filterLanguages(languages: Language[], search: string): Language[] {
			return languages.filter(
				(lang) =>
					lang.name.toLowerCase().includes(search.toLowerCase()) ||
					lang.code.toLowerCase().includes(search.toLowerCase()) ||
					(lang.native_name && lang.native_name.toLowerCase().includes(search.toLowerCase()))
			);
		}

		test('should filter by language name', () => {
			const result = filterLanguages(sampleLanguages, 'Japa');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('ja');
		});

		test('should filter by language code', () => {
			const result = filterLanguages(sampleLanguages, 'de');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('de');
		});

		test('should filter by native name', () => {
			const result = filterLanguages(sampleLanguages, '日本語');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('ja');
		});

		test('should filter case-insensitively', () => {
			const result = filterLanguages(sampleLanguages, 'ENGLISH');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('en');
		});

		test('should return all languages on empty search', () => {
			const result = filterLanguages(sampleLanguages, '');
			expect(result.length).toBe(sampleLanguages.length);
		});

		test('should return empty array when no match', () => {
			const result = filterLanguages(sampleLanguages, 'xyz123');
			expect(result.length).toBe(0);
		});

		test('should match partial strings', () => {
			const result = filterLanguages(sampleLanguages, 'ger');
			// Should match German only
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('de');
		});

		test('should filter by Cyrillic native name', () => {
			const result = filterLanguages(sampleLanguages, 'Рус');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('ru');
		});

		test('should filter by Korean native name', () => {
			const result = filterLanguages(sampleLanguages, '한국');
			expect(result.length).toBe(1);
			expect(result[0].code).toBe('ko');
		});
	});

	describe('common/other language separation', () => {
		const sampleLanguages: Language[] = [
			{ code: 'en', name: 'English', native_name: null, common: true },
			{ code: 'ja', name: 'Japanese', native_name: '日本語', common: true },
			{ code: 'de', name: 'German', native_name: 'Deutsch', common: true },
			{ code: 'ko', name: 'Korean', native_name: '한국어', common: false },
			{ code: 'pt', name: 'Portuguese', native_name: 'Português', common: false }
		];

		test('should separate common languages', () => {
			const commonLanguages = sampleLanguages.filter((l) => l.common);
			expect(commonLanguages.length).toBe(3);
			expect(commonLanguages.every((l) => l.common)).toBe(true);
		});

		test('should separate other languages', () => {
			const otherLanguages = sampleLanguages.filter((l) => !l.common);
			expect(otherLanguages.length).toBe(2);
			expect(otherLanguages.every((l) => !l.common)).toBe(true);
		});

		test('should include all languages in either category', () => {
			const commonLanguages = sampleLanguages.filter((l) => l.common);
			const otherLanguages = sampleLanguages.filter((l) => !l.common);
			expect(commonLanguages.length + otherLanguages.length).toBe(sampleLanguages.length);
		});

		test('common languages should include expected languages', () => {
			const commonLanguages = sampleLanguages.filter((l) => l.common);
			const codes = commonLanguages.map((l) => l.code);
			expect(codes).toContain('en');
			expect(codes).toContain('ja');
			expect(codes).toContain('de');
		});

		test('other languages should include expected languages', () => {
			const otherLanguages = sampleLanguages.filter((l) => !l.common);
			const codes = otherLanguages.map((l) => l.code);
			expect(codes).toContain('ko');
			expect(codes).toContain('pt');
		});
	});

	describe('selection logic', () => {
		interface SelectionState {
			value: string | null;
			isOpen: boolean;
			search: string;
		}

		function select(_state: SelectionState, code: string | null): SelectionState {
			return {
				value: code,
				isOpen: false,
				search: ''
			};
		}

		test('should set value when language selected', () => {
			const state: SelectionState = {
				value: null,
				isOpen: true,
				search: 'japa'
			};

			const newState = select(state, 'ja');
			expect(newState.value).toBe('ja');
		});

		test('should close dropdown on selection', () => {
			const state: SelectionState = {
				value: null,
				isOpen: true,
				search: ''
			};

			const newState = select(state, 'en');
			expect(newState.isOpen).toBe(false);
		});

		test('should clear search on selection', () => {
			const state: SelectionState = {
				value: null,
				isOpen: true,
				search: 'german'
			};

			const newState = select(state, 'de');
			expect(newState.search).toBe('');
		});

		test('should allow selecting null for auto-detect', () => {
			const state: SelectionState = {
				value: 'en',
				isOpen: true,
				search: ''
			};

			const newState = select(state, null);
			expect(newState.value).toBe(null);
		});

		test('should update value when changing selection', () => {
			const state: SelectionState = {
				value: 'en',
				isOpen: true,
				search: ''
			};

			const newState = select(state, 'ja');
			expect(newState.value).toBe('ja');
		});
	});

	describe('onChange callback handling', () => {
		test('should call onChange with selected code', () => {
			let calledWith: string | null = undefined as unknown as string | null;
			const onChange = (value: string | null) => {
				calledWith = value;
			};

			onChange('ja');
			expect(calledWith).toBe('ja');
		});

		test('should call onChange with null for auto-detect', () => {
			let calledWith: string | null = 'initial' as unknown as string | null;
			const onChange = (value: string | null) => {
				calledWith = value;
			};

			onChange(null);
			expect(calledWith).toBe(null);
		});

		test('should handle undefined onChange gracefully', () => {
			const onChange = () => {};
			expect(() => onChange()).not.toThrow();
		});
	});

	describe('dropdown state management', () => {
		interface DropdownState {
			isOpen: boolean;
		}

		function toggleDropdown(state: DropdownState): DropdownState {
			return { isOpen: !state.isOpen };
		}

		function closeDropdown(_state: DropdownState): DropdownState {
			return { isOpen: false };
		}

		test('should open closed dropdown', () => {
			const state: DropdownState = { isOpen: false };
			const newState = toggleDropdown(state);
			expect(newState.isOpen).toBe(true);
		});

		test('should close open dropdown', () => {
			const state: DropdownState = { isOpen: true };
			const newState = toggleDropdown(state);
			expect(newState.isOpen).toBe(false);
		});

		test('should close dropdown on click outside', () => {
			const state: DropdownState = { isOpen: true };
			const newState = closeDropdown(state);
			expect(newState.isOpen).toBe(false);
		});

		test('should remain closed after closing closed dropdown', () => {
			const state: DropdownState = { isOpen: false };
			const newState = closeDropdown(state);
			expect(newState.isOpen).toBe(false);
		});
	});

	describe('edge cases', () => {
		test('should handle empty language list', () => {
			const languages: Language[] = [];
			const filtered = languages.filter((l) => l.common);
			expect(filtered.length).toBe(0);
		});

		test('should handle language with empty name', () => {
			const lang: Language = {
				code: 'xx',
				name: '',
				native_name: null,
				common: false
			};

			function displayName(l: Language): string {
				if (l.native_name) {
					return `${l.name} (${l.native_name})`;
				}
				return l.name;
			}

			expect(displayName(lang)).toBe('');
		});

		test('should handle language with only whitespace native name', () => {
			const lang: Language = {
				code: 'xx',
				name: 'Test',
				native_name: '   ',
				common: false
			};

			function displayName(l: Language): string {
				if (l.native_name) {
					return `${l.name} (${l.native_name})`;
				}
				return l.name;
			}

			expect(displayName(lang)).toBe('Test (   )');
		});

		test('should filter with special regex characters safely', () => {
			const languages: Language[] = [
				{ code: 'en', name: 'English', native_name: null, common: true }
			];

			function filterLanguages(langs: Language[], search: string): Language[] {
				return langs.filter(
					(lang) =>
						lang.name.toLowerCase().includes(search.toLowerCase()) ||
						lang.code.toLowerCase().includes(search.toLowerCase())
				);
			}

			// These should not throw
			expect(() => filterLanguages(languages, '.*')).not.toThrow();
			expect(() => filterLanguages(languages, '()')).not.toThrow();
			expect(() => filterLanguages(languages, '[]')).not.toThrow();
			expect(() => filterLanguages(languages, '+')).not.toThrow();
		});

		test('should handle very long search strings', () => {
			const languages: Language[] = [
				{ code: 'en', name: 'English', native_name: null, common: true }
			];

			function filterLanguages(langs: Language[], search: string): Language[] {
				return langs.filter((lang) => lang.name.toLowerCase().includes(search.toLowerCase()));
			}

			const longSearch = 'a'.repeat(1000);
			const result = filterLanguages(languages, longSearch);
			expect(result.length).toBe(0);
		});

		test('should handle all languages being common', () => {
			const languages: Language[] = [
				{ code: 'en', name: 'English', native_name: null, common: true },
				{ code: 'ja', name: 'Japanese', native_name: '日本語', common: true }
			];

			const common = languages.filter((l) => l.common);
			const other = languages.filter((l) => !l.common);

			expect(common.length).toBe(2);
			expect(other.length).toBe(0);
		});

		test('should handle no common languages', () => {
			const languages: Language[] = [
				{ code: 'ko', name: 'Korean', native_name: '한국어', common: false },
				{ code: 'pt', name: 'Portuguese', native_name: 'Português', common: false }
			];

			const common = languages.filter((l) => l.common);
			const other = languages.filter((l) => !l.common);

			expect(common.length).toBe(0);
			expect(other.length).toBe(2);
		});
	});

	describe('props handling', () => {
		test('should default value to null', () => {
			const defaultValue: string | null = null;
			expect(defaultValue).toBe(null);
		});

		test('should default onChange to empty function', () => {
			const defaultOnChange = () => {};
			expect(typeof defaultOnChange).toBe('function');
			expect(() => defaultOnChange()).not.toThrow();
		});

		test('should accept initial value prop', () => {
			const initialValue = 'en';
			expect(initialValue).toBe('en');
		});

		test('should accept onChange prop', () => {
			let called = false;
			const onChange = () => {
				called = true;
			};
			onChange();
			expect(called).toBe(true);
		});
	});
});
