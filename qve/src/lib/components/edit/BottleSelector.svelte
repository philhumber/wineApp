<script lang="ts">
	/**
	 * BottleSelector component
	 * Pill-based selector for choosing which bottle to edit
	 */
	import { createEventDispatcher } from 'svelte';
	import type { Bottle } from '$lib/api/types';

	export let bottles: Bottle[] = [];
	export let selectedID: number | null = null;
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		select: { bottleID: number };
	}>();

	function handleSelect(bottleID: number) {
		if (!disabled) {
			dispatch('select', { bottleID });
		}
	}

	function handleKeydown(event: KeyboardEvent, bottleID: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSelect(bottleID);
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

	.bottle-option {
		padding: var(--space-2) var(--space-4);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--text-secondary);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 100px;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.bottle-option:hover:not(:disabled) {
		border-color: var(--accent-subtle);
	}

	.bottle-option.active {
		color: var(--text-primary);
		background: var(--surface);
		border-color: var(--accent);
	}

	.bottle-option:disabled {
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
