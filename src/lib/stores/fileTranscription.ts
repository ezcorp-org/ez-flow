/**
 * File transcription store
 *
 * Manages state for file-based transcription operations.
 */

import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { TranscriptionResult } from '../types';

interface FileTranscriptionState {
  isProcessing: boolean;
  progress: number;
  result: { filename: string; text: string; durationMs: number } | null;
  error: string | null;
}

function createFileTranscriptionStore() {
  const { subscribe, set, update } = writable<FileTranscriptionState>({
    isProcessing: false,
    progress: 0,
    result: null,
    error: null,
  });

  return {
    subscribe,

    /**
     * Transcribe an audio file
     */
    async transcribeFile(filePath: string) {
      const filename = filePath.split(/[\\/]/).pop() || 'Unknown';
      update((s) => ({ ...s, isProcessing: true, progress: 0, error: null, result: null }));

      try {
        const result = await invoke<TranscriptionResult>('transcribe_audio', { filePath });
        update((s) => ({
          ...s,
          isProcessing: false,
          result: {
            filename,
            text: result.text,
            durationMs: result.durationMs,
          },
        }));
      } catch (error) {
        update((s) => ({
          ...s,
          isProcessing: false,
          error: String(error),
        }));
      }
    },

    /**
     * Reset the store state
     */
    reset() {
      set({
        isProcessing: false,
        progress: 0,
        result: null,
        error: null,
      });
    },

    /**
     * Set error state
     */
    setError(error: string) {
      update((s) => ({ ...s, error, isProcessing: false }));
    },
  };
}

export const fileTranscription = createFileTranscriptionStore();

/**
 * Check if any model is downloaded before transcribing
 */
export async function checkModelAvailable(): Promise<boolean> {
  try {
    const models = await invoke<string[]>('get_downloaded_model_ids');
    return models.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if Whisper model is loaded
 */
export async function isModelLoaded(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_model_loaded');
  } catch {
    return false;
  }
}
