<script lang="ts">
  /**
   * Price scale indicator component
   * Shows $-$$$$$ based on wine price vs type average
   * Algorithm from original app (cards.js)
   */
  export let avgPricePerLiterEUR: string | null | undefined = null;
  export let typeAvgPricePerLiterEUR: string | null | undefined = null;
  export let compact: boolean = false;

  const labels = ['', 'Budget', 'Value', 'Average', 'Premium', 'Luxury'];

  function calculateScale(avg: string | null | undefined, typeAvg: string | null | undefined): number | null {
    const avgNum = parseFloat(avg || '');
    const typeAvgNum = parseFloat(typeAvg || '');
    if (!avgNum || !typeAvgNum || typeAvgNum === 0) return null;

    const ratio = avgNum / typeAvgNum;
    if (ratio < 0.5) return 1;      // $ - Budget
    if (ratio < 0.8) return 2;      // $$ - Value
    if (ratio < 1.2) return 3;      // $$$ - Average
    if (ratio < 1.8) return 4;      // $$$$ - Premium
    return 5;                        // $$$$$ - Luxury
  }

  $: scale = calculateScale(avgPricePerLiterEUR, typeAvgPricePerLiterEUR);
</script>

{#if scale !== null}
  <span class="price-scale scale-{scale}" class:compact title={labels[scale]}>
    {'$'.repeat(scale)}
  </span>
{:else}
  <span class="price-scale no-data" class:compact title="No price data">—</span>
{/if}

<style>
  .price-scale {
    display: inline-block;
    padding: 2px 6px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: 4px;
    cursor: help;
  }

  .scale-1 { color: #4a7c59; background: rgba(74, 124, 89, 0.1); }
  .scale-2 { color: #5a8f5a; background: rgba(90, 143, 90, 0.1); }
  .scale-3 { color: #8b7355; background: rgba(139, 115, 85, 0.1); }
  .scale-4 { color: #a0522d; background: rgba(160, 82, 45, 0.1); }
  .scale-5 { color: #722f37; background: rgba(114, 47, 55, 0.15); }
  .no-data { color: var(--text-tertiary); background: var(--bg-subtle); }

  .price-scale.compact {
    font-size: 0.5625rem;
    padding: 1px 4px;
  }
</style>
