<script lang="ts">
	interface Props {
		fallbackWindow?: string;
		fallbackPath?: string;
	}

	let { fallbackWindow = 'main', fallbackPath = '/' }: Props = $props();

	async function goBack() {
		// Check if running in Tauri environment
		const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

		if (isTauri) {
			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { getCurrentWindow } = await import('@tauri-apps/api/window');

				const currentWindow = getCurrentWindow();

				// Show the fallback window (usually main)
				const targetWindow = await WebviewWindow.getByLabel(fallbackWindow);
				if (targetWindow) {
					await targetWindow.show();
					await targetWindow.setFocus();

					// Hide current window if it's not the main window
					if (currentWindow.label !== 'main') {
						await currentWindow.hide();
					}
				} else {
					// Fallback to URL navigation
					window.location.href = fallbackPath;
				}
			} catch (error) {
				console.error('Back navigation error:', error);
				// Fallback to URL navigation
				window.location.href = fallbackPath;
			}
		} else {
			// Browser mode - use URL navigation
			window.location.href = fallbackPath;
		}
	}
</script>

<button class="back-button" onclick={goBack} data-testid="back-button" aria-label="Go back">
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M19 12H5"></path>
		<polyline points="12 19 5 12 12 5"></polyline>
	</svg>
	<span>Back</span>
</button>

<style>
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: transparent;
		border: 1px solid #404040;
		border-radius: 6px;
		color: #a3a3a3;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.back-button:hover {
		background: #171717;
		border-color: #525252;
		color: #e5e5e5;
	}

	.back-button:active {
		background: #262626;
	}
</style>
