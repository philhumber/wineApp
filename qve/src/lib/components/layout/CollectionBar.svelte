<script lang="ts">
  /**
   * CollectionBar Component
   * Unified collection header with title, inline stats, and sort controls
   * Layout: [Title + Cellar/All badge] | [stats inline] | [sort controls]
   */
  import { Icon } from '$lib/components';
  import {
    collectionName,
    cellarValue,
    viewMode,
    cellarSortKey,
    cellarSortDir,
    setCellarSort,
    toggleCellarSortDir,
    currentCurrency,
    convertFromEUR,
    formatCompactValue,
    winesLoading,
    wines
  } from '$stores';
  import type { CellarSortKey } from '$lib/stores';

  // Get wine count from store
  $: wineCount = $wines.length;

  // Sort options
  const sortOptions: { key: CellarSortKey; label: string }[] = [
    { key: 'producer', label: 'Producer' },
    { key: 'wineName', label: 'Name' },
    { key: 'country', label: 'Country' },
    { key: 'region', label: 'Region' },
    { key: 'year', label: 'Vintage' },
    { key: 'type', label: 'Type' },
    { key: 'rating', label: 'Rating' },
    { key: 'bottles', label: 'Bottles' },
    { key: 'price', label: 'Price' }
  ];

  // Formatted cellar value in compact display format (~£45k)
  $: formattedValue = (() => {
    if (!$cellarValue || $cellarValue.totalValueEUR === 0) return null;
    const converted = convertFromEUR($cellarValue.totalValueEUR, $currentCurrency);
    return formatCompactValue(converted, $currentCurrency);
  })();

  // View badge text - "Cellar" for in-stock, "All" for all wines
  $: viewBadgeText = $viewMode === 'ourWines' ? 'Cellar' : 'All';

  // Toggle view mode
  function toggleView() {
    viewMode.set($viewMode === 'ourWines' ? 'allWines' : 'ourWines');
  }

  // Handle sort change
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const key = target.value as CellarSortKey;
    const numericFields: CellarSortKey[] = ['rating', 'bottles', 'price'];
    const defaultDir = numericFields.includes(key) ? 'desc' : 'asc';
    setCellarSort(key, defaultDir);
  }
</script>

<div class="collection-bar">
  <!-- Left: Title + Badge + Inline Stats -->
  <div class="collection-left">
    <h1 class="collection-title">{$collectionName}</h1>
    <button
      class="view-badge"
      on:click={toggleView}
      title="Toggle between Cellar and All Wines"
    >
      {viewBadgeText}
    </button>

    <!-- Inline Stats -->
    <span class="inline-stats">
      {#if $winesLoading}
        <span class="stat-text">—</span>
      {:else}
        <span class="stat-text">{wineCount} wines</span>
        {#if $viewMode === 'ourWines' && formattedValue}
          <span class="stat-separator">·</span>
          <span class="stat-text stat-value">{formattedValue}</span>
        {/if}
      {/if}
    </span>
  </div>

  <!-- Right: Sort Controls (desktop only, mobile shows in FilterBar) -->
  <div class="collection-right">
    <div class="select-wrapper">
      <select
        class="sort-select"
        value={$cellarSortKey}
        on:change={handleSortChange}
        aria-label="Sort wines by"
      >
        {#each sortOptions as opt}
          <option value={opt.key}>{opt.label}</option>
        {/each}
      </select>
      <Icon name="chevron-down" size={12} />
    </div>

    <button
      class="sort-dir-btn"
      title={$cellarSortDir === 'asc' ? 'A to Z / Low to High' : 'Z to A / High to Low'}
      on:click={toggleCellarSortDir}
      aria-label="Toggle sort direction"
    >
      <Icon name={$cellarSortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={14} />
    </button>
  </div>
</div>

<style>
  .collection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  /* ─────────────────────────────────────────────────────────
   * LEFT: Title + Badge + Stats
   * ───────────────────────────────────────────────────────── */
  .collection-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .collection-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .view-badge {
    padding: 4px 10px;
    background: var(--bg-subtle);
    border: none;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .view-badge:hover {
    background: var(--accent-muted, rgba(166, 155, 138, 0.15));
    color: var(--text-secondary);
  }

  .view-badge:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─────────────────────────────────────────────────────────
   * INLINE STATS
   * ───────────────────────────────────────────────────────── */
  .inline-stats {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  .stat-text {
    white-space: nowrap;
  }

  .stat-separator {
    color: var(--divider);
  }

  .stat-value {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  /* ─────────────────────────────────────────────────────────
   * RIGHT: Sort Controls
   * ───────────────────────────────────────────────────────── */
  .collection-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .select-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .sort-select {
    appearance: none;
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 6px 28px 6px 12px;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-primary);
    cursor: pointer;
    transition:
      border-color 0.2s var(--ease-out),
      box-shadow 0.2s var(--ease-out);
  }

  .sort-select:hover {
    border-color: var(--accent);
  }

  .sort-select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-subtle, rgba(166, 155, 138, 0.2));
  }

  .select-wrapper :global(svg) {
    position: absolute;
    right: 10px;
    pointer-events: none;
    color: var(--text-tertiary);
  }

  .sort-dir-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--divider);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.2s var(--ease-out),
      color 0.2s var(--ease-out);
  }

  .sort-dir-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .sort-dir-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─────────────────────────────────────────────────────────
   * MOBILE RESPONSIVE
   * ───────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .collection-title {
      font-size: 1.125rem;
    }

    .inline-stats {
      font-size: 0.75rem;
    }

    /* Hide sort controls on mobile - they appear in FilterBar */
    .collection-right {
      display: none;
    }
  }
</style>
