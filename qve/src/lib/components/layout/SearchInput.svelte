<script lang="ts">
  /**
   * SearchInput Component (WIN-24)
   * Expandable inline search input with debounce
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Icon from '../ui/Icon.svelte';

  export let value: string = '';
  export let expanded: boolean = false;

  const dispatch = createEventDispatcher<{
    search: string;
    expand: void;
    collapse: void;
    clear: void;
  }>();

  const DEBOUNCE_MS = 300;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let inputRef: HTMLInputElement;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      dispatch('search', value);
    }, DEBOUNCE_MS);
  }

  function handleExpand() {
    expanded = true;
    dispatch('expand');
  }

  function handleCollapse() {
    expanded = false;
    dispatch('collapse');
  }

  function handleClear() {
    value = '';
    if (debounceTimer) clearTimeout(debounceTimer);
    dispatch('clear');
    handleCollapse();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCollapse();
    }
  }

  // Auto-focus when expanded
  $: if (expanded && inputRef) {
    inputRef.focus();
  }

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });
</script>

<div class="search-wrapper">
  {#if !expanded}
    <button
      class="header-icon search-toggle"
      on:click={handleExpand}
      aria-label="Open search"
      title="Search"
    >
      <Icon name="search" size={18} />
    </button>
  {:else}
    <div class="search-input-container" role="search" aria-label="Search wines">
      <span class="search-icon">
        <Icon name="search" size={18} />
      </span>
      <input
        bind:this={inputRef}
        type="text"
        {value}
        on:input={handleInput}
        on:keydown={handleKeydown}
        placeholder="Search wines..."
        aria-label="Search query"
        class="search-input"
      />
      <button
        class="search-clear"
        on:click={handleClear}
        aria-label="Clear search and close"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  {/if}
</div>

<style>
  .search-wrapper {
    display: flex;
    align-items: center;
    height: 40px;
  }

  .search-input-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 100px;
    padding: 0 var(--space-3);
    height: 40px;
    width: 240px;
    box-sizing: border-box;
  }

  .search-input-container:focus-within {
    border-color: var(--accent);
  }

  .search-icon {
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--text-primary);
    outline: none;
    min-width: 0;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-tertiary);
    transition: all 0.2s var(--ease-out);
    flex-shrink: 0;
    margin-right: -4px;
  }

  .search-clear:hover {
    background: var(--surface-hover);
    color: var(--text-secondary);
  }

  .search-clear:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Match header-icon from Header.svelte */
  .header-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--divider);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .header-icon:hover {
    border-color: var(--accent-subtle);
    background: var(--surface);
  }

  .header-icon :global(svg) {
    color: var(--text-tertiary);
    transition: color 0.2s var(--ease-out);
  }

  .header-icon:hover :global(svg) {
    color: var(--text-secondary);
  }

  .header-icon:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Mobile responsive */
  @media (max-width: 767px) {
    .search-wrapper {
      height: 36px;
    }

    .search-input-container {
      height: 36px;
      width: 200px;
    }

    .header-icon {
      width: 36px;
      height: 36px;
    }
  }

  /* Smaller mobile */
  @media (max-width: 400px) {
    .search-input-container {
      width: 160px;
    }
  }
</style>
