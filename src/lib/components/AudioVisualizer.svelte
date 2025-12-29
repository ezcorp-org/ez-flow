<script lang="ts">
	interface Props {
		level?: number;
	}

	let { level = 0 }: Props = $props();

	const bars = 5;

	function getBarHeight(index: number, audioLevel: number): number {
		const normalized = Math.min(1, Math.max(0, audioLevel));
		const baseHeight = 4;
		const maxHeight = 16;
		const threshold = (index + 1) / bars;
		return normalized >= threshold
			? maxHeight
			: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
	}
</script>

<div class="flex items-center gap-0.5 h-4" data-testid="audio-visualizer">
	{#each Array.from({ length: bars }, (_, i) => i) as barIndex}
		<div
			class="w-1 bg-yellow-400 rounded-full transition-all duration-100"
			style="height: {getBarHeight(barIndex, level)}px"
		></div>
	{/each}
</div>
