<script lang="ts">
	import { onMount } from 'svelte';

	interface NavItem {
		id: string;
		path: string;
		label: string;
		icon: string;
	}

	const navItems: NavItem[] = [
		{ id: 'main', path: '/', label: 'Home', icon: 'home' },
		{ id: 'history', path: '/history', label: 'History', icon: 'history' },
		{ id: 'settings', path: '/settings', label: 'Settings', icon: 'settings' }
	];

	let currentPage = $state('main');
	let isTauri = $state(false);

	onMount(() => {
		// Check if running in Tauri environment
		isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

		// Always use path-based detection - works in both Tauri and browser
		detectCurrentPage();
	});

	function detectCurrentPage() {
		const path = window.location.pathname;
		if (path.startsWith('/history')) {
			currentPage = 'history';
		} else if (path.startsWith('/settings')) {
			currentPage = 'settings';
		} else {
			currentPage = 'main';
		}
	}

	async function navigateTo(item: NavItem) {
		if (item.id === currentPage) return;

		if (isTauri) {
			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { getCurrentWindow } = await import('@tauri-apps/api/window');

				const targetWindow = await WebviewWindow.getByLabel(item.id);
				if (targetWindow) {
					await targetWindow.show();
					await targetWindow.setFocus();

					// Hide current window (except main)
					if (currentPage !== 'main') {
						const currentWin = getCurrentWindow();
						await currentWin.hide();
					}
				} else {
					// Fallback to URL navigation
					window.location.href = item.path;
				}
			} catch (error) {
				console.error('Navigation error:', error);
				// Fallback to URL navigation
				window.location.href = item.path;
			}
		} else {
			// Browser mode - use URL navigation
			window.location.href = item.path;
		}
	}
</script>

<nav class="navbar" data-testid="navbar">
	<div class="nav-items">
		{#each navItems as item}
			<button
				class="nav-item"
				class:active={item.id === currentPage}
				onclick={() => navigateTo(item)}
				data-testid="nav-{item.icon}"
			>
				{#if item.icon === 'home'}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
						<polyline points="9 22 9 12 15 12 15 22"></polyline>
					</svg>
				{:else if item.icon === 'history'}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"></circle>
						<polyline points="12 6 12 12 16 14"></polyline>
					</svg>
				{:else if item.icon === 'settings'}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3"></circle>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
					</svg>
				{/if}
				<span class="nav-label">{item.label}</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.navbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #0a0a0a;
		border-top: 1px solid #262626;
		padding: 0.5rem 1rem;
		z-index: 50;
	}

	.nav-items {
		display: flex;
		justify-content: space-around;
		align-items: center;
		max-width: 400px;
		margin: 0 auto;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		color: #737373;
		background: none;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
	}

	.nav-item:hover {
		color: #a3a3a3;
		background: #171717;
	}

	.nav-item.active {
		color: #f4c430;
	}

	.nav-item.active:hover {
		color: #f4c430;
		background: rgba(244, 196, 48, 0.1);
	}

	.nav-label {
		font-size: 0.6875rem;
		font-weight: 500;
	}
</style>
