<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  // Content components for each message category
  import TextMessage from '../content/TextMessage.svelte';
  import ChipsMessage from '../content/ChipsMessage.svelte';
  import WineCardMessage from '../content/WineCardMessage.svelte';
  import EnrichmentMessage from '../content/EnrichmentMessage.svelte';
  import FormMessage from '../content/FormMessage.svelte';
  import ErrorMessage from '../content/ErrorMessage.svelte';
  import ImageMessage from '../content/ImageMessage.svelte';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  // Map categories to components
  const componentMap: Record<string, any> = {
    text: TextMessage,
    chips: ChipsMessage,
    wine_result: WineCardMessage,
    enrichment: EnrichmentMessage,
    form: FormMessage,
    error: ErrorMessage,
    image: ImageMessage,
  };

  $: Component = componentMap[message.category] ?? TextMessage;
</script>

<svelte:component this={Component} {message} on:action />
