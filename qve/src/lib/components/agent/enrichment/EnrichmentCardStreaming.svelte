<script lang="ts">
	/**
	 * EnrichmentCardStreaming (WIN-181)
	 * Streaming enrichment card that shows skeleton placeholders
	 * that fill in as fields arrive from the LLM stream.
	 *
	 * NOTE: We subscribe directly to the store instead of using props
	 * because Svelte's reactivity doesn't properly track Map.get() calls
	 * when the Map is passed as a prop.
	 */
	import { agentStreamingFields, agentEnriching } from '$lib/stores';
	import FieldTypewriter from '../FieldTypewriter.svelte';
	import StyleProfileDisplay from './StyleProfileDisplay.svelte';
	import CriticScores from './CriticScores.svelte';
	import DrinkWindow from './DrinkWindow.svelte';
	import GrapeComposition from './GrapeComposition.svelte';

	// Subscribe directly to stores for reliable reactivity
	$: streamingFields = $agentStreamingFields;
	$: isStreaming = $agentEnriching;

	// Extract field states - using store subscription for reactivity
	$: bodyField = streamingFields.get('body');
	$: styleField = streamingFields.get('style');
	$: tanninField = streamingFields.get('tannin');
	$: acidityField = streamingFields.get('acidity');
	$: criticScoresField = streamingFields.get('criticScores');
	$: drinkWindowField = streamingFields.get('drinkWindow');
	$: grapesField = streamingFields.get('grapes');
	$: grapeVarietiesField = streamingFields.get('grapeVarieties');
	$: descriptionField = streamingFields.get('description');
	$: overviewField = streamingFields.get('overview');
	$: tastingNotesField = streamingFields.get('tastingNotes');
	$: pairingsField = streamingFields.get('pairings');
	$: pairingNotesField = streamingFields.get('pairingNotes');

	// Derived booleans for section visibility
	$: hasStyleProfile = !!bodyField || !!styleField || !!tanninField || !!acidityField;
	$: hasCriticScores = !!criticScoresField;
	$: hasDrinkWindow = !!drinkWindowField;
	$: hasGrapes = !!grapesField || !!grapeVarietiesField;
	$: hasOverview = !!descriptionField || !!overviewField;
	$: hasTastingNotes = !!tastingNotesField;
	$: hasPairingNotes = !!pairingsField || !!pairingNotesField;

	// Get field values with proper type casting
	$: grapes = grapesField?.value || grapeVarietiesField?.value;
	$: criticScores = criticScoresField?.value;
	$: drinkWindow = drinkWindowField?.value as { start?: number; end?: number; maturity?: 'young' | 'ready' | 'peak' | 'declining' } | undefined;
	$: body = bodyField?.value || styleField?.value;
	$: tannin = tanninField?.value;
	$: acidity = acidityField?.value;
	$: overview = descriptionField?.value || overviewField?.value;
	$: tastingNotes = tastingNotesField?.value;
	$: pairingNotes = pairingsField?.value || pairingNotesField?.value;

	// Track typing states
	$: descriptionTyping = descriptionField?.isTyping || overviewField?.isTyping || false;
	$: tastingNotesTyping = tastingNotesField?.isTyping || false;
	$: pairingNotesTyping = pairingsField?.isTyping || pairingNotesField?.isTyping || false;
</script>

<div class="enrichment-card" class:complete={!isStreaming}>
	<div class="card-header">
		<span class="header-title">Wine Details</span>
		{#if isStreaming}
			<span class="source-badge streaming">Researching...</span>
		{:else}
			<span class="source-badge">Research complete</span>
		{/if}
	</div>

	<div class="card-content">
		<!-- Overview Section -->
		<section class="section">
			<h4 class="section-title">Overview</h4>
			{#if hasOverview}
				<p class="narrative-text">
					<FieldTypewriter
						value={overview}
						isTyping={descriptionTyping}
					/>
				</p>
			{:else}
				<div class="shimmer-container">
					<span class="shimmer-bar" style="width: 100%;"></span>
					<span class="shimmer-bar" style="width: 90%;"></span>
					<span class="shimmer-bar" style="width: 70%;"></span>
				</div>
			{/if}
		</section>

		<!-- Style Profile Section -->
		<section class="section">
			<h4 class="section-title">Style Profile</h4>
			{#if hasStyleProfile}
				<StyleProfileDisplay
					body={body as string | null}
					tannin={tannin as string | null}
					acidity={acidity as string | null}
				/>
			{:else}
				<div class="shimmer-container">
					<span class="shimmer-bar" style="width: 100%;"></span>
					<span class="shimmer-bar" style="width: 80%;"></span>
				</div>
			{/if}
		</section>

		<!-- Grape Composition Section -->
		<section class="section">
			<h4 class="section-title">Grape Composition</h4>
			{#if hasGrapes && Array.isArray(grapes)}
				<GrapeComposition grapes={grapes} />
			{:else}
				<div class="shimmer-container">
					<div class="shimmer-grapes">
						<span class="shimmer-pill"></span>
						<span class="shimmer-pill"></span>
					</div>
				</div>
			{/if}
		</section>

		<!-- Tasting Notes Section -->
		<section class="section">
			<h4 class="section-title">Tasting Notes</h4>
			{#if hasTastingNotes}
				<p class="narrative-text">
					<FieldTypewriter
						value={tastingNotes}
						isTyping={tastingNotesTyping}
					/>
				</p>
			{:else}
				<div class="shimmer-container">
					<span class="shimmer-bar" style="width: 100%;"></span>
					<span class="shimmer-bar" style="width: 85%;"></span>
				</div>
			{/if}
		</section>

		<!-- Food Pairings Section -->
		<section class="section">
			<h4 class="section-title">Food Pairings</h4>
			{#if hasPairingNotes}
				<p class="narrative-text">
					<FieldTypewriter
						value={pairingNotes}
						isTyping={pairingNotesTyping}
					/>
				</p>
			{:else}
				<div class="shimmer-container">
					<span class="shimmer-bar" style="width: 100%;"></span>
					<span class="shimmer-bar" style="width: 75%;"></span>
				</div>
			{/if}
		</section>

		<!-- Drink Window Section -->
		<section class="section">
			<h4 class="section-title">Drink Window</h4>
			{#if hasDrinkWindow && drinkWindow}
				<DrinkWindow
					start={drinkWindow.start ?? null}
					end={drinkWindow.end ?? null}
					maturity={drinkWindow.maturity}
				/>
			{:else}
				<div class="shimmer-container">
					<span class="shimmer-bar" style="width: 60%;"></span>
				</div>
			{/if}
		</section>

		<!-- Critic Scores Section -->
		<section class="section">
			<h4 class="section-title">Critic Scores</h4>
			{#if hasCriticScores && Array.isArray(criticScores)}
				<CriticScores scores={criticScores} />
			{:else}
				<div class="shimmer-container">
					<div class="shimmer-scores">
						<span class="shimmer-score"></span>
						<span class="shimmer-score"></span>
						<span class="shimmer-score"></span>
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.enrichment-card {
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		margin-top: var(--space-3);
		animation: slideUp 0.3s ease-out;
	}

	.enrichment-card.complete {
		border: 1px solid var(--accent);
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

	.source-badge.streaming {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
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

	/* Shimmer animations */
	.shimmer-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.shimmer-bar {
		display: block;
		height: 1em;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-sm);
	}

	.shimmer-scores {
		display: flex;
		gap: var(--space-3);
	}

	.shimmer-score {
		display: block;
		width: 60px;
		height: 40px;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-md);
	}

	.shimmer-grapes {
		display: flex;
		gap: var(--space-2);
	}

	.shimmer-pill {
		display: block;
		width: 80px;
		height: 1.5em;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-pill);
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.shimmer-bar,
		.shimmer-score,
		.shimmer-pill {
			animation: none;
			background: var(--bg-subtle);
		}
		.source-badge.streaming {
			animation: none;
		}
	}
</style>
