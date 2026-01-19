<script lang="ts">
  /**
   * FilterBar Component
   * Horizontal scrollable container for filter pills
   */
  import { createEventDispatcher } from 'svelte';
  import { filters, setFilter } from '$lib/stores';
  import { toasts } from '$lib/stores';
  import FilterPill from './FilterPill.svelte';

  const dispatch = createEventDispatcher<{
    filterChange: { key: string; value: string | undefined };
  }>();

  // Wine type filters (simple toggles)
  const typeFilters = [
    { value: undefined, label: 'All' },
    { value: 'Red', label: 'Red' },
    { value: 'White', label: 'White' },
    { value: 'Sparkling', label: 'Sparkling' },
    { value: 'Rosé', label: 'Rosé' }
  ];

  // Dropdown filters (placeholders for now)
  const dropdownFilters = [
    { key: 'regionDropdown', label: 'Region' },
    { key: 'producerDropdown', label: 'Producer' },
    { key: 'yearDropdown', label: 'Vintage' }
  ];

  function handleTypeSelect(value: string | undefined) {
    setFilter('typesDropdown', value);
    dispatch('filterChange', { key: 'typesDropdown', value });
  }

  function handleDropdownClick(key: string) {
    // Placeholder - show info toast
    toasts.info(`${key.replace('Dropdown', '')} filter coming soon!`);
  }

  // Check if a type filter is active
  function isTypeActive(value: string | undefined): boolean {
    if (value === undefined) {
      // "All" is active when no type filter is set
      return !$filters.typesDropdown;
    }
    return $filters.typesDropdown === value;
  }

  // Check if a dropdown filter has a value
  function isDropdownActive(key: string): boolean {
    return !!$filters[key as keyof typeof $filters];
  }
</script>

<div class="filter-bar" role="toolbar" aria-label="Wine filters">
  {#each typeFilters as filter}
    <FilterPill
      label={filter.label}
      active={isTypeActive(filter.value)}
      on:click={() => handleTypeSelect(filter.value)}
    />
  {/each}

  <span class="filter-divider" aria-hidden="true"></span>

  {#each dropdownFilters as filter}
    <FilterPill
      label={filter.label}
      hasDropdown
      active={isDropdownActive(filter.key)}
      on:click={() => handleDropdownClick(filter.key)}
    />
  {/each}
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

  .filter-divider {
    width: 1px;
    height: 20px;
    background: var(--divider);
    flex-shrink: 0;
    margin: 0 var(--space-1);
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
