<script lang="ts">
  import type { AgentMessage } from '$lib/agent/types';

  export let message: AgentMessage;

  $: src = message.data.category === 'image' ? message.data.src : '';
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
