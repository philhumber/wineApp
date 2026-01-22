<script lang="ts">
  /**
   * CellarSortBar component
   * Sort controls for cellar/home page
   */
  import { Icon, ViewToggle } from '$lib/components';
  import {
    cellarSortKey,
    cellarSortDir,
    setCellarSort,
    toggleCellarSortDir
  } from '$lib/stores';
  import type { CellarSortKey } from '$lib/stores';

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

  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const key = target.value as CellarSortKey;
    // Text fields default to ascending (A-Z)
    // Numeric fields (rating, bottles, price) default to descending (highest first)
    const numericFields: CellarSortKey[] = ['rating', 'bottles', 'price'];
    const defaultDir = numericFields.includes(key) ? 'desc' : 'asc';
    setCellarSort(key, defaultDir);
  }
</script>

<div class="cellar-sort-bar">
  <div class="sort-controls">
    <label class="sort-label" for="cellar-sort-select">Sort by</label>
    <div class="select-wrapper">
      <select
        id="cellar-sort-select"
        class="sort-select"
        value={$cellarSortKey}
        on:change={handleSortChange}
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
    >
      <Icon name={$cellarSortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={14} />
    </button>
  </div>

  <div class="right-controls">
    <ViewToggle />
  </div>
</div>

<style>
  .cellar-sort-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    margin-bottom: var(--space-4);
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sort-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
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
      color 0.2s var(--ease-out),
      transform 0.2s var(--ease-out);
  }

  .sort-dir-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .sort-dir-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .right-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  @media (max-width: 520px) {
    .cellar-sort-bar {
      flex-wrap: wrap;
    }

    .sort-label {
      display: none;
    }
  }
</style>
