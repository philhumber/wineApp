<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import MessageWrapper from './MessageWrapper.svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let messages: AgentMessage[] = [];

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  function handleAction(event: CustomEvent<AgentAction>) {
    dispatch('action', event.detail);
  }
</script>

<div class="message-list">
  {#each messages as message (message.id)}
    <div
      class="message-item"
      data-message-id={message.id}
      animate:flip={{ duration: 200 }}
      in:fly={{ y: 20, duration: 300 }}
    >
      <MessageWrapper {message} on:action={handleAction} />
    </div>
  {/each}
</div>

<style>
  .message-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    min-height: 100%;
  }

  .message-item {
    width: 100%;
  }
</style>
