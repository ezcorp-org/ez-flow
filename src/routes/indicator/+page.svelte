<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import RecordingIndicator from '$lib/components/RecordingIndicator.svelte';
	import type { WorkflowState } from '$lib/services/workflow';

	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let audioLevel = $state(0);
	const unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		const appWindow = getCurrentWindow();

		// Listen for workflow state changes
		unlisteners.push(
			await listen<WorkflowState>('workflow://state-changed', (event) => {
				const state = event.payload;
				isRecording = state === 'recording';
				isTranscribing = state === 'transcribing';

				// Show/hide window based on state
				if (state === 'recording' || state === 'transcribing') {
					appWindow.show();
				} else {
					appWindow.hide();
				}
			})
		);

		// Listen for recording started
		unlisteners.push(
			await listen('hotkey://recording-started', () => {
				isRecording = true;
				appWindow.show();
			})
		);

		// Listen for audio level updates
		unlisteners.push(
			await listen<number>('recording:level', (event) => {
				audioLevel = event.payload;
			})
		);

		// Listen for escape key to cancel
		const handleKeydown = async (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				await appWindow.hide();
			}
		};
		document.addEventListener('keydown', handleKeydown);
		unlisteners.push(() => document.removeEventListener('keydown', handleKeydown));
	});

	onDestroy(() => {
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

<div class="indicator-container">
	{#if isRecording || isTranscribing}
		<RecordingIndicator {isRecording} {isTranscribing} {audioLevel} />
	{/if}
</div>

<style>
	.indicator-container {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		width: 100vw;
		padding: 4px;
	}
</style>
