import { spawn, ChildProcess } from 'child_process';
import { chromium, FullConfig } from '@playwright/test';

let tauriProcess: ChildProcess | null = null;

/**
 * Global setup for EZ Flow E2E tests
 * Starts the Tauri application before running tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('Starting EZ Flow application for E2E tests...');

  // Check if we're running against a dev server or need to start the app
  const isDevMode = process.env.E2E_DEV_MODE === 'true';

  if (isDevMode) {
    // In dev mode, expect the app to already be running
    console.log('Running in dev mode - expecting app to be already running');
    return;
  }

  // Start the Tauri app with tauri-driver
  tauriProcess = spawn('bunx', ['tauri', 'dev'], {
    env: {
      ...process.env,
      TAURI_DRIVER: '1',
      RUST_LOG: 'info',
    },
    stdio: 'pipe',
    shell: true,
  });

  // Store process for teardown
  (global as any).__TAURI_PROCESS__ = tauriProcess;

  // Wait for app to be ready
  await waitForAppReady();

  console.log('EZ Flow application started successfully');
}

async function waitForAppReady(timeout = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Try to connect to the app
      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Check if app is responding
      await page.goto('tauri://localhost', { timeout: 5000 });
      await page.waitForSelector('[data-testid="app-root"]', { timeout: 5000 });

      await browser.close();
      return;
    } catch {
      // App not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Timeout waiting for EZ Flow app to start');
}

export default globalSetup;
