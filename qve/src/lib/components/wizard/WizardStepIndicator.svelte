<script lang="ts">
	export let currentStep: number = 1;
	export let totalSteps: number = 4;
	export let labels: string[] = [];

	$: steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
</script>

<div class="step-indicator">
	{#each steps as step, index}
		{#if index > 0}
			<div class="step-line" class:completed={step <= currentStep}></div>
		{/if}
		<div
			class="step-dot"
			class:active={step === currentStep}
			class:completed={step < currentStep}
			title={labels[index] || `Step ${step}`}
		></div>
	{/each}
</div>

{#if labels.length > 0}
	<div class="step-labels">
		{#each labels as label, index}
			<span
				class="step-label"
				class:active={index + 1 === currentStep}
				class:completed={index + 1 < currentStep}
			>
				{label}
			</span>
		{/each}
	</div>
{/if}

<style>
	.step-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		margin-bottom: var(--space-8);
	}

	.step-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--divider);
		transition: all 0.3s var(--ease-out);
	}

	.step-dot.active {
		background: var(--accent);
		transform: scale(1.2);
	}

	.step-dot.completed {
		background: var(--accent-subtle);
	}

	.step-line {
		width: 40px;
		height: 1px;
		background: var(--divider);
		transition: background 0.3s var(--ease-out);
	}

	.step-line.completed {
		background: var(--accent-subtle);
	}

	.step-labels {
		display: none;
		justify-content: space-between;
		margin-bottom: var(--space-6);
	}

	.step-label {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
		transition: color 0.2s var(--ease-out);
	}

	.step-label.active {
		color: var(--accent);
	}

	.step-label.completed {
		color: var(--text-secondary);
	}

	@media (min-width: 768px) {
		.step-labels {
			display: flex;
		}
	}
</style>
