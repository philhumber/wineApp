<script lang="ts">
	/**
	 * BottleSelector component
	 * Pill-based selector for choosing which bottle to edit
	 * WIN-80: Added × delete buttons on each bottle pill
	 */
	import { createEventDispatcher } from 'svelte';
	import type { Bottle } from '$lib/api/types';

	export let bottles: Bottle[] = [];
	export let selectedID: number | null = null;
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		select: { bottleID: number };
		delete: { bottle: Bottle };
	}>();

	function handleSelect(bottleID: number) {
		if (!disabled) {
			dispatch('select', { bottleID });
		}
	}

	function handleDelete(event: MouseEvent, bottle: Bottle) {
		event.stopPropagation(); // Prevent selecting the bottle
		if (!disabled) {
			dispatch('delete', { bottle });
		}
	}

	function handleKeydown(event: KeyboardEvent, bottleID: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSelect(bottleID);
		}
	}

	function handleDeleteKeydown(event: KeyboardEvent, bottle: Bottle) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			if (!disabled) {
				dispatch('delete', { bottle });
			}
		}
	}

	/**
	 * Format bottle label: "Size - Source (Date)"
	 */
	function formatBottleLabel(bottle: Bottle): string {
		const parts: string[] = [];

		// Size (extract just the name, e.g., "Standard" from "Standard (750ml)")
		const sizeName = bottle.bottleSize?.split(' (')[0] || 'Unknown';
		parts.push(sizeName);

		// Source
		if (bottle.bottleSource) {
			parts.push(bottle.bottleSource);
		}

		// Date (format as "Jan 2026")
		let dateStr = '';
		if (bottle.purchaseDate) {
			const date = new Date(bottle.purchaseDate);
			if (!isNaN(date.getTime())) {
				const month = date.toLocaleString('en-US', { month: 'short' });
				const year = date.getFullYear();
				dateStr = `${month} ${year}`;
			}
		}

		if (dateStr) {
			return `${parts.join(' - ')} (${dateStr})`;
		}

		return parts.join(' - ');
	}
</script>

<div class="bottle-selector" class:disabled>
	<span class="bottle-selector-label">Select Bottle to Edit</span>

	{#if bottles.length === 0}
		<div class="empty-state">
			<p>No bottles available to edit</p>
		</div>
	{:else}
		<div class="bottle-options">
			{#each bottles as bottle (bottle.bottleID)}
				<div class="bottle-pill" class:active={selectedID === bottle.bottleID}>
					<button
						type="button"
						class="bottle-option"
						class:active={selectedID === bottle.bottleID}
						on:click={() => handleSelect(bottle.bottleID)}
						on:keydown={(e) => handleKeydown(e, bottle.bottleID)}
						{disabled}
					>
						{formatBottleLabel(bottle)}
					</button>
					<button
						type="button"
						class="bottle-delete"
						title="Delete bottle"
						aria-label="Delete {formatBottleLabel(bottle)}"
						on:click={(e) => handleDelete(e, bottle)}
						on:keydown={(e) => handleDeleteKeydown(e, bottle)}
						{disabled}
					>
						×
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.bottle-selector {
		margin-bottom: var(--space-5);
	}

	.bottle-selector.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.bottle-selector-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin-bottom: var(--space-3);
	}

	.bottle-options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.bottle-pill {
		display: flex;
		align-items: center;
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 100px;
		transition: all 0.2s var(--ease-out);
	}

	.bottle-pill:hover {
		border-color: var(--accent-subtle);
	}

	.bottle-pill.active {
		background: var(--surface);
		border-color: var(--accent);
	}

	.bottle-option {
		padding: var(--space-2) var(--space-3);
		padding-right: var(--space-1);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.2s var(--ease-out);
	}

	.bottle-option.active {
		color: var(--text-primary);
	}

	.bottle-option:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.bottle-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin-right: 2px;
		font-size: 1rem;
		font-weight: 400;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
		/* Ensure 44px touch target on mobile */
		min-width: 44px;
		min-height: 44px;
	}

	.bottle-delete:hover:not(:disabled) {
		color: var(--error);
		background: rgba(184, 122, 122, 0.1);
	}

	.bottle-delete:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.bottle-delete:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.empty-state {
		padding: var(--space-4);
		background: var(--bg-subtle);
		border: 1px dashed var(--divider);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.empty-state p {
		color: var(--text-tertiary);
		font-size: 0.875rem;
		margin: 0;
	}
</style>
