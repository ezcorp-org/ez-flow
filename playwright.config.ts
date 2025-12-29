import { defineConfig, devices } from '@playwright/test';

/**
 * EZ Flow E2E Test Configuration
 * Uses Playwright with tauri-driver for desktop app testing
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/artifacts',
  fullyParallel: false, // Desktop app tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for desktop app
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],

  use: {
    baseURL: process.env.E2E_DEV_MODE ? 'http://localhost:5173' : 'tauri://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Tauri WebView settings
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Global setup/teardown for Tauri app
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
});
