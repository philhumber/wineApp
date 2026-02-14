<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';
  import { updateMessage, agentMessages, clearNewFlag, isIntroScrollSuppressed } from '$lib/stores/agentConversation';
  import { isScrollLocked } from '$lib/agent/requestLifecycle';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: chips = message.data.category === 'chips' ? message.data.chips : [];
  $: isDisabled = message.disabled ?? false;
  $: selectedChipId = message.data.category === 'chips' ? message.data.selectedChipId : undefined;
  $: groupLabel = message.data.category === 'chips' ? message.data.groupLabel : undefined;

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
    // Check scroll lock and intro suppression before scrolling
    // WIN-305: isIntroScrollSuppressed blocks old messages from scrolling during reset
    if (chipsElement && !isScrollLocked() && !isIntroScrollSuppressed()) {
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
      type: chip.action as AgentAction['type'],
      messageId: message.id,
      payload: chip.payload,
    } as AgentAction);
  }
</script>

{#if isPrecedingReady}
  <div
    class="chips-message"
    class:grouped={groupLabel}
    bind:this={chipsElement}
    transition:fly={{ y: 8, duration: 200 }}
    on:introend={handleIntroEnd}
  >
    {#if groupLabel}
      <span class="group-label">{groupLabel}</span>
    {/if}
    {#each chips as chip (chip.id)}
      {@const colonIdx = chip.label.indexOf(': ')}
      {@const hasFieldValue = chip.action === 'correct_field' && colonIdx > 0}
      <button
        class="chip"
        class:primary={chip.variant === 'primary'}
        class:secondary={chip.variant === 'secondary'}
        class:selected={isDisabled && selectedChipId === chip.id}
        disabled={isDisabled || isProcessing}
        on:click={() => handleChipClick(chip)}
      >
        {#if isDisabled && selectedChipId === chip.id}
          <span class="checkmark">✓</span>
        {/if}
        {#if hasFieldValue}
          <span class="field-name">{chip.label.slice(0, colonIdx)}:</span> <span class="field-value" class:placeholder={chip.variant === 'secondary'}>{chip.label.slice(colonIdx + 2)}</span>
        {:else}
          {chip.label}
        {/if}
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

  .chips-message.grouped {
    background: var(--bg-subtle);
    border: 1px solid var(--divider-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
  }

  .group-label {
    width: 100%;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: var(--space-1);
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

  /* Secondary chip - empty/addable field */
  .chip.secondary {
    border-style: dashed;
    opacity: 0.7;
  }

  .chip.secondary:hover:not(:disabled) {
    opacity: 1;
    border-style: solid;
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

  .field-name {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .field-value {
    font-weight: 400;
    margin-left: 0.25em;
  }

  .field-value.placeholder {
    font-style: italic;
    color: var(--text-tertiary);
  }
</style>
