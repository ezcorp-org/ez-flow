import { test, expect } from 'bun:test';

test('placeholder test - transcription store', () => {
  // Placeholder test - will be replaced with actual store tests
  expect(true).toBe(true);
});

test('app state types are valid', () => {
  const states = ['idle', 'recording', 'transcribing', 'injecting'] as const;
  expect(states).toContain('idle');
  expect(states).toContain('recording');
  expect(states.length).toBe(4);
});
