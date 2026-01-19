<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { theme, viewDensity, viewMode, wines, winesLoading, winesError, filters, toasts } from '$stores';
  import { api } from '$api';
  import type { Wine, WineFilters } from '$lib/api/types';

  // Import components
  import {
    Icon,
    RatingDisplay,
    BottleIndicators,
    WineGrid,
    Header
  } from '$lib/components';

  // Fetch wines with current filters
  async function fetchWines(filterValues: WineFilters = {}) {
    winesLoading.set(true);
    winesError.set(null);
    try {
      // Always include bottleCount: '1' to show only wines with bottles
      const wineList = await api.getWines({ ...filterValues, bottleCount: '1' });
      wines.set(wineList);
    } catch (e) {
      winesError.set(e instanceof Error ? e.message : 'Failed to connect to API');
      console.error('API Error:', e);
    } finally {
      winesLoading.set(false);
    }
  }

  onMount(() => {
    fetchWines($filters);
  });

  // Refetch when filters change
  function handleFilterChange(event: CustomEvent<{ key: string; value: string | undefined }>) {
    fetchWines($filters);
  }

  // Placeholder handlers for header actions
  function handleSearch() {
    toasts.info('Search functionality coming soon!');
  }

  function handleMenu() {
    toasts.info('Menu functionality coming soon!');
  }

  // Action handlers for wine cards (placeholders until pages are built)
  function handleDrink(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    // TODO: Navigate to drink/rate page or open modal
    toasts.info(`Drink: ${wine.wineName} ${wine.year || 'NV'} - coming soon!`);
  }

  function handleAdd(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    // TODO: Open add bottle modal
    toasts.info(`Add bottle to ${wine.wineName} - coming soon!`);
  }

  function handleEdit(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    // TODO: Navigate to edit page
    toasts.info(`Edit: ${wine.wineName} - coming soon!`);
  }
</script>

<!-- Fixed Header with Filters -->
<Header
  on:filterChange={handleFilterChange}
  on:search={handleSearch}
  on:menu={handleMenu}
/>

<main class="page-container">
  <!-- Wine Grid Section -->
  <section class="wine-section">
    <div class="section-header">
      <h2 class="section-title">
        {$viewMode === 'ourWines' ? 'Our Wines' : 'All Wines'}
      </h2>
      <span class="wine-count">
        {#if $winesLoading}
          Loading...
        {:else}
          {$wines.length} wines
        {/if}
      </span>
    </div>

    {#if $winesLoading}
      <div class="loading-state">
        <p>Loading wines...</p>
      </div>
    {:else if $winesError}
      <div class="error-state">
        <p>Error: {$winesError}</p>
        <button on:click={() => location.reload()}>Retry</button>
      </div>
    {:else if $wines.length === 0}
      <div class="empty-state">
        <p>No wines in your collection yet.</p>
        <a href="{base}/add" class="btn-primary">Add Wine</a>
      </div>
    {:else}
      <WineGrid
        wines={$wines}
        on:drink={handleDrink}
        on:add={handleAdd}
        on:edit={handleEdit}
      />
    {/if}
  </section>

  <!-- Phase Status (collapsed) -->
  <details class="status-details">
    <summary>Phase 2 Wave 3 Status</summary>

    <div class="status-grid">
      <div class="status-card">
        <span class="status-label">API</span>
        <span class="status-value" class:error={!!$winesError}>
          {#if $winesLoading}
            Connecting...
          {:else if $winesError}
            {$winesError}
          {:else}
            Connected - {$wines.length} wines
          {/if}
        </span>
      </div>

      <div class="status-card">
        <span class="status-label">Theme</span>
        <span class="status-value">{$theme}</span>
      </div>

      <div class="status-card">
        <span class="status-label">View</span>
        <span class="status-value">{$viewDensity}</span>
      </div>

      <div class="status-card">
        <span class="status-label">Filter</span>
        <span class="status-value">{$filters.typesDropdown || 'All'}</span>
      </div>
    </div>

    <div class="component-showcase">
      <h3>All Icons</h3>
      <div class="icon-showcase">
        <Icon name="sun" size={18} />
        <Icon name="moon" size={18} />
        <Icon name="grid" size={18} />
        <Icon name="list" size={18} />
        <Icon name="search" size={18} />
        <Icon name="menu" size={18} />
        <Icon name="plus" size={18} />
        <Icon name="edit" size={18} />
        <Icon name="drink" size={18} />
        <Icon name="check" size={18} />
        <Icon name="x" size={18} />
        <Icon name="info" size={18} />
        <Icon name="warning" size={18} />
        <Icon name="chevron-down" size={18} />
      </div>
      <div class="rating-showcase">
        <RatingDisplay rating={8.5} />
        <RatingDisplay rating={null} />
        <BottleIndicators count={3} />
      </div>
    </div>

    <div class="toast-test">
      <h3>Toast Tests</h3>
      <div class="toast-buttons">
        <button on:click={() => toasts.success('Wine added successfully!')}>Success</button>
        <button on:click={() => toasts.error('Failed to save changes')}>Error</button>
        <button on:click={() => toasts.warning('Low stock warning')}>Warning</button>
        <button on:click={() => toasts.info('Tip: Click a card to expand')}>Info</button>
        <button on:click={() => toasts.undo('Bottle removed', () => console.log('Undo!'))}>Undo</button>
      </div>
    </div>

    <nav class="route-list">
      <h3>Routes</h3>
      <a href="{base}/add">/add</a>
      <a href="{base}/history">/history</a>
      <a href="{base}/edit/1">/edit/[id]</a>
      <a href="{base}/drink/1">/drink/[id]</a>
    </nav>
  </details>
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
   * WINE SECTION
   * ───────────────────────────────────────────────────────── */
  .wine-section {
    margin-bottom: var(--space-8);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-5);
  }

  .section-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text-primary);
    margin: 0;
  }

  .wine-count {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
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

  .error-state button,
  .empty-state .btn-primary {
    margin-top: var(--space-4);
    padding: var(--space-2) var(--space-5);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 100px;
    cursor: pointer;
    transition: opacity 0.2s var(--ease-out);
  }

  .error-state button:hover,
  .empty-state .btn-primary:hover {
    opacity: 0.9;
  }

  /* ─────────────────────────────────────────────────────────
   * STATUS DETAILS (Collapsed)
   * ───────────────────────────────────────────────────────── */
  .status-details {
    margin-top: var(--space-8);
    padding: var(--space-4);
    background: var(--bg-subtle);
    border-radius: 8px;
  }

  .status-details summary {
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    padding: var(--space-2);
  }

  .status-details[open] summary {
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--divider);
    padding-bottom: var(--space-3);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  @media (max-width: 600px) {
    .status-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .status-card {
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .status-label {
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
  }

  .status-value {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .status-value.error {
    color: var(--error);
    font-size: 0.75rem;
  }

  .component-showcase {
    margin-bottom: var(--space-4);
  }

  .component-showcase h3 {
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-3);
  }

  .icon-showcase {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .rating-showcase {
    display: flex;
    gap: var(--space-5);
  }

  .route-list h3 {
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
  }

  .route-list a {
    display: inline-block;
    margin-right: var(--space-3);
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--accent);
  }

  .route-list a:hover {
    text-decoration: underline;
  }

  .toast-test {
    margin-bottom: var(--space-4);
  }

  .toast-test h3 {
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-3);
  }

  .toast-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .toast-buttons button {
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s var(--ease-out);
  }

  .toast-buttons button:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
</style>
