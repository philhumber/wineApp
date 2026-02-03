<script lang="ts">
	/**
	 * ActionChips
	 * Premium card-style action buttons for agent conversation
	 * 12px radius, shadow, min-height 44px touch targets
	 */
	import { createEventDispatcher } from 'svelte';
	import { Icon, type IconName } from '$lib/components';
	import type { AgentChip } from '$lib/stores';

	const dispatch = createEventDispatcher<{
		select: { action: string };
	}>();

	export let chips: AgentChip[] = [];

	function handleClick(chip: AgentChip) {
		if (!chip.disabled) {
			dispatch('select', { action: chip.action });
		}
	}

	function handleKeydown(e: KeyboardEvent, chip: AgentChip) {
		if ((e.key === 'Enter' || e.key === ' ') && !chip.disabled) {
			e.preventDefault();
			dispatch('select', { action: chip.action });
		}
	}
</script>

<div class="action-chips" role="group" aria-label="Available actions">
	{#each chips as chip (chip.id)}
		<button
			class="action-chip"
			class:disabled={chip.disabled}
			disabled={chip.disabled}
			on:click={() => handleClick(chip)}
			on:keydown={(e) => handleKeydown(e, chip)}
			aria-disabled={chip.disabled}
		>
			{#if chip.icon}
				<Icon name={chip.icon as IconName} size={16} />
			{/if}
			<span class="chip-label">{chip.label}</span>
		</button>
	{/each}
</div>

<style>
	.action-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: flex-end; /* WIN-174: Right-align chips */
		margin-top: var(--space-4);
		padding-right: var(--space-4);
	}

	.action-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		min-height: 44px;

		font-family: var(--font-sans);
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--text-primary);

		background: var(--surface);
		border: 1px solid var(--divider);
		border-radius: var(--radius-lg);

		box-shadow: var(--shadow-sm);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			border-color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			transform 0.2s var(--ease-out),
			background 0.2s var(--ease-out);
	}

	.action-chip:hover:not(:disabled) {
		border-color: var(--accent);
		box-shadow: var(--shadow-md);
		transform: translateY(-1px);
	}

	.action-chip:active:not(:disabled) {
		transform: scale(0.98) translateY(0);
		box-shadow: var(--shadow-sm);
	}

	.action-chip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* WIN-174: Enhanced disabled styling - flattened appearance */
	.action-chip.disabled,
	.action-chip:disabled {
		opacity: 0.6;
		cursor: default;
		pointer-events: none;
		box-shadow: none;
		border-color: var(--divider-subtle);
		background: var(--bg-subtle);
	}

	.action-chip :global(.icon) {
		flex-shrink: 0;
		color: var(--accent);
	}

	.chip-label {
		white-space: nowrap;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.action-chip {
			transition: none;
		}

		.action-chip:hover:not(:disabled) {
			transform: none;
		}

		.action-chip:active:not(:disabled) {
			transform: none;
		}
	}
</style>
