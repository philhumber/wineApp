<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let messages: AgentMessage[] = [];

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  let scrollContainer: HTMLElement;
  let shouldAutoScroll = true;

  // Scroll to bottom
  async function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    await tick();
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior
      });
    }
  }

  // Detect if user scrolled up (disable auto-scroll)
  function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll = distanceFromBottom < 100;
  }

  // Handle actions from child components
  function handleAction(event: CustomEvent<AgentAction>) {
    dispatch('action', event.detail);
  }

  // Auto-scroll when messages change
  $: if (messages.length && shouldAutoScroll) {
    scrollToBottom();
  }
</script>

<div class="agent-chat-container">
  <div
    class="chat-viewport"
    bind:this={scrollContainer}
    on:scroll={handleScroll}
  >
    <slot name="messages" {messages} {handleAction} />
  </div>

  <div class="input-container">
    <slot name="input" {handleAction} />
  </div>
</div>

<style>
  .agent-chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }

  .chat-viewport {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .input-container {
    flex-shrink: 0;
    border-top: 1px solid var(--color-border);
  }
</style>
