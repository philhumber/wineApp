<script lang="ts">
  /**
   * HistoryCard component
   * Displays a drunk wine record with ratings, collapsed by default
   * Wine details expand on click, with Add Bottle action
   */
  import { createEventDispatcher } from 'svelte';
  import type { DrunkWine } from '$lib/api/types';
  import { Icon, RatingDisplay } from '$lib/components';
  import WineImage from './WineImage.svelte';
  import MiniRatingDots from '$lib/components/forms/MiniRatingDots.svelte';
  import {
    currentCurrency,
    availableCurrencies,
    formatPriceConverted
  } from '$lib/stores/currency';

  export let wine: DrunkWine;
  export let expanded: boolean = false;
  export let compact: boolean = false;

  const dispatch = createEventDispatcher<{
    expand: { key: string };
    collapse: { key: string };
    addBottle: { wine: DrunkWine };
  }>();

  // Unique key for this drunk wine entry (wineID + bottleID)
  $: cardKey = `${wine.wineID}-${wine.bottleID}`;

  function handleCardClick() {
    if (expanded) {
      dispatch('collapse', { key: cardKey });
    } else {
      dispatch('expand', { key: cardKey });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  }

  function handleAddBottle(event: MouseEvent) {
    event.stopPropagation();
    dispatch('addBottle', { wine });
  }

  // Convert country code to flag emoji (e.g., "FR" → "🇫🇷")
  function countryCodeToEmoji(code: string): string {
    if (!code || code.length !== 2) return '';
    const codePoints = [...code.toUpperCase()].map(
      (char) => 0x1f1e6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }

  // Format drink date for display
  function formatDrinkDate(dateStr: string | null): string {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // Formatted price for display - converts from original currency to display currency
  $: formattedPrice = formatPriceConverted(
    wine.bottlePrice,
    wine.bottleCurrency,
    $availableCurrencies,
    $currentCurrency
  );

  // Check if any optional ratings exist
  $: hasOptionalRatings =
    (wine.complexityRating && wine.complexityRating > 0) ||
    (wine.drinkabilityRating && wine.drinkabilityRating > 0) ||
    (wine.surpriseRating && wine.surpriseRating > 0) ||
    (wine.foodPairingRating && wine.foodPairingRating > 0);

  // Image path resolution
  $: imageSrc = wine.pictureURL ? `/${wine.pictureURL}` : null;

  // Country flag emoji from code
  $: countryEmoji = countryCodeToEmoji(wine.code);

  // Buy again as boolean (PHP returns 0/1 as number)
  $: buyAgain = wine.buyAgain === 1;
</script>

<article
  class="history-card"
  class:expanded
  class:compact
  data-wine-id={wine.wineID}
  data-bottle-id={wine.bottleID}
  on:click={handleCardClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-expanded={expanded}
>
  <!-- Type badge -->
  <span class="wine-type">{wine.wineType}</span>

  <!-- Drink date badge -->
  <span class="drink-date-badge">
    <Icon name="calendar" size={12} />
    {formatDrinkDate(wine.drinkDate)}
  </span>

  <!-- Image -->
  <WineImage src={imageSrc} alt="{wine.wineName} label" compact={compact && !expanded} />

  <!-- Details -->
  <div class="wine-details">
    <div class="wine-header">
      <h2 class="wine-name">{wine.wineName}</h2>
      <span class="wine-year">{wine.year || 'NV'}</span>
    </div>

    <div class="wine-divider"></div>

    <!-- Rating display (always visible) -->
    <div class="rating-section">
      <div class="rating-row">
        <span class="rating-label">Overall</span>
        <RatingDisplay rating={wine.overallRating} compact={compact && !expanded} />
      </div>
      <div class="rating-row">
        <span class="rating-label">Value</span>
        <RatingDisplay rating={wine.valueRating} compact={compact && !expanded} />
      </div>
    </div>

    <!-- Bottle size, price, and Buy Again -->
    <div class="wine-meta">
      <span class="bottle-size">{wine.bottleSize}</span>
      {#if formattedPrice}
        <span class="bottle-price">{formattedPrice}</span>
      {/if}
      <span class="buy-again" class:yes={buyAgain}>
        <Icon name={buyAgain ? 'check' : 'x'} size={12} />
        <span>{buyAgain ? 'Buy again' : 'Skip'}</span>
      </span>
    </div>
  </div>

  <!-- Add Bottle action button -->
  <div class="card-actions">
    <button class="action-btn" title="Add another bottle" on:click={handleAddBottle}>
      <Icon name="plus" size={14} />
      <span class="btn-text">Add Bottle</span>
    </button>
  </div>

  <!-- Expanded content (wine details) -->
  {#if expanded}
    <div class="history-expanded">
      <!-- Producer / Region / Country info -->
      <div class="wine-info-section">
        <p class="wine-producer">{wine.regionName} · {wine.producerName}</p>
        <p class="wine-location">
          <span>{wine.countryName}</span>
          <span class="wine-flag">{countryEmoji}</span>
        </p>
      </div>

      <!-- Optional ratings if present -->
      {#if hasOptionalRatings}
        <div class="optional-ratings-section">
          <h4>Additional Ratings</h4>
          <div class="optional-ratings-grid">
            {#if wine.complexityRating && wine.complexityRating > 0}
              <MiniRatingDots
                label="Complexity"
                icon="🎭"
                value={wine.complexityRating}
                disabled={true}
              />
            {/if}
            {#if wine.drinkabilityRating && wine.drinkabilityRating > 0}
              <MiniRatingDots
                label="Drinkability"
                icon="🥂"
                value={wine.drinkabilityRating}
                disabled={true}
              />
            {/if}
            {#if wine.surpriseRating && wine.surpriseRating > 0}
              <MiniRatingDots
                label="Surprise"
                icon="✨"
                value={wine.surpriseRating}
                disabled={true}
              />
            {/if}
            {#if wine.foodPairingRating && wine.foodPairingRating > 0}
              <MiniRatingDots
                label="Food Pairing"
                icon="🍽️"
                value={wine.foodPairingRating}
                disabled={true}
              />
            {/if}
          </div>
        </div>
      {/if}

      <!-- Tasting notes from drink event -->
      {#if wine.notes}
        <div class="notes-section">
          <h4>Tasting Notes (When Drunk)</h4>
          <p>{wine.notes}</p>
        </div>
      {/if}

      <!-- Wine details grid -->
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
  .history-card {
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

  .history-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--divider);
  }

  .history-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Expanded state */
  .history-card.expanded {
    flex-wrap: wrap;
  }

  /* ─────────────────────────────────────────────────────────
   * BADGES
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

  .drink-date-badge {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    padding: 4px 10px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-subtle);
    border-radius: 100px;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  /* ─────────────────────────────────────────────────────────
   * DETAILS SECTION
   * ───────────────────────────────────────────────────────── */
  .wine-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
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

  .history-card:hover .wine-divider {
    width: 56px;
  }

  /* ─────────────────────────────────────────────────────────
   * RATING SECTION
   * ───────────────────────────────────────────────────────── */
  .rating-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .rating-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .rating-label {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    min-width: 50px;
  }

  /* ─────────────────────────────────────────────────────────
   * META SECTION
   * ───────────────────────────────────────────────────────── */
  .wine-meta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-top: auto;
    padding-top: var(--space-3);
  }

  .bottle-size {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    padding: 2px 8px;
    background: var(--bg-subtle);
    border-radius: 4px;
  }

  .bottle-price {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 2px 8px;
    background: var(--bg-subtle);
    border-radius: 4px;
    font-weight: 500;
  }

  .buy-again {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-subtle);
  }

  .buy-again.yes {
    color: var(--rating-green, #7a8b6b);
  }

  /* ─────────────────────────────────────────────────────────
   * ACTION BUTTONS
   * ───────────────────────────────────────────────────────── */
  .card-actions {
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

  .history-card:hover .card-actions,
  .history-card.expanded .card-actions {
    opacity: 1;
    transform: translateY(0);
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 100px;
    border: 1px solid var(--divider);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    transition:
      background 0.2s var(--ease-out),
      color 0.2s var(--ease-out),
      border-color 0.2s var(--ease-out),
      transform 0.2s var(--ease-out);
  }

  .action-btn:hover {
    background: var(--bg-subtle);
    color: var(--text-primary);
    border-color: var(--accent);
    transform: scale(1.02);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─────────────────────────────────────────────────────────
   * EXPANDED CONTENT
   * ───────────────────────────────────────────────────────── */
  .history-expanded {
    width: 100%;
    padding-top: var(--space-5);
    border-top: 1px solid var(--divider-subtle);
    margin-top: var(--space-4);
    animation: expandIn 0.35s var(--ease-out);
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

  .wine-info-section {
    margin-bottom: var(--space-5);
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

  .optional-ratings-section {
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--bg-subtle);
    border-radius: 8px;
  }

  .optional-ratings-section h4 {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
    margin: 0 0 var(--space-3) 0;
  }

  .optional-ratings-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }

  .notes-section {
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--bg-subtle);
    border-radius: 8px;
    border-left: 3px solid var(--accent);
  }

  .notes-section h4 {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
    margin: 0 0 var(--space-2) 0;
  }

  .notes-section p {
    font-family: var(--font-serif);
    font-size: 0.9375rem;
    font-style: italic;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
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
  .history-card.compact {
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .history-card.compact .drink-date-badge {
    font-size: 0.5625rem;
    padding: 2px 6px;
  }

  .history-card.compact .wine-type {
    display: none;
  }

  .history-card.compact .wine-divider,
  .history-card.compact .card-actions {
    display: none;
  }

  .history-card.compact .wine-name {
    font-size: 0.875rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .history-card.compact .wine-year {
    font-size: 0.75rem;
  }

  .history-card.compact .rating-section {
    gap: var(--space-1);
  }

  .history-card.compact .rating-label {
    display: none;
  }

  .history-card.compact .wine-meta {
    padding-top: var(--space-2);
    gap: var(--space-2);
  }

  .history-card.compact .bottle-size,
  .history-card.compact .bottle-price,
  .history-card.compact .buy-again {
    font-size: 0.625rem;
    padding: 1px 4px;
  }

  /* ─────────────────────────────────────────────────────────
   * COMPACT + EXPANDED
   * ───────────────────────────────────────────────────────── */
  .history-card.compact.expanded {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .history-card.compact.expanded .wine-type,
  .history-card.compact.expanded .wine-divider,
  .history-card.compact.expanded .card-actions {
    display: flex;
  }

  .history-card.compact.expanded .wine-divider {
    display: block;
  }

  .history-card.compact.expanded .wine-name {
    font-size: 1.5rem;
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
  }

  .history-card.compact.expanded .wine-year {
    font-size: 0.875rem;
  }

  .history-card.compact.expanded .rating-label {
    display: inline;
  }

  .history-card.compact.expanded .rating-section {
    gap: var(--space-2);
  }

  .history-card.compact.expanded .wine-meta {
    padding-top: var(--space-3);
    gap: var(--space-4);
  }

  .history-card.compact.expanded .bottle-size,
  .history-card.compact.expanded .bottle-price,
  .history-card.compact.expanded .buy-again {
    font-size: 0.75rem;
    padding: 2px 8px;
  }

  /* ─────────────────────────────────────────────────────────
   * RESPONSIVE ADJUSTMENTS
   * ───────────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .history-card:not(.compact) {
      flex-direction: column;
    }

    .history-card:not(.compact) :global(.wine-image-container) {
      width: 100%;
      height: 200px;
    }

    .expanded-grid {
      grid-template-columns: 1fr;
    }

    .optional-ratings-grid {
      grid-template-columns: 1fr;
    }

    .action-btn .btn-text {
      display: none;
    }
  }
</style>
