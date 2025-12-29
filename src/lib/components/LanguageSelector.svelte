<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  interface Language {
    code: string;
    name: string;
    native_name: string | null;
    common: boolean;
  }

  interface Props {
    value?: string | null;
    onChange?: (value: string | null) => void;
  }

  let { value = $bindable(null), onChange = () => {} }: Props = $props();

  let languages = $state<Language[]>([]);
  let search = $state('');
  let isOpen = $state(false);
  let dropdownRef: HTMLDivElement;

  onMount(async () => {
    try {
      languages = await invoke<Language[]>('get_supported_languages');
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  });

  const filteredLanguages = $derived(languages.filter(lang =>
    lang.name.toLowerCase().includes(search.toLowerCase()) ||
    lang.code.toLowerCase().includes(search.toLowerCase()) ||
    (lang.native_name && lang.native_name.toLowerCase().includes(search.toLowerCase()))
  ));

  const commonLanguages = $derived(filteredLanguages.filter(l => l.common));
  const otherLanguages = $derived(filteredLanguages.filter(l => !l.common));

  function select(code: string | null) {
    value = code;
    onChange(code);
    isOpen = false;
    search = '';
  }

  function displayName(lang: Language): string {
    if (lang.native_name) {
      return `${lang.name} (${lang.native_name})`;
    }
    return lang.name;
  }

  function getCurrentDisplayName(): string {
    if (value === null) {
      return 'Auto-detect';
    }
    const lang = languages.find(l => l.code === value);
    return lang ? displayName(lang) : value;
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownRef} data-testid="language-selector">
  <button
    type="button"
    class="w-full px-3 py-2 bg-neutral-800 rounded text-left flex justify-between items-center hover:bg-neutral-700 transition-colors"
    onclick={(e: MouseEvent) => { e.stopPropagation(); isOpen = !isOpen; }}
  >
    <span class="truncate">{getCurrentDisplayName()}</span>
    <span class="text-neutral-500 ml-2">{isOpen ? '▲' : '▼'}</span>
  </button>

  {#if isOpen}
    <div
      class="absolute z-50 mt-1 w-full bg-neutral-800 rounded-lg shadow-lg border border-neutral-700 overflow-hidden"
    >
      <input
        type="text"
        bind:value={search}
        placeholder="Search languages..."
        class="w-full px-3 py-2 bg-neutral-700 border-b border-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        data-testid="language-search"
        onclick={(e: MouseEvent) => e.stopPropagation()}
      />

      <div class="max-h-64 overflow-y-auto">
        <button
          type="button"
          class="w-full px-3 py-2 text-left hover:bg-neutral-700 transition-colors"
          class:bg-blue-600={value === null}
          class:hover:bg-blue-700={value === null}
          onclick={(e: MouseEvent) => { e.stopPropagation(); select(null); }}
          data-testid="language-option-auto"
        >
          Auto-detect
        </button>

        {#if commonLanguages.length > 0}
          <div class="px-3 py-1 text-xs text-neutral-500 uppercase font-semibold bg-neutral-900">
            Common
          </div>
          {#each commonLanguages as lang}
            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-neutral-700 transition-colors"
              class:bg-blue-600={value === lang.code}
              class:hover:bg-blue-700={value === lang.code}
              onclick={(e: MouseEvent) => { e.stopPropagation(); select(lang.code); }}
              data-testid="language-option-{lang.code}"
            >
              {displayName(lang)}
            </button>
          {/each}
        {/if}

        {#if otherLanguages.length > 0}
          <div class="px-3 py-1 text-xs text-neutral-500 uppercase font-semibold bg-neutral-900">
            All Languages
          </div>
          {#each otherLanguages as lang}
            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-neutral-700 transition-colors"
              class:bg-blue-600={value === lang.code}
              class:hover:bg-blue-700={value === lang.code}
              onclick={(e: MouseEvent) => { e.stopPropagation(); select(lang.code); }}
              data-testid="language-option-{lang.code}"
            >
              {displayName(lang)}
            </button>
          {/each}
        {/if}

        {#if filteredLanguages.length === 0}
          <div class="px-3 py-4 text-center text-neutral-500">
            No languages found
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
