<script lang="ts">
  /**
   * Toast Component
   * Single toast notification with icon, message, action, and progress bar
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Icon } from '$lib/components';
  import type { IconName } from '$lib/components/ui/Icon.svelte';
  import { toasts } from '$lib/stores';
  import type { Toast as ToastType, ToastType as ToastTypeEnum } from '$lib/stores';

  export let toast: ToastType;

  const dispatch = createEventDispatcher<{
    dismiss: { id: string };
  }>();

  // Icon mapping by type
  const icons: Record<ToastTypeEnum, IconName> = {
    success: 'check',
    error: 'x',
    warning: 'warning',
    info: 'info',
    undo: 'info'
  };

  function handleDismiss() {
    toasts.remove(toast.id);
    dispatch('dismiss', { id: toast.id });
  }

  function handleAction() {
    if (toast.action) {
      toast.action.callback();
      handleDismiss();
    }
  }

  // Pause progress bar on hover
  let paused = false;
</script>

<div
  class="toast toast-{toast.type}"
  role="alert"
  aria-live="polite"
  in:fly={{ x: 100, duration: 300, opacity: 0 }}
  out:fly={{ x: 100, duration: 200, opacity: 0 }}
  on:mouseenter={() => (paused = true)}
  on:mouseleave={() => (paused = false)}
>
  <div class="toast-icon">
    <Icon name={icons[toast.type]} size={16} />
  </div>

  <div class="toast-content">
    <p class="toast-message">{toast.message}</p>
    {#if toast.action}
      <button class="toast-action" on:click={handleAction}>
        {toast.action.label}
      </button>
    {/if}
  </div>

  <button
    class="toast-close"
    on:click={handleDismiss}
    aria-label="Dismiss notification"
  >
    <Icon name="x" size={14} />
  </button>

  {#if toast.duration > 0}
    <div
      class="toast-progress"
      class:paused
      style="animation-duration: {toast.duration}ms"
    ></div>
  {/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
    min-width: 280px;
    max-width: 360px;
  }

  /* Toast icon */
  .toast-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .toast-icon :global(svg) {
    stroke-width: 2;
  }

  /* Toast content */
  .toast-content {
    flex: 1;
    min-width: 0;
    padding-top: 4px;
  }

  .toast-message {
    font-size: 0.9375rem;
    font-weight: 400;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.4;
  }

  .toast-action {
    margin-top: var(--space-2);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--accent);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.2s var(--ease-out);
  }

  .toast-action:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  /* Close button */
  .toast-close {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: background 0.2s var(--ease-out);
  }

  .toast-close:hover {
    background: var(--bg-subtle);
  }

  .toast-close :global(svg) {
    color: var(--text-tertiary);
  }

  .toast-close:hover :global(svg) {
    color: var(--text-secondary);
  }

  /* Progress bar */
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    transform-origin: left;
    animation: progressShrink linear forwards;
  }

  .toast-progress.paused {
    animation-play-state: paused;
  }

  @keyframes progressShrink {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  /* ─────────────────────────────────────────────────────────
     TYPE VARIANTS
     ───────────────────────────────────────────────────────── */

  /* Success */
  .toast-success .toast-icon {
    background: rgba(107, 142, 107, 0.12);
  }

  .toast-success .toast-icon :global(svg) {
    color: var(--success);
  }

  .toast-success .toast-progress {
    background: var(--success);
  }

  /* Error */
  .toast-error .toast-icon {
    background: rgba(184, 122, 122, 0.12);
  }

  .toast-error .toast-icon :global(svg) {
    color: var(--error);
  }

  .toast-error .toast-progress {
    background: var(--error);
  }

  /* Warning */
  .toast-warning .toast-icon {
    background: rgba(196, 163, 90, 0.12);
  }

  .toast-warning .toast-icon :global(svg) {
    color: var(--warning);
  }

  .toast-warning .toast-progress {
    background: var(--warning);
  }

  /* Info */
  .toast-info .toast-icon {
    background: rgba(122, 139, 155, 0.12);
  }

  .toast-info .toast-icon :global(svg) {
    color: var(--info);
  }

  .toast-info .toast-progress {
    background: var(--info);
  }

  /* Undo (uses accent color) */
  .toast-undo .toast-icon {
    background: rgba(166, 155, 138, 0.12);
  }

  .toast-undo .toast-icon :global(svg) {
    color: var(--accent);
  }

  .toast-undo .toast-progress {
    background: var(--accent);
  }

  /* ─────────────────────────────────────────────────────────
     RESPONSIVE
     ───────────────────────────────────────────────────────── */

  @media (max-width: 480px) {
    .toast {
      min-width: 0;
      max-width: none;
    }
  }
</style>
