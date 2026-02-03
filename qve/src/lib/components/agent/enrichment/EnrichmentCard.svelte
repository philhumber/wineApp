<script lang="ts">
	/**
	 * EnrichmentCard (static version)
	 * Displays completed enrichment data in chat history.
	 * Layout matches EnrichmentCardStreaming for visual consistency.
	 */
	import type { AgentEnrichmentData } from '$lib/api/types';
	import StyleProfileDisplay from './StyleProfileDisplay.svelte';
	import CriticScores from './CriticScores.svelte';
	import DrinkWindow from './DrinkWindow.svelte';
	import GrapeComposition from './GrapeComposition.svelte';

	export let data: AgentEnrichmentData;
	export let source: 'cache' | 'web_search' | 'inference' | undefined = undefined;

	// Section visibility - matches EnrichmentCardStreaming
	$: hasOverview = !!data.overview;
	$: hasStyleProfile = data.body || data.tannin || data.acidity;
	$: hasGrapes = data.grapeVarieties && data.grapeVarieties.length > 0;
	$: hasTastingNotes = !!data.tastingNotes;
	$: hasPairingNotes = !!data.pairingNotes;
	$: hasDrinkWindow = data.drinkWindow?.start || data.drinkWindow?.end;
	$: hasCriticScores = data.criticScores && data.criticScores.length > 0;
</script>

<div class="enrichment-card">
	<div class="card-header">
		<span class="header-title">Wine Details</span>
		{#if source}
			<span class="source-badge"
				>{source === 'cache' ? 'Cached' : source === 'web_search' ? 'Web' : 'AI'}</span
			>
		{/if}
	</div>

	<div class="card-content">
		<!-- Overview Section -->
		{#if hasOverview}
			<section class="section">
				<h4 class="section-title">Overview</h4>
				<p class="narrative-text">{data.overview}</p>
			</section>
		{/if}

		<!-- Style Profile Section -->
		{#if hasStyleProfile}
			<section class="section">
				<h4 class="section-title">Style Profile</h4>
				<StyleProfileDisplay body={data.body} tannin={data.tannin} acidity={data.acidity} />
			</section>
		{/if}

		<!-- Grape Composition Section -->
		{#if hasGrapes}
			<section class="section">
				<h4 class="section-title">Grape Composition</h4>
				<GrapeComposition grapes={data.grapeVarieties} />
			</section>
		{/if}

		<!-- Tasting Notes Section -->
		{#if hasTastingNotes}
			<section class="section">
				<h4 class="section-title">Tasting Notes</h4>
				<p class="narrative-text">{data.tastingNotes}</p>
			</section>
		{/if}

		<!-- Food Pairings Section -->
		{#if hasPairingNotes}
			<section class="section">
				<h4 class="section-title">Food Pairings</h4>
				<p class="narrative-text">{data.pairingNotes}</p>
			</section>
		{/if}

		<!-- Drink Window Section -->
		{#if hasDrinkWindow && data.drinkWindow}
			<section class="section">
				<h4 class="section-title">Drink Window</h4>
				<DrinkWindow
					start={data.drinkWindow.start ?? null}
					end={data.drinkWindow.end ?? null}
					maturity={data.drinkWindow.maturity}
				/>
			</section>
		{/if}

		<!-- Critic Scores Section -->
		{#if hasCriticScores}
			<section class="section">
				<h4 class="section-title">Critic Scores</h4>
				<CriticScores scores={data.criticScores} />
			</section>
		{/if}
	</div>
</div>

<style>
	.enrichment-card {
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-top: var(--space-3);
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--divider);
	}

	.header-title {
		font-weight: 600;
		color: var(--text-primary);
	}

	.source-badge {
		font-size: 0.75rem;
		padding: var(--space-1) var(--space-2);
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		color: var(--text-secondary);
	}

	.card-content {
		padding: var(--space-4);
	}

	.section {
		margin-bottom: var(--space-5);
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.narrative-text {
		font-family: var(--font-serif);
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--text-primary);
	}
</style>
