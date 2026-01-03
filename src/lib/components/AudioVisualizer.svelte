<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		level?: number;
	}

	let { level = 0 }: Props = $props();

	const dotCount = 7;
	const maxBounce = 16; // Increased for more visible audio response
	const minBounce = 2; // Slight base bounce when no audio
	let animationFrame: number | null = null;
	let dotOffsets = $state<number[]>(Array(dotCount).fill(0));

	// Store the current level in a mutable variable for animation loop
	let currentAudioLevel = 0;

	// Sync the prop to our mutable variable
	$effect(() => {
		currentAudioLevel = level;
		if (level > 0) {
			console.log('[AudioVisualizer] Level prop updated:', level.toFixed(4));
		}
	});

	// Create varied bounce offsets for each dot
	function getDotOffset(index: number, audioLevel: number, t: number): number {
		// Create a wave pattern - center dots bounce higher
		const centerDistance = Math.abs(index - (dotCount - 1) / 2);
		const centerWeight = 1 - (centerDistance / ((dotCount - 1) / 2)) * 0.5;

		// Phase offset for wave effect - each dot has different phase
		const phase = t / 150 + index * 0.8;
		const wave = Math.sin(phase) * 0.5 + 0.5;

		// Scale up audio level - typical speech is 0.05-0.3, we want visible response
		// Multiply by 3 to make 0.3 level reach full amplitude
		const scaledLevel = Math.min(1, audioLevel * 3);

		// Base animation + audio-responsive boost
		const baseBounce = minBounce * centerWeight * wave;
		const audioBounce = scaledLevel * (maxBounce - minBounce) * centerWeight * wave;

		return baseBounce + audioBounce;
	}

	// Animation loop - always running when component is mounted
	function animate() {
		const t = performance.now();
		const lvl = currentAudioLevel;
		dotOffsets = Array.from({ length: dotCount }, (_, i) => getDotOffset(i, lvl, t));
		animationFrame = requestAnimationFrame(animate);
	}

	onMount(() => {
		// Start animation immediately when component mounts
		animate();
	});

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
	});
</script>

<div class="waveform-container" data-testid="audio-visualizer">
	{#each dotOffsets as offset}
		<div
			class="dot"
			style="transform: translateY({-offset}px)"
		></div>
	{/each}
</div>

<style>
	.waveform-container {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 24px;
		padding: 0 4px;
	}

	.dot {
		width: 6px;
		height: 6px;
		background-color: #F4C430;
		border-radius: 50%;
		transition: transform 0.05s ease-out;
	}
</style>
