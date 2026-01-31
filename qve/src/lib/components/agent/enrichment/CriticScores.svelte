<script lang="ts">
	import type { CriticScore } from '$lib/api/types';

	export let scores: CriticScore[] | null = [];

	const criticAbbreviations: Record<string, string> = {
		'Wine Advocate': 'WA',
		'Wine Spectator': 'WS',
		'James Suckling': 'JS',
		Vinous: 'VIN',
		Decanter: 'DEC',
		'Jancis Robinson': 'JR'
	};

	function getScoreClass(score: number): string {
		if (score >= 95) return 'score-exceptional';
		if (score >= 90) return 'score-outstanding';
		if (score >= 85) return 'score-very-good';
		return 'score-good';
	}

	function getAbbreviation(critic: string): string {
		return criticAbbreviations[critic] || critic.substring(0, 3).toUpperCase();
	}
</script>

<div class="scores-grid">
	{#each scores ?? [] as { critic, score, year }}
		<div
			class="score-badge {getScoreClass(score)}"
			title="{critic}{year ? ` (${year})` : ''}"
		>
			<span class="critic-abbr">{getAbbreviation(critic)}</span>
			<span class="score-value">{score}</span>
		</div>
	{/each}
</div>

<style>
	.scores-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.score-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		min-width: 52px;
	}

	.critic-abbr {
		font-size: 0.6875rem;
		font-weight: 600;
		opacity: 0.8;
	}

	.score-value {
		font-size: 1rem;
		font-weight: 700;
	}

	/* Using muted palette colors */
	.score-exceptional {
		background: var(--score-exceptional-bg);
		color: var(--score-exceptional);
	}

	.score-outstanding {
		background: var(--score-outstanding-bg);
		color: var(--score-outstanding);
	}

	.score-very-good {
		background: var(--score-very-good-bg);
		color: var(--score-very-good);
	}

	.score-good {
		background: var(--score-good-bg);
		color: var(--score-good);
	}
</style>
