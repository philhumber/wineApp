<script lang="ts">
  /**
   * Rating display component
   * Shows a colored dot + rating value, or "Unrated" if no rating
   */
  export let rating: number | null = null;
  export let compact: boolean = false;
</script>

<div class="wine-rating" class:compact>
  {#if rating !== null && rating > 0}
    <span class="rating-dot"></span>
    <span class="rating-value">{rating.toFixed(1)}</span>
  {:else}
    <span class="unrated">Unrated</span>
  {/if}
</div>

<style>
  .wine-rating {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  .rating-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.6;
  }

  .rating-value {
    font-weight: 400;
    color: var(--text-secondary);
  }

  .unrated {
    color: var(--text-tertiary);
    font-style: italic;
    font-size: 0.75rem;
  }

  /* Compact view styling */
  .wine-rating.compact {
    font-size: 0.6875rem;
  }

  .wine-rating.compact .rating-dot {
    width: 2px;
    height: 2px;
  }

  .wine-rating.compact .unrated {
    font-size: 0.625rem;
  }
</style>
