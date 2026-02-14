<script lang="ts">
  /**
   * WineGrid component
   * Responsive container that manages wine card layout and expanded state
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { viewDensity, expandedWineIDs, toggleWineExpanded, targetWineID } from '$lib/stores';
  import type { Wine } from '$lib/api/types';
  import WineCard from './WineCard.svelte';

  export let wines: Wine[] = [];

  // Disable entry animation after initial load to prevent flicker on view switches.
  // Cards fade in on first page load, then appear instantly on subsequent data changes.
  let initialAnimationDone = false;
  onMount(() => {
    // Allow the stagger animation to complete: max delay (350ms) + duration (700ms) + buffer
    setTimeout(() => { initialAnimationDone = true; }, 1100);
  });

  const dispatch = createEventDispatcher<{
    drink: { wine: Wine };
    add: { wine: Wine };
    edit: { wine: Wine };
    delete: { wine: Wine };
  }>();

  function handleToggleExpand(event: CustomEvent<{ wineID: number }>) {
    toggleWineExpanded(event.detail.wineID);
  }

  // Forward action events from WineCard
  function handleDrink(event: CustomEvent<{ wine: Wine }>) {
    dispatch('drink', event.detail);
  }

  function handleAdd(event: CustomEvent<{ wine: Wine }>) {
    dispatch('add', event.detail);
  }

  function handleEdit(event: CustomEvent<{ wine: Wine }>) {
    dispatch('edit', event.detail);
  }

  function handleDelete(event: CustomEvent<{ wine: Wine }>) {
    dispatch('delete', event.detail);
  }

  // Calculate stagger delay (max 350ms for smoother UX)
  function getStaggerDelay(index: number): string {
    return `${Math.min(index * 0.07, 0.35)}s`;
  }
</script>

<div
  class="wine-grid"
  class:view-compact={$viewDensity === 'compact'}
  class:view-medium={$viewDensity === 'medium'}
  class:no-entry-animation={initialAnimationDone}
>
  {#each wines as wine, index (wine.wineID)}
    <WineCard
      {wine}
      expanded={$expandedWineIDs.has(wine.wineID)}
      compact={$viewDensity === 'compact'}
      targetHighlight={$targetWineID != null && Number($targetWineID) === Number(wine.wineID)}
      on:expand={handleToggleExpand}
      on:collapse={handleToggleExpand}
      on:drink={handleDrink}
      on:add={handleAdd}
      on:edit={handleEdit}
      on:delete={handleDelete}
      --animation-delay={getStaggerDelay(index)}
    />
  {/each}
</div>

<style>
  /* ─────────────────────────────────────────────────────────
   * BASE GRID STYLES
   * ───────────────────────────────────────────────────────── */
  .wine-grid {
    width: 100%;
    transition: gap 0.3s var(--ease-out);
  }

  /* ─────────────────────────────────────────────────────────
   * MEDIUM VIEW (List Layout)
   * ───────────────────────────────────────────────────────── */
  .wine-grid.view-medium {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* ─────────────────────────────────────────────────────────
   * COMPACT VIEW (Grid Layout) - Mobile-first approach
   * ───────────────────────────────────────────────────────── */
  .wine-grid.view-compact {
    display: grid;
    grid-template-columns: repeat(2, calc((100% - var(--space-4)) / 2));
    gap: var(--space-4);
  }

  /* Expanded card spans full width in compact view */
  .wine-grid.view-compact :global(.wine-card.expanded) {
    grid-column: 1 / -1;
  }

  /* ─────────────────────────────────────────────────────────
   * RESPONSIVE COLUMN COUNTS (mobile-first)
   * Uses calc() instead of 1fr so all columns resolve to the
   * identical sub-pixel width — prevents aspect-ratio images
   * from rounding to different pixel heights across columns.
   * ───────────────────────────────────────────────────────── */
  @media (min-width: 560px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(3, calc((100% - 2 * var(--space-4)) / 3));
    }
  }

  @media (min-width: 768px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(4, calc((100% - 3 * var(--space-4)) / 4));
    }
  }

  @media (min-width: 992px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(5, calc((100% - 4 * var(--space-4)) / 5));
    }
  }

  @media (min-width: 1200px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(6, calc((100% - 5 * var(--space-4)) / 6));
    }
  }

  /* ─────────────────────────────────────────────────────────
   * STAGGER ANIMATION
   * Apply animation delay via CSS custom property.
   * Disabled after initial load to prevent flicker on view switches.
   * ───────────────────────────────────────────────────────── */
  .wine-grid :global(.wine-card) {
    animation-delay: var(--animation-delay, 0s);
  }

  .wine-grid.no-entry-animation :global(.wine-card) {
    animation: none;
  }
</style>
