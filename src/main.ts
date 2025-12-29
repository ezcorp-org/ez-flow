import './app.css';
import { mount, unmount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { initTrayEventListeners } from './lib/services/trayEvents';

// Simple path-based routing for Tauri windows
const path = window.location.pathname;

interface ModelValidationResult {
  loaded: boolean;
  model_id: string;
  needs_download: boolean;
  error: string | null;
}


/**
 * Check if model validation is needed and show modal if necessary
 * Returns true if the app should continue loading, false if waiting for modal
 */
async function validateModelOnStartup(target: HTMLElement): Promise<boolean> {
  try {
    // Validate and attempt to load the configured model
    const result = await invoke<ModelValidationResult>('validate_and_load_model');

    if (result.loaded) {
      console.log(`Model ${result.model_id} loaded successfully`);
      return true;
    }

    if (result.needs_download) {
      console.log('Model needs download, showing modal');

      // Dynamically import and mount the modal
      const { default: ModelValidationModal } = await import('./lib/components/ModelValidationModal.svelte');

      return new Promise((resolve) => {
        const modalInstance = mount(ModelValidationModal, {
          target,
          props: {
            onComplete: () => {
              unmount(modalInstance);
              resolve(true);
            }
          }
        });
      });
    }

    return true;
  } catch (e) {
    console.error('Model validation failed:', e);
    // Continue anyway - let the app handle the error when transcription is attempted
    return true;
  }
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

    // Validate model on main window startup (non-blocking for other routes)
    await validateModelOnStartup(target);
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
