<script lang="ts">
	import { onDestroy } from 'svelte';
	import AudioVisualizer from './AudioVisualizer.svelte';
	import { X } from '@lucide/svelte';

	interface Props {
		isRecording?: boolean;
		isTranscribing?: boolean;
		audioLevel?: number;
		onClose?: () => void;
	}

	let { isRecording = false, isTranscribing = false, audioLevel = 0, onClose }: Props = $props();

	// Debug: log when audioLevel changes
	$effect(() => {
		if (audioLevel > 0) {
			console.log('[RecordingIndicator] audioLevel prop:', audioLevel.toFixed(4));
		}
	});

	let elapsed = $state(0);
	let interval: ReturnType<typeof setInterval> | undefined;

	$effect(() => {
		if (isRecording && !interval) {
			elapsed = 0;
			interval = setInterval(() => (elapsed += 1), 1000);
		} else if (!isRecording && interval) {
			clearInterval(interval);
			interval = undefined;
		}
	});

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div
	class="recording-indicator bg-neutral-900/90 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-3"
	data-testid="recording-indicator"
>
	{#if isTranscribing}
		<div
			class="w-3 h-3 rounded-full bg-blue-400 animate-pulse"
			data-testid="transcribing-dot"
		></div>
		<span class="text-sm text-neutral-300" data-testid="transcribing-state">Transcribing...</span>
	{:else if isRecording}
		<div class="w-3 h-3 rounded-full bg-red-500 animate-pulse" data-testid="recording-dot"></div>
		<AudioVisualizer level={audioLevel} />
		<span class="text-sm text-neutral-300 font-mono" data-testid="elapsed-time"
			>{formatTime(elapsed)}</span
		>
	{/if}
	{#if onClose}
		<button
			onclick={(e) => { e.stopPropagation(); onClose(); }}
			class="close-button p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors ml-1"
			data-testid="close-button"
			aria-label="Close"
			type="button"
		>
			<X size={14} />
		</button>
	{/if}
</div>

<style>
	.recording-indicator {
		-webkit-app-region: drag;
		user-select: none;
	}

	.close-button {
		-webkit-app-region: no-drag;
		cursor: pointer;
		pointer-events: auto;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 1s ease-in-out infinite;
	}
</style>
