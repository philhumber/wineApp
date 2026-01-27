<script lang="ts">
	/**
	 * WineIdentificationCard
	 * Displays identified wine data with confidence indicator and actions
	 */
	import { createEventDispatcher } from 'svelte';
	import type { AgentParsedWine } from '$lib/api/types';
	import ConfidenceIndicator from './ConfidenceIndicator.svelte';

	const dispatch = createEventDispatcher<{
		addToCellar: { parsed: AgentParsedWine };
		tryAgain: void;
		confirm: { parsed: AgentParsedWine };
		edit: { parsed: AgentParsedWine };
	}>();

	export let parsed: AgentParsedWine;
	export let action: 'auto_populate' | 'suggest' | 'disambiguate';
	export let confidence: number;

	// Format grape list
	$: grapeList = parsed.grapes?.length ? parsed.grapes.join(', ') : null;

	// Build metadata string
	$: metadata = [parsed.vintage, parsed.region, parsed.country].filter(Boolean).join(' \u00B7 ');

	// Get country flag emoji (basic mapping)
	function getCountryFlag(country: string | null): string {
		if (!country) return '';
		const flags: Record<string, string> = {
			France: '\u{1F1EB}\u{1F1F7}',
			Italy: '\u{1F1EE}\u{1F1F9}',
			Spain: '\u{1F1EA}\u{1F1F8}',
			USA: '\u{1F1FA}\u{1F1F8}',
			Australia: '\u{1F1E6}\u{1F1FA}',
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

	function handleAddToCellar() {
		dispatch('addToCellar', { parsed });
	}

	function handleTryAgain() {
		dispatch('tryAgain');
	}

	function handleConfirm() {
		dispatch('confirm', { parsed });
	}

	function handleEdit() {
		dispatch('edit', { parsed });
	}
</script>

<div class="wine-card" class:suggest={action === 'suggest'}>
	<!-- Wine Name -->
	<h3 class="wine-name">
		{parsed.producer || parsed.wineName || 'Unknown Wine'}
	</h3>

	<!-- Accent divider -->
	<div class="divider"></div>

	<!-- Metadata line -->
	{#if metadata}
		<p class="metadata">
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

	<!-- Action buttons - vary based on action type -->
	<div class="actions">
		{#if action === 'auto_populate'}
			<!-- High confidence: Add directly -->
			<button class="btn btn-primary" on:click={handleAddToCellar}> Add to Cellar </button>
			<button class="btn btn-secondary" on:click={handleTryAgain}> Try Again </button>
		{:else if action === 'suggest'}
			<!-- Medium confidence: Confirm or Edit -->
			<button class="btn btn-primary" on:click={handleConfirm}> Confirm </button>
			<button class="btn btn-secondary" on:click={handleEdit}> Edit </button>
		{:else}
			<!-- Low confidence: handled by DisambiguationList -->
			<button class="btn btn-secondary" on:click={handleTryAgain}> Try Again </button>
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

	.wine-card.suggest {
		border-color: var(--warning);
		border-width: 1px;
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

	.wine-name {
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
		line-height: 1.2;
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
		margin-bottom: var(--space-5);
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

	.actions {
		display: flex;
		gap: var(--space-3);
	}

	.btn {
		flex: 1;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;

		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;

		border: none;
		border-radius: var(--radius-pill);
		cursor: pointer;
		touch-action: manipulation;

		transition:
			background 0.15s var(--ease-out),
			transform 0.15s var(--ease-out),
			opacity 0.15s var(--ease-out);
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--text-primary);
		color: var(--bg);
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--divider);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--bg-subtle);
		border-color: var(--accent);
	}
</style>
