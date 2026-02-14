<!--
  DuplicateWarningModal Component
  Shows warning when similar items exist during add wine wizard

  Usage:
  <DuplicateWarningModal
    warning={$duplicateWarning}
    on:useExisting={handleUseExisting}
    on:createNew={handleCreateNew}
    on:addBottle={handleAddBottle}
  />
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { DuplicateWarning } from '$lib/stores/addWine';
	import type { DuplicateMatch } from '$lib/api/types';
	import Icon from '../ui/Icon.svelte';
	import { focusTrap } from '$lib/actions/focusTrap';

	export let warning: DuplicateWarning;

	const dispatch = createEventDispatcher<{
		useExisting: DuplicateMatch;
		createNew: void;
		addBottle: { wineId: number };
		cancel: void;
	}>();

	// Get display names for types
	const typeNames: Record<string, string> = {
		region: 'region',
		producer: 'producer',
		wine: 'wine'
	};

	$: typeName = typeNames[warning.type] || warning.type;
	$: hasExactMatch = warning.exactMatch !== null;
	$: hasSimilarMatches = warning.similarMatches.length > 0;

	// Find any match with bottles (exact match takes priority, then similar matches)
	$: matchWithBottles = warning.type === 'wine'
		? (warning.exactMatch?.bottleCount && warning.exactMatch.bottleCount > 0)
			? warning.exactMatch
			: warning.similarMatches.find(m => m.bottleCount && m.bottleCount > 0) || null
		: null;

	// Wine already in cellar: show special modal if ANY match has bottles
	$: isWineWithBottles = matchWithBottles !== null;
	$: bottleCount = matchWithBottles?.bottleCount || warning.existingBottles || 0;
	$: wineIdForAddBottle = matchWithBottles?.id || warning.existingWineId;

	function handleUseExisting(match: DuplicateMatch) {
		dispatch('useExisting', match);
	}

	function handleCreateNew() {
		dispatch('createNew');
	}

	function handleAddBottle() {
		if (wineIdForAddBottle) {
			dispatch('addBottle', { wineId: wineIdForAddBottle });
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleCancel();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={handleBackdropClick}>
	<div class="modal-content" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-title" use:focusTrap>
		<div class="modal-header">
			<div class="warning-icon">
				<Icon name="warning" size={24} />
			</div>
			<h2 id="duplicate-title" class="modal-title">
				{#if isWineWithBottles}
					Wine Already in Cellar
				{:else}
					Similar {typeName} found
				{/if}
			</h2>
		</div>

		<div class="modal-body">
			{#if isWineWithBottles && matchWithBottles}
				<p class="warning-message">
					<strong>"{warning.searchValue}"</strong> matches <strong>"{matchWithBottles.name}"</strong> which has
					<strong>{bottleCount} bottle{bottleCount !== 1 ? 's' : ''}</strong> in your cellar.
				</p>
				<p class="hint-text">
					Click the wine below to add another bottle to it.
				</p>
			{:else if warning.type === 'wine'}
				<p class="warning-message">
					<strong>"{warning.searchValue}"</strong> looks similar to existing wines:
				</p>
				<p class="hint-text">
					Click a wine to select it and proceed to add a bottle.
				</p>
			{:else if warning.type === 'producer'}
				<p class="warning-message">
					<strong>"{warning.searchValue}"</strong> looks similar to existing producers:
				</p>
				<p class="hint-text">
					Click a producer to select it and proceed to the next step.
				</p>
			{:else if warning.type === 'region'}
				<p class="warning-message">
					<strong>"{warning.searchValue}"</strong> looks similar to existing regions:
				</p>
				<p class="hint-text">
					Click a region to select it and proceed to the next step.
				</p>
			{:else}
				<p class="warning-message">
					<strong>"{warning.searchValue}"</strong> looks similar to existing entries:
				</p>
			{/if}

			<!-- Match list -->
			{#if hasExactMatch || hasSimilarMatches}
				<div class="match-list">
					{#if warning.exactMatch}
						<button
							type="button"
							class="match-item exact-match"
							on:click={() => warning.exactMatch && handleUseExisting(warning.exactMatch)}
						>
							<div class="match-info">
								<span class="match-name">{warning.exactMatch.name}</span>
								{#if warning.exactMatch.meta}
									<span class="match-meta">{warning.exactMatch.meta}</span>
								{/if}
							</div>
							<span class="match-badge">Exact match</span>
						</button>
					{/if}

					{#each warning.similarMatches as match}
						<button
							type="button"
							class="match-item"
							on:click={() => handleUseExisting(match)}
						>
							<div class="match-info">
								<span class="match-name">{match.name}</span>
								{#if match.meta}
									<span class="match-meta">{match.meta}</span>
								{/if}
							</div>
							{#if match.bottleCount && match.bottleCount > 0}
								<span class="bottle-count">{match.bottleCount} bottle{match.bottleCount !== 1 ? 's' : ''}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="modal-footer">
			{#if isWineWithBottles}
				<!-- Special case: wine with bottles - recommend adding bottle -->
				<button type="button" class="btn btn-secondary" on:click={handleCancel}>
					Cancel
				</button>
				<button type="button" class="btn btn-primary" on:click={handleAddBottle}>
					Add Bottle to Existing
				</button>
			{:else}
				<!-- Normal case: choose existing or create new -->
				<button type="button" class="btn btn-secondary" on:click={handleCreateNew}>
					Add New Anyway
				</button>
				{#if warning.exactMatch}
					<button type="button" class="btn btn-primary" on:click={() => warning.exactMatch && handleUseExisting(warning.exactMatch)}>
						Use Existing
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(45, 41, 38, 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		animation: fadeIn 0.2s var(--ease-out);
	}

	:global([data-theme='dark']) .modal-overlay {
		background: rgba(12, 11, 10, 0.8);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-content {
		background: var(--surface);
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		width: 100%;
		max-width: 440px;
		animation: scaleIn 0.2s var(--ease-out);
		overflow: hidden;
	}

	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-5) var(--space-6);
		border-bottom: 1px solid var(--divider-subtle);
	}

	.warning-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--wine-pale);
		border-radius: 50%;
		color: var(--wine-red);
	}

	.modal-title {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--text-primary);
		margin: 0;
	}

	.modal-body {
		padding: var(--space-5) var(--space-6);
	}

	.warning-message {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-4);
	}

	.warning-message strong {
		color: var(--text-primary);
	}

	.hint-text {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-tertiary);
		font-style: italic;
		margin-bottom: var(--space-4);
	}

	.match-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-height: 200px;
		overflow-y: auto;
	}

	.match-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3) var(--space-4);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 8px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s var(--ease-out);
	}

	.match-item:hover {
		border-color: var(--accent);
		background: var(--surface);
	}

	.match-item.exact-match {
		border-color: var(--accent-subtle);
		background: var(--accent-pale, rgba(166, 155, 138, 0.1));
	}

	.match-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.match-name {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.match-meta {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.match-badge {
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent);
		background: var(--accent-pale, rgba(166, 155, 138, 0.15));
		padding: var(--space-1) var(--space-2);
		border-radius: 4px;
	}

	.bottle-count {
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.modal-footer {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-6);
		border-top: 1px solid var(--divider-subtle);
		background: var(--bg-subtle);
	}

	.btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
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

	.btn-secondary {
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--divider);
	}

	.btn-secondary:hover {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
	}

	.btn-primary {
		color: var(--bg);
		background: var(--text-primary);
		border: 1px solid var(--text-primary);
	}

	.btn-primary:hover {
		background: var(--text-secondary);
		border-color: var(--text-secondary);
	}

	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
