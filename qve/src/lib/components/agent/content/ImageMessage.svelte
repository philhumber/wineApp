<script lang="ts">
  import type { AgentMessage } from '$lib/agent/types';
  import { clearNewFlag, agentMessages } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  $: src = message.data.category === 'image' ? message.data.src : '';

  // Track preceding message for sequencing (same pattern as TextMessage)
  $: messageIndex = $agentMessages.findIndex((m) => m.id === message.id);
  $: precedingMessage = messageIndex > 0 ? $agentMessages[messageIndex - 1] : null;
  $: isPrecedingReady = !precedingMessage || precedingMessage.isNew === false;

  // Clear flag when preceding is ready (no typewriter animation for images)
  let hasClearedFlag = false;
  $: if (message.isNew && isPrecedingReady && !hasClearedFlag) {
    hasClearedFlag = true;
    clearNewFlag(message.id);
  }
</script>

{#if src}
  <div class="image-message">
    <img {src} alt="Uploaded wine label" />
  </div>
{/if}

<style>
  .image-message {
    display: inline-block;
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
  }

  img {
    display: block;
    max-height: 240px;
    max-width: 240px;
    width: auto;
    height: auto;
    border-radius: var(--radius-md, 8px);
  }
</style>
