<script lang="ts">
  import type { AgentMessage } from '$lib/agent/types';

  export let message: AgentMessage;

  $: src = message.data.category === 'image' ? message.data.src : '';
</script>

{#if src}
  <div class="image-message">
    <img {src} alt="Uploaded wine photo" />
  </div>
{/if}

<style>
  .image-message {
    max-width: 200px;
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
  }

  img {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
