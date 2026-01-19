<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../ui/Icon.svelte';

	export let currentStep: number = 1;
	export let totalSteps: number = 4;
	export let isSubmitting: boolean = false;
	export let canProceed: boolean = true;

	const dispatch = createEventDispatcher<{
		back: void;
		next: void;
		submit: void;
	}>();

	$: isFirstStep = currentStep === 1;
	$: isLastStep = currentStep === totalSteps;

	function handleBack() {
		if (!isFirstStep) {
			dispatch('back');
		}
	}

	function handleNext() {
		if (isLastStep) {
			dispatch('submit');
		} else {
			dispatch('next');
		}
	}
</script>

<div class="form-nav">
	<button
		type="button"
		class="btn btn-secondary"
		class:hidden={isFirstStep}
		disabled={isSubmitting}
		on:click={handleBack}
	>
		<Icon name="chevron-left" size={14} />
		Back
	</button>

	<button
		type="button"
		class="btn btn-primary"
		disabled={!canProceed || isSubmitting}
		on:click={handleNext}
	>
		{#if isSubmitting}
			Saving...
		{:else if isLastStep}
			Submit
			<Icon name="check" size={14} />
		{:else}
			Next
			<svg viewBox="0 0 24 24" width="14" height="14">
				<path d="M5 12h14M12 5l7 7-7 7" />
			</svg>
		{/if}
	</button>
</div>

<style>
	.form-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-5) var(--space-6);
		background: var(--bg-subtle);
		border-top: 1px solid var(--divider-subtle);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-5);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		border-radius: 100px;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.btn svg {
		width: 14px;
		height: 14px;
		stroke: currentColor;
		stroke-width: 2;
		fill: none;
	}

	.btn-secondary {
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--divider);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
	}

	.btn-secondary.hidden {
		visibility: hidden;
	}

	.btn-primary {
		color: var(--bg);
		background: var(--text-primary);
		border: 1px solid var(--text-primary);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--text-secondary);
		border-color: var(--text-secondary);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.form-nav {
			padding: var(--space-4);
		}
	}
</style>
