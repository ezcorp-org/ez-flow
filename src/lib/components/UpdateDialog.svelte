<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { downloadAndInstall, getCurrentVersion, type DownloadProgress } from '$lib/services/updater';

  export let version: string;
  export let notes: string | null = null;

  const dispatch = createEventDispatcher<{
    dismiss: void;
  }>();

  let currentVersion = '';
  let downloading = false;
  let progress = 0;
  let totalSize: number | null = null;
  let downloadedSize = 0;
  let error: string | null = null;

  onMount(async () => {
    currentVersion = await getCurrentVersion();
  });

  async function install() {
    downloading = true;
    error = null;

    try {
      await downloadAndInstall((prog: DownloadProgress) => {
        downloadedSize += prog.downloaded;
        if (prog.total) {
          totalSize = prog.total;
        }
        if (totalSize) {
          progress = Math.round((downloadedSize / totalSize) * 100);
        }
      });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Update failed';
      downloading = false;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  role="dialog"
  aria-modal="true"
  aria-labelledby="update-title"
>
  <div class="bg-neutral-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-neutral-700">
    <h2 id="update-title" class="text-xl font-bold mb-4 flex items-center gap-2">
      <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Update Available
    </h2>

    <p class="text-neutral-300 mb-4">
      Version <span class="font-mono font-bold text-yellow-400">{version}</span> is available.
      {#if currentVersion}
        <span class="text-neutral-500">
          (Current: {currentVersion})
        </span>
      {/if}
    </p>

    {#if notes}
      <div class="bg-neutral-800 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
        <h3 class="text-sm font-medium text-neutral-400 mb-2">What's New</h3>
        <div class="text-sm text-neutral-300 prose prose-invert prose-sm max-w-none">
          {notes}
        </div>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
        <p class="text-red-300 text-sm">{error}</p>
      </div>
    {/if}

    {#if downloading}
      <div class="mb-4">
        <div class="flex justify-between text-sm text-neutral-400 mb-2">
          <span>Downloading update...</span>
          <span>
            {#if totalSize}
              {formatSize(downloadedSize)} / {formatSize(totalSize)}
            {:else}
              {progress}%
            {/if}
          </span>
        </div>
        <div class="h-2 bg-neutral-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-yellow-400 transition-all duration-300"
            style="width: {progress}%"
          ></div>
        </div>
        <p class="text-xs text-neutral-500 mt-2">
          The app will restart automatically after installation.
        </p>
      </div>
    {:else}
      <div class="flex gap-3">
        <button
          class="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded font-medium transition-colors"
          on:click={install}
        >
          Install & Restart
        </button>
        <button
          class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
          on:click={() => dispatch('dismiss')}
        >
          Later
        </button>
      </div>
    {/if}
  </div>
</div>
