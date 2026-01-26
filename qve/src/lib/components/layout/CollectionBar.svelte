<script lang="ts">
  /**
   * CollectionBar Component
   * Layout: [Title] [CELLAR|ALL toggle] ... [stats on right]
   */
  import {
    collectionName,
    cellarValue,
    viewMode,
    currentCurrency,
    convertFromEUR,
    formatCompactValue,
    winesLoading,
    wines
  } from '$stores';

  // Get wine count from store
  $: wineCount = $wines.length;

  // Formatted cellar value in compact display format (~£45k)
  $: formattedValue = (() => {
    if (!$cellarValue || $cellarValue.totalValueEUR === 0) return null;
    const converted = convertFromEUR($cellarValue.totalValueEUR, $currentCurrency);
    return formatCompactValue(converted, $currentCurrency);
  })();

  // Set view mode
  function setView(mode: 'ourWines' | 'allWines') {
    viewMode.set(mode);
  }
</script>

<div class="collection-bar">
  <!-- Left: Title -->
  <h1 class="collection-title">{$collectionName}</h1>

  <!-- Center: CELLAR/ALL toggle -->
  <div class="view-toggle" role="tablist" aria-label="View mode">
    <button
      class="view-btn"
      class:active={$viewMode === 'ourWines'}
      role="tab"
      aria-selected={$viewMode === 'ourWines'}
      on:click={() => setView('ourWines')}
    >
      Cellar
    </button>
    <button
      class="view-btn"
      class:active={$viewMode === 'allWines'}
      role="tab"
      aria-selected={$viewMode === 'allWines'}
      on:click={() => setView('allWines')}
    >
      All
    </button>
  </div>

  <!-- Right: Stats -->
  <div class="stats">
    {#if $winesLoading}
      <span class="stat-text">—</span>
    {:else}
      <span class="stat-text">{wineCount} wines</span>
      {#if $viewMode === 'ourWines' && formattedValue}
        <span class="stat-separator">·</span>
        <span class="stat-text stat-value">{formattedValue}</span>
      {/if}
    {/if}
  </div>
</div>

<style>
  .collection-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* ─────────────────────────────────────────────────────────
   * TITLE
   * ───────────────────────────────────────────────────────── */
  .collection-title {
    font-family: var(--font-serif);
    font-size: 1.375rem;
    font-weight: 400;
    color: var(--text-primary);
    margin: 0;
    line-height: 1;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  /* ─────────────────────────────────────────────────────────
   * VIEW TOGGLE (CELLAR/ALL)
   * ───────────────────────────────────────────────────────── */
  .view-toggle {
    display: flex;
    background: var(--bg-subtle);
    border-radius: 6px;
    padding: 2px;
  }

  .view-btn {
    padding: 6px 12px;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .view-btn:hover:not(.active) {
    color: var(--text-secondary);
  }

  .view-btn.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .view-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─────────────────────────────────────────────────────────
   * STATS (right-aligned)
   * ───────────────────────────────────────────────────────── */
  .stats {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-left: auto;
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
   * MOBILE RESPONSIVE
   * ───────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .collection-title {
      font-size: 1.25rem;
    }

    .view-btn {
      padding: 5px 10px;
      font-size: 0.6875rem;
    }

    .stats {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 420px) {
    .collection-bar {
      flex-wrap: wrap;
    }

    .stats {
      width: 100%;
      margin-left: 0;
      margin-top: var(--space-1);
    }
  }
</style>
