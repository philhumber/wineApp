<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { api } from '$api';
  import type { DrunkWine } from '$lib/api/types';
  import {
    drunkWines,
    historyLoading,
    historyError,
    sortedDrunkWines,
    drunkWineCount,
    filteredDrunkWineCount,
    clearHistoryFilters,
    modal
  } from '$stores';

  // Track if we had an editRating modal open (to refresh on close)
  let wasEditingRating = false;

  // Import components
  import { Header, HistoryGrid } from '$lib/components';

  // Fetch drunk wines from API
  async function fetchDrunkWines() {
    historyLoading.set(true);
    historyError.set(null);
    try {
      const wines = await api.getDrunkWines();
      drunkWines.set(wines);
    } catch (e) {
      historyError.set(e instanceof Error ? e.message : 'Failed to load history');
      console.error('History API Error:', e);
    } finally {
      historyLoading.set(false);
    }
  }

  onMount(() => {
    fetchDrunkWines();
  });

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

  // Watch modal state - refresh history when editRating modal closes
  $: {
    if ($modal.type === 'editRating') {
      wasEditingRating = true;
    } else if (wasEditingRating && $modal.type === null) {
      // Modal just closed after editing, refresh history
      wasEditingRating = false;
      fetchDrunkWines();
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
    {#if $historyLoading}
      <div class="loading-state">
        <p>Loading history...</p>
      </div>
    {:else if $historyError}
      <div class="error-state">
        <p>Error: {$historyError}</p>
        <button on:click={() => fetchDrunkWines()}>Retry</button>
      </div>
    {:else if $drunkWineCount === 0}
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
      <HistoryGrid wines={$sortedDrunkWines} on:addBottle={handleAddBottle} on:editRating={handleEditRating} />
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
</style>
