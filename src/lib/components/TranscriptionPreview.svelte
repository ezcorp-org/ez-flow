<script lang="ts" module>
	/**
	 * Preview state types
	 */
	export type PreviewState = 'preview' | 'streaming' | 'injecting' | 'complete' | 'error';
</script>

<script lang="ts">
	import AudioVisualizer from './AudioVisualizer.svelte';
	import { X } from '@lucide/svelte';

	interface Props {
		text?: string;
		state?: PreviewState;
		audioLevel?: number;
		showVisualizer?: boolean;
		onClose?: () => void;
	}

	let { text = '', state = 'preview', audioLevel = 0, showVisualizer = true, onClose }: Props = $props();

	/**
	 * Get state indicator color and animation
	 */
	function getStateStyles(currentState: PreviewState): { color: string; animate: boolean } {
		switch (currentState) {
			case 'preview':
				return { color: 'bg-yellow-400', animate: false };
			case 'streaming':
				return { color: 'bg-purple-400', animate: true };
			case 'injecting':
				return { color: 'bg-blue-400', animate: true };
			case 'complete':
				return { color: 'bg-green-400', animate: false };
			case 'error':
				return { color: 'bg-red-400', animate: false };
			default:
				return { color: 'bg-yellow-400', animate: false };
		}
	}

	/**
	 * Get state label text
	 */
	function getStateLabel(currentState: PreviewState): string {
		switch (currentState) {
			case 'preview':
				return 'Preview';
			case 'streaming':
				return 'Transcribing...';
			case 'injecting':
				return 'Injecting...';
			case 'complete':
				return 'Complete';
			case 'error':
				return 'Error';
			default:
				return 'Preview';
		}
	}

	const stateStyles = $derived(getStateStyles(state));
	const stateLabel = $derived(getStateLabel(state));
</script>

<div
	class="transcription-preview bg-neutral-900/95 backdrop-blur rounded-lg p-4 flex flex-col gap-3"
	data-testid="transcription-preview"
>
	<!-- Header with state indicator -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div
				class="w-2.5 h-2.5 rounded-full {stateStyles.color}"
				class:animate-pulse={stateStyles.animate}
				data-testid="state-indicator"
			></div>
			<span class="text-xs text-neutral-400" data-testid="state-label">{stateLabel}</span>
		</div>
		<div class="flex items-center gap-2">
			{#if showVisualizer && (state === 'preview' || state === 'streaming')}
				<AudioVisualizer level={audioLevel} />
			{/if}
			{#if onClose}
				<button
					onclick={(e) => { e.stopPropagation(); onClose(); }}
					class="close-button p-1.5 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
					data-testid="close-button"
					aria-label="Close preview"
					type="button"
				>
					<X size={18} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Transcribed text -->
	<div
		class="text-container flex-1 overflow-y-auto"
		data-testid="preview-text"
	>
		<p class="text-sm text-neutral-100 leading-relaxed">
			{#if text}
				{text}
				{#if state === 'streaming'}
					<span class="streaming-cursor"></span>
				{/if}
			{:else if state === 'streaming'}
				<span class="text-neutral-500 italic">Listening...</span>
			{:else}
				<span class="text-neutral-500 italic">Waiting for transcription...</span>
			{/if}
		</p>
	</div>

	<!-- Error state message -->
	{#if state === 'error'}
		<p class="text-xs text-red-400" data-testid="error-message">
			Failed to process transcription
		</p>
	{/if}
</div>

<style>
	.transcription-preview {
		-webkit-app-region: drag;
		user-select: none;
		max-height: 220px;
		min-height: 120px;
		width: 100%;
	}

	.text-container {
		max-height: 140px;
		-webkit-app-region: no-drag;
		user-select: text;
	}

	.close-button {
		-webkit-app-region: no-drag;
		cursor: pointer;
		pointer-events: auto;
		z-index: 10;
	}

	.text-container::-webkit-scrollbar {
		width: 4px;
	}

	.text-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.text-container::-webkit-scrollbar-thumb {
		background: #404040;
		border-radius: 2px;
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

	.streaming-cursor {
		display: inline-block;
		width: 2px;
		height: 1em;
		background: #f4c430;
		margin-left: 2px;
		vertical-align: text-bottom;
		animation: blink 0.8s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
</style>
