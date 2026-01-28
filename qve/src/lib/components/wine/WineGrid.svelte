<script lang="ts">
  /**
   * WineGrid component
   * Responsive container that manages wine card layout and expanded state
   */
  import { createEventDispatcher } from 'svelte';
  import { viewDensity, expandedWineID, targetWineID } from '$lib/stores';
  import type { Wine } from '$lib/api/types';
  import WineCard from './WineCard.svelte';

  export let wines: Wine[] = [];

  const dispatch = createEventDispatcher<{
    drink: { wine: Wine };
    add: { wine: Wine };
    edit: { wine: Wine };
  }>();

  function handleExpand(event: CustomEvent<{ wineID: number }>) {
    const { wineID } = event.detail;
    expandedWineID.set(wineID);
  }

  function handleCollapse() {
    expandedWineID.set(null);
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

  // Calculate stagger delay (max 350ms for smoother UX)
  function getStaggerDelay(index: number): string {
    return `${Math.min(index * 0.07, 0.35)}s`;
  }
</script>

<div
  class="wine-grid"
  class:view-compact={$viewDensity === 'compact'}
  class:view-medium={$viewDensity === 'medium'}
>
  {#each wines as wine, index (wine.wineID)}
    <WineCard
      {wine}
      expanded={$expandedWineID === wine.wineID}
      compact={$viewDensity === 'compact'}
      targetHighlight={$targetWineID === wine.wineID}
      on:expand={handleExpand}
      on:collapse={handleCollapse}
      on:drink={handleDrink}
      on:add={handleAdd}
      on:edit={handleEdit}
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
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }

  /* Expanded card spans full width in compact view */
  .wine-grid.view-compact :global(.wine-card.expanded) {
    grid-column: 1 / -1;
  }

  /* ─────────────────────────────────────────────────────────
   * RESPONSIVE COLUMN COUNTS (mobile-first)
   * ───────────────────────────────────────────────────────── */
  @media (min-width: 560px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 768px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 992px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  @media (min-width: 1200px) {
    .wine-grid.view-compact {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  /* ─────────────────────────────────────────────────────────
   * STAGGER ANIMATION
   * Apply animation delay via CSS custom property
   * ───────────────────────────────────────────────────────── */
  .wine-grid :global(.wine-card) {
    animation-delay: var(--animation-delay, 0s);
  }
</style>
