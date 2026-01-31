<script lang="ts">
	/**
	 * WineIdentificationCard
	 * Displays identified wine data with confidence indicator
	 */
	import type { AgentParsedWine } from '$lib/api/types';
	import ConfidenceIndicator from './ConfidenceIndicator.svelte';

	export let parsed: AgentParsedWine;
	export let confidence: number;

	// Format grape list
	$: grapeList = parsed.grapes?.length ? parsed.grapes.join(', ') : null;

	// Check if wine name is missing/unknown
	$: hasWineName = parsed.wineName && parsed.wineName !== 'Unknown Wine';

	// Determine display name - show placeholder if no wine name
	$: displayName = hasWineName ? parsed.wineName : null;

	// Always show producer if available (as subtitle when wine name exists, as main info when no wine name)
	$: showProducer = parsed.producer && parsed.producer !== 'Unknown';

	// Build metadata string (region · country)
	$: metadata = [parsed.region, parsed.country].filter(Boolean).join(' · ');

	// Get country flag emoji (basic mapping)
	function getCountryFlag(country: string | null): string {
		if (!country) return '';
		const flags: Record<string, string> = {
			France: '\u{1F1EB}\u{1F1F7}',
			Italy: '\u{1F1EE}\u{1F1F9}',
			Spain: '\u{1F1EA}\u{1F1F8}',
			USA: '\u{1F1FA}\u{1F1F8}',
			Australia: '\u{1F1E6}\u{1F1FA}',
			Austria: '\u{1F1E6}\u{1F1F9}',
			'New Zealand': '\u{1F1F3}\u{1F1FF}',
			Argentina: '\u{1F1E6}\u{1F1F7}',
			Chile: '\u{1F1E8}\u{1F1F1}',
			Germany: '\u{1F1E9}\u{1F1EA}',
			Portugal: '\u{1F1F5}\u{1F1F9}',
			'South Africa': '\u{1F1FF}\u{1F1E6}'
		};
		return flags[country] || '';
	}

	$: countryFlag = getCountryFlag(parsed.country);
</script>

<div class="wine-card" class:incomplete={!hasWineName}>
	<!-- Wine Name -->
	{#if displayName}
		<h3 class="wine-name">{displayName}</h3>
	{:else}
		<span class="missing-label">Wine name needed</span>
	{/if}

	<!-- Producer (always show if available) -->
	{#if showProducer}
		<p class="producer-name">{parsed.producer}</p>
	{/if}

	<!-- Accent divider -->
	<div class="divider"></div>

	<!-- Metadata line (vintage · region · country) -->
	{#if parsed.vintage || metadata}
		<p class="metadata">
			{#if parsed.vintage}{parsed.vintage}{/if}
			{#if parsed.vintage && metadata} · {/if}
			{metadata}
			{#if countryFlag}
				<span class="flag">{countryFlag}</span>
			{/if}
		</p>
	{/if}

	<!-- Confidence indicator -->
	<div class="confidence-section">
		<ConfidenceIndicator score={confidence} />
	</div>

	<!-- Type and grapes -->
	<div class="details">
		{#if parsed.wineType}
			<span class="type-badge">{parsed.wineType}</span>
		{/if}
		{#if grapeList}
			<span class="grapes">{grapeList}</span>
		{/if}
	</div>

</div>

<style>
	.wine-card {
		padding: var(--space-5);
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--divider-subtle);

		animation: slideUp 0.3s var(--ease-out);
	}

	.wine-card.incomplete {
		border-color: var(--warning);
		border-style: dashed;
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

	.missing-label {
		display: block;
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-style: italic;
		color: var(--text-tertiary);
		margin-bottom: var(--space-1);
	}

	.wine-name {
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.2;
	}

	.producer-name {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: var(--space-1) 0 0 0;
	}

	/* When wine name is missing, producer becomes main identifier */
	.wine-card.incomplete .producer-name {
		font-size: 1.5rem;
		margin-top: var(--space-2);
	}

	.divider {
		width: 40px;
		height: 1px;
		background: var(--accent);
		margin: var(--space-3) 0;
	}

	.metadata {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0 0 var(--space-4) 0;
	}

	.flag {
		margin-left: var(--space-1);
	}

	.confidence-section {
		margin-bottom: var(--space-4);
	}

	.details {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.type-badge {
		display: inline-block;
		padding: 2px 8px;
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		font-family: var(--font-sans);
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.grapes {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--text-tertiary);
	}
</style>
