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
	let loadingModel = $state(false);

	let unlisten: UnlistenFn | null = null;

	onMount(async () => {
		try {
			const availableModels = await invoke<
				Array<{ id: string; name: string; size_mb: number; downloaded: boolean }>
			>('get_available_models');
			models = availableModels;

			// Get the configured model from settings
			const settings = await invoke<{ model_id: string }>('get_settings');
			if (settings.model_id) {
				selectedModelId = settings.model_id;
			}

			// If configured model is downloaded, preselect it
			const configured = models.find((m) => m.id === selectedModelId);
			if (!configured?.downloaded) {
				// Fall back to any downloaded model
				const downloaded = models.find((m) => m.downloaded);
				if (downloaded) {
					selectedModelId = downloaded.id;
				}
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

			downloading = false;

			// Auto-continue after download
			await continueToApp();
		} catch (e) {
			console.error('Download failed:', e);
			downloadError = `Download failed: ${e}`;
			downloading = false;
		}
	}

	async function continueToApp() {
		loadingModel = true;
		downloadError = null;

		try {
			// Load the selected model
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
			loadingModel = false;
		}
	}

	function getSelectedModel() {
		return models.find((m) => m.id === selectedModelId);
	}

	function isSelectedModelDownloaded(): boolean {
		return getSelectedModel()?.downloaded ?? false;
	}
</script>

<div class="setup-screen" data-testid="model-setup-screen">
	<div class="setup-container">
		<div class="header">
			<div class="logo">
				<svg width="48" height="48" viewBox="0 0 64 64" fill="none">
					<rect width="64" height="64" rx="16" fill="#f4c430" />
					<path
						d="M20 32 C20 20 32 16 32 16 C32 16 44 20 44 32 C44 44 32 48 32 48 C32 48 20 44 20 32"
						stroke="black"
						stroke-width="3"
						fill="none"
					/>
					<circle cx="32" cy="32" r="8" fill="black" />
				</svg>
			</div>
			<h1>EZ Flow</h1>
			<p class="subtitle">Speech-to-Text Setup</p>
		</div>

		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading models...</p>
			</div>
		{:else}
			<div class="model-section">
				<h2>Select Whisper Model</h2>
				<p class="description">
					Choose a model for speech recognition. Larger models are more accurate but slower.
				</p>

				<div class="model-list">
					{#each models as model}
						<label class="model-option" class:selected={selectedModelId === model.id}>
							<input
								type="radio"
								name="model"
								value={model.id}
								bind:group={selectedModelId}
								disabled={downloading || loadingModel}
							/>
							<div class="model-info">
								<div class="model-name-row">
									<span class="model-name">{model.name}</span>
									{#if model.id === 'base'}
										<span class="badge recommended">Recommended</span>
									{/if}
								</div>
								<span class="model-size">{model.size_mb} MB</span>
							</div>
							<div class="model-status">
								{#if model.downloaded}
									<span class="status-badge installed">Installed</span>
								{:else}
									<span class="status-badge not-installed">Not Installed</span>
								{/if}
							</div>
						</label>
					{/each}
				</div>

				{#if downloadError}
					<div class="error-message">
						<span>{downloadError}</span>
						<button class="dismiss-btn" onclick={() => downloadError = null}>Dismiss</button>
					</div>
				{/if}

				{#if downloading}
					<div class="download-progress">
						<div class="progress-bar">
							<div class="progress-fill" style="width: {downloadProgress}%"></div>
						</div>
						<p class="progress-text">
							Downloading {getSelectedModel()?.name}... {Math.round(downloadProgress)}%
						</p>
					</div>
				{:else if loadingModel}
					<div class="loading-state small">
						<div class="spinner"></div>
						<p>Loading model...</p>
					</div>
				{:else}
					<div class="action-buttons">
						{#if isSelectedModelDownloaded()}
							<button class="primary-button" onclick={continueToApp}>
								Continue with {getSelectedModel()?.name}
							</button>
						{:else}
							<button class="primary-button" onclick={downloadModel}>
								Download {getSelectedModel()?.name} ({getSelectedModel()?.size_mb} MB)
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.setup-screen {
		min-height: 100vh;
		background: linear-gradient(180deg, #0a0a0a 0%, #171717 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: #e5e5e5;
	}

	.setup-container {
		max-width: 520px;
		width: 100%;
	}

	.header {
		text-align: center;
		margin-bottom: 2.5rem;
	}

	.logo {
		margin-bottom: 1rem;
		display: flex;
		justify-content: center;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #f4c430;
		margin: 0 0 0.25rem 0;
	}

	.subtitle {
		color: #737373;
		font-size: 1rem;
		margin: 0;
	}

	.loading-state {
		text-align: center;
		padding: 3rem;
		color: #a3a3a3;
	}

	.loading-state.small {
		padding: 1.5rem;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #262626;
		border-top-color: #f4c430;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.model-section {
		background: #171717;
		border: 1px solid #262626;
		border-radius: 12px;
		padding: 1.5rem;
	}

	h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: #e5e5e5;
	}

	.description {
		color: #737373;
		font-size: 0.875rem;
		margin: 0 0 1.25rem 0;
		line-height: 1.5;
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
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
		transition: all 0.2s;
	}

	.model-option:hover:not(:has(input:disabled)) {
		background: #1a1a1a;
		border-color: #333;
	}

	.model-option.selected {
		border-color: #f4c430;
		background: rgba(244, 196, 48, 0.05);
	}

	.model-option:has(input:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.model-option input {
		accent-color: #f4c430;
		width: 18px;
		height: 18px;
	}

	.model-info {
		flex: 1;
		min-width: 0;
	}

	.model-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.125rem;
	}

	.model-name {
		font-weight: 500;
		color: #e5e5e5;
	}

	.model-size {
		font-size: 0.8125rem;
		color: #737373;
	}

	.badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}

	.badge.recommended {
		background: rgba(244, 196, 48, 0.15);
		color: #f4c430;
	}

	.model-status {
		flex-shrink: 0;
	}

	.status-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.status-badge.installed {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
	}

	.status-badge.not-installed {
		background: rgba(115, 115, 115, 0.15);
		color: #737373;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.dismiss-btn {
		background: none;
		border: none;
		color: #ef4444;
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.download-progress {
		padding: 0.5rem 0;
	}

	.progress-bar {
		height: 8px;
		background: #262626;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #f4c430, #eab308);
		transition: width 0.3s ease;
	}

	.progress-text {
		margin: 0.75rem 0 0 0;
		color: #a3a3a3;
		font-size: 0.875rem;
		text-align: center;
	}

	.action-buttons {
		display: flex;
		justify-content: center;
	}

	.primary-button {
		padding: 0.875rem 2rem;
		background: #f4c430;
		color: #000;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		width: 100%;
	}

	.primary-button:hover {
		background: #eab308;
		transform: translateY(-1px);
	}

	.primary-button:active {
		transform: translateY(0);
	}
</style>
