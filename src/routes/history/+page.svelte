<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { writeText } from '@tauri-apps/plugin-clipboard-manager';
	import NavBar from '$lib/components/NavBar.svelte';

	interface HistoryEntry {
		id: number;
		text: string;
		timestamp: string;
		duration_ms: number;
		model_id: string;
		language: string | null;
	}

	let entries = $state<HistoryEntry[]>([]);
	let expandedId = $state<number | null>(null);
	let searchQuery = $state('');
	let copiedId = $state<number | null>(null);
	let loading = $state(true);
	let showClearConfirm = $state(false);

	const unlisteners: UnlistenFn[] = [];
	let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		await loadHistory();

		// Listen for new history entries (covers all transcription sources)
		unlisteners.push(
			await listen('history://new-entry', async () => {
				await loadHistory();
			})
		);

		// Also listen for legacy events for backwards compatibility
		unlisteners.push(
			await listen('hotkey://transcription-complete', async () => {
				await loadHistory();
			})
		);

		unlisteners.push(
			await listen('tray://transcription-complete', async () => {
				await loadHistory();
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
		// Clean up any pending search timeout
		if (searchTimeoutId) {
			clearTimeout(searchTimeoutId);
		}
	});

	async function loadHistory() {
		loading = true;
		try {
			entries = await invoke<HistoryEntry[]>('get_history', { limit: 100, offset: 0 });
		} catch (error) {
			console.error('Failed to load history:', error);
		}
		loading = false;
	}

	async function executeSearch() {
		try {
			if (searchQuery.trim()) {
				entries = await invoke<HistoryEntry[]>('search_history', { query: searchQuery });
			} else {
				entries = await invoke<HistoryEntry[]>('get_history', { limit: 100, offset: 0 });
			}
		} catch (error) {
			console.error('Failed to search history:', error);
		}
		loading = false;
	}

	function handleSearchInput() {
		// Show loading immediately for user feedback
		loading = true;

		// Cancel any pending search
		if (searchTimeoutId) {
			clearTimeout(searchTimeoutId);
		}

		// Debounce: wait 250ms before executing search
		searchTimeoutId = setTimeout(() => {
			executeSearch();
		}, 250);
	}

	async function copyEntry(entry: HistoryEntry) {
		await writeText(entry.text);
		copiedId = entry.id;
		setTimeout(() => (copiedId = null), 2000);
	}

	async function deleteEntry(id: number) {
		try {
			await invoke('delete_history_entry', { id });
			entries = entries.filter((e) => e.id !== id);
			if (expandedId === id) {
				expandedId = null;
			}
		} catch (error) {
			console.error('Failed to delete entry:', error);
		}
	}

	async function clearAll() {
		try {
			await invoke('clear_history');
			entries = [];
			showClearConfirm = false;
		} catch (error) {
			console.error('Failed to clear history:', error);
		}
	}

	function formatDate(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diffDays === 1) {
			return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diffDays < 7) {
			return date.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
		}
		return date.toLocaleDateString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDuration(ms: number): string {
		const secs = Math.round(ms / 1000);
		if (secs < 60) {
			return `${secs}s`;
		}
		const mins = Math.floor(secs / 60);
		const remainSecs = secs % 60;
		return `${mins}m ${remainSecs}s`;
	}

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<div class="history-page" data-testid="history-panel">
	<div class="sticky-header">
		<div class="header">
			<h1 class="title">History</h1>
			<span class="count">{entries.length} entries</span>
		</div>

		<!-- Search and Clear -->
		<div class="controls">
		<input
			type="text"
			class="search-input"
			bind:value={searchQuery}
			oninput={handleSearchInput}
			placeholder="Search transcriptions..."
			data-testid="history-search"
		/>
		{#if entries.length > 0}
			<button
				class="clear-button"
				onclick={() => (showClearConfirm = true)}
				data-testid="clear-all-btn"
			>
				Clear All
			</button>
		{/if}
		</div>
	</div>

	{#if showClearConfirm}
		<div class="confirm-overlay">
			<div class="confirm-dialog">
				<p>Delete all transcription history?</p>
				<p class="confirm-warning">This action cannot be undone.</p>
				<div class="confirm-buttons">
					<button class="danger-button" onclick={clearAll}>Delete All</button>
					<button class="cancel-button" onclick={() => (showClearConfirm = false)}>Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Entries List -->
	<div class="entries-list">
		{#if loading}
			<div class="loading">Loading...</div>
		{:else if entries.length === 0}
			<div class="empty-state">
				{#if searchQuery}
					<p>No matching transcriptions found</p>
				{:else}
					<p>No transcriptions yet</p>
					<p class="empty-hint">Your transcriptions will appear here</p>
				{/if}
			</div>
		{:else}
			{#each entries as entry (entry.id)}
				<div class="entry" data-testid="history-entry">
					<button class="entry-header" onclick={() => toggleExpand(entry.id)}>
						<div class="entry-meta">
							<span class="entry-date">{formatDate(entry.timestamp)}</span>
							<span class="entry-duration">{formatDuration(entry.duration_ms)}</span>
						</div>
						<p class="entry-preview" data-testid={expandedId === entry.id ? 'entry-full-text' : ''}>
							{#if expandedId === entry.id}
								{entry.text}
							{:else}
								{entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text}
							{/if}
						</p>
						<span class="expand-icon" class:expanded={expandedId === entry.id}>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
								<path
									d="M3.5 4.5L6 7L8.5 4.5"
									stroke="currentColor"
									stroke-width="1.5"
									fill="none"
								/>
							</svg>
						</span>
					</button>

					{#if expandedId === entry.id}
						<div class="entry-actions">
							<button
								class="action-button copy-button"
								class:copied={copiedId === entry.id}
								onclick={() => copyEntry(entry)}
								data-testid="copy-entry-btn"
							>
								{copiedId === entry.id ? 'Copied!' : 'Copy'}
							</button>
							<button
								class="action-button delete-button"
								onclick={() => deleteEntry(entry.id)}
								data-testid="delete-entry-btn"
							>
								Delete
							</button>
							<span class="entry-model">Model: {entry.model_id}</span>
							{#if entry.language}
								<span class="entry-language">Lang: {entry.language}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<NavBar />
</div>

<style>
	.history-page {
		padding: 1.5rem;
		padding-bottom: 5rem; /* Space for navbar */
		background: #0a0a0a;
		min-height: 100vh;
		color: #e5e5e5;
	}

	.sticky-header {
		position: sticky;
		top: 0;
		background: #0a0a0a;
		margin: -1.5rem -1.5rem 0 -1.5rem;
		padding: 1.5rem 1.5rem 1rem 1.5rem;
		z-index: 40;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #f4c430;
		margin: 0;
	}

	.count {
		font-size: 0.875rem;
		color: #737373;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.search-input {
		flex: 1;
		padding: 0.625rem 0.875rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #f4c430;
	}

	.clear-button {
		padding: 0.625rem 1rem;
		background: #7f1d1d;
		border: 1px solid #991b1b;
		border-radius: 6px;
		color: #fecaca;
		font-size: 0.875rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.clear-button:hover {
		background: #991b1b;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.confirm-dialog {
		background: #171717;
		border: 1px solid #404040;
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 320px;
		text-align: center;
	}

	.confirm-dialog p {
		margin: 0 0 0.5rem;
	}

	.confirm-warning {
		color: #ef4444;
		font-size: 0.875rem;
	}

	.confirm-buttons {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.25rem;
		justify-content: center;
	}

	.danger-button {
		padding: 0.5rem 1rem;
		background: #dc2626;
		border: none;
		border-radius: 6px;
		color: white;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.cancel-button {
		padding: 0.5rem 1rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: #737373;
	}

	.empty-hint {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.entry {
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
		overflow: hidden;
	}

	.entry-header {
		width: 100%;
		padding: 1rem;
		background: none;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		display: block;
		position: relative;
	}

	.entry-header:hover {
		background: #1f1f1f;
	}

	.entry-meta {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.entry-date {
		font-size: 0.75rem;
		color: #737373;
	}

	.entry-duration {
		font-size: 0.75rem;
		color: #525252;
	}

	.entry-preview {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: #d4d4d4;
		margin: 0;
		padding-right: 1.5rem;
		word-break: break-word;
	}

	.expand-icon {
		position: absolute;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		color: #525252;
		transition: transform 0.2s ease;
	}

	.expand-icon.expanded {
		transform: translateY(-50%) rotate(180deg);
	}

	.entry-actions {
		padding: 0.75rem 1rem;
		border-top: 1px solid #262626;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.action-button {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		font-size: 0.8125rem;
		cursor: pointer;
		border: none;
	}

	.copy-button {
		background: #f4c430;
		color: #000;
		transition: background-color 0.2s ease;
	}

	.copy-button:hover {
		background: #eab308;
	}

	.copy-button.copied {
		background: #22c55e;
		color: #fff;
	}

	.delete-button {
		background: #404040;
		color: #e5e5e5;
	}

	.delete-button:hover {
		background: #525252;
	}

	.entry-model,
	.entry-language {
		font-size: 0.75rem;
		color: #525252;
		margin-left: auto;
	}

	.entry-language {
		margin-left: 0.5rem;
	}
</style>
