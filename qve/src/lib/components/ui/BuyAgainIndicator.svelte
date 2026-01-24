<script lang="ts">
  /**
   * Buy Again indicator component
   * Shows percentage of ratings where user would buy again
   */
  export let percent: number | null | undefined = null;
  export let ratingCount: number = 0;
  export let compact: boolean = false;

  $: hasData = ratingCount > 0 && percent !== null && percent !== undefined;
  $: isPositive = (percent ?? 0) >= 50;
</script>

{#if hasData}
  <span class="buy-again" class:compact class:positive={isPositive} title="{percent}% would buy again">
    <span class="icon">{isPositive ? '✓' : '✗'}</span>
    <span class="value">{percent}%</span>
    {#if !compact}
      <span class="label">rebuy</span>
    {/if}
  </span>
{/if}

<style>
  .buy-again {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 6px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    background: var(--bg-subtle);
    border-radius: 4px;
    cursor: help;
  }

  .buy-again.positive {
    color: #5a8f5a;
    background: rgba(90, 143, 90, 0.1);
  }

  .buy-again:not(.positive) {
    color: #a05050;
    background: rgba(160, 80, 80, 0.1);
  }

  .icon {
    font-size: 0.625rem;
    font-weight: 600;
  }

  .value {
    font-weight: 500;
  }

  .label {
    font-size: 0.625rem;
    opacity: 0.8;
  }

  .buy-again.compact {
    font-size: 0.5625rem;
    padding: 1px 4px;
  }

  .buy-again.compact .icon {
    font-size: 0.5rem;
  }
</style>
