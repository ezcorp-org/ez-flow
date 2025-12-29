/**
 * EZ Flow Type Definitions
 */

/** Application settings */
export interface Settings {
  startMinimized: boolean;
  launchAtLogin: boolean;
  hotkey: string;
  modelId: string;
  language: string;
  autoCheckUpdates: boolean;
}

/** Audio input device */
export interface AudioDevice {
  name: string;
  isDefault: boolean;
}

/** Recording result from audio capture */
export interface RecordingResult {
  filePath: string;
  durationSecs: number;
  sampleRate: number;
}

/** Microphone permission status */
export type PermissionStatus = 'granted' | 'denied' | 'unknown';

/** Transcription result from Whisper */
export interface TranscriptionResult {
  text: string;
  durationMs: number;
  modelId: string;
  language: string | null;
}

/** Application state */
export type AppState = 'idle' | 'recording' | 'transcribing' | 'injecting';

/** Whisper model info */
export interface WhisperModel {
  id: string;
  name: string;
  sizeMb: number;
  url: string;
  sha256: string;
  downloaded: boolean;
}

/** Download progress event payload */
export interface DownloadProgress {
  modelId: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
}
