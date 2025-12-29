/**
 * Auto-update service for EZ Flow
 *
 * Handles checking for updates, downloading, and installing.
 */

import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  version: string;
  notes: string | null;
  date: string | null;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

let currentUpdate: Update | null = null;

/**
 * Check if auto-update is enabled in settings
 */
export async function isAutoUpdateEnabled(): Promise<boolean> {
  try {
    const settings = await invoke<{ auto_check_updates: boolean }>('get_settings');
    return settings.auto_check_updates;
  } catch {
    return true; // Default to enabled
  }
}

/**
 * Check for available updates
 * @returns Update info if available, null if already on latest
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const update = await check();

    if (update?.available) {
      currentUpdate = update;
      return {
        version: update.version,
        notes: update.body ?? null,
        date: update.date ?? null,
      };
    }

    return null;
  } catch (e) {
    console.error('Update check failed:', e);
    return null;
  }
}

/**
 * Download and install the pending update
 * @param onProgress Callback for download progress
 */
export async function downloadAndInstall(
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  if (!currentUpdate) {
    // Check again if no pending update
    const update = await check();
    if (!update?.available) {
      throw new Error('No update available');
    }
    currentUpdate = update;
  }

  try {
    await currentUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started' && onProgress) {
        onProgress({
          downloaded: 0,
          total: event.data.contentLength ?? null,
        });
      } else if (event.event === 'Progress' && onProgress) {
        onProgress({
          downloaded: event.data.chunkLength,
          total: null,
        });
      }
    });

    // The updater plugin handles restart internally after download completes
    // No explicit restart call needed - it will relaunch automatically
  } catch (e) {
    console.error('Update installation failed:', e);
    throw e;
  }
}

/**
 * Check for updates on app startup if enabled
 */
export async function checkOnStartup(): Promise<UpdateInfo | null> {
  const enabled = await isAutoUpdateEnabled();

  if (!enabled) {
    console.log('Auto-update check disabled');
    return null;
  }

  return checkForUpdates();
}

/**
 * Get current app version
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    const app = await import('@tauri-apps/api/app');
    return await app.getVersion();
  } catch {
    return '0.0.0';
  }
}
