<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { theme, viewDensity, viewMode, wines, winesLoading, winesError, filters, clearAllFilters, hasActiveFilters, hasSearchQuery, searchQuery, activeFilterCount, toasts, targetWineID, modal, cellarSortKey, cellarSortDir, sortWines, deleteStore, fetchWines } from '$stores';
  import type { Wine, WineFilters } from '$lib/api/types';

  // Import components
  import {
    Icon,
    RatingDisplay,
    BottleIndicators,
    WineGrid,
    Header
  } from '$lib/components';

  // Sort wines using cellar sort settings
  $: sortedWines = sortWines($wines, $cellarSortKey, $cellarSortDir);

  // Build filter params including bottleCount from viewMode
  function filtersWithViewMode(filterValues: WineFilters = {}): WineFilters {
    const bottleCountFilter: '0' | '1' = $viewMode === 'ourWines' ? '1' : '0';
    return { ...filterValues, bottleCount: bottleCountFilter };
  }

  // Track previous viewMode to detect changes
  let previousViewMode = $viewMode;

  onMount(() => {
    fetchWines(filtersWithViewMode($filters), true);
  });

  // Track previous filter state to detect changes
  let previousFilters = JSON.stringify($filters);

  // Refetch when viewMode changes (not on initial load) and clear filters
  $: if ($viewMode !== previousViewMode) {
    previousViewMode = $viewMode;
    clearAllFilters();
    previousFilters = JSON.stringify({});
    fetchWines(filtersWithViewMode({}), true);
  }

  // Refetch when filters change — debounced (WIN-206)
  $: {
    const currentFilters = JSON.stringify($filters);
    if (currentFilters !== previousFilters) {
      previousFilters = currentFilters;
      fetchWines(filtersWithViewMode($filters));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // Handle filter change event from Header (for legacy support)
  function handleFilterChange(event: CustomEvent<{ key: string; value: string | undefined }>) {
    // Filters already updated by store, reactive block handles refetch
  }

  // Track if we've already handled the scroll for this target
  let scrolledToWineID: number | null = null;

  // Scroll to target wine after wines load, then highlight
  $: if (!$winesLoading && $wines.length > 0 && $targetWineID && $targetWineID !== scrolledToWineID) {
    const wineIdToHighlight = $targetWineID;
    scrolledToWineID = wineIdToHighlight;

    // Clear targetWineID so highlight doesn't start before scroll
    targetWineID.set(null);

    // Use tick to ensure DOM is updated, then scroll
    tick().then(() => {
      setTimeout(() => {
        const targetCard = document.querySelector(`[data-wine-id="${wineIdToHighlight}"]`);
        const header = document.querySelector('.header');
        if (targetCard) {
          // Calculate scroll position accounting for fixed header
          const headerHeight = header?.getBoundingClientRect().height ?? 160;
          const cardTop = targetCard.getBoundingClientRect().top + window.scrollY;
          const scrollTarget = cardTop - headerHeight - 16; // 16px extra padding

          window.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
          });

          // After scroll completes (~600ms), trigger the highlight animation
          setTimeout(() => {
            targetWineID.set(wineIdToHighlight);
            // Clear targetWineID after animation is done (2s animation + buffer)
            setTimeout(() => {
              targetWineID.set(null);
              scrolledToWineID = null;
            }, 2500);
          }, 600);
        }
      }, 100); // Small delay to ensure cards are rendered
    });
  }

  // Placeholder handlers for header actions
  function handleSearch() {
    toasts.info('Search functionality coming soon!');
  }

  function handleMenu() {
    toasts.info('Menu functionality coming soon!');
  }

  // Action handlers for wine cards
  function handleDrink(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    // Check if wine has bottles
    if (wine.bottleCount <= 0) {
      toasts.info('No bottles available to drink');
      return;
    }
    modal.openDrink(wine);
  }

  function handleAdd(event: CustomEvent<{ wine: Wine }>) {
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

  function handleEdit(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    goto(`${base}/edit/${wine.wineID}`);
  }

  async function handleDelete(event: CustomEvent<{ wine: Wine }>) {
    const { wine } = event.detail;
    // Open delete confirmation modal with cascade impact
    modal.openDeleteConfirm('wine', wine.wineID, wine.wineName);
  }
</script>

<svelte:head>
  <title>Cellar | Qvé</title>
</svelte:head>

<!-- Fixed Header with Filters -->
<Header
  on:filterChange={handleFilterChange}
  on:search={handleSearch}
  on:menu={handleMenu}
/>

<main class="page-container">
  <!-- Wine Grid Section -->
  <section class="wine-section">
    {#if $winesLoading && $wines.length === 0}
      <!-- Only show loading state on initial load; view switches keep current grid visible -->
      <div class="loading-state">
        <p>Loading wines...</p>
      </div>
    {:else if $winesError}
      <div class="error-state">
        <p>Error: {$winesError}</p>
        <button on:click={() => location.reload()}>Retry</button>
      </div>
    {:else if !$winesLoading && $wines.length === 0}
      <div class="empty-state">
        {#if $hasActiveFilters}
          {#if $hasSearchQuery}
            <p>No wines match "{$searchQuery}"{#if $activeFilterCount > 1} with current filters{/if}</p>
          {:else}
            <p>No wines match current filters</p>
          {/if}
          <button class="clear-btn" on:click={clearAllFilters}>Clear All</button>
        {:else}
          <p>No wines in your collection yet.</p>
          <a href="{base}/add" class="btn-primary">Add Wine</a>
        {/if}
      </div>
    {:else}
      <WineGrid
        wines={sortedWines}
        on:drink={handleDrink}
        on:add={handleAdd}
        on:edit={handleEdit}
        on:delete={handleDelete}
      />
    {/if}
  </section>

  <!-- Phase Status (collapsed) -->
  <!-- <details class="status-details">
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
  </details> -->
</main>

<style>
  /* ─────────────────────────────────────────────────────────
   * PAGE LAYOUT
   * ───────────────────────────────────────────────────────── */
  .page-container {
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-6);
    min-height: 100vh;
    box-sizing: border-box;
  }

  @media (max-width: 479px) {
    .page-container {
      padding: var(--space-4);
    }
  }

  /* ─────────────────────────────────────────────────────────
   * WINE SECTION
   * ───────────────────────────────────────────────────────── */
  .wine-section {
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

  .error-state button,
  .empty-state .btn-primary,
  .empty-state .clear-btn {
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
  .empty-state .btn-primary:hover,
  .empty-state .clear-btn:hover {
    opacity: 0.9;
  }

</style>
