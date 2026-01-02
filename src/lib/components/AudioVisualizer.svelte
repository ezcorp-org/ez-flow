<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		level?: number;
	}

	let { level = 0 }: Props = $props();

	const dotCount = 7;
	let animationFrame: number | null = null;
	let time = $state(0);

	// Create varied bounce offsets for each dot based on position and audio level
	function getDotOffset(index: number, audioLevel: number, t: number): number {
		const normalized = Math.min(1, Math.max(0, audioLevel));
		if (normalized < 0.01) return 0;

		// Create a wave pattern - center dots bounce higher
		const centerDistance = Math.abs(index - (dotCount - 1) / 2);
		const centerWeight = 1 - centerDistance / ((dotCount - 1) / 2) * 0.6;

		// Add phase offset for wave effect - each dot has different phase
		const phase = t / 80 + index * 0.9;
		const wave = Math.sin(phase) * 0.5 + 0.5;

		const maxBounce = 14;
		return normalized * maxBounce * centerWeight * wave;
	}

	// Reactively compute dot positions
	let dotOffsets = $derived(
		Array.from({ length: dotCount }, (_, i) => getDotOffset(i, level, time))
	);

	// Animation loop
	function animate() {
		time = performance.now();
		animationFrame = requestAnimationFrame(animate);
	}

	$effect(() => {
		if (level > 0.01) {
			if (!animationFrame) {
				animate();
			}
		} else {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
		}
	});

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});
</script>

<div class="waveform-container" data-testid="audio-visualizer">
	{#each dotOffsets as offset, i}
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
