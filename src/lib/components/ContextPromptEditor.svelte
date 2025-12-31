<script lang="ts">
	interface Props {
		contextPrompt?: string | null;
		useContextPrompt?: boolean;
		onContextPromptChange?: (prompt: string | null) => void;
		onUseContextPromptChange?: (use: boolean) => void;
	}

	let {
		contextPrompt = $bindable(null),
		useContextPrompt = $bindable(false),
		onContextPromptChange = () => {},
		onUseContextPromptChange = () => {}
	}: Props = $props();

	const MAX_CHARS = 500;

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

	let localPrompt = $state(contextPrompt ?? '');
	let showExamples = $state(false);

	const charCount = $derived(localPrompt.length);
	const isOverLimit = $derived(charCount > MAX_CHARS);

	function handlePromptChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		localPrompt = target.value;
		// Only update if under limit
		if (localPrompt.length <= MAX_CHARS) {
			contextPrompt = localPrompt || null;
			onContextPromptChange(contextPrompt);
		}
	}

	function handleToggle(e: Event) {
		const target = e.target as HTMLInputElement;
		useContextPrompt = target.checked;
		onUseContextPromptChange(useContextPrompt);
	}

	function applyExample(prompt: string) {
		localPrompt = prompt;
		contextPrompt = prompt;
		onContextPromptChange(prompt);
		showExamples = false;
	}

	function clearPrompt() {
		localPrompt = '';
		contextPrompt = null;
		onContextPromptChange(null);
	}
</script>

<div class="context-prompt-editor" data-testid="context-prompt-editor">
	<div class="toggle-row">
		<label class="checkbox-label">
			<input
				type="checkbox"
				checked={useContextPrompt}
				onchange={handleToggle}
				data-testid="use-context-prompt-toggle"
			/>
			<span>Use context prompt</span>
		</label>
		<p class="toggle-description">
			Provide domain context to improve transcription accuracy
		</p>
	</div>

	<div class="prompt-container" class:disabled={!useContextPrompt}>
		<textarea
			class="prompt-textarea"
			class:error={isOverLimit}
			placeholder="Describe the context of your transcriptions to improve accuracy. For example: 'This is a medical transcription discussing patient symptoms and treatments.'"
			value={localPrompt}
			oninput={handlePromptChange}
			disabled={!useContextPrompt}
			data-testid="context-prompt-textarea"
		></textarea>

		<div class="prompt-footer">
			<span class="char-count" class:error={isOverLimit}>
				{charCount}/{MAX_CHARS}
			</span>
			<div class="prompt-actions">
				{#if localPrompt}
					<button
						type="button"
						class="text-button"
						onclick={clearPrompt}
						disabled={!useContextPrompt}
						data-testid="clear-prompt"
					>
						Clear
					</button>
				{/if}
				<button
					type="button"
					class="text-button"
					onclick={() => (showExamples = !showExamples)}
					disabled={!useContextPrompt}
					data-testid="show-examples"
				>
					{showExamples ? 'Hide' : 'Show'} Examples
				</button>
			</div>
		</div>

		{#if showExamples && useContextPrompt}
			<div class="examples-list" data-testid="examples-list">
				{#each examplePrompts as example}
					<button
						type="button"
						class="example-button"
						onclick={() => applyExample(example.prompt)}
						data-testid="example-{example.name.toLowerCase()}"
					>
						<span class="example-name">{example.name}</span>
						<span class="example-preview">{example.prompt.slice(0, 60)}...</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.context-prompt-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.toggle-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		accent-color: #f4c430;
	}

	.toggle-description {
		font-size: 0.75rem;
		color: #737373;
		margin: 0;
		margin-left: 1.5rem;
	}

	.prompt-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: opacity 0.2s ease;
	}

	.prompt-container.disabled {
		opacity: 0.5;
	}

	.prompt-textarea {
		width: 100%;
		min-height: 100px;
		max-height: 200px;
		padding: 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
	}

	.prompt-textarea:focus {
		outline: none;
		border-color: #f4c430;
	}

	.prompt-textarea:disabled {
		cursor: not-allowed;
	}

	.prompt-textarea.error {
		border-color: #ef4444;
	}

	.prompt-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.char-count {
		font-size: 0.75rem;
		color: #737373;
	}

	.char-count.error {
		color: #ef4444;
	}

	.prompt-actions {
		display: flex;
		gap: 0.75rem;
	}

	.text-button {
		padding: 0;
		background: none;
		border: none;
		color: #f4c430;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.text-button:hover:not(:disabled) {
		color: #eab308;
	}

	.text-button:disabled {
		color: #404040;
		cursor: not-allowed;
	}

	.examples-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
	}

	.example-button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 4px;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.example-button:hover {
		background: #333333;
	}

	.example-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #e5e5e5;
	}

	.example-preview {
		font-size: 0.75rem;
		color: #737373;
	}
</style>
