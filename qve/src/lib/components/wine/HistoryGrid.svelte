<script lang="ts">
  /**
   * HistoryGrid component
   * Responsive container that manages history card layout and expanded state
   */
  import { createEventDispatcher } from 'svelte';
  import { viewDensity, expandedHistoryKey, getDrunkWineKey } from '$lib/stores';
  import type { DrunkWine } from '$lib/api/types';
  import HistoryCard from './HistoryCard.svelte';

  export let wines: DrunkWine[] = [];

  const dispatch = createEventDispatcher<{
    addBottle: { wine: DrunkWine };
  }>();

  function handleExpand(event: CustomEvent<{ key: string }>) {
    const { key } = event.detail;
    expandedHistoryKey.set(key);
  }

  function handleCollapse() {
    expandedHistoryKey.set(null);
  }

  // Forward addBottle event from HistoryCard
  function handleAddBottle(event: CustomEvent<{ wine: DrunkWine }>) {
    dispatch('addBottle', event.detail);
  }

  // Calculate stagger delay (max 350ms for smoother UX)
  function getStaggerDelay(index: number): string {
    return `${Math.min(index * 0.07, 0.35)}s`;
  }
</script>

<div
  class="history-grid"
  class:view-compact={$viewDensity === 'compact'}
  class:view-medium={$viewDensity === 'medium'}
>
  {#each wines as wine, index (getDrunkWineKey(wine))}
    {@const cardKey = getDrunkWineKey(wine)}
    <HistoryCard
      {wine}
      expanded={$expandedHistoryKey === cardKey}
      compact={$viewDensity === 'compact'}
      on:expand={handleExpand}
      on:collapse={handleCollapse}
      on:addBottle={handleAddBottle}
      --animation-delay={getStaggerDelay(index)}
    />
  {/each}
</div>

<style>
  /* ─────────────────────────────────────────────────────────
   * BASE GRID STYLES
   * ───────────────────────────────────────────────────────── */
  .history-grid {
    width: 100%;
    transition: gap 0.3s var(--ease-out);
  }

  /* ─────────────────────────────────────────────────────────
   * MEDIUM VIEW (List Layout)
   * ───────────────────────────────────────────────────────── */
  .history-grid.view-medium {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* ─────────────────────────────────────────────────────────
   * COMPACT VIEW (Grid Layout)
   * ───────────────────────────────────────────────────────── */
  .history-grid.view-compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-4);
  }

  /* Expanded card spans full width in compact view */
  .history-grid.view-compact :global(.history-card.expanded) {
    grid-column: 1 / -1;
  }

  /* ─────────────────────────────────────────────────────────
   * RESPONSIVE COLUMN COUNTS
   * ───────────────────────────────────────────────────────── */
  @media (min-width: 1200px) {
    .history-grid.view-compact {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  @media (min-width: 992px) and (max-width: 1199px) {
    .history-grid.view-compact {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  @media (min-width: 768px) and (max-width: 991px) {
    .history-grid.view-compact {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 480px) and (max-width: 767px) {
    .history-grid.view-compact {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 479px) {
    .history-grid.view-compact {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* ─────────────────────────────────────────────────────────
   * STAGGER ANIMATION
   * Apply animation delay via CSS custom property
   * ───────────────────────────────────────────────────────── */
  .history-grid :global(.history-card) {
    animation-delay: var(--animation-delay, 0s);
  }
</style>
