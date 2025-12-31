<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import TranscriptionPreview, {
		type PreviewState
	} from '$lib/components/TranscriptionPreview.svelte';
	import { invoke } from '@tauri-apps/api/core';
	import type { PartialTranscriptionEvent, FinalTranscriptionEvent } from '$lib/services/workflow';

	/**
	 * Preview text event payload
	 */
	interface PreviewTextPayload {
		text: string;
		state: PreviewState;
	}

	/**
	 * Settings interface (subset for preview)
	 */
	interface PreviewSettings {
		preview_enabled: boolean;
		preview_duration_secs: number;
		preview_show_visualizer: boolean;
		streaming_enabled: boolean;
	}

	let text = $state('');
	let previewState = $state<PreviewState>('preview');
	let audioLevel = $state(0);
	let showVisualizer = $state(true);
	let previewDuration = $state(3);
	let streamingEnabled = $state(true);
	let hideTimeout: ReturnType<typeof setTimeout> | undefined;
	const unlisteners: UnlistenFn[] = [];

	/**
	 * Load preview settings
	 */
	async function loadSettings() {
		try {
			const settings = await invoke<PreviewSettings>('get_settings');
			showVisualizer = settings.preview_show_visualizer ?? true;
			previewDuration = settings.preview_duration_secs ?? 3;
			streamingEnabled = settings.streaming_enabled ?? true;
		} catch (e) {
			console.error('Failed to load preview settings:', e);
		}
	}

	/**
	 * Schedule window hide after duration
	 */
	function scheduleHide(durationSecs: number) {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}
		hideTimeout = setTimeout(async () => {
			const appWindow = getCurrentWindow();
			await appWindow.hide();
			// Reset state
			text = '';
			previewState = 'preview';
		}, durationSecs * 1000);
	}

	/**
	 * Cancel scheduled hide
	 */
	function cancelHide() {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = undefined;
		}
	}

	onMount(async () => {
		const appWindow = getCurrentWindow();
		await loadSettings();

		// Listen for preview text events
		unlisteners.push(
			await listen<PreviewTextPayload>('preview://text', async (event) => {
				const payload = event.payload;
				text = payload.text;
				previewState = payload.state;

				// Show window
				await appWindow.show();

				// Handle auto-hide based on state
				if (payload.state === 'complete') {
					scheduleHide(previewDuration);
				} else if (payload.state === 'error') {
					scheduleHide(previewDuration + 1); // Show errors a bit longer
				} else {
					cancelHide();
				}
			})
		);

		// Listen for audio level updates (for visualizer)
		unlisteners.push(
			await listen<number>('recording:level', (event) => {
				audioLevel = event.payload;
			})
		);

		// Listen for settings changes
		unlisteners.push(
			await listen<PreviewSettings>('settings://changed', (event) => {
				const settings = event.payload;
				showVisualizer = settings.preview_show_visualizer ?? true;
				previewDuration = settings.preview_duration_secs ?? 3;
				streamingEnabled = settings.streaming_enabled ?? true;
			})
		);

		// Listen for streaming partial transcription events
		unlisteners.push(
			await listen<PartialTranscriptionEvent>('transcription://partial', async (event) => {
				if (!streamingEnabled) return;

				const payload = event.payload;
				text = payload.text;
				previewState = 'streaming';

				// Show window for streaming updates
				await appWindow.show();
				cancelHide();
			})
		);

		// Listen for streaming final transcription events
		unlisteners.push(
			await listen<FinalTranscriptionEvent>('transcription://complete', async (event) => {
				if (!streamingEnabled) return;

				const payload = event.payload;
				text = payload.text;
				previewState = 'complete';

				// Auto-hide after showing final result
				scheduleHide(previewDuration);
			})
		);

		// Listen for recording started to show window in streaming mode
		unlisteners.push(
			await listen('hotkey://recording-started', async () => {
				if (!streamingEnabled) return;

				// Show window and set streaming state
				text = '';
				previewState = 'streaming';
				await appWindow.show();
				cancelHide();
			})
		);

		// Listen for escape key to close
		const handleKeydown = async (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				cancelHide();
				await appWindow.hide();
				text = '';
				previewState = 'preview';
			}
		};
		document.addEventListener('keydown', handleKeydown);
		unlisteners.push(() => document.removeEventListener('keydown', handleKeydown));

		// Handle window drag for position saving
		let isDragging = false;
		let dragEndTimeout: ReturnType<typeof setTimeout> | undefined;

		const handleMouseDown = () => {
			isDragging = true;
		};

		const handleMouseUp = async () => {
			if (isDragging) {
				// Debounce position save
				if (dragEndTimeout) clearTimeout(dragEndTimeout);
				dragEndTimeout = setTimeout(async () => {
					try {
						const position = await appWindow.outerPosition();
						await invoke('save_preview_position', {
							x: position.x,
							y: position.y
						});
					} catch (e) {
						console.error('Failed to save preview position:', e);
					}
				}, 100);
			}
			isDragging = false;
		};

		document.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('mouseup', handleMouseUp);
		unlisteners.push(() => {
			document.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('mouseup', handleMouseUp);
		});
	});

	onDestroy(() => {
		cancelHide();
		unlisteners.forEach((unlisten) => unlisten());
	});
</script>

<svelte:head>
	<style>
		body {
			background: transparent;
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
	</style>
</svelte:head>

<div class="preview-container">
	<TranscriptionPreview {text} state={previewState} {audioLevel} {showVisualizer} />
</div>

<style>
	.preview-container {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		width: 100vw;
		padding: 8px;
	}
</style>
