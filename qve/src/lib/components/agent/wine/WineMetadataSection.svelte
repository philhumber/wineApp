<script lang="ts">
	/**
	 * WineMetadataSection
	 * Displays vintage · region · country with flag
	 */
	import FieldTypewriter from '../FieldTypewriter.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;
	export let isFieldTyping: (field: string) => boolean;
	export let handleFieldComplete: (field: string) => void;

	$: vintage = getFieldValue('vintage');
	$: region = getFieldValue('region');
	$: country = getFieldValue('country');

	$: hasVintage = hasField('vintage');
	$: hasRegion = hasField('region');
	$: hasCountry = hasField('country');

	$: vintageTyping = isFieldTyping('vintage');
	$: regionTyping = isFieldTyping('region');
	$: countryTyping = isFieldTyping('country');

	// Country flag emoji mapping
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

	$: countryFlag = getCountryFlag(country);
	$: hasAnyMetadata = hasVintage || hasRegion || hasCountry;
</script>

{#if state === 'skeleton' || hasAnyMetadata}
	<div class="divider"></div>

	<div class="metadata-row">
		{#if state === 'skeleton'}
			<span class="shimmer-inline shimmer-vintage"></span>
			<span class="separator"> · </span>
			<span class="shimmer-inline shimmer-region"></span>
		{:else}
			{#if hasVintage}
				<span class="vintage">
					{#if state === 'streaming'}
						<FieldTypewriter
							value={vintage}
							isTyping={vintageTyping}
							on:complete={() => handleFieldComplete('vintage')}
						/>
					{:else}
						{vintage}
					{/if}
				</span>
			{/if}

			{#if hasVintage && (hasRegion || hasCountry)}
				<span class="separator"> · </span>
			{/if}

			{#if hasRegion}
				<span class="region">
					{#if state === 'streaming'}
						<FieldTypewriter
							value={region}
							isTyping={regionTyping}
							on:complete={() => handleFieldComplete('region')}
						/>
					{:else}
						{region}
					{/if}
				</span>
			{/if}

			{#if hasCountry}
				{#if hasRegion}
					<span class="separator"> · </span>
				{/if}
				<span class="country">
					{#if state === 'streaming'}
						<FieldTypewriter
							value={country}
							isTyping={countryTyping}
							on:complete={() => handleFieldComplete('country')}
						/>
					{:else}
						{country}
					{/if}
				</span>
				{#if countryFlag}
					<span class="flag">{countryFlag}</span>
				{/if}
			{/if}
		{/if}
	</div>
{/if}

<style>
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

	.shimmer-inline {
		display: inline-block;
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

	.shimmer-vintage {
		width: 3em;
	}

	.shimmer-region {
		width: 8em;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shimmer-inline {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
