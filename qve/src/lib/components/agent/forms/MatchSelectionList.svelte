<script lang="ts">
	/**
	 * MatchSelectionList
	 * Radio-style list for selecting from fuzzy matches during add wine flow
	 * Used for region, producer, and wine matching steps
	 */
	import { createEventDispatcher } from 'svelte';
	import type { DuplicateMatch } from '$lib/api/types';
	import type { EntityType } from '$lib/agent/types';

	const dispatch = createEventDispatcher<{
		submit: { entityType: EntityType; matchId: number };
		action: { action: string; data?: unknown };
	}>();

	export let matches: DuplicateMatch[] = [];
	export let type: EntityType = 'region';
	export let disabled: boolean = false;

	let selectedIndex: number | null = null;

	function handleSelect(index: number) {
		if (disabled) return;
		selectedIndex = index;
	}

	function handleConfirm() {
		if (disabled) return;
		if (selectedIndex !== null && matches[selectedIndex]) {
			const match = matches[selectedIndex];
			dispatch('submit', { entityType: type, matchId: match.id });
		}
	}

	function handleAddNew() {
		if (disabled) return;
		dispatch('action', { action: 'add_new', data: { entityType: type } });
	}

	function handleHelpDecide() {
		if (disabled) return;
		dispatch('action', { action: 'clarify', data: { entityType: type } });
	}

	// Dynamic header based on type
	$: headerTitle = {
		region: 'Existing regions found',
		producer: 'Existing producers found',
		wine: 'Existing wines found'
	}[type];

	$: headerSubtitle = {
		region: 'Select a matching region or add a new one:',
		producer: 'Select a matching producer or add a new one:',
		wine: 'Select a matching wine or add a new one:'
	}[type];

	$: canConfirm = selectedIndex !== null;
	$: hasMatches = matches.length > 0;
</script>

<div class="match-selection">
	{#if hasMatches}
		<header class="header">
			<h3 class="title">{headerTitle}</h3>
			<p class="subtitle">{headerSubtitle}</p>
		</header>

		<div class="matches">
			{#each matches as match, index}
				<button
					type="button"
					class="match"
					class:selected={selectedIndex === index}
					on:click={() => handleSelect(index)}
					aria-pressed={selectedIndex === index}
				>
					<div class="radio">
						<div class="radio-inner"></div>
					</div>
					<div class="match-info">
						<span class="match-name">{match.name}</span>
						{#if match.meta}
							<span class="match-meta">{match.meta}</span>
						{/if}
						{#if match.bottleCount !== undefined && match.bottleCount > 0}
							<span class="match-bottles">
								{match.bottleCount} bottle{match.bottleCount !== 1 ? 's' : ''} in cellar
							</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>

		<div class="actions">
			<button class="btn btn-primary" disabled={!canConfirm || disabled} on:click={handleConfirm}>
				Use Selected
			</button>
		</div>

		<div class="secondary-actions">
			<button class="link-btn" disabled={disabled} on:click={handleAddNew}>
				Add new {type}
			</button>
			<span class="separator">•</span>
			<button class="link-btn" disabled={disabled} on:click={handleHelpDecide}>
				Help me decide
			</button>
		</div>
	{:else}
		<div class="no-matches">
			<p class="no-matches-text">No existing {type}s match this entry.</p>
		</div>
	{/if}
</div>

<style>
	.match-selection {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.header {
		text-align: left;
	}

	.title {
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 var(--space-1) 0;
	}

	.subtitle {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.matches {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.match {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-4);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: var(--radius-md);
		cursor: pointer;
		touch-action: manipulation;
		text-align: left;
		transition:
			background 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}

	.match:hover {
		background: var(--surface);
	}

	.match.selected {
		background: var(--surface);
		border-color: var(--accent);
	}

	.match:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Radio button */
	.radio {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		margin-top: 2px;
		border: 2px solid var(--divider);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s var(--ease-out);
	}

	.match.selected .radio {
		border-color: var(--accent);
	}

	.radio-inner {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--accent);
		transform: scale(0);
		transition: transform 0.15s var(--ease-out);
	}

	.match.selected .radio-inner {
		transform: scale(1);
	}

	/* Match info */
	.match-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.match-name {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.3;
	}

	.match-meta {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.match-bottles {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		opacity: 0.8;
	}

	/* Actions */
	.actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.btn {
		flex: 1;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;

		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;

		border: none;
		border-radius: var(--radius-pill);
		cursor: pointer;
		touch-action: manipulation;

		transition:
			background 0.15s var(--ease-out),
			transform 0.15s var(--ease-out),
			opacity 0.15s var(--ease-out);
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--text-primary);
		color: var(--bg);
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Secondary actions (Add new / Help me decide) */
	.secondary-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding-top: var(--space-2);
	}

	.link-btn {
		background: none;
		border: none;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--accent);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: opacity 0.15s var(--ease-out);
	}

	.link-btn:hover:not(:disabled) {
		opacity: 0.8;
	}

	.link-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.separator {
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	/* No matches state */
	.no-matches {
		padding: var(--space-4);
		background: var(--bg-subtle);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.no-matches-text {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}
</style>
