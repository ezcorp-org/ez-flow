<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		formatHotkey,
		getCurrentHotkey,
		isHotkeyRegistered,
		onHotkeyRegistered,
		onHotkeyRegistrationFailed
	} from '$lib/services/hotkeys';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	let hotkey = $state<string | null>(null);
	let isRegistered = $state(false);
	let error = $state<string | null>(null);
	let unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		// Get initial state
		hotkey = await getCurrentHotkey();
		isRegistered = await isHotkeyRegistered();

		// Listen for changes
		unlisteners.push(
			await onHotkeyRegistered((newHotkey) => {
				hotkey = newHotkey;
				isRegistered = true;
				error = null;
			})
		);

		unlisteners.push(
			await onHotkeyRegistrationFailed((errorMsg) => {
				error = errorMsg;
				isRegistered = false;
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
	});

	const displayHotkey = $derived(hotkey ? formatHotkey(hotkey) : 'Not set');
</script>

<div class="hotkey-display" data-testid="hotkey-display">
	<span class="hotkey-label">Push-to-talk:</span>
	<kbd class="hotkey-value" class:inactive={!isRegistered}>
		{displayHotkey}
	</kbd>
	{#if error}
		<span class="hotkey-error" title={error}>!</span>
	{/if}
</div>

<style>
	.hotkey-display {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.hotkey-label {
		color: var(--text-secondary, #666);
	}

	.hotkey-value {
		padding: 0.25rem 0.5rem;
		background: var(--kbd-bg, #f4f4f4);
		border: 1px solid var(--kbd-border, #ccc);
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.75rem;
	}

	.hotkey-value.inactive {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.hotkey-error {
		color: var(--error-color, #e53935);
		font-weight: bold;
		cursor: help;
	}
</style>
