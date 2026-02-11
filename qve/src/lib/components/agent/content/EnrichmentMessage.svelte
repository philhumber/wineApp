<script lang="ts">
  import { onMount } from 'svelte';
  import type { AgentMessage, EnrichmentMessageData } from '$lib/agent/types';
  import type { AgentEnrichmentData } from '$lib/api/types';
  import EnrichmentCard from '../cards/EnrichmentCard.svelte';
  import { clearNewFlag } from '$lib/stores';

  export let message: AgentMessage;

  // Signal readiness immediately on mount (no typewriter animation)
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  });

  // Extract data directly from message (AgentEnrichmentData | null)
  $: enrichmentMsgData = message.data as EnrichmentMessageData;
  $: messageData = enrichmentMsgData.data as AgentEnrichmentData | null;
  $: streamingTextFields = enrichmentMsgData.streamingTextFields ?? [];

  // Card state: null data = skeleton, otherwise static
  $: cardState = (messageData === null ? 'skeleton' : 'static') as 'skeleton' | 'streaming' | 'static';
</script>

<EnrichmentCard state={cardState} data={messageData} {streamingTextFields} />
