<script lang="ts">
  /**
   * Header Component
   * Fixed-position header with logo, density toggle, collection row, and filter bar
   * Supports variants: 'cellar' (default), 'add', 'edit' for form pages
   */
  import { createEventDispatcher } from 'svelte';
  import { ViewToggle, Icon, ThemeToggle } from '$lib/components';
  import FilterBar from './FilterBar.svelte';
  import HistoryFilterBar from './HistoryFilterBar.svelte';
  import CollectionRow from './CollectionRow.svelte';
  import SearchInput from './SearchInput.svelte';
  import { toggleMenu, wines, winesLoading, viewMode, drunkWineCount, filteredDrunkWineCount, historyLoading, collectionName, searchQuery, setFilter, clearFilter } from '$lib/stores';
  import { currentCurrency, formatCompactValue, availableCurrencies, convertFromEUR } from '$lib/stores/currency';
  import type { Wine } from '$lib/api/types';

  export let variant: 'cellar' | 'add' | 'edit' = 'cellar';
  export let showFilters: boolean = true;
  export let filterType: 'cellar' | 'history' | 'none' = 'cellar';

  // Computed: is this a form variant (add/edit)?
  $: isFormVariant = variant === 'add' || variant === 'edit';

  // Page titles for form variants and collection row
  const variantTitles: Record<string, string> = {
    add: 'Add Wine',
    edit: 'Edit Wine'
  };

  // Collection row title based on filter type
  $: collectionTitle = filterType === 'history' ? 'Drink History' : $collectionName;

  // Calculate total cellar value from wines (prices are stored in EUR in avgPricePerLiterEUR)
  $: cellarStats = calculateCellarStats($wines, $currentCurrency);

  function calculateCellarStats(wineList: Wine[], currency: typeof $currentCurrency) {
    let totalValueEUR = 0;
    let unpricedCount = 0;

    for (const wine of wineList) {
      if (wine.avgPricePerLiterEUR && wine.bottleCount > 0) {
        // avgPricePerLiterEUR is per liter, multiply by total volume
        // Assuming standard 750ml bottles for simplicity
        const bottleValueEUR = parseFloat(String(wine.avgPricePerLiterEUR)) * 0.75 * wine.bottleCount;
        totalValueEUR += bottleValueEUR;
      } else if (wine.bottleCount > 0) {
        unpricedCount++;
      }
    }

    // Convert to display currency
    const totalValueDisplay = convertFromEUR(totalValueEUR, currency);
    const formattedValue = formatCompactValue(totalValueDisplay, currency);

    return {
      totalValue: formattedValue,
      unpricedCount
    };
  }

  const dispatch = createEventDispatcher<{
    search: void;
    filterChange: { key: string; value: string | undefined };
  }>();

  let scrollY = 0;
  let searchExpanded = false;

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
    <!-- Top row: Menu, Logo, Density toggle, Search -->
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
          {#if filterType === 'cellar'}
            <SearchInput
              value={$searchQuery}
              bind:expanded={searchExpanded}
              on:search={(e) => setFilter('searchQuery', e.detail)}
              on:clear={() => { clearFilter('searchQuery'); searchExpanded = false; }}
              on:expand={() => searchExpanded = true}
              on:collapse={() => { searchExpanded = false; }}
            />
          {:else}
            <button
              class="header-icon"
              title="Search"
              aria-label="Search wines"
              on:click={handleSearch}
            >
              <Icon name="search" size={18} />
            </button>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Collection row: Title, View toggle (Cellar/All), Stats -->
    {#if !isFormVariant}
      <CollectionRow
        title={collectionTitle}
        showViewToggle={filterType === 'cellar'}
        wineCount={$wines.length}
        bottleCount={filterType === 'history' ? $filteredDrunkWineCount : undefined}
        totalValue={filterType === 'cellar' ? cellarStats.totalValue : undefined}
        unpricedCount={filterType === 'cellar' ? cellarStats.unpricedCount : 0}
        isLoading={filterType === 'history' ? $historyLoading : $winesLoading}
      />
    {/if}

    <!-- Filter bar with sort controls -->
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
<div
  class="header-spacer"
  class:with-collection={!isFormVariant}
  class:with-filters={!isFormVariant && showFilters}
></div>

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
    overflow-x: hidden;
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
    width: 100%;
    margin: 0 auto;
    padding: var(--space-4) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    box-sizing: border-box;
    overflow: hidden;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    height: 64px;
  }

  /* With collection row (title + view toggle + stats) */
  .header-spacer.with-collection {
    height: 108px;
  }

  /* With collection row + filter bar */
  .header-spacer.with-collection.with-filters {
    height: 152px;
  }

  /* Responsive adjustments */
  @media (max-width: 479px) {
    .header-inner {
      padding: var(--space-3) var(--space-4);
    }
  }

  @media (max-width: 768px) {
    .header-inner {
      padding: var(--space-3) var(--space-4);
      gap: var(--space-2);
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
      height: 56px;
    }

    /* With collection row (title + view toggle + stats) */
    .header-spacer.with-collection {
      height: 96px;
    }

    /* With collection row + filter bar */
    .header-spacer.with-collection.with-filters {
      height: 140px;
    }
  }

  @media (max-width: 480px) {
    .header-actions {
      gap: var(--space-1);
    }
  }
</style>
