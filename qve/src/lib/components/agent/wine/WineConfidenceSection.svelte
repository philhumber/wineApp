<script lang="ts">
	/**
	 * WineConfidenceSection
	 * Displays confidence indicator with skeleton fallback
	 */
	import ConfidenceIndicator from '../ConfidenceIndicator.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	$: confidence = getFieldValue('confidence') as number | null;
	$: hasConfidence = hasField('confidence');
</script>

<div class="confidence-section">
	{#if state === 'skeleton' || !hasConfidence}
		<span class="shimmer-inline shimmer-confidence"></span>
	{:else}
		<ConfidenceIndicator score={confidence} />
	{/if}
</div>

<style>
	.confidence-section {
		margin-bottom: var(--space-4);
		min-height: 1.5em;
	}

	.shimmer-inline {
		display: inline-block;
		height: 1.25em;
		width: 6em;
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

	.shimmer-confidence {
		width: 6em;
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
