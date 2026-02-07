<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';
  import { updateMessage, agentMessages, clearNewFlag } from '$lib/stores/agentConversation';
  import { isScrollLocked } from '$lib/stores/agent';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: chips = message.data.category === 'chips' ? message.data.chips : [];
  $: isDisabled = message.disabled ?? false;
  $: selectedChipId = message.data.category === 'chips' ? message.data.selectedChipId : undefined;

  // Find the preceding message and check if it's ready (isNew === false)
  // Chips wait for the preceding message to complete its animation
  $: messageIndex = $agentMessages.findIndex((m) => m.id === message.id);
  $: precedingMessage = messageIndex > 0 ? $agentMessages[messageIndex - 1] : null;
  $: isPrecedingReady = !precedingMessage || precedingMessage.isNew === false;

  let chipsElement: HTMLElement;

  // WIN-228: Local processing flag to block double-clicks before store updates
  let isProcessing = false;

  /**
   * Handle intro animation complete - scroll into view and clear isNew flag.
   * Clearing the flag signals to following messages that this one is ready.
   */
  function handleIntroEnd() {
    // Check scroll lock before scrolling (prevents chaos during enrichment streaming)
    if (chipsElement && !isScrollLocked()) {
      chipsElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // Signal completion so following messages can appear
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  }

  function handleChipClick(chip: { id: string; action: string; payload?: unknown }) {
    // WIN-228: Block if already processing (handles rapid double-clicks)
    if (isProcessing || isDisabled) return;
    if (message.data.category !== 'chips') return;

    // Set immediately to block any subsequent clicks
    isProcessing = true;

    // Record which chip was selected before dispatching
    updateMessage(message.id, {
      data: {
        category: 'chips',
        chips: message.data.chips,
        selectedChipId: chip.id
      }
    });

    dispatch('action', {
      type: 'chip_tap',
      payload: { action: chip.action, messageId: message.id, data: chip.payload }
    });
  }
</script>

{#if isPrecedingReady}
  <div
    class="chips-message"
    bind:this={chipsElement}
    transition:fly={{ y: 8, duration: 200 }}
    on:introend={handleIntroEnd}
  >
    {#each chips as chip (chip.id)}
      <button
        class="chip"
        class:primary={chip.variant === 'primary'}
        class:selected={isDisabled && selectedChipId === chip.id}
        disabled={isDisabled || isProcessing}
        on:click={() => handleChipClick(chip)}
      >
        {#if isDisabled && selectedChipId === chip.id}
          <span class="checkmark">✓</span>
        {/if}
        {chip.label}
      </button>
    {/each}
  </div>
{/if}

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

  /* Selected chip - stands out when disabled */
  .chip.selected {
    opacity: 0.9;
  }

  .checkmark {
    margin-right: var(--space-1);
    font-size: 0.75em;
  }
</style>
