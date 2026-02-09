<script lang="ts">
  /**
   * TypingIndicatorMessage
   * Wrapper for TypingIndicator in the agent chat.
   * WIN-187: Shows cancel link to abort in-flight LLM requests.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { AgentMessage, TypingMessageData, AgentAction } from '$lib/agent/types';
  import TypingIndicator from '../TypingIndicator.svelte';
  import { clearNewFlag } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: data = message.data as TypingMessageData;
  $: text = data.text;

  let containerElement: HTMLElement;
  let enrichmentCardCountOnMount = 0;

  // Clear isNew flag quickly so typing doesn't block subsequent messages
  // Also scroll into view - this BYPASSES scroll lock intentionally
  onMount(() => {
    enrichmentCardCountOnMount = document.querySelectorAll('[data-enrichment-card]').length;

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

  // When typing indicator is removed, scroll to the NEW enrichment card if one appeared.
  // Only scrolls if enrichment card count increased since mount — prevents scrolling
  // back to old enrichment cards when typing indicator is replaced by non-enrichment
  // content (e.g. cache confirmation chips). BYPASSES scroll lock intentionally.
  onDestroy(() => {
    requestAnimationFrame(() => {
      const enrichmentCards = document.querySelectorAll('[data-enrichment-card]');
      if (enrichmentCards.length > enrichmentCardCountOnMount) {
        const enrichmentCard = enrichmentCards[enrichmentCards.length - 1];
        if (enrichmentCard) {
          enrichmentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
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
