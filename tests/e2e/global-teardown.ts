import { ChildProcess } from 'child_process';

/**
 * Global teardown for EZ Flow E2E tests
 * Stops the Tauri application after all tests complete
 */
async function globalTeardown(): Promise<void> {
  console.log('Stopping EZ Flow application...');

  const tauriProcess = (global as Record<string, unknown>).__TAURI_PROCESS__ as ChildProcess | undefined;

  if (tauriProcess) {
    // Send SIGTERM to gracefully stop the app
    tauriProcess.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if still running after 5 seconds
        tauriProcess.kill('SIGKILL');
        resolve();
      }, 5000);

      tauriProcess.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    console.log('EZ Flow application stopped');
  }
}

export default globalTeardown;
