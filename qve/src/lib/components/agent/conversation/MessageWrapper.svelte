<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import MessageContent from './MessageContent.svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';
  import { agentMessages } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: isDisabled = message.disabled ?? false;
  $: isNew = message.isNew ?? false;
  $: role = message.role ?? 'agent';
  $: isStreaming = message.isStreaming ?? false;
  $: category = message.data?.category ?? 'text';

  // Find preceding message and check if it's ready (isNew === false)
  // Messages wait for preceding agent message to complete before appearing
  $: messageIndex = $agentMessages.findIndex((m) => m.id === message.id);
  $: precedingMessage = messageIndex > 0 ? $agentMessages[messageIndex - 1] : null;

  // All messages wait for preceding message to complete before appearing
  // Chips have their own isPrecedingReady logic in ChipsMessage.svelte
  $: isPrecedingReady =
    category === 'chips' ||
    !precedingMessage ||
    precedingMessage.isNew === false;

  let wrapperElement: HTMLElement;

  /**
   * Scroll message into view after fly-in animation completes.
   */
  function handleIntroEnd() {
    if (wrapperElement && role === 'agent') {
      wrapperElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }
</script>

{#if isPrecedingReady}
  <div
    bind:this={wrapperElement}
    class="message-wrapper"
    class:disabled={isDisabled}
    class:is-new={isNew}
    class:user={role === 'user'}
    class:agent={role === 'agent'}
    class:streaming={isStreaming}
    transition:fly={{ y: 12, duration: 250 }}
    on:introend={handleIntroEnd}
  >
    <MessageContent {message} on:action />
  </div>
{/if}

<style>
  .message-wrapper {
    transition: opacity 0.2s;
    max-width: 100%;
  }

  .message-wrapper.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .message-wrapper.is-new {
    animation: messageHighlight 0.5s ease-out;
  }

  .message-wrapper.user {
    display: flex;
    justify-content: flex-end;
  }

  .message-wrapper.agent {
    display: flex;
    justify-content: flex-start;
  }

  .message-wrapper.streaming {
    /* Streaming messages might have special styling */
  }

  @keyframes messageHighlight {
    from {
      background-color: var(--accent-muted);
    }
    to {
      background-color: transparent;
    }
  }
</style>
