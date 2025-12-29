<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';

  let name = $state('');
  let greeting = $state('');

  async function greet() {
    greeting = await invoke('greet', { name });
  }
</script>

<main class="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-8">
  <h1 class="text-4xl font-bold text-yellow-400 mb-8">EZ Flow</h1>

  <p class="text-neutral-400 mb-6">Local speech-to-text that just works.</p>

  <div class="flex gap-4 mb-6">
    <input
      type="text"
      bind:value={name}
      placeholder="Enter a name..."
      class="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-yellow-400"
    />
    <button
      onclick={greet}
      class="px-6 py-2 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 transition-colors"
    >
      Greet
    </button>
  </div>

  {#if greeting}
    <p class="text-lg text-neutral-200">{greeting}</p>
  {/if}
</main>
