<script lang="ts">
  /**
   * Header Component
   * Fixed-position header with logo, theme/view toggles, and filter bar
   * Supports variants: 'cellar' (default), 'add', 'edit' for form pages
   */
  import { createEventDispatcher } from 'svelte';
  import { ViewToggle, Icon, ThemeToggle } from '$lib/components';
  import FilterBar from './FilterBar.svelte';
  import HistoryFilterBar from './HistoryFilterBar.svelte';
  import { toggleMenu } from '$lib/stores';

  export let variant: 'cellar' | 'add' | 'edit' = 'cellar';
  export let showFilters: boolean = true;
  export let filterType: 'cellar' | 'history' | 'none' = 'cellar';

  // Computed: is this a form variant (add/edit)?
  $: isFormVariant = variant === 'add' || variant === 'edit';

  // Page titles for form variants
  const variantTitles: Record<string, string> = {
    add: 'Add Wine',
    edit: 'Edit Wine'
  };

  const dispatch = createEventDispatcher<{
    search: void;
    filterChange: { key: string; value: string | undefined };
  }>();

  let scrollY = 0;

  function handleSearch() {
    dispatch('search');
  }

  function handleMenu() {
    toggleMenu();
  }

  function handleFilterChange(event: CustomEvent<{ key: string; value: string | undefined }>) {
    dispatch('filterChange', event.detail);
  }
</script>

<svelte:window bind:scrollY />

<header class="header" class:scrolled={scrollY > 10}>
  <div class="header-inner">
    <div class="header-top">
      <div class="header-left">
        <button
          class="header-icon"
          title="Menu"
          aria-label="Open menu"
          on:click={handleMenu}
        >
          <Icon name="menu" size={18} />
        </button>
        <a href="/qve/" class="logo">Qvé</a>
        {#if isFormVariant}
          <h1 class="page-title">{variantTitles[variant]}</h1>
        {/if}
      </div>
      <div class="header-actions">
        {#if isFormVariant}
          <ThemeToggle />
        {:else}
          <ViewToggle />
          <button
            class="header-icon"
            title="Search"
            aria-label="Search wines"
            on:click={handleSearch}
          >
            <Icon name="search" size={18} />
          </button>
        {/if}
      </div>
    </div>

    {#if !isFormVariant && showFilters}
      {#if filterType === 'cellar'}
        <FilterBar on:filterChange={handleFilterChange} />
      {:else if filterType === 'history'}
        <HistoryFilterBar />
      {/if}
    {/if}
  </div>
</header>

<!-- Spacer to account for fixed header height -->
<div class="header-spacer" class:with-filters={!isFormVariant && showFilters}></div>

<style>
  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg);
    transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out);
    border-bottom: 1px solid transparent;
  }

  .header.scrolled {
    border-bottom-color: var(--divider);
  }

  /* Dark mode: solid background (backdrop-filter removed to fix iOS Safari
     stacking context bug that traps position:fixed dropdowns) */
  :global([data-theme="dark"]) .header {
    background: rgba(12, 11, 10, 0.98);
  }

  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-6);
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-5);
  }

  /* Remove margin if no filters */
  .header:not(:has(.filter-bar)):not(:has(.history-filter-bar)) .header-top {
    margin-bottom: 0;
  }

  .logo {
    font-family: var(--font-serif);
    font-size: 2rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--text-primary);
    text-decoration: none;
    transition: color 0.2s var(--ease-out);
  }

  .logo:hover {
    color: var(--accent);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .page-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-primary);
    margin: 0;
    margin-left: var(--space-2);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

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

  /* Spacer to offset content below fixed header */
  .header-spacer {
    height: calc(80px + var(--space-5));
  }

  .header-spacer.with-filters {
    height: calc(140px + var(--space-5));
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .header-inner {
      padding: var(--space-4) var(--space-4);
    }

    .header-top {
      margin-bottom: var(--space-4);
    }

    .logo {
      font-size: 1.5rem;
    }

    .header-actions {
      gap: var(--space-2);
    }

    .header-icon {
      width: 36px;
      height: 36px;
    }

    .page-title {
      font-size: 1rem;
    }

    .header-spacer {
      height: calc(70px + var(--space-4));
    }

    .header-spacer.with-filters {
      height: calc(120px + var(--space-4));
    }
  }

  @media (max-width: 480px) {
    .header-actions {
      gap: var(--space-1);
    }
  }
</style>
