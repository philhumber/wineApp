<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import { Header, Icon, BottleSelector, WineForm, BottleForm } from '$lib/components';
	import {
		editWine,
		isWineDirty,
		isBottleDirty,
		isEditDirty,
		canSubmitWine,
		canSubmitBottle,
		hasBottles,
		wineTypeOptions,
		modal,
		targetWineID
	} from '$stores';

	// Get wine ID from URL
	$: wineID = parseInt($page.params.id || '0', 10);

	// Subscribe to store
	$: state = $editWine;
	$: activeTab = state.activeTab;
	$: isLoading = state.isLoading;
	$: isSubmitting = state.isSubmitting;

	// Track if we should allow navigation
	let allowNavigation = false;

	// Track if we pushed history when navigating to bottle tab
	let bottleTabPushedHistory = false;

	// Initialize on mount
	onMount(async () => {
		if (wineID && !isNaN(wineID)) {
			await editWine.init(wineID);

			// Check for tab param in URL (deep link case - no history pushed)
			const tabParam = $page.url.searchParams.get('tab');
			if (tabParam === 'bottle') {
				editWine.setTab('bottle');
				// Don't set bottleTabPushedHistory - we're deep linking, not navigating
			}
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		editWine.reset();
	});

	// Handle browser back/forward navigation
	afterNavigate(({ type, to }) => {
		if (type === 'popstate') {
			// Only handle if still on this edit page
			if (to?.url.pathname !== `${base}/edit/${wineID}`) {
				return;
			}

			const tabParam = to.url.searchParams.get('tab');
			if (tabParam === 'bottle') {
				editWine.setTab('bottle');
			} else {
				editWine.setTab('wine');
				// Reset flag when navigating back to wine tab
				bottleTabPushedHistory = false;
			}
		}
	});

	// Warn before leaving with unsaved changes
	beforeNavigate(({ cancel, to }) => {
		// Allow navigation within edit page (tab changes via query params)
		const isStayingInEditPage = to?.url.pathname === `${base}/edit/${wineID}`;
		if (isStayingInEditPage) {
			return; // Don't block tab-to-tab navigation
		}

		// Block navigation away from edit page if there's unsaved data
		if (!allowNavigation && $isEditDirty && !$editWine.isSubmitting) {
			cancel();
			modal.confirm({
				title: 'Discard changes?',
				message: 'You have unsaved changes. Are you sure you want to leave?',
				confirmLabel: 'Discard',
				cancelLabel: 'Keep editing',
				variant: 'danger',
				onConfirm: () => {
					modal.close();
					allowNavigation = true;
					history.back();
				},
				onCancel: () => {
					modal.close();
				}
			});
		}
	});

	// Tab switching with browser history
	function handleTabClick(tab: 'wine' | 'bottle') {
		const currentTab = $page.url.searchParams.get('tab') || 'wine';

		if (tab === 'bottle' && currentTab !== 'bottle') {
			// Going to bottle tab - push history
			editWine.setTab('bottle');
			bottleTabPushedHistory = true;
			goto(`${base}/edit/${wineID}?tab=bottle`, { noScroll: true, keepFocus: true });
		} else if (tab === 'wine' && currentTab === 'bottle') {
			// Going back to wine tab
			if (bottleTabPushedHistory) {
				// We pushed history, so use back to clean it up
				history.back();
			} else {
				// Deep linked to bottle tab - use goto instead of history.back()
				editWine.setTab('wine');
				goto(`${base}/edit/${wineID}`, { noScroll: true, keepFocus: true, replaceState: true });
			}
		} else {
			// Already on requested tab - just update store
			editWine.setTab(tab);
		}
	}

	// Handle cancel with dirty check
	function handleCancel() {
		if ($isEditDirty) {
			modal.confirm({
				title: 'Discard changes?',
				message: 'You have unsaved changes. Are you sure you want to leave?',
				confirmLabel: 'Discard',
				cancelLabel: 'Keep editing',
				variant: 'danger',
				onConfirm: () => {
					modal.close();
					allowNavigation = true;
					goto(`${base}/`);
				},
				onCancel: () => {
					modal.close();
				}
			});
		} else {
			allowNavigation = true;
			goto(`${base}/`);
		}
	}

	// Handle save
	async function handleSave() {
		let success = false;

		if (activeTab === 'wine') {
			success = await editWine.submitWine();
		} else {
			success = await editWine.submitBottle();
		}

		if (success) {
			// Set target wine ID for scroll-to-wine highlight
			targetWineID.set(wineID);
			// Allow navigation without warning
			allowNavigation = true;
			goto(`${base}/`);
		}
	}

	// Bottle selection
	function handleBottleSelect(event: CustomEvent<{ bottleID: number }>) {
		editWine.selectBottle(event.detail.bottleID);
	}

	// Wine form input
	function handleWineInput(event: CustomEvent<{ field: string; value: string }>) {
		const { field, value } = event.detail;
		editWine.setWineField(field as keyof typeof state.wine, value);
	}

	// Wine image handlers
	function handleImageSelect(event: CustomEvent<File>) {
		const file = event.detail;
		// Create preview URL
		const preview = URL.createObjectURL(file);
		editWine.setWinePicture(file, preview);
	}

	function handleImageClear() {
		editWine.clearWinePicture();
	}

	// Bottle form input
	function handleBottleInput(event: CustomEvent<{ field: string; value: string }>) {
		const { field, value } = event.detail;
		editWine.setBottleField(field as keyof typeof state.bottle, value);
	}

	// Compute if current tab can submit
	$: canSubmit = activeTab === 'wine' ? $canSubmitWine : $canSubmitBottle;
</script>

<svelte:head>
	<title>Edit Wine | Qvé</title>
</svelte:head>

<!-- Header -->
<Header variant="edit" />

<!-- Main -->
<main class="main">
	{#if isLoading}
		<div class="loading-state">
			<p>Loading wine details...</p>
		</div>
	{:else if !state.wineID}
		<div class="error-state">
			<p>Wine not found</p>
			<button class="btn btn-secondary" on:click={() => goto(`${base}/`)}>Back to Home</button>
		</div>
	{:else}
		<!-- Tab Switcher -->
		<div class="tab-switcher">
			<button
				class="tab-btn"
				class:active={activeTab === 'wine'}
				on:click={() => handleTabClick('wine')}
				type="button"
			>
				Wine Details
			</button>
			<button
				class="tab-btn"
				class:active={activeTab === 'bottle'}
				class:disabled={!$hasBottles}
				on:click={() => $hasBottles && handleTabClick('bottle')}
				type="button"
				disabled={!$hasBottles}
				title={!$hasBottles ? 'No bottles to edit' : ''}
			>
				Bottle Details
			</button>
		</div>

		<!-- Form Container -->
		<div class="form-container">
			<!-- Wine Tab -->
			{#if activeTab === 'wine'}
				<div class="form-section">
					<WineForm
						state={state.wine}
						wineTypeOptions={$wineTypeOptions}
						errors={state.errors}
						disabled={isSubmitting}
						on:input={handleWineInput}
						on:imageSelect={handleImageSelect}
						on:imageClear={handleImageClear}
					/>
				</div>
			{/if}

			<!-- Bottle Tab -->
			{#if activeTab === 'bottle'}
				<div class="form-section">
					{#if !$hasBottles}
						<div class="empty-state">
							<Icon name="wine-bottle" size={48} />
							<p>No bottles available to edit</p>
							<p class="hint">Add bottles from the home page</p>
						</div>
					{:else}
						<BottleSelector
							bottles={state.bottles}
							selectedID={state.selectedBottleID}
							disabled={isSubmitting}
							on:select={handleBottleSelect}
						/>

						{#if state.selectedBottleID}
							<BottleForm
								state={state.bottle}
								errors={state.errors}
								disabled={isSubmitting}
								on:input={handleBottleInput}
							/>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Form Navigation -->
			<div class="form-nav">
				<button class="btn btn-secondary" on:click={handleCancel} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					on:click={handleSave}
					disabled={!canSubmit || isSubmitting}
				>
					{#if isSubmitting}
						Saving...
					{:else}
						<Icon name="check" size={14} />
						Save Changes
					{/if}
				</button>
			</div>
		</div>
	{/if}
</main>

<style>
	/* Main */
	.main {
		position: relative;
		z-index: 1;
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-6) var(--space-6) var(--space-10);
	}

	/* Loading & Error States */
	.loading-state,
	.error-state {
		text-align: center;
		padding: var(--space-8);
		color: var(--text-secondary);
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
	}

	/* Tab Switcher */
	.tab-switcher {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1);
		background: var(--bg-subtle);
		border-radius: 12px;
		margin-bottom: var(--space-6);
		border: 1px solid var(--divider);
	}

	.tab-btn {
		flex: 1;
		padding: var(--space-3) var(--space-5);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.tab-btn:hover:not(.disabled) {
		color: var(--text-secondary);
	}

	.tab-btn.active {
		color: var(--text-primary);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}

	.tab-btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Form Container */
	.form-container {
		background: var(--surface);
		border: 1px solid var(--divider-subtle);
		border-radius: 12px;
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.form-section {
		padding: var(--space-6);
		animation: fadeIn 0.3s var(--ease-out);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8);
		color: var(--text-tertiary);
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state .hint {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	/* Form Navigation */
	.form-nav {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		padding: var(--space-5) var(--space-6);
		background: var(--bg-subtle);
		border-top: 1px solid var(--divider-subtle);
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-5);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 100px;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		color: var(--text-secondary);
		background: var(--surface);
		border: 1px solid var(--divider);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
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

	/* Responsive */
	@media (max-width: 768px) {
		.main {
			padding: var(--space-4) var(--space-4) var(--space-8);
		}

		.form-section {
			padding: var(--space-5);
		}

		.form-nav {
			padding: var(--space-4);
		}

		.tab-btn {
			padding: var(--space-2) var(--space-3);
			font-size: 0.8125rem;
		}
	}
</style>
