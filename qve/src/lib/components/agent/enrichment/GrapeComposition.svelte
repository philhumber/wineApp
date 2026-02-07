<script lang="ts">
	import type { GrapeVariety } from '$lib/api/types';

	export let grapes: GrapeVariety[] | null = [];

	// Parse numeric percentage from string (e.g., "75", "40-50%", "~60%")
	// Returns first number found, or null if none
	function parsePercentage(pct: string | null): number | null {
		if (!pct) return null;
		const match = pct.match(/(\d+)/);
		return match ? parseInt(match[1], 10) : null;
	}

	// Sort by percentage descending (parse number for sorting)
	$: sortedGrapes = [...(grapes ?? [])].sort(
		(a, b) => (parsePercentage(b.percentage) ?? 0) - (parsePercentage(a.percentage) ?? 0)
	);

	// Check if we have numeric percentages for bar display
	$: hasNumericPercentages = sortedGrapes.some((g) => parsePercentage(g.percentage) !== null);

	// Generate colors using CSS color-mix for theme awareness
	function getGrapeColor(index: number): string {
		const hueShift = index * 25;
		return `hsl(calc(var(--accent-hue, 350) + ${hueShift}), 45%, 40%)`;
	}
</script>

<div class="grape-composition">
	{#if sortedGrapes.length > 1 && hasNumericPercentages}
		<div class="stacked-bar" role="img" aria-label="Grape composition breakdown">
			{#each sortedGrapes as grape, i}
				{@const numericPct = parsePercentage(grape.percentage)}
				{#if numericPct}
					<div
						class="bar-segment"
						style="width: {numericPct}%; background-color: {getGrapeColor(i)};"
						title="{grape.grape}: {grape.percentage}"
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
					<span class="grape-percent"
						>{grape.percentage}{grape.percentage.includes('%') ? '' : '%'}</span
					>
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
