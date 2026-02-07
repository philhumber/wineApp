<script lang="ts">
  import { onMount } from 'svelte';
  import type { AgentMessage, TypingMessageData } from '$lib/agent/types';
  import TypingIndicator from '../TypingIndicator.svelte';
  import { clearNewFlag } from '$lib/stores/agentConversation';

  export let message: AgentMessage;

  $: data = message.data as TypingMessageData;
  $: text = data.text;

  // Clear isNew flag quickly so typing doesn't block subsequent messages
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  });
</script>

<TypingIndicator {text} />
