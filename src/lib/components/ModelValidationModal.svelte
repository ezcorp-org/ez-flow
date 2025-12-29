<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface Props {
		onComplete: () => void;
	}

	let { onComplete }: Props = $props();

	// Model state
	let models = $state<Array<{ id: string; name: string; size_mb: number; downloaded: boolean }>>([]);
	let selectedModelId = $state('base');
	let downloading = $state(false);
	let downloadProgress = $state(0);
	let downloadError = $state<string | null>(null);
	let loading = $state(true);

	let unlisten: UnlistenFn | null = null;

	onMount(async () => {
		try {
			const availableModels = await invoke<
				Array<{ id: string; name: string; size_mb: number; downloaded: boolean }>
			>('get_available_models');
			models = availableModels;

			// If a model is already downloaded, preselect it
			const downloaded = models.find((m) => m.downloaded);
			if (downloaded) {
				selectedModelId = downloaded.id;
			}
		} catch (e) {
			console.error('Failed to get models:', e);
			downloadError = 'Failed to load available models';
		} finally {
			loading = false;
		}

		// Set up download progress listener
		unlisten = await listen<{ progress: number }>('model:download_progress', (event) => {
			downloadProgress = event.payload.progress * 100;
		});
	});

	onDestroy(() => {
		if (unlisten) {
			unlisten();
		}
	});

	async function downloadModel() {
		downloading = true;
		downloadProgress = 0;
		downloadError = null;

		try {
			await invoke('download_model', { modelId: selectedModelId });

			// Mark the model as downloaded in local state
			models = models.map((m) =>
				m.id === selectedModelId ? { ...m, downloaded: true } : m
			);

			// Load the model after download
			await loadModelAndComplete();
		} catch (e) {
			console.error('Download failed:', e);
			downloadError = `Download failed: ${e}`;
			downloading = false;
		}
	}

	async function loadModelAndComplete() {
		try {
			// Load the model
			await invoke('load_whisper_model', { modelName: selectedModelId });

			// Update settings with the selected model
			await invoke('update_setting', {
				key: 'model_id',
				value: selectedModelId
			});

			// Signal completion
			onComplete();
		} catch (e) {
			console.error('Failed to load model:', e);
			downloadError = `Failed to load model: ${e}`;
			downloading = false;
		}
	}

	async function useExistingModel() {
		const downloadedModel = models.find((m) => m.downloaded);
		if (downloadedModel) {
			selectedModelId = downloadedModel.id;
			await loadModelAndComplete();
		}
	}

	function hasDownloadedModel(): boolean {
		return models.some((m) => m.downloaded);
	}
</script>

<div class="modal-overlay" data-testid="model-validation-modal">
	<div class="modal">
		<div class="modal-header">
			<div class="icon">&#128203;</div>
			<h2>Model Required</h2>
		</div>

		{#if loading}
			<div class="loading">
				<p>Loading available models...</p>
			</div>
		{:else}
			<p class="description">
				A Whisper model is required for speech-to-text. Please select a model to download or use an existing one.
			</p>

			<div class="model-list">
				{#each models as model}
					<label class="model-option" class:selected={selectedModelId === model.id}>
						<input type="radio" name="model" value={model.id} bind:group={selectedModelId} />
						<div class="model-info">
							<span class="model-name">
								{model.name}
								{#if model.id === 'base'}
									<span class="recommended">Recommended</span>
								{/if}
							</span>
							<span class="model-size">{model.size_mb} MB</span>
						</div>
						{#if model.downloaded}
							<span class="downloaded-badge" title="Downloaded">&#10003;</span>
						{/if}
					</label>
				{/each}
			</div>

			{#if downloadError}
				<div class="error-message">
					{downloadError}
					<button class="retry-link" onclick={() => downloadError = null}>Dismiss</button>
				</div>
			{/if}

			{#if downloading}
				<div class="download-progress">
					<div class="progress-bar">
						<div class="progress-fill" style="width: {downloadProgress}%"></div>
					</div>
					<p class="progress-text">Downloading... {Math.round(downloadProgress)}%</p>
				</div>
			{:else}
				<div class="button-group">
					{#if hasDownloadedModel()}
						<button class="secondary-button" onclick={useExistingModel}>
							Use Downloaded Model
						</button>
					{/if}
					<button
						class="primary-button"
						onclick={downloadModel}
						disabled={downloading}
					>
						Download {models.find((m) => m.id === selectedModelId)?.name || 'Model'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		backdrop-filter: blur(4px);
	}

	.modal {
		background: #171717;
		border: 1px solid #262626;
		border-radius: 12px;
		padding: 2rem;
		max-width: 480px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #f4c430;
		margin: 0;
	}

	.description {
		color: #a3a3a3;
		font-size: 0.9375rem;
		line-height: 1.6;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: #a3a3a3;
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.model-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: #0a0a0a;
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s;
	}

	.model-option:hover {
		background: #1f1f1f;
	}

	.model-option.selected {
		border-color: #f4c430;
	}

	.model-option input {
		accent-color: #f4c430;
	}

	.model-info {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.model-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #e5e5e5;
	}

	.recommended {
		font-size: 0.6875rem;
		color: #f4c430;
		background: rgba(244, 196, 48, 0.15);
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.model-size {
		color: #737373;
		font-size: 0.875rem;
	}

	.downloaded-badge {
		color: #22c55e;
		font-size: 1.25rem;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.retry-link {
		background: none;
		border: none;
		color: #ef4444;
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.download-progress {
		margin-top: 1rem;
	}

	.progress-bar {
		height: 8px;
		background: #262626;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #f4c430;
		transition: width 0.3s ease;
	}

	.progress-text {
		margin-top: 0.5rem;
		color: #a3a3a3;
		font-size: 0.875rem;
		text-align: center;
	}

	.button-group {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.primary-button {
		padding: 0.75rem 1.5rem;
		background: #f4c430;
		color: #000;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.primary-button:hover:not(:disabled) {
		background: #eab308;
	}

	.primary-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.secondary-button {
		padding: 0.75rem 1.5rem;
		background: transparent;
		color: #a3a3a3;
		border: 1px solid #404040;
		border-radius: 8px;
		font-size: 1rem;
		cursor: pointer;
		transition: border-color 0.2s, color 0.2s;
	}

	.secondary-button:hover {
		border-color: #737373;
		color: #e5e5e5;
	}
</style>
