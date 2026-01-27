<script lang="ts">
  /**
   * Rating display component
   * Shows a colored dot + rating value, or "Unrated" if no rating
   * Optionally shows breakdown of overall and value ratings
   */
  export let rating: number | string | null = null;
  export let compact: boolean = false;
  export let showBreakdown: boolean = false;
  export let overallRating: number | null = null;
  export let valueRating: number | null = null;

  // Convert to number (PHP may return string)
  $: numericRating = rating !== null ? Number(rating) : null;
  $: numericOverall = overallRating !== null ? Number(overallRating) : null;
  $: numericValue = valueRating !== null ? Number(valueRating) : null;
  $: hasRating = numericRating !== null && !isNaN(numericRating) && numericRating > 0;
  $: hasBreakdown = showBreakdown && numericOverall !== null && numericValue !== null && !isNaN(numericOverall) && !isNaN(numericValue);
</script>

<div class="wine-rating" class:compact>
  {#if hasRating && numericRating !== null}
    <span class="rating-dot"></span>
    <span class="rating-value">{numericRating.toFixed(1)}</span>
    {#if hasBreakdown && numericOverall !== null && numericValue !== null}
      <span class="rating-breakdown">
        (Overall: {numericOverall.toFixed(1)}, Value: {numericValue.toFixed(1)})
      </span>
    {/if}
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

  .rating-breakdown {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-style: italic;
    margin-left: var(--space-1);
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

  .wine-rating.compact .rating-breakdown {
    display: none;
  }

  .wine-rating.compact .unrated {
    font-size: 0.625rem;
  }
</style>
