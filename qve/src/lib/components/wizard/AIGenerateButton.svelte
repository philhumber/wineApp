<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label: string = 'Get More Information...';
	export let disabled: boolean = false;
	export let loading: boolean = false;

	const dispatch = createEventDispatcher<{
		click: void;
	}>();

	function handleClick() {
		if (!disabled && !loading) {
			dispatch('click');
		}
	}
</script>

<button
	type="button"
	class="ai-button"
	class:loading
	{disabled}
	on:click={handleClick}
>
	<svg viewBox="0 0 24 24" class="ai-icon">
		<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
	</svg>
	{#if loading}
		<span class="loading-text">Generating...</span>
	{:else}
		{label}
	{/if}
</button>

<style>
	.ai-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--accent);
		background: transparent;
		border: 1px dashed var(--accent-subtle);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
		margin-bottom: var(--space-5);
	}

	.ai-button:hover:not(:disabled) {
		background: rgba(166, 155, 138, 0.05);
		border-style: solid;
	}

	.ai-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ai-button.loading {
		border-style: solid;
		background: rgba(166, 155, 138, 0.05);
	}

	.ai-icon {
		width: 16px;
		height: 16px;
		stroke: currentColor;
		stroke-width: 1.5;
		fill: none;
		flex-shrink: 0;
	}

	.ai-button.loading .ai-icon {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.loading-text {
		font-style: italic;
	}
</style>
