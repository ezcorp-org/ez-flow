/**
 * History service for managing transcription history
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * History entry interface
 */
export interface HistoryEntry {
	id: number;
	text: string;
	timestamp: string;
	duration_ms: number;
	model_id: string;
	language: string | null;
}

/**
 * Get paginated history entries
 */
export async function getHistory(limit: number = 100, offset: number = 0): Promise<HistoryEntry[]> {
	return invoke<HistoryEntry[]>('get_history', { limit, offset });
}

/**
 * Search history entries
 */
export async function searchHistory(query: string): Promise<HistoryEntry[]> {
	return invoke<HistoryEntry[]>('search_history', { query });
}

/**
 * Delete a single history entry
 */
export async function deleteHistoryEntry(id: number): Promise<void> {
	return invoke('delete_history_entry', { id });
}

/**
 * Clear all history
 */
export async function clearHistory(): Promise<void> {
	return invoke('clear_history');
}

/**
 * Get history entry count
 */
export async function getHistoryCount(): Promise<number> {
	return invoke<number>('get_history_count');
}
