<script lang="ts">
  /**
   * FilterBar Component
   * Horizontal scrollable container for filter pills
   */
  import { createEventDispatcher } from 'svelte';
  import { filters, setFilter, clearFilter, clearAllFilters, hasActiveFilters, viewMode } from '$lib/stores';
  import { filterOptions } from '$lib/stores/filterOptions';
  import type { FilterOption } from '$lib/stores/filterOptions';
  import FilterPill from './FilterPill.svelte';
  import FilterDropdown from './FilterDropdown.svelte';

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

  // State: which dropdown is open
  let openDropdown: string | null = null;
  let dropdownOptions: FilterOption[] = [];
  let dropdownLoading = false;
  let dropdownPosition: { top: number; left: number } = { top: 0, left: 0 };

  // Refs for pill buttons
  let pillRefs: Record<string, HTMLDivElement> = {};

  // Handle dropdown pill click
  async function handleDropdownClick(filter: typeof dropdownFilters[number]) {
    // If same dropdown is open, close it
    if (openDropdown === filter.key) {
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

<style>
  .filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .filter-bar::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* Wrapper for dropdown pills to position dropdown relative to pill */
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
    flex-shrink: 0;
  }

  .clear-all-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  /* Responsive: add fade gradient on mobile to indicate scrollable */
  @media (max-width: 640px) {
    .filter-bar {
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
    }

    .filter-bar :global(.filter-pill) {
      scroll-snap-align: start;
    }
  }
</style>
