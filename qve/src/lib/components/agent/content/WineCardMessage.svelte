<script lang="ts">
  import type { AgentMessage } from '$lib/agent/types';
  import type { AgentParsedWine } from '$lib/api/types';
  import WineCard from '../cards/WineCard.svelte';

  export let message: AgentMessage;

  // Extract result from message data
  $: result = message.data.category === 'wine_result' ? message.data.result : null;
  $: confidence = message.data.category === 'wine_result' ? message.data.confidence : undefined;
  $: isStreaming = message.isStreaming ?? false;

  // Determine card state based on message streaming state
  $: cardState = (isStreaming ? 'streaming' : 'static') as 'skeleton' | 'streaming' | 'static';

  // Map WineIdentificationResult to AgentParsedWine format
  // Note: Types will be properly unified in Phase 3
  $: cardData = result
    ? ({
        producer: result.producer ?? null,
        wineName: result.wineName ?? null,
        vintage: result.vintage?.toString() ?? null,
        region: result.region ?? null,
        appellation: result.appellation ?? null,
        country: result.country ?? null,
        wineType: (result.type as AgentParsedWine['wineType']) ?? null,
        grapes: result.grapes ?? null,
        confidence: confidence ?? result.confidence ?? 0,
      } satisfies AgentParsedWine)
    : null;
</script>

{#if cardData}
  <WineCard state={cardState} data={cardData} confidence={confidence ?? null} />
{/if}
