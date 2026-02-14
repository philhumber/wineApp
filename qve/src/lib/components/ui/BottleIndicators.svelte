<script lang="ts">
  /**
   * Bottle indicators component
   * Shows SVG bottle silhouettes grouped by size
   * Falls back to simple count in compact mode
   */

  // Size breakdown (from getWines.php aggregated counts)
  export let standardCount: number = 0;
  export let smallCount: number = 0;
  export let largeCount: number = 0;
  // Fallback: total count if no size breakdown available
  export let count: number = 0;
  export let compact: boolean = false;

  // Build display array from size counts or fallback
  $: hasSizeData = standardCount + smallCount + largeCount > 0;
  $: effectiveCount = hasSizeData
    ? standardCount + smallCount + largeCount
    : count;

  // Create ordered array: large first, then standard, then small
  type BottleSize = 'small' | 'standard' | 'large';
  $: displayBottles = hasSizeData
    ? [
        ...Array(largeCount).fill('large' as BottleSize),
        ...Array(standardCount).fill('standard' as BottleSize),
        ...Array(smallCount).fill('small' as BottleSize),
      ]
    : Array(count).fill('standard' as BottleSize);

  // Tooltip text
  $: tooltipParts = [
    largeCount > 0 ? `${largeCount} large` : '',
    standardCount > 0 ? `${standardCount} standard` : '',
    smallCount > 0 ? `${smallCount} small` : '',
  ].filter(Boolean);

  $: tooltipText = hasSizeData && tooltipParts.length > 1
    ? tooltipParts.join(', ')
    : `${effectiveCount} bottle${effectiveCount !== 1 ? 's' : ''}`;
</script>

{#if compact}
  <span class="bottle-count">{effectiveCount}</span>
{:else}
  <div class="bottle-indicators" title={tooltipText}>
    {#each displayBottles as size}
      {#if size === 'large'}
        <svg class="bottle-icon large" viewBox="0 0 14 36" aria-hidden="true">
          <!-- Magnum: wider body, taller. Neck 17% -->
          <path d="M4 0 h6 v2 h-1 v6 Q12 8 13 12 v20 Q13 36 12 36 H2 Q1 36 1 32 v-20 Q2 8 5 8 v-6 h-1 Z"/>
        </svg>
      {:else if size === 'standard'}
        <svg class="bottle-icon standard" viewBox="0 0 12 32" aria-hidden="true">
          <!-- Standard Bordeaux: short neck, high shoulders, wide body. Neck 19% -->
          <path d="M3.5 0 h5 v2 h-1 v6 Q10 8 11 12 v16 Q11 32 10 32 H2 Q1 32 1 28 v-16 Q2 8 4.5 8 v-6 h-1 Z"/>
        </svg>
      {:else}
        <svg class="bottle-icon small" viewBox="0 0 10 24" aria-hidden="true">
          <!-- Half bottle: shorter, same proportions. Neck 17% -->
          <path d="M3 0 h4 v1.5 h-.5 v4 Q8 5.5 9 8.5 v11.5 Q9 24 8 24 H2 Q1 24 1 20 v-11.5 Q2 5.5 3.5 5.5 v-4 H3 Z"/>
        </svg>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .bottle-indicators {
    display: flex;
    align-items: flex-end;
    gap: 2px;
  }

  .bottle-icon {
    fill: var(--accent);
    opacity: 0.75;
    transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
  }

  .bottle-icon:hover {
    opacity: 1;
    transform: translateY(-1px);
  }

  .bottle-icon.large {
    width: 12px;
    height: 28px;
  }

  .bottle-icon.standard {
    width: 8px;
    height: 22px;
  }

  .bottle-icon.small {
    width: 6px;
    height: 15px;
  }

  /* Compact view count */
  .bottle-count {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    letter-spacing: 0.02em;
  }

  .bottle-count::after {
    content: " btl";
  }
</style>
