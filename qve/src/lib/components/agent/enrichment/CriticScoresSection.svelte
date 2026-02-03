<script lang="ts">
	/**
	 * CriticScoresSection
	 * Displays critic scores and ratings
	 */
	import CriticScores from './CriticScores.svelte';

	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;

	$: criticScores = getFieldValue('criticScores');
	$: hasCriticScores = hasField('criticScores');
	$: isArray = Array.isArray(criticScores) && criticScores.length > 0;
</script>

<section class="section">
	<h4 class="section-title">Critic Scores</h4>
	{#if state === 'skeleton' || !hasCriticScores || !isArray}
		<div class="shimmer-container">
			<div class="shimmer-scores">
				<span class="shimmer-score"></span>
				<span class="shimmer-score"></span>
				<span class="shimmer-score"></span>
			</div>
		</div>
	{:else}
		<CriticScores scores={criticScores} />
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

	.shimmer-scores {
		display: flex;
		gap: var(--space-3);
	}

	.shimmer-score {
		display: block;
		width: 60px;
		height: 40px;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-md);
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
		.shimmer-score {
			animation: none;
			background: var(--bg-subtle);
		}
	}
</style>
