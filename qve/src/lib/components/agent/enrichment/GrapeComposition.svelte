<script lang="ts">
	import type { GrapeVariety } from '$lib/api/types';

	export let grapes: GrapeVariety[] | null = [];

	// Sort by percentage descending
	$: sortedGrapes = [...(grapes ?? [])].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));

	// Generate colors using CSS color-mix for theme awareness
	function getGrapeColor(index: number): string {
		const hueShift = index * 25;
		return `hsl(calc(var(--accent-hue, 350) + ${hueShift}), 45%, 40%)`;
	}
</script>

<div class="grape-composition">
	{#if sortedGrapes.length > 1}
		<div class="stacked-bar" role="img" aria-label="Grape composition breakdown">
			{#each sortedGrapes as grape, i}
				{#if grape.percentage}
					<div
						class="bar-segment"
						style="width: {grape.percentage}%; background-color: {getGrapeColor(i)};"
						title="{grape.grape}: {grape.percentage}%"
					></div>
				{/if}
			{/each}
		</div>
	{/if}

	<ul class="grape-list">
		{#each sortedGrapes as grape, i}
			<li class="grape-item">
				<span class="grape-dot" style="background-color: {getGrapeColor(i)};"></span>
				<span class="grape-name">{grape.grape}</span>
				{#if grape.percentage}
					<span class="grape-percent">{grape.percentage}%</span>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.grape-composition {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.stacked-bar {
		display: flex;
		height: 12px;
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.bar-segment {
		transition: width 0.5s ease-out;
	}

	.grape-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.grape-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.grape-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.grape-name {
		font-size: 0.875rem;
		color: var(--text-primary);
		flex: 1;
	}

	.grape-percent {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 40px;
		text-align: right;
	}
</style>
