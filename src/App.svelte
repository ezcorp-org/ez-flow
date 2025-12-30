<script lang="ts">
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { onMount, onDestroy } from 'svelte';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import HistoryList from '$lib/components/HistoryList.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import ModelSetupScreen from '$lib/components/ModelSetupScreen.svelte';
	import FileDropZone from '$lib/components/FileDropZone.svelte';

	let historyList: HistoryList;
	let lastTranscription = $state<string | null>(null);
	let lastTranscriptionFilename = $state<string | null>(null);
	let error = $state<string | null>(null);
	let checkingModel = $state(true);
	let needsModelSetup = $state(false);
	const unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		// Check if any model is downloaded
		try {
			const downloadedModels = await invoke<string[]>('get_downloaded_model_ids');
			needsModelSetup = downloadedModels.length === 0;
		} catch (e) {
			console.error('Failed to check models:', e);
			needsModelSetup = true;
		}
		checkingModel = false;

		// Listen for transcription complete events from tray/hotkey
		unlisteners.push(
			await listen<string>('tray://transcription-complete', async () => {
				// Refresh history when transcription completes from tray
				await historyList?.refresh();
			})
		);
	});

	function handleModelSetupComplete() {
		needsModelSetup = false;
	}

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
	});

	async function handleTranscriptionComplete(text: string) {
		lastTranscription = text;
		lastTranscriptionFilename = null;
		error = null;
		// Refresh history to show new entry
		await historyList?.refresh();
		// Clear the notification after a few seconds
		setTimeout(() => {
			lastTranscription = null;
		}, 5000);
	}

	async function handleFileTranscriptionComplete(text: string, filename: string) {
		lastTranscription = text;
		lastTranscriptionFilename = filename;
		error = null;
		// Refresh history to show new entry
		await historyList?.refresh();
		// Clear the notification after a few seconds
		setTimeout(() => {
			lastTranscription = null;
			lastTranscriptionFilename = null;
		}, 5000);
	}

	function handleError(err: string) {
		error = err;
		lastTranscription = null;
		// Clear the error after a few seconds
		setTimeout(() => {
			error = null;
		}, 5000);
	}

	function dismissNotification() {
		lastTranscription = null;
		lastTranscriptionFilename = null;
		error = null;
	}
</script>

{#if checkingModel}
	<div class="loading-screen">
		<div class="loading-spinner"></div>
		<p>Loading...</p>
	</div>
{:else if needsModelSetup}
	<ModelSetupScreen onComplete={handleModelSetupComplete} />
{:else}
<main class="app" data-testid="main-app">
	<header class="header">
		<div class="logo">
			<svg width="32" height="32" viewBox="0 0 64 64" fill="none">
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
		<p class="tagline">Local speech-to-text that just works</p>
	</header>

	<section class="record-section">
		<RecordButton onTranscriptionComplete={handleTranscriptionComplete} onError={handleError} />

		{#if lastTranscription}
			<div class="notification success" data-testid="transcription-success">
				<div class="notification-content">
					<span class="notification-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					</span>
					<span class="notification-text">
						{#if lastTranscriptionFilename}
							Transcribed "{lastTranscriptionFilename}"!
						{:else}
							Transcription copied to clipboard!
						{/if}
					</span>
				</div>
				<button class="dismiss-btn" onclick={dismissNotification} aria-label="Dismiss">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		{/if}

		{#if error}
			<div class="notification error" data-testid="transcription-error">
				<div class="notification-content">
					<span class="notification-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
					</span>
					<span class="notification-text">{error}</span>
				</div>
				<button class="dismiss-btn" onclick={dismissNotification} aria-label="Dismiss">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		{/if}
	</section>

	<section class="file-drop-section">
		<FileDropZone
			onTranscriptionComplete={handleFileTranscriptionComplete}
			onError={handleError}
		/>
	</section>

	<section class="history-section">
		<HistoryList bind:this={historyList} limit={5} showViewAll={true} />
	</section>

	<footer class="footer">
		<p class="hint">
			Tip: Use <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> for push-to-talk anywhere
		</p>
	</footer>

	<NavBar />
</main>
{/if}

<style>
	.loading-screen {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(180deg, #0a0a0a 0%, #171717 100%);
		color: #737373;
		gap: 1rem;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #262626;
		border-top-color: #f4c430;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.app {
		min-height: 100vh;
		background: linear-gradient(180deg, #0a0a0a 0%, #171717 100%);
		color: #e5e5e5;
		display: flex;
		flex-direction: column;
		padding: 2rem;
		padding-bottom: 5rem; /* Space for navbar */
	}

	.header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.logo {
		margin-bottom: 0.75rem;
		display: flex;
		justify-content: center;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: #f4c430;
		margin: 0 0 0.25rem 0;
	}

	.tagline {
		color: #737373;
		font-size: 0.9375rem;
		margin: 0;
	}

	.record-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 0;
	}

	.notification {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		max-width: 320px;
		width: 100%;
		animation: slideIn 0.2s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.notification.success {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.3);
		color: #22c55e;
	}

	.notification.error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
	}

	.notification-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.notification-icon {
		flex-shrink: 0;
	}

	.notification-text {
		font-size: 0.875rem;
	}

	.dismiss-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: inherit;
		opacity: 0.6;
		cursor: pointer;
		border-radius: 4px;
		transition: opacity 0.15s;
	}

	.dismiss-btn:hover {
		opacity: 1;
	}

	.file-drop-section {
		max-width: 480px;
		width: 100%;
		margin: 0 auto;
		padding: 0 0 1rem 0;
	}

	.history-section {
		flex: 1;
		max-width: 480px;
		width: 100%;
		margin: 0 auto;
		padding: 1rem 0;
	}

	.footer {
		text-align: center;
		padding-top: 1.5rem;
		border-top: 1px solid #262626;
		margin-top: auto;
	}

	.hint {
		font-size: 0.8125rem;
		color: #525252;
		margin: 0;
	}

	kbd {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		font-size: 0.75rem;
		font-family: monospace;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 4px;
		color: #a3a3a3;
	}
</style>
