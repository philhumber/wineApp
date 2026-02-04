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
    gap: var(--space-sm, 8px);
    padding: var(--space-sm, 8px) 0;
  }

  .chip {
    padding: var(--space-xs, 4px) var(--space-md, 16px);
    border-radius: 9999px;
    border: 1px solid var(--color-border, #e0e0e0);
    background: var(--color-surface, #fff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    transition: all 0.2s;
  }

  .chip:hover:not(:disabled) {
    background: var(--color-surface-hover, #f3f4f6);
  }

  .chip.primary {
    background: var(--color-primary, #6366f1);
    color: white;
    border-color: var(--color-primary, #6366f1);
  }

  .chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
