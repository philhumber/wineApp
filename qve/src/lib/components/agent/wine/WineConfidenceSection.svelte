<script lang="ts">
	/**
	 * WineConfidenceSection
	 * Displays confidence indicator with skeleton fallback
	 */
	import type { StreamingField } from '$lib/agent/types';
	import ConfidenceIndicator from '../ConfidenceIndicator.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let fieldsMap: Map<string, StreamingField> = new Map();
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	// For streaming mode, directly access fieldsMap to ensure proper Svelte reactivity
	$: confidenceField = state === 'streaming' ? fieldsMap.get('confidence') : null;

	// Derive values from field state or use accessor functions
	$: confidence = (state === 'streaming' ? confidenceField?.value : getFieldValue('confidence')) as number | null;
	$: hasConfidence = state === 'streaming' ? !!confidenceField : hasField('confidence');
</script>

<div class="confidence-section">
	{#if state === 'skeleton' || !hasConfidence || confidence === null}
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
