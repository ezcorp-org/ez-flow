<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		level?: number;
	}

	let { level = 0 }: Props = $props();

	const dotCount = 7;
	const maxBounce = 14;
	let animationFrame: number | null = null;
	let dotOffsets = $state<number[]>(Array(dotCount).fill(0));
	let frameCount = 0;

	// Store the current level in a mutable variable that the animation can read
	// This ensures we always have the latest value even outside reactive context
	let currentAudioLevel = 0;

	// Sync the prop to our mutable variable
	$effect(() => {
		currentAudioLevel = level;
		console.log('[AudioVisualizer] Level prop updated:', level.toFixed(4));
	});

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

		return normalized * maxBounce * centerWeight * wave;
	}

	// Animation loop - updates dotOffsets directly
	function animate() {
		const t = performance.now();
		// Read from our mutable variable instead of the prop directly
		const lvl = currentAudioLevel;
		dotOffsets = Array.from({ length: dotCount }, (_, i) => getDotOffset(i, lvl, t));

		// Log every 30 frames (~0.5s at 60fps)
		frameCount++;
		if (frameCount % 30 === 0) {
			console.log('[AudioVisualizer] animate frame:', frameCount, 'level:', lvl.toFixed(4), 'offsets:', dotOffsets.map(o => o.toFixed(1)).join(','));
		}

		animationFrame = requestAnimationFrame(animate);
	}

	$effect(() => {
		console.log('[AudioVisualizer] Animation control effect, level:', level.toFixed(4), 'animationFrame:', animationFrame);
		if (level > 0.01) {
			if (!animationFrame) {
				console.log('[AudioVisualizer] Starting animation, level:', level.toFixed(4));
				frameCount = 0;
				animate();
			}
		} else {
			if (animationFrame) {
				console.log('[AudioVisualizer] Stopping animation, level:', level.toFixed(4));
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
				// Reset to zero
				dotOffsets = Array(dotCount).fill(0);
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
