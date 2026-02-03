<!--
  AddBottleModal Component
  Modal for adding bottles to an existing wine

  Design follows: design/qve-rebrand/qve-add-bottle-mockup.html
-->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    addBottle,
    isDirtyAddBottle,
    canSubmitAddBottle,
    incrementBottleCount,
    scrollToWine,
    collapseWine,
    bottleSizeSelectOptions,
    storageOptions,
    currencySelectOptions,
    modal
  } from '$lib/stores';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let wineID: number;
  export let wineName: string;
  export let pictureURL: string | null | undefined = null;
  export let year: string | null | undefined = null;
  export let regionName: string | undefined = undefined;
  export let countryName: string | undefined = undefined;

  // Resolve image path (PHP returns path like "images/wines/...")
  $: imageSrc = pictureURL ? `/${pictureURL}` : null;

  const dispatch = createEventDispatcher<{ close: void }>();

  onMount(() => {
    addBottle.init(wineID, wineName);

    // Register dirty check hook for stacked confirmation
    modal.registerBeforeCloseHook(() => ({
      dirty: $isDirtyAddBottle,
      confirmation: {
        title: 'Discard changes?',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger'
      },
      onConfirm: () => {
        addBottle.reset();
      }
    }));
  });

  onDestroy(() => {
    modal.clearBeforeCloseHook();
  });

  function handleClose() {
    modal.requestClose();
  }

  async function handleSubmit() {
    const result = await addBottle.submit();
    if (result.success) {
      // Increment bottle count in wines list
      if (result.wineID && result.count > 0) {
        incrementBottleCount(result.wineID, result.count);
        // Collapse this wine's card and scroll to it
        collapseWine(result.wineID);
        scrollToWine(result.wineID);
      }
      addBottle.reset();
      dispatch('close');
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  $: state = $addBottle;
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Main modal -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleBackdropClick}>
  <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <!-- Header -->
    <div class="modal-header">
      <h2 id="modal-title" class="modal-title">Add Bottle</h2>
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
            <img src={imageSrc} alt={wineName} />
          {:else}
            <Icon name="drink" size={24} />
          {/if}
        </div>
        <div class="wine-info-details">
          <div class="wine-info-name">
            {wineName}
            {#if year}
              <span class="wine-year">{year}</span>
            {/if}
          </div>
          {#if regionName || countryName}
            <div class="wine-info-meta">
              {#if regionName}{regionName}{/if}{#if regionName && countryName} · {/if}{#if countryName}{countryName}{/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Row 1: Bottle Size, Storage Location -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="bottle-size">
            Bottle Size <span class="required">*</span>
          </label>
          <select
            id="bottle-size"
            class="form-select"
            class:has-error={state.errors.bottleSize}
            value={state.bottleSize}
            on:change={(e) => addBottle.setField('bottleSize', e.currentTarget.value)}
          >
            <option value="">Select size...</option>
            {#each $bottleSizeSelectOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if state.errors.bottleSize}
            <span class="form-error">{state.errors.bottleSize}</span>
          {/if}
        </div>

        <div class="form-group">
          <label class="form-label" for="storage-location">
            Storage Location <span class="required">*</span>
          </label>
          <select
            id="storage-location"
            class="form-select"
            class:has-error={state.errors.storageLocation}
            value={state.storageLocation}
            on:change={(e) => addBottle.setField('storageLocation', e.currentTarget.value)}
          >
            <option value="">Select location...</option>
            {#each storageOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if state.errors.storageLocation}
            <span class="form-error">{state.errors.storageLocation}</span>
          {/if}
        </div>
      </div>

      <!-- Row 2: Source -->
      <div class="form-group">
        <label class="form-label" for="source">
          Source <span class="required">*</span>
        </label>
        <input
          type="text"
          id="source"
          class="form-input"
          class:has-error={state.errors.source}
          placeholder="e.g., Waitrose, Majestic, Gift..."
          value={state.source}
          on:input={(e) => addBottle.setField('source', e.currentTarget.value)}
        />
        {#if state.errors.source}
          <span class="form-error">{state.errors.source}</span>
        {/if}
      </div>

      <!-- Row 3: Price, Currency -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="price">Price</label>
          <input
            type="number"
            id="price"
            class="form-input"
            placeholder="e.g., 45.00"
            step="0.01"
            min="0"
            value={state.price}
            on:input={(e) => addBottle.setField('price', e.currentTarget.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="currency">
            Currency <span class="required">*</span>
          </label>
          <select
            id="currency"
            class="form-select"
            class:has-error={state.errors.currency}
            value={state.currency}
            on:change={(e) => addBottle.setField('currency', e.currentTarget.value)}
          >
            {#each $currencySelectOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if state.errors.currency}
            <span class="form-error">{state.errors.currency}</span>
          {/if}
        </div>
      </div>

      <!-- Row 4: Purchase Date, Quantity -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="purchase-date">Purchase Date</label>
          <input
            type="date"
            id="purchase-date"
            class="form-input"
            value={state.purchaseDate}
            on:change={(e) => addBottle.setField('purchaseDate', e.currentTarget.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="quantity">Quantity</label>
          <div class="quantity-stepper">
            <button
              type="button"
              class="stepper-btn"
              aria-label="Decrease quantity"
              disabled={state.quantity <= 1}
              on:click={() => addBottle.setField('quantity', Math.max(1, state.quantity - 1))}
            >
              <Icon name="minus" size={16} />
            </button>
            <span class="stepper-value" id="quantity">{state.quantity}</span>
            <button
              type="button"
              class="stepper-btn"
              aria-label="Increase quantity"
              disabled={state.quantity >= 24}
              on:click={() => addBottle.setField('quantity', Math.min(24, state.quantity + 1))}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          {#if state.errors.quantity}
            <span class="form-error">{state.errors.quantity}</span>
          {/if}
        </div>
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
        disabled={!$canSubmitAddBottle || state.isSubmitting}
        on:click={handleSubmit}
      >
        {#if state.isSubmitting}
          Adding...
        {:else}
          <Icon name="plus" size={14} />
          Add Bottle
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
    max-width: 440px;
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

  .wine-info-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .wine-year {
    color: var(--text-tertiary, #8a847d);
    font-weight: 400;
  }

  .wine-info-meta {
    font-family: var(--font-sans, system-ui);
    font-size: 0.8125rem;
    color: var(--text-secondary, #5c5652);
    margin-top: var(--space-1, 0.25rem);
  }

  /* Form Elements */
  .form-group {
    margin-bottom: var(--space-5, 1.5rem);
  }

  .form-row .form-group {
    margin-bottom: 0;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4, 1rem);
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

  .required {
    color: var(--error, #b87a7a);
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
    box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
  }

  .form-select.has-error,
  .form-input.has-error {
    border-color: var(--error, #b87a7a);
  }

  .form-error {
    display: block;
    font-size: 0.75rem;
    color: var(--error, #b87a7a);
    margin-top: var(--space-1, 0.25rem);
  }

  /* Quantity Stepper */
  .quantity-stepper {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    background: var(--bg-subtle, #f5f3f0);
    border: 1px solid var(--divider, #e8e4de);
    border-radius: 8px;
    padding: var(--space-2, 0.5rem);
  }

  .stepper-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: var(--surface, #ffffff);
    color: var(--text-secondary, #5c5652);
    cursor: pointer;
    transition: all 0.2s var(--ease-out, ease-out);
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--divider, #e8e4de);
    color: var(--text-primary, #2d2926);
  }

  .stepper-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stepper-btn:focus-visible {
    outline: 2px solid var(--accent, #a69b8a);
    outline-offset: 2px;
  }

  .stepper-value {
    flex: 1;
    text-align: center;
    font-family: var(--font-sans, system-ui);
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary, #2d2926);
    min-width: 2rem;
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
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out, ease-out);
  }

  .btn-secondary {
    color: var(--text-secondary, #5c5652);
    background: var(--surface, #ffffff);
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

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
