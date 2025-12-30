import './app.css';
import { mount, unmount } from 'svelte';
import { initTrayEventListeners } from './lib/services/trayEvents';

// Simple path-based routing for Tauri windows
const path = window.location.pathname;

/**
 * Show the model setup screen on startup
 * This ensures the user always sees the current model status and can change/download if needed
 */
async function showModelSetupScreen(target: HTMLElement): Promise<void> {
  const { default: ModelSetupScreen } = await import('./lib/components/ModelSetupScreen.svelte');

  return new Promise((resolve) => {
    const setupInstance = mount(ModelSetupScreen, {
      target,
      props: {
        onComplete: () => {
          unmount(setupInstance);
          resolve();
        }
      }
    });
  });
}

async function init() {
  const target = document.getElementById('app')!;

  // Initialize tray event listeners for all windows (they share the same Tauri context)
  // Only initialize for main window to avoid duplicate handlers
  if (path === '/' || path === '') {
    try {
      await initTrayEventListeners();
    } catch (e) {
      console.error('Failed to init tray listeners:', e);
    }

    // Always show model setup screen on main window startup
    // This ensures the user can see model status and download if needed
    await showModelSetupScreen(target);
  }

  if (path === '/settings' || path === '/settings/') {
    const { default: Settings } = await import('./routes/settings/+page.svelte');
    mount(Settings, { target });
  } else if (path === '/history' || path === '/history/') {
    const { default: History } = await import('./routes/history/+page.svelte');
    mount(History, { target });
  } else if (path === '/indicator' || path === '/indicator/') {
    const { default: Indicator } = await import('./routes/indicator/+page.svelte');
    mount(Indicator, { target });
  } else if (path === '/onboarding' || path === '/onboarding/') {
    const { default: Onboarding } = await import('./routes/onboarding/+page.svelte');
    mount(Onboarding, { target });
  } else {
    // Default: main app
    const { default: App } = await import('./App.svelte');
    mount(App, { target });
  }
}

init();
