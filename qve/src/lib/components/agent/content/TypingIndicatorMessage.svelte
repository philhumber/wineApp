<script lang="ts">
  /**
   * TypingIndicatorMessage
   * Wrapper for TypingIndicator in the agent chat.
   * WIN-187: Shows cancel link to abort in-flight LLM requests.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import type { AgentMessage, TypingMessageData, AgentAction } from '$lib/agent/types';
  import TypingIndicator from '../TypingIndicator.svelte';
  import { clearNewFlag } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: data = message.data as TypingMessageData;
  $: text = data.text;

  let containerElement: HTMLElement;

  // Clear isNew flag quickly so typing doesn't block subsequent messages
  // Also scroll into view - this BYPASSES scroll lock intentionally
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
    // Scroll typing indicator into view - bypasses scroll lock
    // This ensures the loading message is visible during enrichment
    if (containerElement) {
      requestAnimationFrame(() => {
        if (containerElement) {
          containerElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    }
  });

  /**
   * WIN-187: Handle cancel click - dispatch action to cancel the request
   */
  function handleCancel() {
    dispatch('action', { type: 'cancel_request' });
  }
</script>

<div bind:this={containerElement}>
  <TypingIndicator {text} showCancel={true} on:cancel={handleCancel} />
</div>
