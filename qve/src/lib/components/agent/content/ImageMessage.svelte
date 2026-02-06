<script lang="ts">
  import { onMount } from 'svelte';
  import type { AgentMessage } from '$lib/agent/types';
  import { clearNewFlag } from '$lib/stores';

  export let message: AgentMessage;

  $: src = message.data.category === 'image' ? message.data.src : '';

  // Signal readiness immediately on mount (no typewriter animation)
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  });
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
