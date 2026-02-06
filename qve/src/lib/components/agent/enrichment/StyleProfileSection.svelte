<script lang="ts">
	/**
	 * StyleProfileSection
	 * Displays wine style profile (body, tannin, acidity)
	 */
	import type { StreamingField } from '$lib/agent/types';
	import StyleProfileDisplay from './StyleProfileDisplay.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let fieldsMap: Map<string, StreamingField> = new Map();
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	// For streaming mode, directly access fieldsMap to ensure proper Svelte reactivity
	$: bodyField = state === 'streaming' ? (fieldsMap.get('body') || fieldsMap.get('style')) : null;
	$: tanninField = state === 'streaming' ? fieldsMap.get('tannin') : null;
	$: acidityField = state === 'streaming' ? fieldsMap.get('acidity') : null;

	// Handle field name variations (body or style)
	$: body = state === 'streaming' ? bodyField?.value : (getFieldValue('body') || getFieldValue('style'));
	$: tannin = state === 'streaming' ? tanninField?.value : getFieldValue('tannin');
	$: acidity = state === 'streaming' ? acidityField?.value : getFieldValue('acidity');

	$: hasStyleProfile = state === 'streaming'
		? !!(bodyField || tanninField || acidityField)
		: (hasField('body') || hasField('style') || hasField('tannin') || hasField('acidity'));
</script>

<!-- Hide entire section in static state when no data available -->
{#if state !== 'static' || hasStyleProfile}
	<section class="section">
		<h4 class="section-title">Style Profile</h4>
		{#if state === 'skeleton' || !hasStyleProfile}
			<div class="shimmer-container">
				<span class="shimmer-bar" style="width: 100%;"></span>
				<span class="shimmer-bar" style="width: 80%;"></span>
			</div>
		{:else}
			<StyleProfileDisplay
				body={body as string | null}
				tannin={tannin as string | null}
				acidity={acidity as string | null}
			/>
		{/if}
	</section>
{/if}

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
