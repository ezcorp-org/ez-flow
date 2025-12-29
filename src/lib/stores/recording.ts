/**
 * Recording store
 *
 * Manages state for live recording and transcription operations.
 */

import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { TranscriptionResult } from '../types';

interface RecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  startTime: number | null;
  result: TranscriptionResult | null;
  error: string | null;
}

function createRecordingStore() {
  const { subscribe, set, update } = writable<RecordingState>({
    isRecording: false,
    isProcessing: false,
    startTime: null,
    result: null,
    error: null,
  });

  return {
    subscribe,

    /**
     * Start recording audio
     */
    async startRecording() {
      try {
        await invoke('start_recording');
        update((s) => ({
          ...s,
          isRecording: true,
          startTime: Date.now(),
          error: null,
          result: null,
        }));
      } catch (error) {
        update((s) => ({ ...s, error: String(error) }));
        throw error;
      }
    },

    /**
     * Stop recording and transcribe
     */
    async stopRecording() {
      update((s) => ({ ...s, isRecording: false, isProcessing: true }));

      try {
        const result = await invoke<TranscriptionResult>('stop_recording_and_transcribe');
        update((s) => ({ ...s, isProcessing: false, result }));
        return result;
      } catch (error) {
        update((s) => ({ ...s, isProcessing: false, error: String(error) }));
        throw error;
      }
    },

    /**
     * Stop recording without transcribing
     */
    async cancelRecording() {
      try {
        await invoke('stop_recording');
        update((s) => ({ ...s, isRecording: false, isProcessing: false }));
      } catch {
        // Ignore errors when cancelling
        update((s) => ({ ...s, isRecording: false, isProcessing: false }));
      }
    },

    /**
     * Reset the store state
     */
    reset() {
      set({
        isRecording: false,
        isProcessing: false,
        startTime: null,
        result: null,
        error: null,
      });
    },

    /**
     * Clear just the result
     */
    clearResult() {
      update((s) => ({ ...s, result: null }));
    },
  };
}

export const recording = createRecordingStore();

/**
 * Derived store for recording duration in seconds
 */
export const recordingDuration = derived(recording, ($recording) => {
  if (!$recording.startTime || !$recording.isRecording) {
    return 0;
  }
  return Math.floor((Date.now() - $recording.startTime) / 1000);
});
