<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { writeText } from '@tauri-apps/plugin-clipboard-manager';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onTranscriptionComplete?: (text: string, filename: string) => void;
		onError?: (error: string) => void;
	}

	let { onTranscriptionComplete, onError }: Props = $props();

	// Supported audio/video file extensions
	const SUPPORTED_EXTENSIONS = [
		'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma',
		'.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.m4v'
	];

	let isDragging = $state(false);
	let isProcessing = $state(false);
	let progress = $state(0);
	let currentFile = $state<string | null>(null);
	let transcriptionResult = $state<{ text: string; filename: string; durationMs: number } | null>(null);
	let errorMessage = $state<string | null>(null);
	let copied = $state(false);

	const unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		// Listen for transcription progress events
		unlisteners.push(
			await listen<{ progress: number; stage: string }>('file-transcription://progress', (event) => {
				progress = event.payload.progress;
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
	});

	function isFileSupported(filename: string): boolean {
		const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
		return SUPPORTED_EXTENSIONS.includes(ext);
	}

	function getFileExtension(filename: string): string {
		return filename.toLowerCase().slice(filename.lastIndexOf('.'));
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		// Only set isDragging to false if we're leaving the dropzone entirely
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;
		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			isDragging = false;
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) {
			return;
		}

		// Only process the first file
		const file = files[0];
		await processFile(file);
	}

	async function processFile(file: File) {
		const filename = file.name;

		// Validate file type
		if (!isFileSupported(filename)) {
			const ext = getFileExtension(filename);
			const errorMsg = `Unsupported file type: ${ext}. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`;
			errorMessage = errorMsg;
			onError?.(errorMsg);
			return;
		}

		// Reset state
		errorMessage = null;
		transcriptionResult = null;
		isProcessing = true;
		progress = 0;
		currentFile = filename;

		try {
			// Check if a model is loaded
			const isLoaded = await invoke<boolean>('is_model_loaded');
			if (!isLoaded) {
				// Try to load the default model
				const downloadedModels = await invoke<string[]>('get_downloaded_model_ids');
				if (downloadedModels.length === 0) {
					throw new Error('No transcription model available. Please download a model in Settings.');
				}
				// Load the first available model
				await invoke('load_whisper_model', { modelName: downloadedModels[0] });
			}

			// Read file as array buffer and get the path
			// For drag-and-drop, we need to save the file temporarily
			const arrayBuffer = await file.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			// Save the file to a temporary location and transcribe
			const result = await invoke<{ text: string; durationMs: number; modelId: string; language: string | null }>('transcribe_dropped_file', {
				fileData: Array.from(uint8Array),
				fileName: filename
			});

			transcriptionResult = {
				text: result.text,
				filename,
				durationMs: result.durationMs
			};

			progress = 100;
			onTranscriptionComplete?.(result.text, filename);
		} catch (error) {
			const errorMsg = String(error);
			errorMessage = errorMsg;
			onError?.(errorMsg);
		} finally {
			isProcessing = false;
		}
	}

	async function copyToClipboard() {
		if (transcriptionResult) {
			await writeText(transcriptionResult.text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function dismissResult() {
		transcriptionResult = null;
		errorMessage = null;
		currentFile = null;
		progress = 0;
	}

	function formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}
</script>

<div
	class="file-drop-zone"
	class:dragging={isDragging}
	class:processing={isProcessing}
	class:has-result={transcriptionResult !== null}
	class:has-error={errorMessage !== null}
	data-testid="file-dropzone"
	role="button"
	tabindex="0"
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if isProcessing}
		<div class="processing-state" data-testid="file-processing">
			<div class="spinner"></div>
			<p class="processing-text">Transcribing {currentFile}...</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress}%"></div>
			</div>
			<span class="progress-text">{Math.round(progress)}%</span>
		</div>
	{:else if transcriptionResult}
		<div class="result-state" data-testid="file-transcription-result">
			<div class="result-header">
				<div class="result-info">
					<span class="result-filename">{transcriptionResult.filename}</span>
					<span class="result-duration">{formatDuration(transcriptionResult.durationMs)}</span>
				</div>
				<button class="dismiss-btn" onclick={dismissResult} aria-label="Dismiss">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
			<p class="result-text" data-testid="transcription-text">{transcriptionResult.text}</p>
			<button
				class="copy-btn"
				class:copied
				onclick={copyToClipboard}
				data-testid="copy-transcription-btn"
			>
				{#if copied}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
					Copied!
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
					</svg>
					Copy to Clipboard
				{/if}
			</button>
		</div>
	{:else if errorMessage}
		<div class="error-state" data-testid="file-transcription-error">
			<div class="error-icon">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>
			<p class="error-text">{errorMessage}</p>
			<button class="retry-btn" onclick={dismissResult}>Try Again</button>
		</div>
	{:else}
		<div class="drop-prompt">
			<div class="drop-icon">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="17 8 12 3 7 8"></polyline>
					<line x1="12" y1="3" x2="12" y2="15"></line>
				</svg>
			</div>
			<p class="drop-text">
				{#if isDragging}
					Drop file to transcribe
				{:else}
					Drag and drop an audio or video file here
				{/if}
			</p>
			<p class="drop-hint">Supports MP3, WAV, M4A, MP4, and more</p>
		</div>
	{/if}
</div>

<style>
	.file-drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 160px;
		padding: 1.5rem;
		background: #171717;
		border: 2px dashed #404040;
		border-radius: 12px;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.file-drop-zone:hover:not(.processing):not(.has-result):not(.has-error) {
		border-color: #525252;
		background: #1a1a1a;
	}

	.file-drop-zone.dragging {
		border-color: #f4c430;
		background: rgba(244, 196, 48, 0.05);
		border-style: solid;
	}

	.file-drop-zone.processing {
		border-color: #404040;
		cursor: default;
	}

	.file-drop-zone.has-result {
		border-color: #22c55e;
		border-style: solid;
		background: rgba(34, 197, 94, 0.05);
	}

	.file-drop-zone.has-error {
		border-color: #ef4444;
		border-style: solid;
		background: rgba(239, 68, 68, 0.05);
	}

	/* Drop prompt state */
	.drop-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.drop-icon {
		color: #525252;
		transition: color 0.2s;
	}

	.file-drop-zone.dragging .drop-icon {
		color: #f4c430;
	}

	.drop-text {
		margin: 0;
		font-size: 1rem;
		color: #a3a3a3;
	}

	.file-drop-zone.dragging .drop-text {
		color: #f4c430;
	}

	.drop-hint {
		margin: 0;
		font-size: 0.75rem;
		color: #525252;
	}

	/* Processing state */
	.processing-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 300px;
	}

	.spinner {
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

	.processing-text {
		margin: 0;
		font-size: 0.875rem;
		color: #a3a3a3;
		text-align: center;
		word-break: break-word;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: #262626;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #f4c430;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.75rem;
		color: #737373;
	}

	/* Result state */
	.result-state {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.result-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.result-filename {
		font-size: 0.875rem;
		font-weight: 600;
		color: #e5e5e5;
		word-break: break-word;
	}

	.result-duration {
		font-size: 0.75rem;
		color: #737373;
	}

	.result-text {
		margin: 0;
		padding: 0.75rem;
		background: #0a0a0a;
		border-radius: 8px;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #d4d4d4;
		max-height: 120px;
		overflow-y: auto;
		word-break: break-word;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: #f4c430;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #000;
		cursor: pointer;
		transition: all 0.15s;
	}

	.copy-btn:hover {
		background: #eab308;
	}

	.copy-btn.copied {
		background: #22c55e;
		color: #fff;
	}

	.dismiss-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		color: #737373;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.15s;
	}

	.dismiss-btn:hover {
		background: #262626;
		color: #a3a3a3;
	}

	/* Error state */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.error-icon {
		color: #ef4444;
	}

	.error-text {
		margin: 0;
		font-size: 0.875rem;
		color: #ef4444;
		max-width: 300px;
		word-break: break-word;
	}

	.retry-btn {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid #404040;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #a3a3a3;
		cursor: pointer;
		transition: all 0.15s;
	}

	.retry-btn:hover {
		background: #171717;
		border-color: #525252;
		color: #e5e5e5;
	}
</style>
