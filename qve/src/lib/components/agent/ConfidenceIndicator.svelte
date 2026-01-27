<script lang="ts">
	/**
	 * ConfidenceIndicator
	 * Visual display of confidence score with color-coded bar
	 *
	 * Thresholds:
	 * - 85-100%: High (success/green)
	 * - 60-84%: Good (warning/yellow)
	 * - 0-59%: Low (error/red)
	 */

	export let score: number;
	export let showLabel: boolean = true;
	export let compact: boolean = false;

	// Clamp score to 0-100
	$: normalizedScore = Math.max(0, Math.min(100, score));

	// Determine confidence level
	$: level = normalizedScore >= 85 ? 'high' : normalizedScore >= 60 ? 'good' : 'low';

	// Readable label
	$: levelLabel = level === 'high' ? 'High' : level === 'good' ? 'Good' : 'Low';
</script>

<div class="confidence" class:compact>
	<div class="bar-container">
		<div
			class="bar-fill"
			class:high={level === 'high'}
			class:good={level === 'good'}
			class:low={level === 'low'}
			style="width: {normalizedScore}%"
		></div>
	</div>

	{#if showLabel}
		<div class="label">
			<span class="percentage">{normalizedScore}%</span>
			<span class="level" class:high={level === 'high'} class:good={level === 'good'} class:low={level === 'low'}>
				{levelLabel}
			</span>
		</div>
	{/if}
</div>

<style>
	.confidence {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.confidence.compact {
		flex-direction: row;
		align-items: center;
		gap: var(--space-3);
	}

	.bar-container {
		flex: 1;
		height: 8px;
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.confidence.compact .bar-container {
		height: 6px;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-pill);
		transition: width 0.5s var(--ease-out);
	}

	.bar-fill.high {
		background: var(--success);
	}

	.bar-fill.good {
		background: var(--warning);
	}

	.bar-fill.low {
		background: var(--error);
	}

	.label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.confidence.compact .label {
		flex-shrink: 0;
	}

	.percentage {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.level {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.level.high {
		color: var(--success);
	}

	.level.good {
		color: var(--warning);
	}

	.level.low {
		color: var(--error);
	}
</style>
