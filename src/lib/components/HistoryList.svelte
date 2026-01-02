<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { writeText } from '@tauri-apps/plugin-clipboard-manager';

	interface HistoryEntry {
		id: number;
		text: string;
		timestamp: string;
		duration_ms: number;
		model_id: string;
		language: string | null;
	}

	interface Props {
		limit?: number;
		showViewAll?: boolean;
	}

	let { limit = 5, showViewAll = true }: Props = $props();

	let entries = $state<HistoryEntry[]>([]);
	let loading = $state(true);
	let copiedId = $state<number | null>(null);

	const unlisteners: UnlistenFn[] = [];

	onMount(async () => {
		await loadHistory();

		// Listen for new history entries
		unlisteners.push(
			await listen('history://new-entry', async () => {
				console.log('[HistoryList] Received history://new-entry event, refreshing...');
				await loadHistory();
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
	});

	export async function refresh() {
		await loadHistory();
	}

	async function loadHistory() {
		loading = true;
		try {
			entries = await invoke<HistoryEntry[]>('get_history', { limit, offset: 0 });
		} catch (error) {
			console.error('Failed to load history:', error);
		}
		loading = false;
	}

	async function copyEntry(entry: HistoryEntry, event: MouseEvent) {
		event.stopPropagation();
		await writeText(entry.text);
		copiedId = entry.id;
		setTimeout(() => (copiedId = null), 2000);
	}

	function formatDate(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diffDays === 1) {
			return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		}
		return date.toLocaleDateString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}

	function openHistoryWindow() {
		// Open the history window
		invoke('tauri', {
			__tauriModule: 'Window',
			message: {
				cmd: 'createWebview',
				data: {
					options: { label: 'history', url: '/history' }
				}
			}
		}).catch(() => {
			// Fallback: try to show existing window
			window.location.href = '/history';
		});
	}
</script>

<div class="history-list" data-testid="history-list">
	<div class="list-header">
		<h2>Recent Transcriptions</h2>
		<span class="entry-count">{entries.length} recent</span>
	</div>

	<div class="entries">
		{#if loading}
			<div class="loading">Loading...</div>
		{:else if entries.length === 0}
			<div class="empty-state">
				<p>No transcriptions yet</p>
				<p class="hint">Your transcriptions will appear here</p>
			</div>
		{:else}
			{#each entries as entry (entry.id)}
				<div class="entry" data-testid="history-entry">
					<div class="entry-content">
						<span class="entry-date">{formatDate(entry.timestamp)}</span>
						<p class="entry-text">{truncateText(entry.text, 80)}</p>
					</div>
					<button
						class="copy-btn"
						class:copied={copiedId === entry.id}
						onclick={(e) => copyEntry(entry, e)}
						title="Copy to clipboard"
						data-testid="copy-btn"
					>
						{#if copiedId === entry.id}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						{:else}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
							</svg>
						{/if}
					</button>
				</div>
			{/each}
		{/if}
	</div>

	{#if showViewAll && entries.length > 0}
		<button class="view-all-btn" onclick={openHistoryWindow} data-testid="view-all-btn">
			View All History
		</button>
	{/if}
</div>

<style>
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 0.25rem;
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
		color: #e5e5e5;
		margin: 0;
	}

	.entry-count {
		font-size: 0.75rem;
		color: #737373;
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
		color: #737373;
	}

	.empty-state p {
		margin: 0;
	}

	.hint {
		font-size: 0.8125rem;
		margin-top: 0.25rem !important;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
		transition: border-color 0.15s;
	}

	.entry:hover {
		border-color: #404040;
	}

	.entry-content {
		flex: 1;
		min-width: 0;
	}

	.entry-date {
		display: block;
		font-size: 0.6875rem;
		color: #737373;
		margin-bottom: 0.25rem;
	}

	.entry-text {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: #d4d4d4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.copy-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 6px;
		color: #a3a3a3;
		cursor: pointer;
		transition: all 0.15s;
	}

	.copy-btn:hover {
		background: #404040;
		color: #e5e5e5;
	}

	.copy-btn.copied {
		background: #166534;
		border-color: #22c55e;
		color: #22c55e;
	}

	.view-all-btn {
		padding: 0.625rem 1rem;
		background: transparent;
		border: 1px solid #404040;
		border-radius: 8px;
		color: #a3a3a3;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.view-all-btn:hover {
		background: #171717;
		border-color: #525252;
		color: #e5e5e5;
	}
</style>
