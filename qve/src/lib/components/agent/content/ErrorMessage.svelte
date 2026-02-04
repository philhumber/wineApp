<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: error = message.data.category === 'error' ? message.data.error : null;
  $: retryable = message.data.category === 'error' ? message.data.retryable : false;

  function handleRetry() {
    dispatch('action', { type: 'chip_tap', payload: { action: 'try_again', messageId: message.id } });
  }

  function handleStartOver() {
    dispatch('action', { type: 'start_over' });
  }
</script>

{#if error}
  <div class="error-message">
    <div class="error-icon">!</div>
    <div class="error-content">
      <p class="error-text">{error.userMessage}</p>
      {#if error.supportRef}
        <p class="error-ref">Reference: {error.supportRef}</p>
      {/if}
    </div>
    <div class="error-actions">
      {#if retryable}
        <button class="retry-btn" on:click={handleRetry}>Try Again</button>
      {/if}
      <button class="start-over-btn" on:click={handleStartOver}>Start Over</button>
    </div>
  </div>
{/if}

<style>
  .error-message {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 8px);
    padding: var(--space-md, 16px);
    background: var(--color-error-subtle, #fef2f2);
    border-radius: var(--radius-md, 8px);
  }

  .error-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-error, #dc2626);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
  }

  .error-content {
    flex: 1;
  }

  .error-text {
    color: var(--color-error, #dc2626);
    margin: 0;
  }

  .error-ref {
    font-size: var(--font-size-sm, 14px);
    color: var(--color-text-muted, #9ca3af);
    margin: var(--space-xs, 4px) 0 0 0;
  }

  .error-actions {
    display: flex;
    gap: var(--space-sm, 8px);
  }

  .retry-btn, .start-over-btn {
    padding: var(--space-xs, 4px) var(--space-md, 16px);
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border, #e0e0e0);
    background: var(--color-surface, #fff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    transition: background 0.2s;
  }

  .retry-btn:hover, .start-over-btn:hover {
    background: var(--color-surface-hover, #f3f4f6);
  }
</style>
