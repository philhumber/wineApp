<script lang="ts">
  /**
   * ToastContainer Component
   * Manages toast stack positioning and renders Toast components
   */
  import { toasts } from '$lib/stores';
  import Toast from './Toast.svelte';

  export let position: 'bottom-right' | 'bottom-center' | 'top-right' = 'bottom-right';
  export let maxToasts: number = 5;

  // Slice to show only the most recent toasts
  $: visibleToasts = $toasts.slice(-maxToasts);
</script>

{#if visibleToasts.length > 0}
  <div
    class="toast-container toast-{position}"
    role="region"
    aria-label="Notifications"
    aria-live="polite"
  >
    {#each visibleToasts as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    pointer-events: none;
  }

  /* Allow pointer events on individual toasts */
  .toast-container :global(.toast) {
    pointer-events: auto;
  }

  /* Position variants */
  .toast-bottom-right {
    bottom: var(--space-6);
    right: var(--space-6);
    align-items: flex-end;
  }

  .toast-bottom-center {
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
  }

  .toast-top-right {
    top: var(--space-6);
    right: var(--space-6);
    align-items: flex-end;
  }

  /* Responsive: full width on mobile */
  @media (max-width: 480px) {
    .toast-container {
      left: var(--space-4);
      right: var(--space-4);
      bottom: var(--space-4);
      transform: none;
      align-items: stretch;
    }

    .toast-bottom-center {
      left: var(--space-4);
      transform: none;
    }

    .toast-top-right {
      top: auto;
      bottom: var(--space-4);
    }
  }
</style>
