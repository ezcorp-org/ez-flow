<script lang="ts">
	import { formatHotkey, checkHotkeyAvailable } from '$lib/services/hotkeys';
	import {
		normalizeKeyboardEventKey,
		isModifierKey,
		validateHotkey,
		buildHotkeyString
	} from '$lib/services/keybind';

	// Props using Svelte 5 runes
	interface Props {
		value: string;
		onchange?: (newHotkey: string) => void;
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: Props = $props();

	let isCapturing = $state(false);
	let capturedKeys = $state<string[]>([]);
	let error = $state<string | null>(null);

	// Track which modifier keys are currently held
	let activeModifiers = $state<Set<string>>(new Set());

	const displayValue = $derived(
		isCapturing
			? capturedKeys.length > 0
				? formatHotkey(capturedKeys.join('+'))
				: 'Press keys...'
			: formatHotkey(value)
	);

	function startCapture() {
		if (disabled) return;
		isCapturing = true;
		capturedKeys = [];
		activeModifiers = new Set();
		error = null;
	}

	function cancelCapture() {
		isCapturing = false;
		capturedKeys = [];
		activeModifiers = new Set();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!isCapturing) return;

		e.preventDefault();
		e.stopPropagation();

		// Escape cancels capture
		if (e.key === 'Escape') {
			cancelCapture();
			return;
		}

		const normalizedKey = normalizeKeyboardEventKey(e);
		if (!normalizedKey) return;

		// Track modifiers - must reassign Set to trigger Svelte 5 reactivity
		if (isModifierKey(normalizedKey)) {
			activeModifiers = new Set([...activeModifiers, normalizedKey]);
			updateCapturedKeys();
		} else {
			// Non-modifier key pressed - finalize the combination
			updateCapturedKeys(normalizedKey);
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (!isCapturing) return;

		e.preventDefault();
		e.stopPropagation();

		const normalizedKey = normalizeKeyboardEventKey(e);
		if (!normalizedKey) return;

		// Remove modifier from active set - must reassign Set to trigger Svelte 5 reactivity
		if (isModifierKey(normalizedKey)) {
			activeModifiers = new Set([...activeModifiers].filter(k => k !== normalizedKey));
			// If we have captured keys with a non-modifier, finalize
			if (capturedKeys.length > 0 && !capturedKeys.every((k) => isModifierKey(k))) {
				finalizeCapturedKeys();
			} else {
				updateCapturedKeys();
			}
		}
	}

	function updateCapturedKeys(nonModifierKey?: string) {
		// Build keys array using the shared utility
		const hotkeyString = buildHotkeyString(activeModifiers, nonModifierKey);
		capturedKeys = hotkeyString ? hotkeyString.split('+') : [];

		if (nonModifierKey) {
			// Finalize immediately when a non-modifier key is pressed
			finalizeCapturedKeys();
		}
	}

	async function finalizeCapturedKeys() {
		if (capturedKeys.length === 0) {
			cancelCapture();
			return;
		}

		const hotkeyString = capturedKeys.join('+');

		// Validate the hotkey using shared validation
		const validationError = validateHotkey(hotkeyString);
		if (validationError) {
			error = validationError;
			setTimeout(() => {
				cancelCapture();
			}, 2000);
			return;
		}

		// Check if the hotkey is available
		try {
			const available = await checkHotkeyAvailable(hotkeyString);
			if (!available) {
				error = 'This hotkey is already in use by another application';
				setTimeout(() => {
					cancelCapture();
				}, 2000);
				return;
			}

			// Hotkey is valid - notify parent
			isCapturing = false;
			activeModifiers = new Set();
			onchange?.(hotkeyString);
		} catch (e) {
			error = `Invalid hotkey: ${e}`;
			setTimeout(() => {
				cancelCapture();
			}, 2000);
		}
	}

	function handleBlur() {
		if (isCapturing) {
			cancelCapture();
		}
	}
</script>

<div class="keybind-capture" data-testid="keybind-capture">
	<button
		type="button"
		class="keybind-button"
		class:capturing={isCapturing}
		class:error={!!error}
		class:disabled={disabled}
		onclick={startCapture}
		onkeydown={handleKeyDown}
		onkeyup={handleKeyUp}
		onblur={handleBlur}
		disabled={disabled}
		data-testid="keybind-button"
	>
		<span class="keybind-value">{displayValue}</span>
		{#if isCapturing}
			<span class="capture-hint">Press Esc to cancel</span>
		{:else}
			<span class="edit-hint">Click to change</span>
		{/if}
	</button>
	{#if error}
		<p class="keybind-error" data-testid="keybind-error">{error}</p>
	{/if}
</div>

<style>
	.keybind-capture {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.keybind-button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		width: 100%;
		max-width: 300px;
		padding: 0.75rem 1rem;
		background: #171717;
		border: 2px solid #262626;
		border-radius: 8px;
		color: #e5e5e5;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.keybind-button:hover:not(.disabled) {
		border-color: #404040;
	}

	.keybind-button:focus {
		outline: none;
		border-color: #f4c430;
	}

	.keybind-button.capturing {
		border-color: #f4c430;
		background: #1a1a1a;
		animation: pulse 1.5s infinite;
	}

	.keybind-button.error {
		border-color: #ef4444;
	}

	.keybind-button.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.keybind-value {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 1rem;
		font-weight: 500;
		color: #f4c430;
	}

	.capture-hint,
	.edit-hint {
		font-size: 0.75rem;
		color: #737373;
	}

	.capture-hint {
		color: #f4c430;
	}

	.keybind-error {
		font-size: 0.75rem;
		color: #ef4444;
		margin: 0;
	}

	@keyframes pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(244, 196, 48, 0.4);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(244, 196, 48, 0);
		}
	}
</style>
