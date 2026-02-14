<!--
  ConfirmModal Component
  Simple confirmation dialog

  Usage:
  <ConfirmModal
    title="Discard changes?"
    message="You have unsaved changes. Are you sure you want to close?"
    confirmLabel="Discard"
    cancelLabel="Keep editing"
    variant="danger"
    on:confirm={handleConfirm}
    on:cancel={handleCancel}
  />
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { modal } from '$lib/stores';
  import { focusTrap } from '$lib/actions/focusTrap';

  export let title: string = 'Are you sure?';
  export let message: string = '';
  export let confirmLabel: string = 'Confirm';
  export let cancelLabel: string = 'Cancel';
  export let variant: 'default' | 'danger' = 'default';

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  function handleConfirm() {
    dispatch('confirm');
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
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleBackdropClick}>
  <div class="modal-content" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" use:focusTrap={{ initialFocus: variant === 'danger' ? '.btn-secondary' : '.btn-primary' }}>
    <div class="modal-body">
      <h2 id="confirm-title" class="confirm-title">{title}</h2>
      {#if message}
        <p class="confirm-message">{message}</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        class:btn-danger={variant === 'danger'}
        on:click={handleConfirm}
      >
        {confirmLabel}
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
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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

  .confirm-title {
    font-family: var(--font-serif, Georgia);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-primary, #2d2926);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .confirm-message {
    font-family: var(--font-sans, system-ui);
    font-size: 0.9375rem;
    color: var(--text-secondary, #5c5652);
    line-height: 1.5;
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

  .btn-primary:hover {
    background: var(--text-secondary, #5c5652);
    border-color: var(--text-secondary, #5c5652);
  }

  .btn-danger {
    background: var(--error, #b87a7a);
    border-color: var(--error, #b87a7a);
  }

  .btn-danger:hover {
    background: #a06a6a;
    border-color: #a06a6a;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent, #a69b8a);
    outline-offset: 2px;
  }
</style>
