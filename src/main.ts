import './app.css';
import { mount } from 'svelte';
import { initTrayEventListeners } from './lib/services/trayEvents';

// Simple path-based routing for Tauri windows
const path = window.location.pathname;

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
    // Model check is now handled inside App.svelte
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
