<script lang="ts">
	/**
	 * GrapeCompositionSection
	 * Displays grape varieties composition
	 */
	import GrapeComposition from './GrapeComposition.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	// Handle field name variations (grapes or grapeVarieties)
	$: grapes = getFieldValue('grapes') || getFieldValue('grapeVarieties');
	$: hasGrapes = hasField('grapes') || hasField('grapeVarieties');
	$: isArray = Array.isArray(grapes);
</script>

<section class="section">
	<h4 class="section-title">Grape Composition</h4>
	{#if state === 'skeleton' || !hasGrapes || !isArray}
		<div class="shimmer-container">
			<div class="shimmer-grapes">
				<span class="shimmer-pill"></span>
				<span class="shimmer-pill"></span>
			</div>
		</div>
	{:else}
		<GrapeComposition {grapes} />
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

	.shimmer-grapes {
		display: flex;
		gap: var(--space-2);
	}

	.shimmer-pill {
		display: block;
		width: 80px;
		height: 1.5em;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-pill);
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
		.shimmer-pill {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
