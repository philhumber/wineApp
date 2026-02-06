<script lang="ts">
	/**
	 * WineProducerSection
	 * Displays producer with skeleton/streaming/static states
	 */
	import type { StreamingField } from '$lib/agent/types';
	import FieldTypewriter from '../FieldTypewriter.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let fieldsMap: Map<string, StreamingField> = new Map();
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;
	export let isFieldTyping: (field: string) => boolean;
	export let handleFieldComplete: (field: string) => void;

	// For streaming mode, directly access fieldsMap to ensure proper Svelte reactivity
	$: producerField = state === 'streaming' ? fieldsMap.get('producer') : null;

	// Derive values from field state or use accessor functions
	$: producer = state === 'streaming' ? producerField?.value : getFieldValue('producer');
	$: hasProducer = state === 'streaming' ? !!producerField : hasField('producer');
	$: isTyping = state === 'streaming' ? (producerField?.isTyping ?? false) : false;
	$: showProducer = hasProducer && producer && producer !== 'Unknown';
</script>

<div class="producer-section">
	{#if state === 'skeleton'}
		<span class="shimmer-line producer-shimmer"></span>
	{:else if showProducer}
		{#if state === 'streaming'}
			<p class="producer-name">
				<FieldTypewriter
					value={producer}
					{isTyping}
					on:complete={() => handleFieldComplete('producer')}
				/>
			</p>
		{:else}
			<p class="producer-name">{producer}</p>
		{/if}
	{/if}
</div>

<style>
	.producer-section {
		min-height: 1.5em;
		margin-bottom: var(--space-1);
	}

	.producer-name {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: var(--space-1) 0 0 0;
	}

	.shimmer-line {
		display: block;
		height: 1.25rem;
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

	.producer-shimmer {
		width: 50%;
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
		.shimmer-line {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
