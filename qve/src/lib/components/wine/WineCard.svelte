<script lang="ts">
  /**
   * WineCard component
   * Displays a single wine with expand/collapse, hover actions, and responsive layouts
   */
  import { createEventDispatcher } from 'svelte';
  import type { Wine } from '$lib/api/types';
  import { Icon, RatingDisplay, BottleIndicators, PriceScale, BuyAgainIndicator } from '$lib/components';
  import { modal } from '$lib/stores';
  import WineImage from './WineImage.svelte';

  export let wine: Wine;
  export let expanded: boolean = false;
  export let compact: boolean = false;
  export let targetHighlight: boolean = false;

  const dispatch = createEventDispatcher<{
    expand: { wineID: number };
    collapse: { wineID: number };
    drink: { wine: Wine };
    add: { wine: Wine };
    edit: { wine: Wine };
  }>();

  function handleCardClick() {
    if (expanded) {
      dispatch('collapse', { wineID: wine.wineID });
    } else {
      dispatch('expand', { wineID: wine.wineID });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  }

  function handleAction(action: 'drink' | 'add' | 'edit', event: MouseEvent) {
    event.stopPropagation();
    dispatch(action, { wine });
  }

  function handleImageClick(event: CustomEvent) {
    // Stop propagation to prevent card from collapsing
    event.stopPropagation();
    if (expanded && imageSrc) {
      modal.openImageLightbox(imageSrc, `${wine.wineName} ${wine.year || 'NV'}`);
    }
  }

  // Convert country code to flag emoji (e.g., "FR" → "🇫🇷")
  function countryCodeToEmoji(code: string): string {
    if (!code || code.length !== 2) return '';
    const codePoints = [...code.toUpperCase()].map(
      char => 0x1F1E6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }

  // Image path resolution (PHP returns path like "images/wines/...")
  $: imageSrc = wine.pictureURL
    ? `/${wine.pictureURL}`
    : null;

  // Country flag emoji from code
  $: countryEmoji = countryCodeToEmoji(wine.code);

  // Format price with currency symbol
  function formatPrice(price: string | null | undefined, currency: string | null | undefined): string | null {
    if (!price) return null;
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice === 0) return null;
    const symbols: Record<string, string> = {
      EUR: '€', GBP: '£', USD: '$', SEK: 'kr ', CHF: 'CHF '
    };
    const symbol = currency ? (symbols[currency] || currency + ' ') : '€';
    return `${symbol}${numPrice.toFixed(2)}`;
  }

  // Check if any price data exists
  $: hasPriceData = wine.standardPrice || wine.magnumPrice || wine.demiPrice || wine.smallPrice;
</script>

<article
  class="wine-card"
  class:expanded
  class:compact
  class:target-highlight={targetHighlight}
  data-wine-id={wine.wineID}
  on:click={handleCardClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-expanded={expanded}
>
  <!-- Type badge -->
  <span class="wine-type">{wine.wineType}</span>

  <!-- Image -->
  <WineImage
    src={imageSrc}
    alt="{wine.wineName} label"
    compact={compact && !expanded}
    clickable={expanded && !!imageSrc}
    on:click={handleImageClick}
  />

  <!-- Details -->
  <div class="wine-details">
    <div class="wine-header">
      <h2 class="wine-name">{wine.wineName}</h2>
      <span class="wine-year">{wine.year || 'NV'}</span>
    </div>

    <div class="wine-divider"></div>

    <p class="wine-producer">{wine.regionName} · {wine.producerName}</p>
    <p class="wine-location">
      <span>{wine.countryName}</span>
      <span class="wine-flag">{countryEmoji}</span>
    </p>

    <div class="wine-meta">
      <BottleIndicators count={wine.bottleCount} compact={compact && !expanded} />
      <PriceScale
        avgPricePerLiterEUR={wine.avgPricePerLiterEUR}
        typeAvgPricePerLiterEUR={wine.typeAvgPricePerLiterEUR}
        compact={compact && !expanded}
      />
      <RatingDisplay
        rating={wine.avgRating}
        compact={compact && !expanded}
        showBreakdown={expanded && !!wine.avgOverallRating && !!wine.avgValueRating}
        overallRating={wine.avgOverallRating}
        valueRating={wine.avgValueRating}
      />
      <BuyAgainIndicator
        percent={wine.buyAgainPercent}
        ratingCount={wine.ratingCount || 0}
        compact={compact && !expanded}
      />
    </div>
  </div>

  <!-- Action buttons -->
  <div class="wine-actions">
    <button
      class="action-btn"
      title="Drink"
      on:click={(e) => handleAction('drink', e)}
    >
      <Icon name="drink" size={14} />
    </button>
    <button
      class="action-btn"
      title="Add Bottle"
      on:click={(e) => handleAction('add', e)}
    >
      <Icon name="plus" size={14} />
    </button>
    <button
      class="action-btn"
      title="Edit"
      on:click={(e) => handleAction('edit', e)}
    >
      <Icon name="edit" size={14} />
    </button>
  </div>

  <!-- Expanded content -->
  {#if expanded}
    <div class="wine-expanded">
      <!-- Details Row: Sources + Prices -->
      {#if wine.bottleSources || hasPriceData}
        <div class="expanded-details-row">
          <!-- Bottle Sources as pills -->
          {#if wine.bottleSources}
            <div class="detail-group">
              <span class="detail-label">Source</span>
              <div class="source-pills">
                {#each wine.bottleSources.split(', ').filter(Boolean) as source}
                  <span class="source-pill">{source}</span>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Average Prices -->
          {#if hasPriceData}
            <div class="detail-group">
              <span class="detail-label">Avg Price</span>
              <div class="price-items">
            {#if wine.standardPrice}
              <span class="price-item">
                <span class="size">Std</span>
                <span class="amount">{formatPrice(wine.standardPrice, wine.currency)}</span>
              </span>
            {/if}
            {#if wine.magnumPrice}
              <span class="price-item">
                <span class="size">Mag</span>
                <span class="amount">{formatPrice(wine.magnumPrice, wine.currency)}</span>
              </span>
            {/if}
            {#if wine.demiPrice}
              <span class="price-item">
                <span class="size">Half</span>
                <span class="amount">{formatPrice(wine.demiPrice, wine.currency)}</span>
              </span>
            {/if}
            {#if wine.smallPrice}
              <span class="price-item">
                <span class="size">Small</span>
                <span class="amount">{formatPrice(wine.smallPrice, wine.currency)}</span>
              </span>
            {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="expanded-grid">
        <div class="expanded-section">
          <h4>Description</h4>
          <p>{wine.description || 'No description available.'}</p>
        </div>
        <div class="expanded-section">
          <h4>Tasting Notes</h4>
          <p>{wine.tastingNotes || 'No tasting notes available.'}</p>
        </div>
        <div class="expanded-section">
          <h4>Pairing</h4>
          <p>{wine.pairing || 'No pairing suggestions available.'}</p>
        </div>
      </div>
    </div>
  {/if}
</article>

<style>
  /* ─────────────────────────────────────────────────────────
   * BASE CARD STYLES
   * ───────────────────────────────────────────────────────── */
  .wine-card {
    position: relative;
    display: flex;
    gap: var(--space-6);
    padding: var(--space-6);
    background: var(--surface);
    border-radius: 8px;
    border: 1px solid var(--divider-subtle);
    cursor: pointer;
    transition:
      box-shadow 0.3s var(--ease-out),
      border-color 0.3s var(--ease-out),
      transform 0.3s var(--ease-out);
    animation: fadeInUp 0.7s var(--ease-out) forwards;
  }

  .wine-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--divider);
  }

  .wine-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Expanded state */
  .wine-card.expanded {
    flex-wrap: wrap;
  }

  /* Target highlight for scroll-to-wine - only uses highlightPulse
     to avoid overwriting fadeInUp which would restart and flash the card */
  .wine-card.target-highlight {
    animation: highlightPulse 2s var(--ease-out) forwards;
  }

  @keyframes highlightPulse {
    0% {
      border-color: var(--divider-subtle);
      box-shadow: none;
    }
    15%, 85% {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-subtle, rgba(166, 155, 138, 0.2));
    }
    100% {
      border-color: var(--divider-subtle);
      box-shadow: none;
    }
  }

  /* ─────────────────────────────────────────────────────────
   * TYPE BADGE
   * ───────────────────────────────────────────────────────── */
  .wine-type {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    padding: 2px 8px;
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    background: var(--bg-subtle);
    border-radius: 100px;
  }

  /* ─────────────────────────────────────────────────────────
   * DETAILS SECTION
   * ───────────────────────────────────────────────────────── */
  .wine-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Prevent flex overflow */
  }

  .wine-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .wine-name {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .wine-year {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .wine-divider {
    width: 40px;
    height: 1px;
    background: var(--accent);
    margin: var(--space-3) 0;
    transition: width 0.3s var(--ease-out);
  }

  .wine-card:hover .wine-divider {
    width: 56px;
  }

  .wine-producer {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    color: var(--text-secondary);
    margin: 0 0 var(--space-1) 0;
  }

  .wine-location {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .wine-flag {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .wine-meta {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-top: auto;
    padding-top: var(--space-4);
  }

  /* ─────────────────────────────────────────────────────────
   * ACTION BUTTONS
   * ───────────────────────────────────────────────────────── */
  .wine-actions {
    position: absolute;
    bottom: var(--space-4);
    right: var(--space-4);
    display: flex;
    gap: 2px;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.25s var(--ease-out),
      transform 0.25s var(--ease-out);
  }

  .wine-card:hover .wine-actions,
  .wine-card.expanded .wine-actions {
    opacity: 1;
    transform: translateY(0);
  }

  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--divider);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s var(--ease-out),
      color 0.2s var(--ease-out),
      border-color 0.2s var(--ease-out),
      transform 0.2s var(--ease-out);
  }

  .action-btn:hover {
    background: var(--surface);
    color: var(--text-primary);
    border-color: var(--accent);
    transform: scale(1.05);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─────────────────────────────────────────────────────────
   * EXPANDED CONTENT
   * ───────────────────────────────────────────────────────── */
  .wine-expanded {
    width: 100%;
    padding-top: var(--space-5);
    border-top: 1px solid var(--divider-subtle);
    margin-top: var(--space-4);
    animation: expandIn 0.35s var(--ease-out);
  }

  /* Expanded Details Row */
  .expanded-details-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--divider-subtle);
  }

  .detail-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .detail-label {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
  }

  /* Source Pills */
  .source-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .source-pill {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg-subtle);
    border-radius: 100px;
  }

  /* Price Items */
  .price-items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .price-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-subtle);
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 0.75rem;
  }

  .price-item .size {
    color: var(--text-tertiary);
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.625rem;
    letter-spacing: 0.05em;
  }

  .price-item .amount {
    color: var(--text-secondary);
    font-weight: 500;
  }

  @keyframes expandIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .expanded-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-5);
  }

  .expanded-section h4 {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
    margin: 0 0 var(--space-2) 0;
  }

  .expanded-section p {
    font-family: var(--font-serif);
    font-size: 0.9375rem;
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  /* ─────────────────────────────────────────────────────────
   * COMPACT VIEW STYLES
   * ───────────────────────────────────────────────────────── */
  .wine-card.compact {
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .wine-card.compact .wine-type,
  .wine-card.compact .wine-divider,
  .wine-card.compact .wine-producer,
  .wine-card.compact .wine-location,
  .wine-card.compact .wine-actions {
    display: none;
  }

  .wine-card.compact .wine-name {
    font-size: 0.875rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wine-card.compact .wine-year {
    font-size: 0.75rem;
  }

  .wine-card.compact .wine-meta {
    padding-top: var(--space-2);
    gap: var(--space-3);
  }

  /* ─────────────────────────────────────────────────────────
   * COMPACT + EXPANDED (Full-width in grid)
   * ───────────────────────────────────────────────────────── */
  .wine-card.compact.expanded {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .wine-card.compact.expanded .wine-type,
  .wine-card.compact.expanded .wine-divider,
  .wine-card.compact.expanded .wine-producer,
  .wine-card.compact.expanded .wine-location,
  .wine-card.compact.expanded .wine-actions {
    display: flex;
  }

  .wine-card.compact.expanded .wine-divider {
    display: block;
  }

  .wine-card.compact.expanded .wine-name {
    font-size: 1.5rem;
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
  }

  .wine-card.compact.expanded .wine-year {
    font-size: 0.875rem;
  }

  .wine-card.compact.expanded .wine-meta {
    padding-top: var(--space-4);
    gap: var(--space-5);
  }

  /* ─────────────────────────────────────────────────────────
   * RESPONSIVE ADJUSTMENTS
   * ───────────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .wine-card:not(.compact) {
      flex-direction: column;
    }

    .wine-card:not(.compact) :global(.wine-image-container) {
      width: 100%;
      height: auto;
      aspect-ratio: 1;
    }

    .expanded-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
