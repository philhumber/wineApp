<script lang="ts">
  /**
   * HistoryFilterBar Component
   * Filter controls for history page (Country, Type, Region, Producer, Vintage)
   * Uses client-side filtering via historyFilters store
   */
  import {
    historyFilters,
    setHistoryFilter,
    clearHistoryFilters,
    hasHistoryFilters,
    drunkWines
  } from '$lib/stores';
  import FilterPill from './FilterPill.svelte';
  import FilterDropdown from './FilterDropdown.svelte';
  import type { FilterOption } from '$lib/stores/filterOptions';
  import type { DrunkWine } from '$lib/api/types';

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
</style>
