<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { onMount, onDestroy } from 'svelte';
	import AudioVisualizer from './AudioVisualizer.svelte';

	interface Props {
		onTranscriptionComplete?: (text: string) => void;
		onError?: (error: string) => void;
	}

	let { onTranscriptionComplete, onError }: Props = $props();

	let isRecording = $state(false);
	let isTranscribing = $state(false);
	let audioLevel = $state(0);
	let elapsed = $state(0);
	let interval: ReturnType<typeof setInterval> | undefined;
	const unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		// Listen for audio level updates
		unlisteners.push(
			await listen<number>('recording:level', (event) => {
				audioLevel = event.payload;
			})
		);

		// Listen for workflow state changes
		unlisteners.push(
			await listen<string>('workflow://state-changed', (event) => {
				const state = event.payload;
				isRecording = state === 'recording';
				isTranscribing = state === 'transcribing';

				if (state === 'idle') {
					stopTimer();
				}
			})
		);

		// Listen for transcription complete from tray
		unlisteners.push(
			await listen<string>('tray://transcription-complete', (event) => {
				isTranscribing = false;
				onTranscriptionComplete?.(event.payload);
			})
		);

		// Listen for transcription errors
		unlisteners.push(
			await listen<string>('tray://transcription-error', (event) => {
				isTranscribing = false;
				isRecording = false;
				onError?.(event.payload);
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
		stopTimer();
	});

	function startTimer() {
		elapsed = 0;
		interval = setInterval(() => (elapsed += 1), 1000);
	}

	function stopTimer() {
		if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
		elapsed = 0;
	}

	async function toggleRecording() {
		if (isRecording) {
			await stopRecording();
		} else {
			await startRecording();
		}
	}

	async function startRecording() {
		try {
			await invoke('start_recording');
			isRecording = true;
			startTimer();
		} catch (e) {
			console.error('Failed to start recording:', e);
			onError?.(String(e));
		}
	}

	async function stopRecording() {
		try {
			isRecording = false;
			isTranscribing = true;
			stopTimer();

			const result = await invoke<{ text: string }>('stop_recording_and_transcribe');
			isTranscribing = false;
			onTranscriptionComplete?.(result.text);
		} catch (e) {
			console.error('Failed to stop/transcribe:', e);
			isTranscribing = false;
			onError?.(String(e));
		}
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="record-container" data-testid="record-button-container">
	<button
		class="record-button"
		class:recording={isRecording}
		class:transcribing={isTranscribing}
		onclick={toggleRecording}
		disabled={isTranscribing}
		data-testid="record-button"
	>
		{#if isTranscribing}
			<div class="spinner"></div>
			<span>Transcribing...</span>
		{:else if isRecording}
			<div class="recording-indicator">
				<div class="pulse-ring"></div>
				<div class="mic-icon recording"></div>
			</div>
			<span>Stop Recording</span>
		{:else}
			<div class="mic-icon"></div>
			<span>Start Recording</span>
		{/if}
	</button>

	{#if isRecording}
		<div class="recording-status" data-testid="recording-status">
			<div class="status-dot"></div>
			<AudioVisualizer level={audioLevel} />
			<span class="elapsed-time">{formatTime(elapsed)}</span>
		</div>
	{/if}
</div>

<style>
	.record-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.record-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 280px;
		padding: 1rem 1.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: #f4c430;
		color: #000;
	}

	.record-button:hover:not(:disabled) {
		background: #eab308;
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(244, 196, 48, 0.3);
	}

	.record-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.record-button.recording {
		background: #dc2626;
		color: #fff;
	}

	.record-button.recording:hover:not(:disabled) {
		background: #b91c1c;
		box-shadow: 0 4px 16px rgba(220, 38, 38, 0.3);
	}

	.record-button.transcribing {
		background: #262626;
		color: #a3a3a3;
		cursor: not-allowed;
	}

	.record-button:disabled {
		opacity: 0.8;
	}

	.mic-icon {
		width: 24px;
		height: 24px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z'/%3E%3Cpath d='M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z'/%3E%3C/svg%3E");
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}

	.mic-icon.recording {
		filter: brightness(0) invert(1);
	}

	.recording-indicator {
		position: relative;
		width: 24px;
		height: 24px;
	}

	.pulse-ring {
		position: absolute;
		inset: -4px;
		border: 2px solid rgba(255, 255, 255, 0.5);
		border-radius: 50%;
		animation: pulse 1.5s ease-out infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.8);
			opacity: 1;
		}
		100% {
			transform: scale(1.3);
			opacity: 0;
		}
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid #404040;
		border-top-color: #f4c430;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.recording-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
	}

	.status-dot {
		width: 10px;
		height: 10px;
		background: #dc2626;
		border-radius: 50%;
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.elapsed-time {
		font-family: monospace;
		font-size: 0.875rem;
		color: #a3a3a3;
	}
</style>
