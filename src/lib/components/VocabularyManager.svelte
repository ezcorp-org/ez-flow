<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { X, Upload, Download, Plus } from 'lucide-svelte';

	interface Props {
		vocabulary?: string[];
		onChange?: (vocabulary: string[]) => void;
	}

	let { vocabulary = $bindable([]), onChange = () => {} }: Props = $props();

	let newTerm = $state('');
	let importExportStatus = $state<string | null>(null);
	let isDuplicateError = $state(false);

	function addTerm() {
		const term = newTerm.trim();
		if (!term) return;

		if (vocabulary.includes(term)) {
			isDuplicateError = true;
			setTimeout(() => (isDuplicateError = false), 2000);
			return;
		}

		vocabulary = [...vocabulary, term];
		onChange(vocabulary);
		newTerm = '';
	}

	function removeTerm(term: string) {
		vocabulary = vocabulary.filter((t) => t !== term);
		onChange(vocabulary);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTerm();
		}
	}

	async function exportVocabulary() {
		try {
			const path = await save({
				defaultPath: 'vocabulary.json',
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (path) {
				await invoke('export_vocabulary', { path, vocabulary });
				importExportStatus = 'Vocabulary exported successfully';
				setTimeout(() => (importExportStatus = null), 3000);
			}
		} catch (error) {
			importExportStatus = `Export failed: ${error}`;
			setTimeout(() => (importExportStatus = null), 5000);
		}
	}

	async function importVocabulary() {
		try {
			const path = await open({
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (path) {
				const imported = await invoke<string[]>('import_vocabulary', { path });
				// Merge without duplicates
				const merged = [...new Set([...vocabulary, ...imported])];
				vocabulary = merged;
				onChange(vocabulary);
				importExportStatus = `Imported ${imported.length} terms`;
				setTimeout(() => (importExportStatus = null), 3000);
			}
		} catch (error) {
			importExportStatus = `Import failed: ${error}`;
			setTimeout(() => (importExportStatus = null), 5000);
		}
	}
</script>

<div class="vocabulary-manager" data-testid="vocabulary-manager">
	<div class="input-row">
		<input
			type="text"
			bind:value={newTerm}
			onkeydown={handleKeydown}
			placeholder="Add custom term (e.g., HIPAA, COVID-19)"
			class="term-input"
			class:error={isDuplicateError}
			data-testid="vocabulary-input"
		/>
		<button
			type="button"
			class="add-button"
			onclick={addTerm}
			disabled={!newTerm.trim()}
			data-testid="add-term-button"
		>
			<Plus size={16} />
			Add
		</button>
	</div>

	{#if isDuplicateError}
		<p class="error-message">Term already exists</p>
	{/if}

	{#if vocabulary.length > 0}
		<div class="terms-list" data-testid="vocabulary-list">
			{#each vocabulary as term}
				<div class="term-tag">
					<span class="term-text">{term}</span>
					<button
						type="button"
						class="remove-button"
						onclick={() => removeTerm(term)}
						aria-label="Remove {term}"
						data-testid="remove-term-{term}"
					>
						<X size={14} />
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty-message">No custom vocabulary terms. Add terms to improve transcription accuracy.</p>
	{/if}

	<div class="import-export-row">
		<button type="button" class="secondary-button" onclick={importVocabulary} data-testid="import-vocabulary">
			<Upload size={14} />
			Import
		</button>
		<button
			type="button"
			class="secondary-button"
			onclick={exportVocabulary}
			disabled={vocabulary.length === 0}
			data-testid="export-vocabulary"
		>
			<Download size={14} />
			Export
		</button>
	</div>

	{#if importExportStatus}
		<p class="status-message" class:error={importExportStatus.includes('failed')}>
			{importExportStatus}
		</p>
	{/if}
</div>

<style>
	.vocabulary-manager {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.term-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
	}

	.term-input:focus {
		outline: none;
		border-color: #f4c430;
	}

	.term-input.error {
		border-color: #ef4444;
	}

	.add-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: #f4c430;
		border: none;
		border-radius: 6px;
		color: #000;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.add-button:hover:not(:disabled) {
		background: #eab308;
	}

	.add-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		font-size: 0.75rem;
		color: #ef4444;
		margin: 0;
	}

	.terms-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		min-height: 60px;
		max-height: 200px;
		overflow-y: auto;
	}

	.term-tag {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.term-text {
		color: #e5e5e5;
	}

	.remove-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem;
		background: none;
		border: none;
		color: #737373;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.remove-button:hover {
		color: #ef4444;
	}

	.empty-message {
		font-size: 0.8125rem;
		color: #737373;
		text-align: center;
		padding: 1rem;
		background: #171717;
		border: 1px dashed #262626;
		border-radius: 6px;
		margin: 0;
	}

	.import-export-row {
		display: flex;
		gap: 0.5rem;
	}

	.secondary-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.secondary-button:hover:not(:disabled) {
		background: #333333;
	}

	.secondary-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-message {
		font-size: 0.8125rem;
		color: #22c55e;
		margin: 0;
	}

	.status-message.error {
		color: #ef4444;
	}
</style>
