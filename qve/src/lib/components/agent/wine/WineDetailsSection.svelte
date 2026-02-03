<script lang="ts">
	/**
	 * WineDetailsSection
	 * Displays wine type badge and grape varieties
	 */
	import FieldTypewriter from '../FieldTypewriter.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;
	export let isFieldTyping: (field: string) => boolean;
	export let handleFieldComplete: (field: string) => void;

	$: wineType = getFieldValue('wineType');
	$: grapes = getFieldValue('grapes');

	$: hasType = hasField('wineType');
	$: hasGrapes = hasField('grapes');

	$: typeTyping = isFieldTyping('wineType');
	$: grapesTyping = isFieldTyping('grapes');

	// Format grapes for display (handle array or string)
	$: grapeList = Array.isArray(grapes) ? grapes.join(', ') : grapes;
</script>

<div class="details">
	{#if state === 'skeleton'}
		<span class="shimmer-badge"></span>
		<span class="shimmer-inline shimmer-grapes"></span>
	{:else}
		{#if hasType}
			<span class="type-badge">
				{#if state === 'streaming'}
					<FieldTypewriter
						value={wineType}
						isTyping={typeTyping}
						speed={25}
						on:complete={() => handleFieldComplete('wineType')}
					/>
				{:else}
					{wineType}
				{/if}
			</span>
		{/if}

		{#if hasGrapes}
			<span class="grapes">
				{#if state === 'streaming'}
					<FieldTypewriter
						value={grapeList}
						isTyping={grapesTyping}
						on:complete={() => handleFieldComplete('grapes')}
					/>
				{:else}
					{grapeList}
				{/if}
			</span>
		{/if}
	{/if}
</div>

<style>
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

	.shimmer-badge {
		width: 4em;
		height: 1.5em;
		border-radius: var(--radius-pill);
	}

	.shimmer-inline {
		height: 1em;
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

	@media (prefers-reduced-motion: reduce) {
		.shimmer-inline,
		.shimmer-badge {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
