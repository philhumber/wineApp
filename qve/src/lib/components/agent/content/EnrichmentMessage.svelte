<script lang="ts">
  import type { AgentMessage, EnrichmentData } from '$lib/agent/types';
  import type { AgentEnrichmentData } from '$lib/api/types';
  import EnrichmentCard from '../cards/EnrichmentCard.svelte';

  export let message: AgentMessage;

  // Extract data from message
  $: messageData = message.data.category === 'enrichment' ? message.data.data : null;
  $: isStreaming = message.isStreaming ?? false;

  // Determine card state based on message streaming state
  $: cardState = (isStreaming ? 'streaming' : 'static') as 'skeleton' | 'streaming' | 'static';

  // Map EnrichmentData to AgentEnrichmentData format
  // Note: Types will be properly unified in Phase 3
  function mapToAgentEnrichment(data: EnrichmentData): AgentEnrichmentData {
    return {
      grapeVarieties:
        data.grapeComposition?.map((g) => ({
          grape: g.grape,
          percentage: g.percentage?.toString() ?? null,
        })) ?? null,
      appellation: null,
      alcoholContent: null,
      drinkWindow: data.drinkWindow ?? null,
      productionMethod: null,
      criticScores:
        data.criticScores?.map((c) => ({
          critic: c.critic,
          score: c.score,
          vintage: c.vintage,
        })) ?? null,
      averagePrice: null,
      priceSource: null,
      body: data.styleProfile?.body?.toString() ?? null,
      tannin: data.styleProfile?.tannin?.toString() ?? null,
      acidity: data.styleProfile?.acidity?.toString() ?? null,
      sweetness: data.styleProfile?.sweetness?.toString() ?? null,
      overview: data.overview ?? null,
      tastingNotes: data.tastingNotes
        ? [
            data.tastingNotes.nose?.join(', ') ?? '',
            data.tastingNotes.palate?.join(', ') ?? '',
            data.tastingNotes.finish ?? '',
          ]
            .filter(Boolean)
            .join('. ')
        : null,
      pairingNotes: data.foodPairings?.join(', ') ?? null,
      confidence: 0,
      sources: [],
    };
  }

  $: cardData = messageData ? mapToAgentEnrichment(messageData) : null;
</script>

{#if cardData}
  <EnrichmentCard state={cardState} data={cardData} />
{/if}
