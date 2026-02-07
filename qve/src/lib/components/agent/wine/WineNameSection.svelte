<script lang="ts">
	/**
	 * WineNameSection
	 * Displays wine name with skeleton/streaming/static states
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
	// (Calling functions in reactive statements doesn't track Map changes)
	$: wineNameField = state === 'streaming' ? fieldsMap.get('wineName') : null;

	// Derive values from field state or use accessor functions
	$: wineName = state === 'streaming' ? wineNameField?.value : getFieldValue('wineName');
	$: hasWineName = state === 'streaming' ? !!wineNameField : hasField('wineName');
	$: isTyping = state === 'streaming' ? (wineNameField?.isTyping ?? false) : false;
	$: hasName = hasWineName && wineName && wineName !== 'Unknown Wine';
</script>

<div class="wine-name-section">
	{#if state === 'skeleton'}
		<span class="shimmer-line wine-name-shimmer"></span>
	{:else if hasName}
		{#if state === 'streaming'}
			<h3 class="wine-name">
				<FieldTypewriter
					value={wineName}
					{isTyping}
					on:complete={() => handleFieldComplete('wineName')}
				/>
			</h3>
		{:else}
			<h3 class="wine-name">{wineName}</h3>
		{/if}
	{:else}
		<span class="missing-label">Wine name needed</span>
	{/if}
</div>

<style>
	.wine-name-section {
		min-height: 1.75em;
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

	.missing-label {
		display: block;
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-style: italic;
		color: var(--text-tertiary);
	}

	.shimmer-line {
		display: block;
		height: 1.5rem;
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

	.wine-name-shimmer {
		width: 70%;
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
