<!--
  DrinkRateModal Component
  Modal for rating a bottle of wine

  Design follows: design/qve-rebrand/qve-drink-rate-mockup.html
-->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { drinkWine, isDirty, canSubmit, modal, updateWineInList, scrollToWine, collapseWine } from '$lib/stores';
  import { viewMode } from '$lib/stores/view';
  import { api } from '$lib/api';
  import { RatingDots, MiniRatingDots, ToggleSwitch } from '$lib/components/forms';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { Wine, DrunkWine } from '$lib/api/types';

  // Props - either wine (new rating) or drunkWine (edit mode)
  export let wine: Wine | undefined = undefined;
  export let drunkWine: DrunkWine | undefined = undefined;
  export let isEdit: boolean = false;

  const dispatch = createEventDispatcher<{ close: void; confirm: void; rated: { isEdit: boolean } }>();

  let showConfirmClose = false;

  onMount(async () => {
    if (isEdit && drunkWine) {
      drinkWine.initEdit(drunkWine);
    } else if (wine) {
      await drinkWine.init(wine);
    }
  });

  function handleClose() {
    if ($isDirty) {
      showConfirmClose = true;
    } else {
      dispatch('close');
    }
  }

  function handleConfirmClose() {
    showConfirmClose = false;
    drinkWine.reset();
    dispatch('close');
  }

  function handleCancelClose() {
    showConfirmClose = false;
  }

  async function handleSubmit() {
    const result = await drinkWine.submit();
    if (result.success) {
      if (result.isEdit) {
        // Edit mode - dispatch rated event for history refresh
        dispatch('rated', { isEdit: true });
      } else {
        // New rating - update wine in list and handle view switching
        if (result.wineID) {
          // Fetch updated wine data from API (includes new rating, bottle count, etc.)
          const updatedWine = await api.getWine(result.wineID);

          if (updatedWine) {
            // Update wine in store with fresh data
            updateWineInList(result.wineID, updatedWine);

            // If last bottle was drunk, switch to All Wines view
            if (updatedWine.bottleCount === 0) {
              viewMode.set('allWines');
            }
          }

          // Collapse this wine's card and scroll to it
          collapseWine(result.wineID);
          scrollToWine(result.wineID);
        }
      }
      drinkWine.reset();
      dispatch('close');
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !showConfirmClose) {
      handleClose();
    }
  }

  // Format bottle for dropdown display: Size - Source (if present) - Date (if present)
  function formatBottle(bottle: { bottleSize: string; bottleSource?: string | null; purchaseDate?: string | null }): string {
    const parts: string[] = [bottle.bottleSize || 'Unknown size'];

    // Only add source if it exists and is not empty
    const source = bottle.bottleSource?.trim();
    if (source) {
      parts.push(source);
    }

    // Only add date if it exists
    if (bottle.purchaseDate) {
      const date = new Date(bottle.purchaseDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      parts.push(date);
    }

    return parts.join(' - ');
  }

  // Resolve image path (PHP returns path like "images/wines/...")
  $: imageSrc = (wine?.pictureURL || drunkWine?.pictureURL)
    ? `/${wine?.pictureURL || drunkWine?.pictureURL}`
    : null;

  // Get wine display name (from either wine or drunkWine)
  $: displayName = wine?.wineName || drunkWine?.wineName || '';
  $: displayYear = wine?.year || drunkWine?.year;
  $: displayRegion = wine?.regionName || drunkWine?.regionName || '';
  $: displayCountry = wine?.countryName || drunkWine?.countryName || '';

  $: state = $drinkWine;

  // Show food pairing reminder when user has rated food pairing
  $: showFoodPairingReminder = state.foodPairingRating > 0;
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if showConfirmClose}
  <!-- Confirm close dialog -->
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="confirm-overlay" on:click={() => (showConfirmClose = false)}>
    <div class="confirm-content" role="alertdialog" aria-modal="true">
      <div class="confirm-body">
        <h3 class="confirm-title">Discard changes?</h3>
        <p class="confirm-message">You have unsaved changes. Are you sure you want to close?</p>
      </div>
      <div class="confirm-footer">
        <button type="button" class="btn btn-secondary" on:click={handleCancelClose}>
          Keep editing
        </button>
        <button type="button" class="btn btn-danger" on:click={handleConfirmClose}>
          Discard
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Main modal -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleBackdropClick}>
  <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <!-- Header -->
    <div class="modal-header">
      <h2 id="modal-title" class="modal-title">{$drinkWine.isEditMode ? 'Edit Rating' : 'Rate that wine!'}</h2>
      <button type="button" class="modal-close" aria-label="Close" on:click={handleClose}>
        <Icon name="close" size={16} />
      </button>
    </div>

    <!-- Body -->
    <div class="modal-body">
      <!-- Wine Info Card -->
      <div class="wine-info">
        <div class="wine-info-image">
          {#if imageSrc}
            <img src={imageSrc} alt={displayName} />
          {:else}
            <Icon name="drink" size={24} />
          {/if}
        </div>
        <div class="wine-info-details">
          <div class="wine-info-name">
            {displayName}
            {#if displayYear}
              <span class="wine-year">{displayYear}</span>
            {/if}
          </div>
          <div class="wine-info-meta">{displayRegion} · {displayCountry}</div>
        </div>
      </div>

      <!-- Bottle Selector (hidden in edit mode) -->
      {#if !$drinkWine.isEditMode}
        <div class="form-group">
          <label class="form-label" for="bottle-select">Which Bottle?</label>
          {#if state.isLoading}
            <div class="loading-placeholder">Loading bottles...</div>
          {:else if state.availableBottles.length === 0}
            <div class="no-bottles">No bottles available</div>
          {:else}
            <select
              id="bottle-select"
              class="form-select"
              value={state.bottleID ?? ''}
              on:change={(e) => drinkWine.selectBottle(Number(e.currentTarget.value))}
            >
              <option value="" disabled>Select a bottle...</option>
              {#each state.availableBottles as bottle}
                <option value={bottle.bottleID}>
                  {formatBottle(bottle)}
                </option>
              {/each}
            </select>
          {/if}
          {#if state.errors.bottleID}
            <span class="form-error">{state.errors.bottleID}</span>
          {/if}
        </div>
      {/if}

      <!-- Main Ratings Row -->
      <div class="ratings-row">
        <RatingDots
          label="Overall"
          icon="🍷"
          value={state.overallRating}
          variant="wine"
          on:change={(e) => drinkWine.setOverallRating(e.detail)}
        />
        <RatingDots
          label="Value"
          icon="💰"
          value={state.valueRating}
          variant="value"
          on:change={(e) => drinkWine.setValueRating(e.detail)}
        />
      </div>

      <!-- More Ratings (Collapsible) -->
      <div class="more-ratings-section">
        <button
          type="button"
          class="more-ratings-toggle"
          aria-expanded={state.showMoreRatings}
          on:click={() => drinkWine.toggleMoreRatings()}
        >
          <Icon name={state.showMoreRatings ? 'chevron-down' : 'chevron-right'} size={14} />
          <span>More ratings (optional)</span>
        </button>

        {#if state.showMoreRatings}
          <div class="more-ratings-content">
            <MiniRatingDots
              label="Complexity"
              icon="🎭"
              value={state.complexityRating}
              on:change={(e) => drinkWine.setOptionalRating('complexity', e.detail)}
            />
            <MiniRatingDots
              label="Drinkability"
              icon="🍷"
              value={state.drinkabilityRating}
              on:change={(e) => drinkWine.setOptionalRating('drinkability', e.detail)}
            />
            <MiniRatingDots
              label="Surprise"
              icon="✨"
              value={state.surpriseRating}
              on:change={(e) => drinkWine.setOptionalRating('surprise', e.detail)}
            />
            <MiniRatingDots
              label="Food Pairing"
              icon="🍽️"
              value={state.foodPairingRating}
              on:change={(e) => drinkWine.setOptionalRating('foodPairing', e.detail)}
            />
          </div>
        {/if}
      </div>

      <!-- Date & Buy Again Row -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="drink-date">Drink Date</label>
          <input
            type="date"
            id="drink-date"
            class="form-input"
            value={state.drinkDate}
            on:change={(e) => drinkWine.setDrinkDate(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label class="form-label">Buy Again?</label>
          <ToggleSwitch
            checked={state.buyAgain}
            label={state.buyAgain ? 'Yes' : 'No'}
            on:change={() => drinkWine.toggleBuyAgain()}
          />
        </div>
      </div>

      <!-- Tasting Notes -->
      <div class="form-group">
        <label class="form-label" for="tasting-notes">Tasting Notes</label>
        <textarea
          id="tasting-notes"
          class="form-textarea"
          class:food-pairing-hint={showFoodPairingReminder}
          placeholder="How was it? What did you taste?"
          value={state.notes}
          on:input={(e) => drinkWine.setNotes(e.currentTarget.value)}
        ></textarea>
        {#if showFoodPairingReminder}
          <div class="food-pairing-reminder">
            <span class="reminder-icon">🍽️</span>
            <span class="reminder-text">You rated the food pairing - describe what you paired it with!</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer -->
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleClose}>
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={!$canSubmit || state.isSubmitting}
        on:click={handleSubmit}
      >
        {#if state.isSubmitting}
          {$drinkWine.isEditMode ? 'Updating...' : 'Rating...'}
        {:else}
          {$drinkWine.isEditMode ? 'Update' : 'Rate!'}
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(45, 41, 38, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4, 1rem);
    animation: fadeIn 0.3s var(--ease-out, ease-out);
  }

  :global([data-theme='dark']) .modal-overlay {
    background: rgba(12, 11, 10, 0.8);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: var(--surface, #ffffff);
    border-radius: 16px;
    box-shadow: var(--shadow-xl, 0 20px 40px rgba(45, 41, 38, 0.12));
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.35s var(--ease-out, ease-out);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5, 1.5rem) var(--space-6, 2rem);
    border-bottom: 1px solid var(--divider-subtle, #f0ede8);
  }

  .modal-title {
    font-family: var(--font-serif, Georgia);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text-primary, #2d2926);
    margin: 0;
  }

  .modal-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: var(--bg-subtle, #f5f3f0);
    cursor: pointer;
    transition: all 0.2s var(--ease-out, ease-out);
    color: var(--text-tertiary, #8a847d);
  }

  .modal-close:hover {
    background: var(--divider, #e8e4de);
    color: var(--text-primary, #2d2926);
  }

  /* Body */
  .modal-body {
    padding: var(--space-6, 2rem);
  }

  /* Wine Info Card */
  .wine-info {
    display: flex;
    align-items: center;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 8px;
    margin-bottom: var(--space-5, 1.5rem);
  }

  .wine-info-image {
    width: 48px;
    height: 64px;
    background: var(--divider-subtle, #f0ede8);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--accent, #a69b8a);
    flex-shrink: 0;
  }

  .wine-info-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .wine-info-details {
    flex: 1;
    min-width: 0;
  }

  .wine-info-name {
    font-family: var(--font-serif, Georgia);
    font-size: 1.125rem;
    color: var(--text-primary, #2d2926);
    line-height: 1.3;
  }

  .wine-year {
    font-family: var(--font-sans, system-ui);
    font-size: 0.875rem;
    color: var(--text-tertiary, #8a847d);
  }

  .wine-info-meta {
    font-size: 0.8125rem;
    color: var(--text-tertiary, #8a847d);
    margin-top: 2px;
  }

  /* Form Elements */
  .form-group {
    margin-bottom: var(--space-5, 1.5rem);
  }

  .form-label {
    display: block;
    font-family: var(--font-sans, system-ui);
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-tertiary, #8a847d);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .form-select,
  .form-input {
    width: 100%;
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    font-family: var(--font-sans, system-ui);
    font-size: 0.9375rem;
    color: var(--text-primary, #2d2926);
    background: var(--bg-subtle, #f5f3f0);
    border: 1px solid var(--divider, #e8e4de);
    border-radius: 8px;
    outline: none;
    transition: all 0.2s var(--ease-out, ease-out);
  }

  .form-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A847D' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-4, 1rem) center;
    padding-right: var(--space-10, 4rem);
  }

  .form-select:focus,
  .form-input:focus {
    border-color: var(--accent, #a69b8a);
    background-color: var(--surface, #ffffff);
  }

  .form-textarea {
    width: 100%;
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    font-family: var(--font-sans, system-ui);
    font-size: 0.9375rem;
    color: var(--text-primary, #2d2926);
    background: var(--bg-subtle, #f5f3f0);
    border: 1px solid var(--divider, #e8e4de);
    border-radius: 8px;
    outline: none;
    resize: vertical;
    min-height: 80px;
    line-height: 1.6;
    transition: all 0.2s var(--ease-out, ease-out);
  }

  .form-textarea:focus {
    border-color: var(--accent, #a69b8a);
    background: var(--surface, #ffffff);
  }

  .form-textarea::placeholder {
    color: var(--text-tertiary, #8a847d);
  }

  .form-textarea.food-pairing-hint {
    border-color: var(--accent-warm, #c4a87c);
  }

  .form-textarea.food-pairing-hint::placeholder {
    color: var(--accent-warm, #c4a87c);
  }

  .food-pairing-reminder {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-top: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    background: linear-gradient(135deg, rgba(196, 168, 124, 0.1) 0%, rgba(196, 168, 124, 0.05) 100%);
    border-radius: 6px;
    border-left: 3px solid var(--accent-warm, #c4a87c);
    animation: fadeIn 0.3s var(--ease-out, ease-out);
  }

  .reminder-icon {
    font-size: 1rem;
  }

  .reminder-text {
    font-size: 0.8125rem;
    color: var(--text-secondary, #5c5652);
  }

  .form-error {
    display: block;
    font-size: 0.75rem;
    color: var(--error, #b87a7a);
    margin-top: var(--space-1, 0.25rem);
  }

  .loading-placeholder,
  .no-bottles {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    font-size: 0.875rem;
    color: var(--text-tertiary, #8a847d);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 8px;
    text-align: center;
  }

  /* Ratings Row */
  .ratings-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6, 2rem);
    margin-bottom: var(--space-5, 1.5rem);
  }

  /* More Ratings Section */
  .more-ratings-section {
    margin-bottom: var(--space-5, 1.5rem);
  }

  .more-ratings-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) 0;
    font-family: var(--font-sans, system-ui);
    font-size: 0.8125rem;
    color: var(--text-tertiary, #8a847d);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s var(--ease-out, ease-out);
  }

  .more-ratings-toggle:hover {
    color: var(--text-secondary, #5c5652);
  }

  .more-ratings-content {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 8px;
    margin-top: var(--space-2, 0.5rem);
  }

  /* Date & Toggle Row */
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4, 1rem);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-5, 1.5rem) var(--space-6, 2rem);
    border-top: 1px solid var(--divider-subtle, #f0ede8);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 0 0 16px 16px;
  }

  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem) var(--space-5, 1.5rem);
    font-family: var(--font-sans, system-ui);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out, ease-out);
  }

  .btn-secondary {
    color: var(--text-secondary, #5c5652);
    background: transparent;
    border: 1px solid var(--divider, #e8e4de);
  }

  .btn-secondary:hover {
    border-color: var(--text-tertiary, #8a847d);
    color: var(--text-primary, #2d2926);
  }

  .btn-primary {
    color: var(--bg, #faf9f7);
    background: var(--text-primary, #2d2926);
    border: 1px solid var(--text-primary, #2d2926);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--text-secondary, #5c5652);
    border-color: var(--text-secondary, #5c5652);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent, #a69b8a);
    outline-offset: 2px;
  }

  /* Confirm Dialog */
  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(45, 41, 38, 0.4);
    backdrop-filter: blur(4px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4, 1rem);
    animation: fadeIn 0.2s var(--ease-out, ease-out);
  }

  .confirm-content {
    background: var(--surface, #ffffff);
    border-radius: 12px;
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(45, 41, 38, 0.06));
    width: 100%;
    max-width: 360px;
    animation: scaleIn 0.2s var(--ease-out, ease-out);
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .confirm-body {
    padding: var(--space-6, 2rem);
    text-align: center;
  }

  .confirm-title {
    font-family: var(--font-serif, Georgia);
    font-size: 1.125rem;
    font-weight: 400;
    color: var(--text-primary, #2d2926);
    margin: 0 0 var(--space-2, 0.5rem) 0;
  }

  .confirm-message {
    font-size: 0.875rem;
    color: var(--text-secondary, #5c5652);
    margin: 0;
  }

  .confirm-footer {
    display: flex;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem) var(--space-5, 1.5rem);
    border-top: 1px solid var(--divider-subtle, #f0ede8);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 0 0 12px 12px;
  }

  .btn-danger {
    background: var(--error, #b87a7a);
    border-color: var(--error, #b87a7a);
    color: white;
  }

  .btn-danger:hover {
    background: #a06a6a;
    border-color: #a06a6a;
  }

  /* Responsive */
  @media (max-width: 520px) {
    .modal-content {
      max-height: 100vh;
      border-radius: 16px 16px 0 0;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 100%;
    }

    .modal-overlay {
      align-items: flex-end;
      padding: 0;
    }

    .form-row,
    .ratings-row {
      grid-template-columns: 1fr;
    }
  }
</style>
