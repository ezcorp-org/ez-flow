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

/** Transcription result */
export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

/** Individual transcription segment */
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

/** Application state */
export type AppState = 'idle' | 'recording' | 'transcribing' | 'injecting';

/** Whisper model info */
export interface WhisperModel {
  id: string;
  name: string;
  size: string;
  downloaded: boolean;
}
