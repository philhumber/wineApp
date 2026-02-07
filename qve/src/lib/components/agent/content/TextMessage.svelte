<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { AgentMessage, TextMessageData } from '$lib/agent/types';
  import TypewriterText from '../TypewriterText.svelte';
  import { clearNewFlag, agentMessages } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ typewriterComplete: void }>();

  $: role = message.role ?? 'agent';
  $: variant = (message.data as TextMessageData).variant;
  $: isDivider = variant === 'divider';
  $: isNew = message.isNew ?? false;
  $: content = message.data.category === 'text' ? message.data.content : '';
  $: shouldAnimate = isNew && role === 'agent' && !isDivider;

  // Track preceding message for sequencing
  $: messageIndex = $agentMessages.findIndex((m) => m.id === message.id);
  $: precedingMessage = messageIndex > 0 ? $agentMessages[messageIndex - 1] : null;
  $: isPrecedingReady = !precedingMessage || precedingMessage.isNew === false;

  // For non-animating messages (user, divider), clear flag when preceding is ready
  // This ensures proper sequencing even for user messages
  let hasClearedFlag = false;
  $: if (message.isNew && !shouldAnimate && isPrecedingReady && !hasClearedFlag) {
    hasClearedFlag = true;
    clearNewFlag(message.id);
  }

  function handleTypewriterComplete() {
    clearNewFlag(message.id);
    dispatch('typewriterComplete');
  }
</script>

{#if isDivider}
  <!-- Conversation divider - elegant separator -->
  <div class="divider-wrapper" data-divider>
    <div class="divider-line"></div>
    <span class="divider-icon">✦</span>
    <div class="divider-line"></div>
  </div>
{:else}
  <div class="text-message" class:user={role === 'user'} class:agent={role === 'agent'}>
    {#if shouldAnimate}
      <TypewriterText text={content} on:complete={handleTypewriterComplete} />
    {:else}
      {@html content}
    {/if}
  </div>
{/if}

<style>
  /* Conversation divider */
  .divider-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-6) 0;
    padding: 0 var(--space-2);
    width: 100%;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      var(--divider-subtle) 20%,
      var(--divider-subtle) 80%,
      transparent
    );
  }

  .divider-icon {
    color: var(--text-quaternary);
    font-size: 0.625rem;
    opacity: 0.6;
  }

  /* Text messages */
  .text-message {
    padding: var(--space-3) var(--space-4);
    line-height: 1.6;
    border-radius: var(--radius-lg);
    max-width: 85%;
    font-size: 0.9375rem;
    font-family: var(--font-sans);
  }

  /* Agent messages - subtle, elegant bubble */
  .text-message.agent {
    background: var(--bg-subtle);
    color: var(--text-primary);
    border: 1px solid var(--divider-subtle);
  }

  /* User messages - warm accent tone */
  .text-message.user {
    background: var(--accent);
    color: var(--bg);
    margin-left: auto;
  }

  .text-message :global(strong) {
    font-weight: 600;
  }

  .text-message :global(em) {
    font-style: italic;
    font-family: var(--font-serif);
  }

  /* Wine/producer names - elegant serif italic */
  .text-message :global(.wine-name) {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 500;
  }

  /* Links in messages */
  .text-message :global(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .text-message :global(a:hover) {
    opacity: 0.8;
  }
</style>
