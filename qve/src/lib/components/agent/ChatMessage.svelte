<script lang="ts">
	/**
	 * ChatMessage
	 * Displays a single message in the agent conversation
	 * Agent: Editorial serif with accent divider
	 * User: Subtle indented card
	 * WIN-168: Typewriter effect for agent messages
	 */
	import { createEventDispatcher } from 'svelte';
	import type { AgentMessage, AgentChip } from '$lib/stores';
	import type { AgentCandidate, AgentParsedWine } from '$lib/api/types';
	import ActionChips from './ActionChips.svelte';
	import WineIdentificationCard from './WineIdentificationCard.svelte';
	import DisambiguationList from './DisambiguationList.svelte';
	import CandidateMiniCards from './CandidateMiniCards.svelte';
	import MatchSelectionList from './MatchSelectionList.svelte';
	import BottleDetailsForm from './BottleDetailsForm.svelte';
	import ManualEntryForm from './ManualEntryForm.svelte';
	import { EnrichmentCard } from './enrichment';
	import { agentAddState } from '$lib/stores';
	import TypewriterText from './TypewriterText.svelte';

	const dispatch = createEventDispatcher<{
		chipSelect: { action: string; data?: unknown };
		selectCandidate: { candidate: AgentCandidate };
		formReady: void;
		chipsReady: void;
	}>();

	export let message: AgentMessage;

	// WIN-168: Chip delay until typewriter animation completes
	// Message types without TypewriterText should show chips immediately
	const noTypewriterTypes = ['wine_result', 'bottle_form'];
	let chipsReady = !message.isNew || noTypewriterTypes.includes(message.type);

	function handleTypewriterComplete() {
		chipsReady = true;
		// WIN-168: Notify parent to scroll when chips become visible
		if (message.chips && message.chips.length > 0) {
			dispatch('chipsReady');
		}
	}

	// For manual entry form - derive missing fields from identified wine
	$: partialData = $agentAddState?.identified ?? null;
	$: missingFields = partialData ? getMissingFields(partialData) : [];

	function getMissingFields(parsed: AgentParsedWine): string[] {
		const missing: string[] = [];
		if (!parsed.producer) missing.push('producer');
		if (!parsed.wineName) missing.push('wine name');
		if (!parsed.region) missing.push('region');
		if (!parsed.wineType) missing.push('wine type');
		return missing;
	}

	function handleChipSelect(e: CustomEvent<{ action: string; data?: unknown }>) {
		dispatch('chipSelect', e.detail);
	}

	function handleSelectCandidate(e: CustomEvent<{ candidate: AgentCandidate }>) {
		dispatch('selectCandidate', e.detail);
	}

	function handleManualEntryComplete(e: CustomEvent<{ producer: string; wineName: string; region: string; wineType: string }>) {
		dispatch('chipSelect', { action: 'manual_entry_complete', data: e.detail });
	}

	function handleBottleNext() {
		dispatch('chipSelect', { action: 'bottle_next' });
	}

	function handleBottleSubmit() {
		dispatch('chipSelect', { action: 'bottle_submit' });
	}

	function handleFormReady() {
		dispatch('formReady');
	}
</script>

<article
	class="chat-message"
	class:agent={message.role === 'agent'}
	class:user={message.role === 'user'}
	class:has-wine-result={message.type === 'wine_result'}
	class:has-wine-enrichment={message.type === 'wine_enrichment'}
	class:has-low-confidence={message.type === 'low_confidence'}
	class:has-partial-match={message.type === 'partial_match'}
	class:has-disambiguation={message.type === 'disambiguation'}
>
	{#if message.role === 'agent'}
		<!-- Agent message: Editorial serif with accent divider -->
		{#if message.type === 'wine_result' && message.wineResult}
			<!-- Wine result card -->
			<WineIdentificationCard
				parsed={message.wineResult}
				confidence={message.confidence ?? 0}
			/>
		{:else if message.type === 'wine_enrichment' && message.enrichmentData}
			<!-- Wine enrichment card -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<EnrichmentCard data={message.enrichmentData} source={message.enrichmentSource} />
		{:else if message.type === 'low_confidence'}
			<!-- Low confidence conversational message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text low-confidence-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text low-confidence-text">{message.content}</p>
			{/if}
			<div class="accent-divider"></div>
		{:else if message.type === 'partial_match'}
			<!-- Partial match conversational message with optional mini-cards -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text partial-match-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text partial-match-text">{message.content}</p>
			{/if}
			{#if message.candidates && message.candidates.length > 0}
				<CandidateMiniCards
					candidates={message.candidates}
					on:select={handleSelectCandidate}
				/>
			{/if}
			<div class="accent-divider"></div>
		{:else if message.type === 'disambiguation' && message.candidates}
			<!-- Disambiguation list -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<DisambiguationList
				candidates={message.candidates}
				on:select={handleSelectCandidate}
			/>
		{:else if message.type === 'error'}
			<!-- Error message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text error-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text error-text">{message.content}</p>
			{/if}
		{:else if message.type === 'coming_soon'}
			<!-- Coming soon message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text coming-soon-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text coming-soon-text">{message.content}</p>
			{/if}
			<div class="accent-divider"></div>
		{:else if message.type === 'add_confirm'}
			<!-- Add to cellar confirmation -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<!-- ActionChips provided via message.chips -->
		{:else if message.type === 'match_selection'}
			<!-- Match selection list -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			{#if message.matches && message.matchType}
				<MatchSelectionList
					matches={message.matches}
					type={message.matchType}
					on:chipSelect={handleChipSelect}
				/>
			{/if}
			<!-- ActionChips for "Add as new" | "Help me decide" provided via message.chips -->
		{:else if message.type === 'match_confirmed'}
			<!-- Match confirmed message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<!-- No chips - auto-advance after brief display -->
		{:else if message.type === 'existing_wine_choice'}
			<!-- WIN-145: Wine exists - add bottle or create new? -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<!-- ActionChips: "Add Another Bottle" | "Create New Wine" provided via message.chips -->
		{:else if message.type === 'manual_entry'}
			<!-- Manual entry form for missing fields -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			{#if partialData}
				<ManualEntryForm
					{partialData}
					{missingFields}
					on:complete={handleManualEntryComplete}
				/>
			{/if}
		{:else if message.type === 'bottle_form'}
			<!-- Bottle details form -->
			<BottleDetailsForm
				part={message.bottleFormPart ?? 1}
				on:next={handleBottleNext}
				on:submit={handleBottleSubmit}
				on:ready={handleFormReady}
			/>
		{:else if message.type === 'enrichment_choice'}
			<!-- Enrichment choice message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<!-- ActionChips: "Enrich now" | "Add quickly" provided via message.chips -->
		{:else if message.type === 'add_complete'}
			<!-- Add complete success message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text success-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text success-text">{message.content}</p>
			{/if}
			<!-- No chips - panel closes and navigates automatically -->
		{:else}
			<!-- Standard text message -->
			{#if message.isNew}
				<TypewriterText text={message.content} className="agent-text" on:complete={handleTypewriterComplete} />
			{:else}
				<p class="agent-text">{message.content}</p>
			{/if}
			<div class="accent-divider"></div>
		{/if}

		{#if message.chips && message.chips.length > 0 && chipsReady}
			<ActionChips chips={message.chips} on:select={handleChipSelect} />
		{/if}
	{:else}
		<!-- User message: Subtle indented card -->
		<div class="user-card">
			{#if message.type === 'image_preview' && message.imageUrl}
				<img src={message.imageUrl} alt="Wine label" class="user-image" />
			{:else}
				<p class="user-text">{message.content}</p>
			{/if}
		</div>
	{/if}
</article>

<style>
	/* WIN-168: Removed fadeInUp from agent messages - replaced by typewriter effect */
	.chat-message.user {
		animation: fadeInUp 0.4s var(--ease-out);
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Agent messages */
	.chat-message.agent {
		padding-right: var(--space-4);
	}

	.agent-text {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-style: italic;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	.agent-text.error-text {
		color: var(--error);
		font-style: normal;
		white-space: pre-wrap;
	}

	.agent-text.coming-soon-text {
		color: var(--text-tertiary);
	}

	.agent-text.success-text {
		color: var(--success, #6b8e6b);
		font-style: normal;
	}

	.agent-text.low-confidence-text {
		color: var(--text-secondary);
		line-height: 1.7;
	}

	.agent-text.partial-match-text {
		color: var(--text-secondary);
		line-height: 1.7;
	}

	.accent-divider {
		width: 40px;
		height: 1px;
		background: var(--accent);
		margin-top: var(--space-3);
	}

	/* User messages */
	.chat-message.user {
		display: flex;
		justify-content: flex-end;
	}

	.user-card {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		margin-left: var(--space-4);
		max-width: 85%;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
	}

	.user-text {
		margin: 0;
		line-height: 1.5;
	}

	.user-image {
		max-width: 200px;
		max-height: 200px;
		border-radius: var(--radius-md);
		object-fit: cover;
	}

	/* Wine result, enrichment, partial-match, and disambiguation don't need extra padding */
	.chat-message.has-wine-result,
	.chat-message.has-wine-enrichment,
	.chat-message.has-partial-match,
	.chat-message.has-disambiguation {
		padding-right: 0;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.chat-message.user {
			animation: none;
		}
	}
</style>
