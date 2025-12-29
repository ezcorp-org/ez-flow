/**
 * Tray event handlers
 *
 * Listens for events from the system tray menu and handles them.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

let isRecording = false;
const unlisteners: UnlistenFn[] = [];

/**
 * Start recording audio
 */
async function startRecording() {
  if (isRecording) {
    console.log('Already recording');
    return;
  }

  try {
    await invoke('start_recording');
    isRecording = true;
    await invoke('show_recording_indicator');
    console.log('Recording started from tray');
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
}

/**
 * Stop recording and transcribe
 */
async function stopRecording() {
  if (!isRecording) {
    console.log('Not currently recording');
    return;
  }

  try {
    await invoke('hide_recording_indicator');
    const result = await invoke<{ text: string }>('stop_recording_and_transcribe');
    isRecording = false;

    if (result && result.text) {
      // Copy to clipboard
      await writeText(result.text);
      console.log('Transcription copied to clipboard:', result.text);
    }
  } catch (error) {
    console.error('Failed to stop and transcribe:', error);
    isRecording = false;
  }
}

/**
 * Open file picker and transcribe selected file
 */
async function transcribeFile() {
  try {
    // Open file dialog
    const filePath = await open({
      multiple: false,
      filters: [
        {
          name: 'Audio Files',
          extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm']
        }
      ]
    });

    if (!filePath) {
      console.log('No file selected');
      return;
    }

    const path = typeof filePath === 'string' ? filePath : filePath.path;
    console.log('Transcribing file:', path);

    // Transcribe the file
    const result = await invoke<{ text: string }>('transcribe_audio', {
      filePath: path
    });

    if (result && result.text) {
      // Copy to clipboard
      await writeText(result.text);
      console.log('File transcription copied to clipboard:', result.text);
    }
  } catch (error) {
    console.error('Failed to transcribe file:', error);
  }
}

/**
 * Initialize tray event listeners
 */
export async function initTrayEventListeners(): Promise<void> {
  // Listen for start recording event
  unlisteners.push(
    await listen('tray://start-recording', () => {
      console.log('Received tray://start-recording event');
      startRecording();
    })
  );

  // Listen for stop recording event
  unlisteners.push(
    await listen('tray://stop-recording', () => {
      console.log('Received tray://stop-recording event');
      stopRecording();
    })
  );

  // Listen for transcribe file event
  unlisteners.push(
    await listen('tray://transcribe-file', () => {
      console.log('Received tray://transcribe-file event');
      transcribeFile();
    })
  );

  console.log('Tray event listeners initialized');
}

/**
 * Cleanup tray event listeners
 */
export function cleanupTrayEventListeners(): void {
  unlisteners.forEach(unlisten => unlisten());
  unlisteners.length = 0;
  console.log('Tray event listeners cleaned up');
}
