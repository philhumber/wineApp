<script lang="ts">
  /**
   * HistorySortBar component
   * Sort and filter controls for history page
   */
  import { Icon, ViewToggle } from '$lib/components';
  import {
    historySortKey,
    historySortDir,
    setHistorySort,
    toggleHistorySortDir
  } from '$lib/stores';
  import type { HistorySortKey } from '$lib/stores';

  const sortOptions: { key: HistorySortKey; label: string }[] = [
    { key: 'drinkDate', label: 'Date' },
    { key: 'overallRating', label: 'Rating' },
    { key: 'valueRating', label: 'Value' },
    { key: 'wineName', label: 'Name' },
    { key: 'wineType', label: 'Type' },
    { key: 'country', label: 'Country' },
    { key: 'producer', label: 'Producer' },
    { key: 'region', label: 'Region' },
    { key: 'year', label: 'Vintage' },
    { key: 'price', label: 'Price' },
    { key: 'buyAgain', label: 'Buy Again' }
  ];

  // Text fields default to ascending (A-Z)
  // Numeric fields (date, ratings, price, buyAgain) default to descending (newest/highest first)
  const textFields: HistorySortKey[] = ['wineName', 'wineType', 'country', 'producer', 'region', 'year'];

  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const key = target.value as HistorySortKey;
    const defaultDir = textFields.includes(key) ? 'asc' : 'desc';
    setHistorySort(key, defaultDir);
  }
</script>

<div class="history-sort-bar">
  <div class="sort-controls">
    <label class="sort-label" for="sort-select">Sort by</label>
    <div class="select-wrapper">
      <select
        id="sort-select"
        class="sort-select"
        value={$historySortKey}
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
      title={$historySortDir === 'desc' ? 'Newest first' : 'Oldest first'}
      on:click={toggleHistorySortDir}
    >
      <Icon name={$historySortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={14} />
    </button>
  </div>

  <div class="right-controls">
    <ViewToggle />
  </div>
</div>

<style>
  .history-sort-bar {
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

  .sort-select option {
    color: #2D2926;
    background-color: #FFFFFF;
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
    .history-sort-bar {
      flex-wrap: wrap;
    }

    .sort-label {
      display: none;
    }
  }
</style>
