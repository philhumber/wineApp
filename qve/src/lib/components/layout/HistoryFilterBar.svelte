<script lang="ts">
  /**
   * HistoryFilterBar Component
   * Filter controls for history page (Country, Type, Region, Producer, Vintage)
   * Uses client-side filtering via historyFilters store
   * On mobile: also includes sort controls (hidden on desktop)
   */
  import { Icon } from '$lib/components';
  import {
    historyFilters,
    setHistoryFilter,
    clearHistoryFilters,
    hasHistoryFilters,
    drunkWines,
    historySortKey,
    historySortDir,
    setHistorySort,
    toggleHistorySortDir
  } from '$lib/stores';
  import FilterPill from './FilterPill.svelte';
  import FilterDropdown from './FilterDropdown.svelte';
  import type { FilterOption } from '$lib/stores/filterOptions';
  import type { DrunkWine } from '$lib/api/types';
  import type { HistorySortKey } from '$lib/stores';

  // Sort options for history (mobile controls) - matches HistorySortBar
  const sortOptions: { key: HistorySortKey; label: string }[] = [
    { key: 'drinkDate', label: 'Date' },
    { key: 'combinedRating', label: 'Rating' },
    { key: 'wineName', label: 'Name' },
    { key: 'wineType', label: 'Type' },
    { key: 'country', label: 'Country' },
    { key: 'producer', label: 'Producer' },
    { key: 'region', label: 'Region' },
    { key: 'year', label: 'Vintage' },
    { key: 'price', label: 'Price' }
  ];

  // Text fields default to ascending (A-Z)
  // Numeric fields (date, ratings, price) default to descending (newest/highest first)
  const textFields: HistorySortKey[] = ['wineName', 'wineType', 'country', 'producer', 'region', 'year'];

  // Handle sort change (mobile)
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const key = target.value as HistorySortKey;
    const defaultDir = textFields.includes(key) ? 'asc' : 'desc';
    setHistorySort(key, defaultDir);
  }

  // Build filter options from drunk wines data (client-side)
  function buildOptions(wines: DrunkWine[], field: keyof DrunkWine): FilterOption[] {
    const counts = new Map<string, number>();
    for (const wine of wines) {
      const value = wine[field] as string;
      if (value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Helper to check if wine matches all OTHER filters (excluding the one we're building options for)
  function matchesOtherFilters(w: DrunkWine, excludeKey: string): boolean {
    if (excludeKey !== 'countryDropdown' && $historyFilters.countryDropdown && w.countryName !== $historyFilters.countryDropdown) return false;
    if (excludeKey !== 'typesDropdown' && $historyFilters.typesDropdown && w.wineType !== $historyFilters.typesDropdown) return false;
    if (excludeKey !== 'regionDropdown' && $historyFilters.regionDropdown && w.regionName !== $historyFilters.regionDropdown) return false;
    if (excludeKey !== 'producerDropdown' && $historyFilters.producerDropdown && w.producerName !== $historyFilters.producerDropdown) return false;
    if (excludeKey !== 'yearDropdown' && $historyFilters.yearDropdown && w.year !== $historyFilters.yearDropdown) return false;
    return true;
  }

  // Build filtered wine lists for cascading (each filter considers OTHER active filters)
  $: winesForCountry = $drunkWines.filter((w) => matchesOtherFilters(w, 'countryDropdown'));
  $: winesForType = $drunkWines.filter((w) => matchesOtherFilters(w, 'typesDropdown'));
  $: winesForRegion = $drunkWines.filter((w) => matchesOtherFilters(w, 'regionDropdown'));
  $: winesForProducer = $drunkWines.filter((w) => matchesOtherFilters(w, 'producerDropdown'));
  $: winesForYear = $drunkWines.filter((w) => matchesOtherFilters(w, 'yearDropdown'));

  // Reactive filter options - now context-aware (cascading)
  $: countryOptions = buildOptions(winesForCountry, 'countryName');
  $: typeOptions = buildOptions(winesForType, 'wineType');
  $: regionOptions = buildOptions(winesForRegion, 'regionName');
  $: producerOptions = buildOptions(winesForProducer, 'producerName');
  $: yearOptions = buildOptions(winesForYear, 'year');

  // Dropdown filter definitions (same order as cellar FilterBar)
  const dropdownFilters = [
    { key: 'countryDropdown' as const, label: 'Country' },
    { key: 'typesDropdown' as const, label: 'Type' },
    { key: 'regionDropdown' as const, label: 'Region' },
    { key: 'producerDropdown' as const, label: 'Producer' },
    { key: 'yearDropdown' as const, label: 'Vintage' }
  ];

  // State
  let openDropdown: string | null = null;
  let dropdownPosition: { top: number; left: number } = { top: 0, left: 0 };
  let pillRefs: Record<string, HTMLDivElement> = {};

  function getOptions(key: string): FilterOption[] {
    switch (key) {
      case 'countryDropdown':
        return countryOptions;
      case 'typesDropdown':
        return typeOptions;
      case 'regionDropdown':
        return regionOptions;
      case 'producerDropdown':
        return producerOptions;
      case 'yearDropdown':
        return yearOptions;
      default:
        return [];
    }
  }

  function handleDropdownClick(filter: typeof dropdownFilters[number]) {
    if (openDropdown === filter.key) {
      openDropdown = null;
      return;
    }

    const pillWrapper = pillRefs[filter.key];
    if (pillWrapper) {
      const rect = pillWrapper.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 8,
        left: rect.left
      };
    }

    openDropdown = filter.key;
  }

  function handleSelect(key: string, event: CustomEvent<{ value: string }>) {
    setHistoryFilter(key as keyof typeof $historyFilters, event.detail.value);
    openDropdown = null;
  }

  function handleClear(key: string) {
    setHistoryFilter(key as keyof typeof $historyFilters, undefined);
    openDropdown = null;
  }

  function handleClose() {
    openDropdown = null;
  }

  function isActive(key: string): boolean {
    return !!$historyFilters[key as keyof typeof $historyFilters];
  }

  function getValue(key: string): string | undefined {
    return $historyFilters[key as keyof typeof $historyFilters];
  }

  function getLabel(filter: typeof dropdownFilters[number]): string {
    const value = getValue(filter.key);
    return value || filter.label;
  }
</script>

<div class="history-filter-bar" role="toolbar" aria-label="History filters">
  {#each dropdownFilters as filter}
    <div class="dropdown-wrapper" bind:this={pillRefs[filter.key]}>
      <FilterPill
        label={getLabel(filter)}
        hasDropdown
        active={isActive(filter.key)}
        expanded={openDropdown === filter.key}
        on:click={() => handleDropdownClick(filter)}
      />
      {#if openDropdown === filter.key}
        <FilterDropdown
          items={getOptions(filter.key)}
          loading={false}
          selectedValue={getValue(filter.key)}
          label={filter.label}
          position={dropdownPosition}
          on:select={(e) => handleSelect(filter.key, e)}
          on:clear={() => handleClear(filter.key)}
          on:close={handleClose}
        />
      {/if}
    </div>
  {/each}

  {#if $hasHistoryFilters}
    <button class="clear-all-btn" on:click={clearHistoryFilters}>
      Clear all
    </button>
  {/if}

  <!-- Sort controls: mobile only (hidden on desktop) -->
  <div class="mobile-sort-controls">
    <div class="select-wrapper">
      <select
        class="sort-select"
        value={$historySortKey}
        on:change={handleSortChange}
        aria-label="Sort history by"
      >
        {#each sortOptions as opt}
          <option value={opt.key}>{opt.label}</option>
        {/each}
      </select>
      <Icon name="chevron-down" size={12} />
    </div>

    <button
      class="sort-dir-btn"
      title={$historySortDir === 'asc' ? 'A to Z / Low to High' : 'Z to A / High to Low'}
      on:click={toggleHistorySortDir}
      aria-label="Toggle sort direction"
    >
      <Icon name={$historySortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={14} />
    </button>
  </div>
</div>

<style>
  .history-filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .history-filter-bar::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .dropdown-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .clear-all-btn {
    margin-left: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--divider);
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .clear-all-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  /* ─────────────────────────────────────────────────────────
   * MOBILE SORT CONTROLS
   * Hidden on desktop, visible on mobile
   * ───────────────────────────────────────────────────────── */
  .mobile-sort-controls {
    display: none;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
    flex-shrink: 0;
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
    padding: 6px 24px 6px 10px;
    font-family: var(--font-sans);
    font-size: 0.75rem;
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
    right: 8px;
    pointer-events: none;
    color: var(--text-tertiary);
  }

  .sort-dir-btn {
    width: 28px;
    height: 28px;
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

  /* Responsive: show sort controls on mobile */
  @media (max-width: 640px) {
    .mobile-sort-controls {
      display: flex;
    }
  }
</style>
