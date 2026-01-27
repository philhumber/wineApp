<script lang="ts">
  /**
   * FilterBar Component
   * Horizontal scrollable filter pills with sort controls on the right
   */
  import { createEventDispatcher } from 'svelte';
  import { filters, setFilter, clearFilter, clearAllFilters, hasActiveFilters, viewMode, cellarSortKey, cellarSortDir, setCellarSort, toggleCellarSortDir } from '$lib/stores';
  import { filterOptions } from '$lib/stores/filterOptions';
  import type { FilterOption } from '$lib/stores/filterOptions';
  import FilterPill from './FilterPill.svelte';
  import FilterDropdown from './FilterDropdown.svelte';
  import { Icon } from '$lib/components';

  const dispatch = createEventDispatcher<{
    filterChange: { key: string; value: string | undefined };
  }>();

  // Dropdown filter definitions
  const dropdownFilters = [
    { key: 'countryDropdown', label: 'Country', fetchKey: 'countries' as const },
    { key: 'typesDropdown', label: 'Type', fetchKey: 'types' as const },
    { key: 'regionDropdown', label: 'Region', fetchKey: 'regions' as const },
    { key: 'producerDropdown', label: 'Producer', fetchKey: 'producers' as const },
    { key: 'yearDropdown', label: 'Vintage', fetchKey: 'years' as const }
  ];

  // Sort options for cellar view
  const sortOptions = [
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

  // Handle sort change
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    setCellarSort(target.value as typeof $cellarSortKey);
  }

  // State: which dropdown is open
  let openDropdown: string | null = null;
  let dropdownOptions: FilterOption[] = [];
  let dropdownLoading = false;
  let dropdownPosition: { top: number; left: number } = { top: 0, left: 0 };
  let lastOpenTime = 0; // Debounce for iOS double-tap bug

  // Refs for pill buttons
  let pillRefs: Record<string, HTMLDivElement> = {};

  // Handle dropdown pill click
  async function handleDropdownClick(filter: typeof dropdownFilters[number]) {
    const now = Date.now();

    // If same dropdown is open, close it (but not if just opened - iOS debounce)
    if (openDropdown === filter.key) {
      // Ignore close if opened less than 2000ms ago (iOS ghost click protection)
      if (now - lastOpenTime < 2000) {
        return;
      }
      openDropdown = null;
      return;
    }

    // Calculate position from the pill button
    const pillWrapper = pillRefs[filter.key];
    if (pillWrapper) {
      const rect = pillWrapper.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 8, // 8px gap below the pill
        left: rect.left
      };
    }

    // Open new dropdown
    openDropdown = filter.key;
    lastOpenTime = Date.now(); // Track open time for iOS debounce
    dropdownLoading = true;
    dropdownOptions = [];

    // Fetch options based on filter type
    // All filters are context-aware: each filter is filtered by all other active filters
    try {
      if (filter.fetchKey === 'countries') {
        dropdownOptions = await filterOptions.fetchCountries(
          $viewMode,
          $filters.typesDropdown,
          $filters.regionDropdown,
          $filters.producerDropdown,
          $filters.yearDropdown
        );
      } else if (filter.fetchKey === 'types') {
        dropdownOptions = await filterOptions.fetchTypes(
          $viewMode,
          $filters.countryDropdown,
          $filters.regionDropdown,
          $filters.producerDropdown,
          $filters.yearDropdown
        );
      } else if (filter.fetchKey === 'regions') {
        dropdownOptions = await filterOptions.fetchRegions(
          $viewMode,
          $filters.countryDropdown,
          $filters.typesDropdown,
          $filters.producerDropdown,
          $filters.yearDropdown
        );
      } else if (filter.fetchKey === 'producers') {
        dropdownOptions = await filterOptions.fetchProducers(
          $viewMode,
          $filters.countryDropdown,
          $filters.regionDropdown,
          $filters.typesDropdown,
          $filters.yearDropdown
        );
      } else if (filter.fetchKey === 'years') {
        dropdownOptions = await filterOptions.fetchYears(
          $viewMode,
          $filters.countryDropdown,
          $filters.regionDropdown,
          $filters.producerDropdown,
          $filters.typesDropdown
        );
      }
    } finally {
      dropdownLoading = false;
    }
  }

  // Handle dropdown selection
  function handleDropdownSelect(key: string, event: CustomEvent<{ value: string }>) {
    setFilter(key as keyof typeof $filters, event.detail.value);
    openDropdown = null;
    dispatch('filterChange', { key, value: event.detail.value });
  }

  // Handle dropdown clear
  function handleDropdownClear(key: string) {
    clearFilter(key as keyof typeof $filters);
    openDropdown = null;
    dispatch('filterChange', { key, value: undefined });
  }

  // Handle dropdown close
  function handleDropdownClose() {
    openDropdown = null;
  }

  // Check if a dropdown filter has a value
  function isDropdownActive(key: string): boolean {
    return !!$filters[key as keyof typeof $filters];
  }

  // Get current filter value for a dropdown
  function getDropdownValue(key: string): string | undefined {
    return $filters[key as keyof typeof $filters] as string | undefined;
  }

  // Get label for dropdown (includes selected value if active)
  function getDropdownLabel(filter: typeof dropdownFilters[number]): string {
    const value = getDropdownValue(filter.key);
    return value || filter.label;
  }
</script>

<div class="filter-bar" role="toolbar" aria-label="Wine filters">
  <!-- Scrollable filter pills -->
  <div class="filter-pills">
    {#each dropdownFilters as filter}
      <div class="dropdown-wrapper" bind:this={pillRefs[filter.key]}>
        <FilterPill
          label={getDropdownLabel(filter)}
          hasDropdown
          active={isDropdownActive(filter.key)}
          expanded={openDropdown === filter.key}
          on:click={() => handleDropdownClick(filter)}
        />
        {#if openDropdown === filter.key}
          <FilterDropdown
            items={dropdownOptions}
            loading={dropdownLoading}
            selectedValue={getDropdownValue(filter.key)}
            label={filter.label}
            position={dropdownPosition}
            on:select={(e) => handleDropdownSelect(filter.key, e)}
            on:clear={() => handleDropdownClear(filter.key)}
            on:close={handleDropdownClose}
          />
        {/if}
      </div>
    {/each}

    {#if $hasActiveFilters}
      <button class="clear-all-btn" on:click={clearAllFilters}>
        Clear all
      </button>
    {/if}
  </div>

  <!-- Vertical separator -->
  <div class="sort-separator" aria-hidden="true"></div>

  <!-- Sort controls: always visible on right -->
  <div class="sort-controls">
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
  .filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  /* ─────────────────────────────────────────────────────────
   * FILTER PILLS (scrollable)
   * ───────────────────────────────────────────────────────── */
  .filter-pills {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    flex: 1;
    min-width: 0; /* Allow shrinking */
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x; /* Prevents vertical scroll/tap interference on mobile */
    scrollbar-width: none; /* Firefox - hide scrollbar */
    -ms-overflow-style: none; /* IE/Edge - hide scrollbar */
  }

  .filter-pills::-webkit-scrollbar {
    display: none; /* Chrome/Safari - hide scrollbar */
  }

  /* Wrapper for dropdown pills to position dropdown relative to pill */
  .dropdown-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .clear-all-btn {
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--divider);
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .clear-all-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  /* ─────────────────────────────────────────────────────────
   * VERTICAL SEPARATOR
   * ───────────────────────────────────────────────────────── */
  .sort-separator {
    width: 1px;
    height: 24px;
    background: var(--divider);
    flex-shrink: 0;
  }

  /* ─────────────────────────────────────────────────────────
   * SORT CONTROLS (always visible on right)
   * ───────────────────────────────────────────────────────── */
  .sort-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
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

  /* ─────────────────────────────────────────────────────────
   * MOBILE RESPONSIVE
   * ───────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .filter-pills {
      scroll-snap-type: x proximity;
    }

    .filter-pills :global(.filter-pill) {
      scroll-snap-align: start;
    }
  }
</style>
