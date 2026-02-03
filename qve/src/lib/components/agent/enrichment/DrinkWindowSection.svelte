<script lang="ts">
	/**
	 * DrinkWindowSection
	 * Displays optimal drinking window for the wine
	 */
	import type { StreamingFieldState } from '$lib/stores/agent';
	import DrinkWindow from './DrinkWindow.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let fieldsMap: Map<string, StreamingFieldState> = new Map();
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	// For streaming mode, directly access fieldsMap to ensure proper Svelte reactivity
	$: drinkWindowField = state === 'streaming' ? fieldsMap.get('drinkWindow') : null;

	$: drinkWindow = (state === 'streaming' ? drinkWindowField?.value : getFieldValue('drinkWindow')) as
		| { start?: number; end?: number; maturity?: 'young' | 'ready' | 'peak' | 'declining' }
		| undefined;
	$: hasDrinkWindow = state === 'streaming' ? !!drinkWindowField : hasField('drinkWindow');
	$: hasWindowData = drinkWindow?.start || drinkWindow?.end;
</script>

<section class="section">
	<h4 class="section-title">Drink Window</h4>
	{#if state === 'skeleton' || !hasDrinkWindow || !hasWindowData}
		<div class="shimmer-container">
			<span class="shimmer-bar" style="width: 60%;"></span>
		</div>
	{:else if drinkWindow}
		<DrinkWindow
			start={drinkWindow.start ?? null}
			end={drinkWindow.end ?? null}
			maturity={drinkWindow.maturity}
		/>
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
