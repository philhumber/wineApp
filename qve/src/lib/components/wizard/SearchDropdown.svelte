<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Icon from '../ui/Icon.svelte';

	// Generic type for search items
	type T = $$Generic<{ id: number; name: string; meta?: string }>;

	export let placeholder: string = 'Search...';
	export let value: string = '';
	export let items: T[] = [];
	export let loading: boolean = false;
	export let disabled: boolean = false;
	export let selectedItem: T | null = null;
	export let createNewLabel: string = '+ Add new...';

	let isOpen = false;
	let inputElement: HTMLInputElement;
	let containerElement: HTMLDivElement;

	const dispatch = createEventDispatcher<{
		search: string;
		select: T;
		createNew: { searchValue: string };
		clear: void;
	}>();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		dispatch('search', value);
		isOpen = true;
	}

	function handleFocus() {
		// Always open dropdown on focus if no selection
		if (!selectedItem) {
			isOpen = true;
		}
	}

	function handleClick() {
		// Always open dropdown on click if no selection
		if (!selectedItem) {
			isOpen = true;
		}
	}

	function handleBlur(e: FocusEvent) {
		// Delay closing to allow click events on dropdown items
		setTimeout(() => {
			if (!containerElement?.contains(document.activeElement)) {
				isOpen = false;
			}
		}, 200);
	}

	function handleSelect(item: T) {
		selectedItem = item;
		value = item.name;
		isOpen = false;
		dispatch('select', item);
	}

	function handleCreateNew() {
		isOpen = false;
		dispatch('createNew', { searchValue: value });
	}

	function handleClear() {
		value = '';
		selectedItem = null;
		dispatch('clear');
		inputElement?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			isOpen = false;
			inputElement?.blur();
		}
	}

	// Track previous selection to detect when it's cleared externally
	let prevSelectedItem: T | null = null;
	$: {
		// If selection was just cleared (had value before, null now), open dropdown
		if (prevSelectedItem !== null && selectedItem === null) {
			isOpen = true;
		}
		prevSelectedItem = selectedItem;
	}

	// Display value: show selected item name if selected, otherwise the search value
	$: displayValue = selectedItem ? selectedItem.name : value;

	// Filter items based on search value (scrollable, max-height handles display limit)
	$: filteredItems = value
		? items.filter((item) => item.name.toLowerCase().includes(value.toLowerCase()))
		: items;

	$: showDropdown = isOpen && !selectedItem;
</script>

<div class="search-container" bind:this={containerElement}>
	<svg class="search-icon" viewBox="0 0 24 24">
		<circle cx="11" cy="11" r="7" />
		<path d="M21 21l-4.35-4.35" />
	</svg>

	<input
		bind:this={inputElement}
		type="text"
		class="search-input"
		class:has-selection={selectedItem !== null}
		{placeholder}
		value={displayValue}
		{disabled}
		readonly={selectedItem !== null}
		on:input={handleInput}
		on:focus={handleFocus}
		on:click={handleClick}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
	/>

	{#if selectedItem}
		<button type="button" class="clear-btn" on:click={handleClear} title="Clear selection">
			<Icon name="x" size={14} />
		</button>
	{/if}

	{#if showDropdown}
		<div class="search-results" class:active={showDropdown}>
			{#if loading}
				<div class="search-result-item loading">
					<span class="loading-text">Searching...</span>
				</div>
			{:else}
				<!-- Add new option always at top -->
				<button
					type="button"
					class="search-result-item search-result-new"
					on:click={handleCreateNew}
					on:mousedown|preventDefault
				>
					<div class="search-result-name">{createNewLabel}</div>
				</button>

				{#if filteredItems.length > 0}
					<div class="search-divider"></div>
					{#each filteredItems as item}
						<button
							type="button"
							class="search-result-item"
							on:click={() => handleSelect(item)}
							on:mousedown|preventDefault
						>
							<div class="search-result-name">{item.name}</div>
							{#if item.meta}
								<div class="search-result-meta">{item.meta}</div>
							{/if}
						</button>
					{/each}
				{:else if value.trim() !== ''}
					<div class="search-divider"></div>
					<div class="search-result-item no-results">
						<span class="no-results-text">No existing matches</span>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-container {
		position: relative;
		margin-bottom: var(--space-5);
	}

	.search-icon {
		position: absolute;
		left: var(--space-4);
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		stroke: var(--text-tertiary);
		stroke-width: 1.5;
		fill: none;
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: var(--space-4);
		padding-left: var(--space-10);
		padding-right: var(--space-10);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 8px;
		outline: none;
		transition: all 0.2s var(--ease-out);
	}

	.search-input:focus {
		border-color: var(--accent);
		background: var(--surface);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input.has-selection {
		border-color: var(--accent-subtle);
		background: var(--surface);
	}

	.search-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.clear-btn {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.15s var(--ease-out);
	}

	.clear-btn:hover {
		background: var(--bg-subtle);
		color: var(--text-secondary);
	}

	.search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: var(--space-2);
		background: var(--surface);
		border: 1px solid var(--divider);
		border-radius: 8px;
		box-shadow: var(--shadow-lg);
		max-height: 280px;
		overflow-y: auto;
		z-index: 1000;
		display: none;
	}

	.search-results.active {
		display: block;
		animation: dropdownFadeIn 0.15s var(--ease-out);
	}

	@keyframes dropdownFadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.search-result-item {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		text-align: left;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background 0.15s var(--ease-out);
		display: block;
	}

	.search-result-item:hover {
		background: var(--bg-subtle);
	}

	.search-result-item + .search-result-item {
		border-top: 1px solid var(--divider-subtle);
	}

	.search-divider {
		height: 1px;
		background: var(--divider);
		margin: var(--space-2) 0;
	}

	.search-divider + .search-result-item {
		border-top: none;
	}

	.search-result-item.loading,
	.search-result-item.no-results {
		cursor: default;
		color: var(--text-tertiary);
	}

	.search-result-item.loading:hover,
	.search-result-item.no-results:hover {
		background: transparent;
	}

	.search-result-name {
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.search-result-meta {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		margin-top: 2px;
	}

	.search-result-new {
		color: var(--accent);
	}

	.search-result-new .search-result-name {
		color: var(--accent);
		font-style: italic;
	}

	.loading-text,
	.no-results-text {
		font-size: 0.875rem;
		font-style: italic;
	}
</style>
