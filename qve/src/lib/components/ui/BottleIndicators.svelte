<script lang="ts">
  /**
   * Bottle indicators component
   * Shows SVG bottle silhouettes grouped by size
   * Falls back to simple count in compact mode
   */
  import type { Bottle } from '$lib/api/types';

  export let bottles: Bottle[] = [];
  export let count: number = 0;
  export let compact: boolean = false;

  // If no bottles array provided, use count
  $: effectiveCount = bottles.length > 0 ? bottles.length : count;

  // Group bottles by size
  type BottleSize = 'small' | 'standard' | 'large';

  interface BottleGroup {
    size: BottleSize;
    count: number;
  }

  function getBottleSize(sizeString: string): BottleSize {
    const smallSizes = ['Piccolo', 'Quarter', 'Demi', '375ml', '187ml', '200ml'];
    const largeSizes = ['Magnum', 'Jeroboam', 'Rehoboam', 'Methuselah', '1.5L', '3L', '4.5L', '6L'];

    const upperSize = sizeString.toUpperCase();
    if (smallSizes.some(s => upperSize.includes(s.toUpperCase()))) return 'small';
    if (largeSizes.some(s => upperSize.includes(s.toUpperCase()))) return 'large';
    return 'standard';
  }

  // Group bottles by size
  $: bottleGroups = bottles.reduce<BottleGroup[]>((acc, bottle) => {
    const size = getBottleSize(bottle.bottleSize || '750ml');
    const existing = acc.find(g => g.size === size);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ size, count: 1 });
    }
    return acc;
  }, []);

  // Sort by size (large first) and create individual bottle entries
  $: sortedBottles = bottleGroups
    .sort((a, b) => {
      const order = { large: 0, standard: 1, small: 2 };
      return order[a.size] - order[b.size];
    })
    .flatMap(group => Array(group.count).fill(group.size));

  // If no bottles data, create standard bottles from count
  $: displayBottles = sortedBottles.length > 0
    ? sortedBottles
    : Array(effectiveCount).fill('standard');

  // Title text for tooltip
  $: tooltipText = bottleGroups.length > 0
    ? bottleGroups.map(g => `${g.count} ${g.size}`).join(', ')
    : `${effectiveCount} bottle${effectiveCount !== 1 ? 's' : ''}`;
</script>

{#if compact}
  <!-- Compact view: just show count -->
  <span class="bottle-count">{effectiveCount}</span>
{:else}
  <!-- Full view: show bottle silhouettes -->
  <div class="bottle-indicators" title={tooltipText}>
    {#each displayBottles as size}
      {#if size === 'large'}
        <svg class="bottle-icon large" viewBox="0 0 10 32">
          <path d="M3 0h4v3c2 1 3 3 3 6v20c0 2-1 3-3 3H3c-2 0-3-1-3-3V9c0-3 1-5 3-6V0z"/>
        </svg>
      {:else if size === 'standard'}
        <svg class="bottle-icon standard" viewBox="0 0 8 24">
          <path d="M2.5 0h3v2.5c1.5 0.8 2.5 2 2.5 4.5v14c0 1.5-1 3-2.5 3h-3c-1.5 0-2.5-1.5-2.5-3V7c0-2.5 1-3.7 2.5-4.5V0z"/>
        </svg>
      {:else}
        <svg class="bottle-icon small" viewBox="0 0 6 16">
          <path d="M2 0h2v1.5c1 0.5 2 1.5 2 3v9.5c0 1-0.5 2-1.5 2h-3c-1 0-1.5-1-1.5-2V4.5c0-1.5 1-2.5 2-3V0z"/>
        </svg>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .bottle-indicators {
    display: flex;
    align-items: flex-end;
    gap: 3px;
  }

  .bottle-icon {
    fill: var(--accent);
    opacity: 0.7;
    transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
  }

  .bottle-icon:hover {
    opacity: 1;
    transform: translateY(-1px);
  }

  .bottle-icon.large {
    width: 9px;
    height: 30px;
  }

  .bottle-icon.standard {
    width: 7px;
    height: 22px;
  }

  .bottle-icon.small {
    width: 5px;
    height: 14px;
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
