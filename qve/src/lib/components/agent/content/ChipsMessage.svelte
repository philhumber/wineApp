<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: chips = message.data.category === 'chips' ? message.data.chips : [];
  $: isDisabled = message.disabled ?? false;

  function handleChipClick(chip: { id: string; action: string; payload?: unknown }) {
    if (isDisabled) return;
    dispatch('action', {
      type: 'chip_tap',
      payload: { action: chip.action, messageId: message.id, data: chip.payload }
    });
  }
</script>

<div class="chips-message">
  {#each chips as chip (chip.id)}
    <button
      class="chip"
      class:primary={chip.variant === 'primary'}
      disabled={isDisabled}
      on:click={() => handleChipClick(chip)}
    >
      {chip.label}
    </button>
  {/each}
</div>

<style>
  .chips-message {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) 0;
  }

  .chip {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid var(--divider);
    background: var(--surface);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.875rem;
    font-family: var(--font-sans);
    font-weight: 500;
    transition: all 0.2s var(--ease-out);
    min-height: 40px;
    display: inline-flex;
    align-items: center;
  }

  .chip:hover:not(:disabled) {
    background: var(--bg-subtle);
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .chip:active:not(:disabled) {
    transform: translateY(0);
  }

  /* Primary chip - warm accent style */
  .chip.primary {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .chip.primary:hover:not(:disabled) {
    background: var(--accent-subtle);
    border-color: var(--accent-subtle);
  }

  .chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-subtle);
    border-color: var(--divider-subtle);
  }
</style>
