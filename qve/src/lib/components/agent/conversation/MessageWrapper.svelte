<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MessageContent from './MessageContent.svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: isDisabled = message.disabled ?? false;
  $: isNew = message.isNew ?? false;
  $: role = message.role ?? 'agent';
  $: isStreaming = message.isStreaming ?? false;
</script>

<div
  class="message-wrapper"
  class:disabled={isDisabled}
  class:is-new={isNew}
  class:user={role === 'user'}
  class:agent={role === 'agent'}
  class:streaming={isStreaming}
>
  <MessageContent {message} on:action />
</div>

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
      background-color: var(--color-accent-subtle, rgba(99, 102, 241, 0.1));
    }
    to {
      background-color: transparent;
    }
  }
</style>
