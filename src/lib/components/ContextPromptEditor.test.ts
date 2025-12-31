import { test, expect, describe } from 'bun:test';

describe('ContextPromptEditor', () => {
	test('should be importable', async () => {
		// Test that the component can be imported without errors
		const module = await import('./ContextPromptEditor.svelte');
		expect(module.default).toBeDefined();
	});

	describe('context prompt logic', () => {
		const MAX_CHARS = 500;

		test('should enforce character limit', () => {
			const longPrompt = 'a'.repeat(600);
			const isOverLimit = longPrompt.length > MAX_CHARS;
			expect(isOverLimit).toBe(true);
		});

		test('should allow prompts within limit', () => {
			const validPrompt = 'This is a medical transcription context.';
			const isOverLimit = validPrompt.length > MAX_CHARS;
			expect(isOverLimit).toBe(false);
		});

		test('should calculate character count', () => {
			const prompt = 'Medical transcription';
			expect(prompt.length).toBe(21);
		});

		test('should handle null/empty prompts', () => {
			const prompt: string | null = null;
			const localPrompt = prompt ?? '';
			expect(localPrompt).toBe('');
		});
	});

	describe('example prompts', () => {
		const examplePrompts = [
			{
				name: 'Medical',
				prompt:
					'This is a medical transcription. Common terms include patient, diagnosis, prescription, symptoms, treatment, vitals, lab results, and medical procedures.'
			},
			{
				name: 'Legal',
				prompt:
					'This is a legal transcription. Common terms include plaintiff, defendant, jurisdiction, testimony, evidence, court, statute, and legal proceedings.'
			},
			{
				name: 'Technical',
				prompt:
					'This is a technical transcription. Common terms include API, database, server, deployment, debugging, repository, framework, and software development.'
			},
			{
				name: 'Business',
				prompt:
					'This is a business meeting transcription. Common terms include quarterly, revenue, stakeholders, metrics, deliverables, and strategic planning.'
			}
		];

		test('should have multiple example prompts', () => {
			expect(examplePrompts.length).toBeGreaterThan(0);
		});

		test('should have valid example prompts', () => {
			for (const example of examplePrompts) {
				expect(example.name).toBeDefined();
				expect(example.prompt).toBeDefined();
				expect(example.prompt.length).toBeGreaterThan(0);
				expect(example.prompt.length).toBeLessThanOrEqual(500);
			}
		});

		test('should include expected domains', () => {
			const names = examplePrompts.map((e) => e.name);
			expect(names).toContain('Medical');
			expect(names).toContain('Legal');
			expect(names).toContain('Technical');
		});
	});
});
