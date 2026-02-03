<script lang="ts">
	/**
	 * WineCardStreaming (WIN-181)
	 * Streaming wine card that shows skeleton placeholders that fill in
	 * as fields arrive from the LLM stream.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { agentStreamingFields, agentIsStreaming, agent } from '$lib/stores';
	import FieldTypewriter from './FieldTypewriter.svelte';
	import ConfidenceIndicator from './ConfidenceIndicator.svelte';
	import type { StreamingFieldState } from '$lib/stores/agent';

	onMount(() => {
		console.log('🎨 WineCardStreaming: MOUNTED');
	});

	onDestroy(() => {
		console.log('🎨 WineCardStreaming: DESTROYED');
	});

	// Field definitions for display order
	const fields = [
		{ key: 'producer', label: 'Producer', isMain: true },
		{ key: 'wineName', label: 'Wine', isMain: true },
		{ key: 'vintage', label: 'Vintage' },
		{ key: 'region', label: 'Region' },
		{ key: 'country', label: 'Country' },
		{ key: 'wineType', label: 'Type' },
		{ key: 'grapes', label: 'Grapes' }
	];

	$: streamingFields = $agentStreamingFields;
	$: isStreaming = $agentIsStreaming;

	// Debug: Log when component updates
	$: console.log('🎨 WineCardStreaming: streamingFields size:', streamingFields.size, [...streamingFields.keys()]);

	// Get field state - directly reference streamingFields for reactivity
	function getFieldState(key: string): StreamingFieldState | undefined {
		return streamingFields.get(key);
	}

	// Handler for when a field finishes typing
	function handleFieldComplete(field: string) {
		agent.markFieldTypingComplete(field);
	}

	// Get country flag emoji
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

	// Extract field states directly for proper Svelte reactivity
	// (Function calls in reactive statements don't track Map changes properly)
	$: producerField = streamingFields.get('producer');
	$: wineNameField = streamingFields.get('wineName');
	$: vintageField = streamingFields.get('vintage');
	$: regionField = streamingFields.get('region');
	$: countryField = streamingFields.get('country');
	$: wineTypeField = streamingFields.get('wineType');
	$: grapesField = streamingFields.get('grapes');
	$: confidenceField = streamingFields.get('confidence');

	// Derived booleans
	$: hasProducer = !!producerField;
	$: hasWineName = !!wineNameField;
	$: hasVintage = !!vintageField;
	$: hasRegion = !!regionField;
	$: hasCountry = !!countryField;
	$: hasType = !!wineTypeField;
	$: hasGrapes = !!grapesField;
	$: confidence = confidenceField ? (confidenceField.value as number) : null;

	// Get country for flag
	$: countryValue = countryField?.value as string | null;
	$: countryFlag = getCountryFlag(countryValue);
</script>

<!-- WIN-181: Streaming card stays visible until user takes action (no fade needed) -->
<div class="wine-card-streaming">
	<!-- Wine Name -->
	<div class="field-row main-field" class:has-value={hasWineName}>
		{#if hasWineName && wineNameField}
			<h3 class="wine-name">
				<FieldTypewriter
					value={wineNameField.value}
					isTyping={wineNameField.isTyping}
					on:complete={() => handleFieldComplete('wineName')}
				/>
			</h3>
		{:else}
			<span class="shimmer-line wine-name-shimmer"></span>
		{/if}
	</div>

	<!-- Producer -->
	<div class="field-row main-field" class:has-value={hasProducer}>
		{#if hasProducer && producerField}
			<p class="producer-name">
				<FieldTypewriter
					value={producerField.value}
					isTyping={producerField.isTyping}
					on:complete={() => handleFieldComplete('producer')}
				/>
			</p>
		{:else}
			<span class="shimmer-line producer-shimmer"></span>
		{/if}
	</div>

	<!-- Accent divider -->
	<div class="divider"></div>

	<!-- Metadata line (vintage · region · country) -->
	<div class="metadata-row">
		{#if hasVintage && vintageField}
			<span class="vintage">
				<FieldTypewriter
					value={vintageField.value}
					isTyping={vintageField.isTyping}
					on:complete={() => handleFieldComplete('vintage')}
				/>
			</span>
		{:else}
			<span class="shimmer-inline shimmer-vintage"></span>
		{/if}

		{#if hasVintage && (hasRegion || hasCountry)}
			<span class="separator"> · </span>
		{/if}

		{#if hasRegion && regionField}
			<span class="region">
				<FieldTypewriter
					value={regionField.value}
					isTyping={regionField.isTyping}
					on:complete={() => handleFieldComplete('region')}
				/>
			</span>
		{:else if !hasVintage}
			<span class="shimmer-inline shimmer-region"></span>
		{/if}

		{#if hasCountry && countryField}
			{#if hasRegion}
				<span class="separator"> · </span>
			{/if}
			<span class="country">
				<FieldTypewriter
					value={countryField.value}
					isTyping={countryField.isTyping}
					on:complete={() => handleFieldComplete('country')}
				/>
			</span>
			{#if countryFlag}
				<span class="flag">{countryFlag}</span>
			{/if}
		{/if}
	</div>

	<!-- Confidence indicator -->
	{#if confidence !== null}
		<div class="confidence-section">
			<ConfidenceIndicator score={confidence} />
		</div>
	{:else}
		<div class="confidence-section">
			<span class="shimmer-inline shimmer-confidence"></span>
		</div>
	{/if}

	<!-- Type and grapes -->
	<div class="details">
		{#if hasType && wineTypeField}
			<span class="type-badge">
				<FieldTypewriter
					value={wineTypeField.value}
					isTyping={wineTypeField.isTyping}
					speed={25}
					on:complete={() => handleFieldComplete('wineType')}
				/>
			</span>
		{:else}
			<span class="shimmer-badge"></span>
		{/if}

		{#if hasGrapes && grapesField}
			<span class="grapes">
				<FieldTypewriter
					value={grapesField.value}
					isTyping={grapesField.isTyping}
					on:complete={() => handleFieldComplete('grapes')}
				/>
			</span>
		{:else}
			<span class="shimmer-inline shimmer-grapes"></span>
		{/if}
	</div>
</div>

<style>
	/* No styling needed - container only exists for fade transition */

	.wine-card-streaming {
		padding: var(--space-5);
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--divider-subtle);
		animation: slideUp 0.3s var(--ease-out);
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

	.field-row {
		min-height: 1.5em;
		margin-bottom: var(--space-1);
	}

	.main-field {
		min-height: 1.75em;
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

	.divider {
		width: 40px;
		height: 1px;
		background: var(--accent);
		margin: var(--space-3) 0;
	}

	.metadata-row {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0 0 var(--space-4) 0;
		min-height: 1.25em;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0;
	}

	.separator {
		color: var(--text-tertiary);
	}

	.flag {
		margin-left: var(--space-1);
	}

	.confidence-section {
		margin-bottom: var(--space-4);
		min-height: 1.5em;
	}

	.details {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		min-height: 1.5em;
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

	/* Shimmer animations */
	.shimmer-line,
	.shimmer-inline,
	.shimmer-badge {
		display: inline-block;
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

	.shimmer-line {
		display: block;
		height: 1em;
	}

	.wine-name-shimmer {
		width: 70%;
		height: 1.5rem;
	}

	.producer-shimmer {
		width: 50%;
		height: 1.25rem;
	}

	.shimmer-inline {
		height: 1em;
	}

	.shimmer-vintage {
		width: 3em;
	}

	.shimmer-region {
		width: 8em;
	}

	.shimmer-confidence {
		width: 6em;
		height: 1.25em;
	}

	.shimmer-badge {
		width: 4em;
		height: 1.5em;
		border-radius: var(--radius-pill);
	}

	.shimmer-grapes {
		width: 12em;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.shimmer-line,
		.shimmer-inline,
		.shimmer-badge {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
