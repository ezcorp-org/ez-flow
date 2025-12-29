/**
 * EZ Flow Type Definitions
 */

/** Application settings */
export interface Settings {
  startMinimized: boolean;
  hotkey: string;
  modelId: string;
  language: string;
  autoCheckUpdates: boolean;
}

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
