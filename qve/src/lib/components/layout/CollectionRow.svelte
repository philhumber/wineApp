<script lang="ts">
  /**
   * CollectionRow Component
   * Displays page title, view toggle (optional), and stats
   * Used in the header between the top row and filter bar
   */
  import { viewMode, modal } from '$lib/stores';

  export let title: string = 'Our Wines';
  export let showViewToggle: boolean = true;
  export let wineCount: number = 0;
  export let bottleCount: number | undefined = undefined;
  export let totalValue: string | null | undefined = undefined;
  export let unpricedCount: number = 0;
  export let isLoading: boolean = false;

  // Handle view mode toggle
  function setMode(mode: 'ourWines' | 'allWines') {
    viewMode.setWithHistory(mode);
  }
</script>

<div class="collection-row">
  <div class="collection-left">
    <h1 class="collection-title">{title}</h1>
    {#if showViewToggle}
      <div class="view-toggle" role="group" aria-label="View mode">
        <button
          class:active={$viewMode === 'ourWines'}
          on:click={() => setMode('ourWines')}
          aria-pressed={$viewMode === 'ourWines'}
        >
          Cellar
        </button>
        <button
          class:active={$viewMode === 'allWines'}
          on:click={() => setMode('allWines')}
          aria-pressed={$viewMode === 'allWines'}
        >
          All
        </button>
      </div>
    {/if}
  </div>

  <div class="stats-inline">
    {#if isLoading}
      <span class="stat-loading">Loading...</span>
    {:else if bottleCount !== undefined}
      <!-- History page: show bottle count -->
      <span><strong>{bottleCount}</strong> bottles</span>
    {:else}
      <!-- Cellar page: show wine count and value -->
      <span><strong>{wineCount}</strong> wines</span>
      {#if totalValue}
        <span class="stat-sep">&middot;</span>
        <button
          type="button"
          class="stat-value-btn"
          on:click={() => modal.openCellarValue()}
          aria-label="View cellar value history"
        >
          <strong>{totalValue}</strong>
          {#if unpricedCount > 0}
            <span class="stat-note">*{unpricedCount} unpriced</span>
          {/if}
        </button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .collection-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .collection-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .collection-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-primary);
    line-height: 1.2;
    margin: 0;
  }

  /* View toggle (Cellar / All) */
  .view-toggle {
    display: flex;
    background: var(--bg-subtle);
    border-radius: var(--radius-sm);
    padding: 2px;
  }

  .view-toggle button {
    padding: 4px 10px;
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .view-toggle button.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .view-toggle button:hover:not(.active) {
    color: var(--text-secondary);
  }

  /* Stats (wine count, value) */
  .stats-inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .stats-inline strong {
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-sep {
    color: var(--text-tertiary);
  }

  .stat-note {
    font-size: 0.6875rem;
    color: var(--accent);
    margin-left: var(--space-1);
  }

  .stat-value-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: color 0.2s var(--ease-out);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .stat-value-btn:hover {
    color: var(--accent);
  }

  .stat-value-btn:active {
    opacity: 0.7;
  }

  .stat-value-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }

  .stat-value-btn strong {
    font-weight: 600;
    color: inherit;
  }

  .stat-loading {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }

  /* Responsive: tighter on mobile */
  @media (max-width: 768px) {
    .collection-title {
      font-size: 1.125rem;
    }

    .stats-inline {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .collection-row {
      gap: var(--space-2);
    }

    .collection-left {
      gap: var(--space-2);
    }

    .view-toggle button {
      padding: 3px 8px;
      font-size: 0.5625rem;
    }

    .stats-inline {
      font-size: 0.6875rem;
    }

    .stat-note {
      font-size: 0.5625rem;
    }
  }
</style>
