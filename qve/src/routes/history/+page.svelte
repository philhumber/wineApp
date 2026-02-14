<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import type { DrunkWine } from '$lib/api/types';
  import {
    drunkWines,
    historyLoading,
    historyError,
    sortedDrunkWines,
    drunkWineCount,
    filteredDrunkWineCount,
    clearHistoryFilters,
    modal,
    deleteStore,
    // WIN-205: Server-side pagination
    historyPagination,
    historyFilters,
    historySortKey,
    historySortDir,
    fetchHistory
  } from '$stores';

  // Track if we had an editRating modal open (to refresh on close)
  let wasEditingRating = false;

  // Track initialization to avoid double-fetch on mount
  let initialized = false;

  // Track previous filter/sort state to detect actual changes (WIN-206)
  let previousHistoryState = '';
  let previousHistoryFilters = '';

  // Import components
  import { Header, HistoryGrid } from '$lib/components';

  onMount(() => {
    previousHistoryState = JSON.stringify({ f: $historyFilters, sk: $historySortKey, sd: $historySortDir });
    previousHistoryFilters = JSON.stringify($historyFilters);
    fetchHistory(1, true);
    initialized = true;
  });

  // WIN-205/WIN-206: Reactive refetch on filter/sort change — debounced
  $: if (initialized) {
    const currentState = JSON.stringify({ f: $historyFilters, sk: $historySortKey, sd: $historySortDir });
    if (currentState !== previousHistoryState) {
      const currentFilterStr = JSON.stringify($historyFilters);
      const filtersChanged = currentFilterStr !== previousHistoryFilters;
      previousHistoryState = currentState;
      previousHistoryFilters = currentFilterStr;
      fetchHistory(1);
      if (filtersChanged && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // Handle Add Bottle action from history card
  function handleAddBottle(event: CustomEvent<{ wine: DrunkWine }>) {
    const { wine } = event.detail;
    modal.openAddBottle(
      wine.wineID,
      wine.wineName,
      wine.pictureURL,
      wine.year,
      wine.regionName,
      wine.countryName
    );
  }

  // Handle Edit Rating action from history card
  function handleEditRating(event: CustomEvent<{ wine: DrunkWine }>) {
    const { wine } = event.detail;
    modal.openEditRating(wine);
  }

  // Handle Delete Rating action from history card
  function handleDeleteRating(event: CustomEvent<{ wine: DrunkWine }>) {
    const { wine } = event.detail;
    // Use simple confirmation modal for history deletion
    modal.confirm({
      title: 'Delete this rating?',
      message: `Remove this rating and history for "${wine.wineName}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        modal.close();
        // Start pending delete with undo timer
        deleteStore.startDelete('bottle', wine.bottleID, wine.wineName, { drunkWine: wine });
        // Remove from local state immediately
        drunkWines.update(wines => wines.filter(w => w.bottleID !== wine.bottleID));
      },
      onCancel: () => {
        modal.close();
      }
    });
  }

  // Watch modal state - refresh history when editRating modal closes
  $: {
    if ($modal.type === 'editRating') {
      wasEditingRating = true;
    } else if (wasEditingRating && $modal.type === null) {
      // Modal just closed after editing, refresh history (stay on current page)
      wasEditingRating = false;
      fetchHistory();
    }
  }
</script>

<svelte:head>
  <title>History | Qvé</title>
</svelte:head>

<!-- Header with History Filters -->
<Header filterType="history" />

<main class="page-container">
  <!-- History Section -->
  <section class="history-section">
    <!-- Three-state UI -->
    {#if $historyLoading && $drunkWineCount === 0}
      <!-- Only show loading state on initial load; filter/sort changes keep current grid visible -->
      <div class="loading-state">
        <p>Loading history...</p>
      </div>
    {:else if $historyError}
      <div class="error-state">
        <p>Error: {$historyError}</p>
        <button on:click={() => fetchHistory(1)}>Retry</button>
      </div>
    {:else if !$historyLoading && $drunkWineCount === 0}
      <div class="empty-state">
        <div class="empty-icon">🍷</div>
        <h3>No wines consumed yet</h3>
        <p>When you drink a wine and rate it, it will appear here.</p>
        <a href="{base}/" class="btn-primary">Back to Collection</a>
      </div>
    {:else if $filteredDrunkWineCount === 0}
      <div class="empty-state">
        <h3>No matches</h3>
        <p>No wines match your current filters.</p>
        <button class="btn-secondary" on:click={clearHistoryFilters}>
          Clear Filters
        </button>
      </div>
    {:else}
      <HistoryGrid wines={$sortedDrunkWines} on:addBottle={handleAddBottle} on:editRating={handleEditRating} on:deleteRating={handleDeleteRating} />

      <!-- WIN-205: Pagination controls -->
      {#if $historyPagination.totalPages > 1}
        <nav class="pagination" aria-label="History pages">
          <button
            class="pagination-btn"
            disabled={$historyPagination.page <= 1}
            on:click={() => fetchHistory($historyPagination.page - 1)}
          >
            Previous
          </button>
          <span class="page-indicator">
            {$historyPagination.page} of {$historyPagination.totalPages}
          </span>
          <button
            class="pagination-btn"
            disabled={$historyPagination.page >= $historyPagination.totalPages}
            on:click={() => fetchHistory($historyPagination.page + 1)}
          >
            Next
          </button>
        </nav>
      {/if}
    {/if}
  </section>
</main>

<style>
  /* ─────────────────────────────────────────────────────────
   * PAGE LAYOUT
   * ───────────────────────────────────────────────────────── */
  .page-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-6);
    min-height: 100vh;
  }

  /* ─────────────────────────────────────────────────────────
   * HISTORY SECTION
   * ───────────────────────────────────────────────────────── */
  .history-section {
    margin-bottom: var(--space-8);
  }

  /* ─────────────────────────────────────────────────────────
   * STATES
   * ───────────────────────────────────────────────────────── */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12);
    text-align: center;
    color: var(--text-tertiary);
    background: var(--surface);
    border: 1px solid var(--divider-subtle);
    border-radius: 8px;
  }

  .error-state {
    color: var(--error);
  }

  .empty-state .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-4);
    opacity: 0.5;
  }

  .empty-state h3 {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-secondary);
    margin: 0 0 var(--space-2) 0;
  }

  .empty-state p {
    margin: 0 0 var(--space-5) 0;
  }

  .error-state button,
  .btn-primary,
  .btn-secondary {
    padding: var(--space-2) var(--space-5);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    border-radius: 100px;
    cursor: pointer;
    transition: opacity 0.2s var(--ease-out);
    text-decoration: none;
  }

  .btn-primary {
    background: var(--text-primary);
    color: var(--bg);
    border: none;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--divider);
  }

  .btn-secondary:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .error-state button {
    margin-top: var(--space-4);
    background: var(--accent);
    color: white;
    border: none;
  }

  .error-state button:hover {
    opacity: 0.9;
  }

  /* ─────────────────────────────────────────────────────────
   * PAGINATION (WIN-205)
   * ───────────────────────────────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-6);
    padding: var(--space-4) 0;
  }

  .pagination-btn {
    padding: var(--space-2) var(--space-5);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    border-radius: 100px;
    cursor: pointer;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--divider);
    transition:
      border-color 0.2s var(--ease-out),
      color 0.2s var(--ease-out),
      opacity 0.2s var(--ease-out);
  }

  .pagination-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .page-indicator {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }
</style>
