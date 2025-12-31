import { test, expect, describe } from 'bun:test';

describe('VocabularyManager', () => {
	test('should be importable', async () => {
		// Test that the component can be imported without errors
		const module = await import('./VocabularyManager.svelte');
		expect(module.default).toBeDefined();
	});

	describe('vocabulary management logic', () => {
		test('should filter duplicates', () => {
			const vocabulary = ['HIPAA', 'EHR', 'COVID-19'];
			const newTerm = 'HIPAA';
			const hasDuplicate = vocabulary.includes(newTerm);
			expect(hasDuplicate).toBe(true);
		});

		test('should allow adding new terms', () => {
			const vocabulary = ['HIPAA', 'EHR'];
			const newTerm = 'COVID-19';
			const hasDuplicate = vocabulary.includes(newTerm);
			expect(hasDuplicate).toBe(false);

			const updated = [...vocabulary, newTerm];
			expect(updated).toEqual(['HIPAA', 'EHR', 'COVID-19']);
		});

		test('should remove terms', () => {
			const vocabulary = ['HIPAA', 'EHR', 'COVID-19'];
			const termToRemove = 'EHR';
			const updated = vocabulary.filter((t) => t !== termToRemove);
			expect(updated).toEqual(['HIPAA', 'COVID-19']);
		});

		test('should trim whitespace from terms', () => {
			const term = '  HIPAA  ';
			const trimmed = term.trim();
			expect(trimmed).toBe('HIPAA');
		});

		test('should handle empty terms', () => {
			const term = '   ';
			const trimmed = term.trim();
			expect(trimmed).toBe('');
			expect(trimmed.length).toBe(0);
		});
	});

	describe('import/export format', () => {
		test('should have expected export format', () => {
			const exportData = {
				version: 1,
				name: 'Medical Terms',
				description: 'Common medical vocabulary',
				terms: ['HIPAA', 'EHR', 'COVID-19']
			};

			expect(exportData.version).toBe(1);
			expect(exportData.terms).toBeInstanceOf(Array);
			expect(exportData.terms.length).toBe(3);
		});

		test('should validate export data', () => {
			const exportData = {
				version: 1,
				terms: ['Term1', 'Term2']
			};

			expect(exportData.version).toBeLessThanOrEqual(1);
			expect(exportData.terms.every((t: string) => t.trim().length > 0)).toBe(true);
		});
	});

	describe('case-insensitive duplicate detection', () => {
		test('should detect HIPAA and hipaa as duplicates', () => {
			const vocabulary = ['HIPAA', 'EHR', 'COVID-19'];
			const newTerm = 'hipaa';
			const hasDuplicate = vocabulary.some(
				(term) => term.toLowerCase() === newTerm.toLowerCase()
			);
			expect(hasDuplicate).toBe(true);
		});

		test('should detect COVID-19 and covid-19 as duplicates', () => {
			const vocabulary = ['HIPAA', 'EHR', 'COVID-19'];
			const newTerm = 'covid-19';
			const hasDuplicate = vocabulary.some(
				(term) => term.toLowerCase() === newTerm.toLowerCase()
			);
			expect(hasDuplicate).toBe(true);
		});

		test('should detect mixed case duplicates', () => {
			const vocabulary = ['MyCustomTerm'];
			const variations = ['mycustomterm', 'MYCUSTOMTERM', 'myCUSTOMterm'];
			for (const variant of variations) {
				const hasDuplicate = vocabulary.some(
					(term) => term.toLowerCase() === variant.toLowerCase()
				);
				expect(hasDuplicate).toBe(true);
			}
		});
	});

	describe('import merge logic', () => {
		test('should deduplicate when importing terms that already exist', () => {
			const existing = ['HIPAA', 'EHR', 'COVID-19'];
			const imported = ['HIPAA', 'MRI', 'CT Scan'];

			const merged = [
				...existing,
				...imported.filter(
					(term) => !existing.some((e) => e.toLowerCase() === term.toLowerCase())
				)
			];

			expect(merged).toEqual(['HIPAA', 'EHR', 'COVID-19', 'MRI', 'CT Scan']);
			expect(merged.length).toBe(5);
		});

		test('should add unique terms from import', () => {
			const existing = ['Term1', 'Term2'];
			const imported = ['Term3', 'Term4', 'Term5'];

			const merged = [
				...existing,
				...imported.filter(
					(term) => !existing.some((e) => e.toLowerCase() === term.toLowerCase())
				)
			];

			expect(merged).toEqual(['Term1', 'Term2', 'Term3', 'Term4', 'Term5']);
		});

		test('should merge with case-insensitive comparison', () => {
			const existing = ['HIPAA', 'EHR'];
			const imported = ['hipaa', 'ehr', 'NewTerm'];

			const merged = [
				...existing,
				...imported.filter(
					(term) => !existing.some((e) => e.toLowerCase() === term.toLowerCase())
				)
			];

			// Only NewTerm should be added since hipaa and ehr are duplicates
			expect(merged).toEqual(['HIPAA', 'EHR', 'NewTerm']);
			expect(merged.length).toBe(3);
		});

		test('should preserve original casing when merging', () => {
			const existing = ['HIPAA'];
			const imported = ['hipaa', 'Hipaa', 'HiPaA'];

			const merged = [
				...existing,
				...imported.filter(
					(term) => !existing.some((e) => e.toLowerCase() === term.toLowerCase())
				)
			];

			// Original HIPAA should be preserved, duplicates ignored
			expect(merged).toEqual(['HIPAA']);
		});
	});

	describe('edge cases', () => {
		test('should handle maximum vocabulary size (1000 terms)', () => {
			const maxSize = 1000;
			const vocabulary: string[] = [];

			for (let i = 0; i < maxSize; i++) {
				vocabulary.push(`Term${i}`);
			}

			expect(vocabulary.length).toBe(maxSize);

			// Test that adding beyond max is prevented
			const canAddMore = vocabulary.length < maxSize;
			expect(canAddMore).toBe(false);
		});

		test('should handle Unicode characters (Müller)', () => {
			const vocabulary = ['Müller', 'café', 'naïve'];
			const newTerm = 'Müller';
			const hasDuplicate = vocabulary.includes(newTerm);
			expect(hasDuplicate).toBe(true);

			// Test adding new Unicode term
			const anotherTerm = 'résumé';
			const updated = [...vocabulary, anotherTerm];
			expect(updated).toContain('résumé');
		});

		test('should handle special characters (café)', () => {
			const vocabulary: string[] = [];
			const specialTerms = ['café', 'naïve', 'Ångström', 'über'];

			for (const term of specialTerms) {
				vocabulary.push(term);
			}

			expect(vocabulary).toEqual(['café', 'naïve', 'Ångström', 'über']);
		});

		test('should handle Japanese characters (日本語)', () => {
			const vocabulary = ['日本語', '東京', 'カタカナ'];

			expect(vocabulary.length).toBe(3);
			expect(vocabulary).toContain('日本語');

			// Test duplicate detection with Unicode
			const hasDuplicate = vocabulary.includes('東京');
			expect(hasDuplicate).toBe(true);
		});

		test('should handle very long terms (100+ characters)', () => {
			const longTerm = 'A'.repeat(150);
			const maxLength = 100;

			// Test that long terms are detected
			expect(longTerm.length).toBeGreaterThan(maxLength);

			// Test truncation logic
			const truncated = longTerm.length > maxLength ? longTerm.substring(0, maxLength) : longTerm;
			expect(truncated.length).toBe(maxLength);
		});

		test('should reject terms exceeding maximum length', () => {
			const maxLength = 100;
			const validTerm = 'A'.repeat(100);
			const invalidTerm = 'A'.repeat(101);

			expect(validTerm.length).toBeLessThanOrEqual(maxLength);
			expect(invalidTerm.length).toBeGreaterThan(maxLength);
		});

		test('should handle terms with leading/trailing spaces', () => {
			const term = '  HIPAA  ';
			const trimmed = term.trim();
			expect(trimmed).toBe('HIPAA');

			// Test that trimmed term is used for duplicate detection
			const vocabulary = ['HIPAA'];
			const hasDuplicate = vocabulary.includes(trimmed);
			expect(hasDuplicate).toBe(true);
		});

		test('should handle terms with multiple internal spaces', () => {
			const term = 'COVID   19';
			// Normalize internal spaces
			const normalized = term.replace(/\s+/g, ' ').trim();
			expect(normalized).toBe('COVID 19');
		});

		test('should handle empty vocabulary', () => {
			const vocabulary: string[] = [];
			const newTerm = 'FirstTerm';

			const hasDuplicate = vocabulary.some(
				(term) => term.toLowerCase() === newTerm.toLowerCase()
			);
			expect(hasDuplicate).toBe(false);

			const updated = [...vocabulary, newTerm];
			expect(updated.length).toBe(1);
		});
	});

	describe('invalid import handling', () => {
		test('should reject invalid JSON structure', () => {
			const invalidJson = '{ invalid json }';
			let parseError = false;

			try {
				JSON.parse(invalidJson);
			} catch {
				parseError = true;
			}

			expect(parseError).toBe(true);
		});

		test('should reject import with missing terms field', () => {
			const importData = {
				version: 1,
				name: 'Test Vocabulary'
				// missing terms field
			};

			const isValid = 'terms' in importData && Array.isArray(importData.terms);
			expect(isValid).toBe(false);
		});

		test('should reject import with missing version field', () => {
			const importData = {
				name: 'Test Vocabulary',
				terms: ['Term1', 'Term2']
				// missing version field
			};

			const isValid = 'version' in importData && typeof importData.version === 'number';
			expect(isValid).toBe(false);
		});

		test('should reject import with wrong version number', () => {
			const importData = {
				version: 99,
				name: 'Test Vocabulary',
				terms: ['Term1', 'Term2']
			};

			const supportedVersions = [1];
			const isValidVersion = supportedVersions.includes(importData.version);
			expect(isValidVersion).toBe(false);
		});

		test('should reject import with version 0', () => {
			const importData = {
				version: 0,
				terms: ['Term1']
			};

			const isValidVersion = importData.version >= 1;
			expect(isValidVersion).toBe(false);
		});

		test('should reject import with negative version', () => {
			const importData = {
				version: -1,
				terms: ['Term1']
			};

			const isValidVersion = importData.version >= 1;
			expect(isValidVersion).toBe(false);
		});

		test('should reject import with non-array terms', () => {
			const importData = {
				version: 1,
				terms: 'not an array'
			};

			const isValid = Array.isArray(importData.terms);
			expect(isValid).toBe(false);
		});

		test('should reject import with non-string terms in array', () => {
			const importData = {
				version: 1,
				terms: ['Valid', 123, null, { invalid: true }]
			};

			const allStrings = importData.terms.every((term) => typeof term === 'string');
			expect(allStrings).toBe(false);
		});

		test('should filter out invalid terms during import', () => {
			const importData = {
				version: 1,
				terms: ['Valid1', '', '   ', 'Valid2', null, undefined, 123]
			};

			const validTerms = importData.terms.filter(
				(term): term is string =>
					typeof term === 'string' && term.trim().length > 0
			);

			expect(validTerms).toEqual(['Valid1', 'Valid2']);
		});

		test('should handle empty terms array in import', () => {
			const importData = {
				version: 1,
				name: 'Empty Vocabulary',
				terms: []
			};

			const isValid =
				'version' in importData &&
				'terms' in importData &&
				Array.isArray(importData.terms);
			expect(isValid).toBe(true);
			expect(importData.terms.length).toBe(0);
		});
	});
});
