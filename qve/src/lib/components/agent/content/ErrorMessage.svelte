<script lang="ts">
  import { onMount } from 'svelte';
  import type { AgentMessage } from '$lib/agent/types';
  import { clearNewFlag } from '$lib/stores';

  export let message: AgentMessage;

  $: error = message.data.category === 'error' ? message.data.error : null;

  // Signal readiness immediately on mount (no typewriter animation)
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  });
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
  </div>
{/if}

<style>
  .error-message {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--status-past-bg);
    border: 1px solid var(--error);
    border-radius: var(--radius-lg);
    max-width: 85%;
  }

  .error-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--error);
    color: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .error-content {
    flex: 1;
    min-width: 0;
  }

  .error-text {
    color: var(--error);
    margin: 0;
    font-size: 0.9375rem;
    font-family: var(--font-sans);
    line-height: 1.5;
  }

  .error-ref {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin: var(--space-2) 0 0 0;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
</style>
