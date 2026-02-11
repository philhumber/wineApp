<script lang="ts">
	/**
	 * EnrichmentCard (Universal)
	 * Unified enrichment card supporting skeleton, streaming, and static states.
	 * Replaces both EnrichmentCard and EnrichmentCardStreaming.
	 */
	import { isEnriching } from '$lib/stores/agentEnrichment';
	import type { AgentEnrichmentData } from '$lib/api/types';
	import DataCard from './DataCard.svelte';
	import OverviewSection from '../enrichment/OverviewSection.svelte';
	import StyleProfileSection from '../enrichment/StyleProfileSection.svelte';
	import GrapeCompositionSection from '../enrichment/GrapeCompositionSection.svelte';
	import TastingNotesSection from '../enrichment/TastingNotesSection.svelte';
	import FoodPairingsSection from '../enrichment/FoodPairingsSection.svelte';
	import DrinkWindowSection from '../enrichment/DrinkWindowSection.svelte';
	import CriticScoresSection from '../enrichment/CriticScoresSection.svelte';

	// ─────────────────────────────────────────────────────
	// PROPS
	// ─────────────────────────────────────────────────────

	/** Card state: skeleton | streaming | static */
	export let state: 'skeleton' | 'streaming' | 'static' = 'static';

	/** Static state: Complete enrichment data */
	export let data: AgentEnrichmentData | null = null;

	/** Static state: Data source indicator */
	export let source: 'cache' | 'web_search' | 'inference' | undefined = undefined;

	/** Fields with active text streaming cursors */
	export let streamingTextFields: string[] = [];

	// ─────────────────────────────────────────────────────
	// STREAMING STATE
	// ─────────────────────────────────────────────────────

	$: enriching = $isEnriching;

	// Per-section text streaming booleans
	$: isOverviewStreaming = streamingTextFields.includes('overview');
	$: isTastingNotesStreaming = streamingTextFields.includes('tastingNotes');
	$: isPairingNotesStreaming = streamingTextFields.includes('pairingNotes');

	// ─────────────────────────────────────────────────────
	// STATIC STATE TRANSFORMATION
	// ─────────────────────────────────────────────────────

	// Convert static data to flat object for DataCard
	$: staticData = state === 'static' && data
		? {
				overview: data.overview,
				body: data.body,
				tannin: data.tannin,
				acidity: data.acidity,
				sweetness: data.sweetness,
				grapeVarieties: data.grapeVarieties,
				tastingNotes: data.tastingNotes,
				pairingNotes: data.pairingNotes,
				drinkWindow: data.drinkWindow,
				criticScores: data.criticScores
			}
		: null;

	// ─────────────────────────────────────────────────────
	// HEADER
	// ─────────────────────────────────────────────────────

	$: header = {
		title: 'Wine Details',
		badge:
			state === 'streaming' || enriching
				? 'Researching...'
				: state === 'static' && source
					? source === 'cache'
						? 'Cached'
						: source === 'web_search'
							? 'Web'
							: 'AI'
					: 'Research complete',
		badgeStreaming: state === 'streaming' || enriching
	};

	// Data attributes for scroll targeting - always include enrichment-card
	$: dataAttributes = {
		'enrichment-card': true
	};

	</script>

<div class="enrichment-card-wrapper">
	<DataCard
		{state}
		data={staticData}
		streamingFields={new Map()}
		{header}
		cardClass="enrichment-card"
		{dataAttributes}
		let:state={cardState}
		let:fieldsMap
		let:getFieldValue
		let:hasField
		let:isFieldTyping
		let:handleFieldComplete
	>
		<OverviewSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
			{isFieldTyping}
			{handleFieldComplete}
			isTextStreaming={isOverviewStreaming}
		/>

		<StyleProfileSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
		/>

		<GrapeCompositionSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
		/>

		<TastingNotesSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
			{isFieldTyping}
			{handleFieldComplete}
			isTextStreaming={isTastingNotesStreaming}
		/>

		<FoodPairingsSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
			{isFieldTyping}
			{handleFieldComplete}
			isTextStreaming={isPairingNotesStreaming}
		/>

		<DrinkWindowSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
		/>

		<CriticScoresSection
			state={cardState}
			{fieldsMap}
			{getFieldValue}
			{hasField}
		/>
	</DataCard>
</div>

<style>
	.enrichment-card-wrapper :global(.data-card.enrichment-card) {
		background: var(--surface-raised);
		margin-top: var(--space-3);
	}

	.enrichment-card-wrapper :global(.data-card.enrichment-card.skeleton) {
		border: 1px solid var(--divider-subtle);
	}

	/* When streaming is complete, show accent border */
	.enrichment-card-wrapper :global(.data-card.enrichment-card:not(.skeleton)) {
		border: 1px solid var(--accent);
	}
</style>
