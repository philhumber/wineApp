<script lang="ts">
	/**
	 * TastingNotesSection
	 * Displays wine tasting notes
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
	$: tastingNotesField = state === 'streaming' ? fieldsMap.get('tastingNotes') : null;

	$: tastingNotes = state === 'streaming' ? tastingNotesField?.value : getFieldValue('tastingNotes');
	$: hasTastingNotes = state === 'streaming' ? !!tastingNotesField : hasField('tastingNotes');
	$: isTyping = state === 'streaming' ? (tastingNotesField?.isTyping ?? false) : false;
</script>

<section class="section">
	<h4 class="section-title">Tasting Notes</h4>
	{#if state === 'skeleton' || !hasTastingNotes}
		<div class="shimmer-container">
			<span class="shimmer-bar" style="width: 100%;"></span>
			<span class="shimmer-bar" style="width: 85%;"></span>
		</div>
	{:else}
		<p class="narrative-text">
			{#if state === 'streaming'}
				<FieldTypewriter
					value={tastingNotes}
					{isTyping}
					on:complete={() => handleFieldComplete('tastingNotes')}
				/>
			{:else}
				{tastingNotes}
			{/if}
		</p>
	{/if}
</section>

<style>
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

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shimmer-bar {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
