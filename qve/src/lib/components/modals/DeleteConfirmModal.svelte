<!--
  DeleteConfirmModal Component (WIN-80)
  Confirmation dialog for soft delete with cascade impact preview

  Usage:
  <DeleteConfirmModal
    entityType="wine"
    entityId={123}
    entityName="Château Margaux 2015"
    on:confirm={handleDelete}
    on:cancel={handleCancel}
  />
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { api } from '$lib/api';
  import { Icon } from '$lib/components';
  import type { DeleteEntityType, DeleteImpactResponse, DeleteImpact } from '$lib/api/types';

  export let entityType: DeleteEntityType;
  export let entityId: number;
  export let entityName: string;

  const dispatch = createEventDispatcher<{
    confirm: { type: DeleteEntityType; id: number; name: string };
    cancel: void;
  }>();

  let cancelButton: HTMLButtonElement;
  let loading = true;
  let error: string | null = null;
  let impact: DeleteImpact | null = null;

  onMount(async () => {
    // Focus cancel button by default (safer option)
    cancelButton?.focus();

    // Load impact preview
    try {
      const response = await api.getDeleteImpact(entityType, entityId);
      impact = response.impact;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load impact preview';
    } finally {
      loading = false;
    }
  });

  function handleConfirm() {
    dispatch('confirm', { type: entityType, id: entityId, name: entityName });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }

  // Format impact counts for display
  function getImpactSummary(impactData: DeleteImpact | null): string[] {
    if (!impactData) return [];

    const items: string[] = [];

    if (impactData.producers && impactData.producers.count > 0) {
      items.push(`${impactData.producers.count} producer${impactData.producers.count > 1 ? 's' : ''}`);
    }
    if (impactData.wines && impactData.wines.count > 0) {
      items.push(`${impactData.wines.count} wine${impactData.wines.count > 1 ? 's' : ''}`);
    }
    if (impactData.bottles && impactData.bottles.count > 0) {
      items.push(`${impactData.bottles.count} bottle${impactData.bottles.count > 1 ? 's' : ''}`);
    }
    if (impactData.ratings && impactData.ratings.count > 0) {
      items.push(`${impactData.ratings.count} rating${impactData.ratings.count > 1 ? 's' : ''}`);
    }

    return items;
  }

  // Get sample names from impact
  function getSampleNames(impactData: DeleteImpact | null): string[] {
    if (!impactData) return [];

    // Return first few names from whichever category has them
    if (impactData.producers?.names && impactData.producers.names.length > 0) {
      return impactData.producers.names;
    }
    if (impactData.wines?.names && impactData.wines.names.length > 0) {
      return impactData.wines.names;
    }
    if (impactData.bottles?.names && impactData.bottles.names.length > 0) {
      return impactData.bottles.names;
    }

    return [];
  }

  // Reactive statements with explicit impact dependency for Svelte reactivity
  $: impactItems = getImpactSummary(impact);
  $: sampleNames = getSampleNames(impact);
  $: hasCascade = impactItems.length > 0 && entityType !== 'bottle';
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleBackdropClick}>
  <div class="modal-content" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
    <div class="modal-body">
      <div class="delete-icon">
        <Icon name="x" size={24} />
      </div>

      <h2 id="delete-title" class="delete-title">
        Delete {entityType}?
      </h2>

      <p class="delete-name">{entityName}</p>

      {#if loading}
        <div class="loading-state">
          <span class="loading-spinner"></span>
          Checking impact...
        </div>
      {:else if error}
        <p class="error-message">{error}</p>
      {:else if hasCascade}
        <div class="impact-warning">
          <p class="impact-intro">This will also delete:</p>
          <ul class="impact-list">
            {#each impactItems as item}
              <li>{item}</li>
            {/each}
          </ul>
          {#if sampleNames.length > 0}
            <p class="impact-samples">
              Including: {sampleNames.slice(0, 3).join(', ')}{sampleNames.length > 3 ? '...' : ''}
            </p>
          {/if}
        </div>
      {/if}

      <!--<p class="undo-notice">
        You can undo this within 10 seconds.
      </p>-->
    </div>

    <div class="modal-footer">
      <button
        type="button"
        class="btn btn-secondary"
        bind:this={cancelButton}
        on:click={handleCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={loading}
        on:click={handleConfirm}
      >
        Delete
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(45, 41, 38, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4, 1rem);
    animation: fadeIn 0.2s var(--ease-out, ease-out);
  }

  :global([data-theme='dark']) .modal-overlay {
    background: rgba(12, 11, 10, 0.8);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background: var(--surface, #ffffff);
    border-radius: 12px;
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(45, 41, 38, 0.06));
    width: 100%;
    max-width: 400px;
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

  .modal-body {
    padding: var(--space-6, 2rem);
    text-align: center;
  }

  .delete-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto var(--space-4, 1rem);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(184, 122, 122, 0.12);
    border-radius: 50%;
  }

  .delete-icon :global(svg) {
    color: var(--error, #b87a7a);
  }

  .delete-title {
    font-family: var(--font-serif, Georgia);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-primary, #2d2926);
    margin-bottom: var(--space-2, 0.5rem);
    text-transform: capitalize;
  }

  .delete-name {
    font-family: var(--font-sans, system-ui);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary, #5c5652);
    margin-bottom: var(--space-4, 1rem);
    word-break: break-word;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 0.5rem);
    font-size: 0.875rem;
    color: var(--text-tertiary, #8a847d);
    padding: var(--space-3, 0.75rem) 0;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--divider, #e8e4de);
    border-top-color: var(--accent, #a69b8a);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    font-size: 0.875rem;
    color: var(--error, #b87a7a);
    padding: var(--space-3, 0.75rem);
    background: rgba(184, 122, 122, 0.08);
    border-radius: var(--radius-md, 8px);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .impact-warning {
    text-align: left;
    padding: var(--space-4, 1rem);
    background: rgba(196, 163, 90, 0.08);
    border: 1px solid rgba(196, 163, 90, 0.2);
    border-radius: var(--radius-md, 8px);
    margin-bottom: var(--space-4, 1rem);
  }

  .impact-intro {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--warning, #c4a35a);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .impact-list {
    margin: 0;
    padding-left: var(--space-5, 1.5rem);
    font-size: 0.875rem;
    color: var(--text-secondary, #5c5652);
    line-height: 1.6;
  }

  .impact-list li {
    margin-bottom: var(--space-1, 0.25rem);
  }

  .impact-samples {
    margin-top: var(--space-2, 0.5rem);
    font-size: 0.8125rem;
    font-style: italic;
    color: var(--text-tertiary, #8a847d);
  }

  .undo-notice {
    font-size: 0.8125rem;
    color: var(--text-tertiary, #8a847d);
  }

  .modal-footer {
    display: flex;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem) var(--space-6, 2rem);
    border-top: 1px solid var(--divider-subtle, #f0ede8);
    background: var(--bg-subtle, #f5f3f0);
    border-radius: 0 0 12px 12px;
  }

  .btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    color: var(--text-secondary, #5c5652);
    background: transparent;
    border: 1px solid var(--divider, #e8e4de);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--text-tertiary, #8a847d);
    color: var(--text-primary, #2d2926);
  }

  .btn-danger {
    color: var(--bg, #faf9f7);
    background: var(--error, #b87a7a);
    border: 1px solid var(--error, #b87a7a);
  }

  .btn-danger:hover:not(:disabled) {
    background: #a06a6a;
    border-color: #a06a6a;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent, #a69b8a);
    outline-offset: 2px;
  }
</style>
