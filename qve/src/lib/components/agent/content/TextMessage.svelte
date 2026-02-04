<script lang="ts">
  import type { AgentMessage } from '$lib/agent/types';
  export let message: AgentMessage;
</script>

<div class="text-message">
  {#if message.data.category === 'text'}
    {@html message.data.content}
  {/if}
</div>

<style>
  .text-message {
    padding: var(--space-sm, 8px);
    line-height: 1.5;
  }
</style>
