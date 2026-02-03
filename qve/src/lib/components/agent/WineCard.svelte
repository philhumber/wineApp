<script lang="ts">
	/**
	 * WineCard (Universal)
	 * Unified wine card supporting skeleton, streaming, and static states.
	 * Replaces both WineIdentificationCard and WineCardStreaming.
	 */
	import { agentStreamingFields } from '$lib/stores';
	import type { AgentParsedWine } from '$lib/api/types';
	import DataCard from './DataCard.svelte';
	import WineNameSection from './wine/WineNameSection.svelte';
	import WineProducerSection from './wine/WineProducerSection.svelte';
	import WineMetadataSection from './wine/WineMetadataSection.svelte';
	import WineConfidenceSection from './wine/WineConfidenceSection.svelte';
	import WineDetailsSection from './wine/WineDetailsSection.svelte';

	// ─────────────────────────────────────────────────────
	// PROPS
	// ─────────────────────────────────────────────────────

	/** Card state: skeleton | streaming | static */
	export let state: 'skeleton' | 'streaming' | 'static' = 'static';

	/** Static state: Complete parsed wine data */
	export let data: AgentParsedWine | null = null;

	/** Static state: Confidence score (0-100) */
	export let confidence: number | null = null;

	// ─────────────────────────────────────────────────────
	// STREAMING STATE
	// ─────────────────────────────────────────────────────

	// Subscribe to streaming fields for reactive updates
	$: streamingFields = $agentStreamingFields;

	// ─────────────────────────────────────────────────────
	// STATIC STATE TRANSFORMATION
	// ─────────────────────────────────────────────────────

	// Convert static data to flat object for DataCard
	$: staticData = state === 'static' && data
		? {
				wineName: data.wineName,
				producer: data.producer,
				vintage: data.vintage,
				region: data.region,
				country: data.country,
				wineType: data.wineType,
				grapes: data.grapes,
				confidence: confidence
			}
		: null;

	// ─────────────────────────────────────────────────────
	// CARD STYLING
	// ─────────────────────────────────────────────────────

	// Check if wine name is missing for incomplete styling
	$: hasWineName =
		state === 'static'
			? data?.wineName && data.wineName !== 'Unknown Wine'
			: streamingFields.has('wineName');

	$: cardClass = hasWineName ? '' : 'incomplete';
</script>

<DataCard
	{state}
	data={staticData}
	{streamingFields}
	{cardClass}
	let:state={cardState}
	let:getFieldValue
	let:hasField
	let:isFieldTyping
	let:handleFieldComplete
>
	<WineNameSection
		state={cardState}
		{getFieldValue}
		{hasField}
		{isFieldTyping}
		{handleFieldComplete}
	/>

	<WineProducerSection
		state={cardState}
		{getFieldValue}
		{hasField}
		{isFieldTyping}
		{handleFieldComplete}
	/>

	<WineMetadataSection
		state={cardState}
		{getFieldValue}
		{hasField}
		{isFieldTyping}
		{handleFieldComplete}
	/>

	<WineConfidenceSection
		state={cardState}
		{getFieldValue}
		{hasField}
	/>

	<WineDetailsSection
		state={cardState}
		{getFieldValue}
		{hasField}
		{isFieldTyping}
		{handleFieldComplete}
	/>
</DataCard>

<style>
	:global(.data-card.incomplete) {
		border-color: var(--warning);
		border-style: dashed;
	}
</style>
