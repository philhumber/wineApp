<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { api } from '$lib/api/client';
	import { addWineStore } from '$lib/stores';
	import {
		FormInput,
		FormTextarea,
		FormRow,
		SearchDropdown,
		AIGenerateButton,
		AIExpandedSection,
		DuplicateWarningModal
	} from '$lib/components';
	import type { Producer, DuplicateMatch } from '$lib/api/types';

	// Local state
	let producers: Array<{ id: number; name: string; meta?: string }> = [];
	let searchLoading = false;
	let searchValue = '';

	// Subscribe to store
	$: state = $addWineStore;
	$: producerErrors = state.errors.producer;
	$: isCreateMode = state.mode.producer === 'create';
	$: aiExpanded = state.aiExpanded.producer;
	$: duplicateWarning = state.duplicateWarning;
	$: showDuplicateModal = duplicateWarning !== null && duplicateWarning.type === 'producer';

	// Get region context for filtering
	$: regionName = state.selected.region?.regionName || state.region.regionName;
	$: regionId = state.selected.region?.regionID;

	// Fetch producers (filtered by region if available)
	async function loadProducers() {
		try {
			const producersData = await api.getProducers({
				regionName: regionName || undefined,
				withBottleCount: false
			});

			producers = producersData.map((p) => ({
				id: p.producerID,
				name: p.producerName,
				meta: p.regionName
			}));
		} catch (error) {
			console.error('Failed to load producers:', error);
		}
	}

	onMount(() => {
		loadProducers();
	});

	// Reload producers when region changes
	$: if (regionName) {
		loadProducers();
	}

	// Search handler
	async function handleSearch(e: CustomEvent<string>) {
		searchValue = e.detail;
	}

	// Select existing producer
	function handleSelect(e: CustomEvent<{ id: number; name: string; meta?: string }>) {
		const producer = e.detail;
		addWineStore.selectProducer({
			producerID: producer.id,
			producerName: producer.name,
			regionID: 0,
			regionName: producer.meta
		});
	}

	// Pending create data (stored while checking duplicates)
	let pendingCreateValue = '';

	// Switch to create mode
	async function handleCreateNew(e: CustomEvent<{ searchValue: string }>) {
		const searchVal = e.detail.searchValue.trim();
		pendingCreateValue = searchVal;

		// Check for duplicates before proceeding
		if (searchVal) {
			const hasDuplicates = await addWineStore.checkForDuplicates('producer', searchVal, {
				regionId,
				regionName
			});

			if (hasDuplicates) {
				// Modal will be shown - don't proceed to create mode yet
				return;
			}
		}

		// No duplicates found, proceed to create mode
		proceedToCreateMode(searchVal);
	}

	// Actually switch to create mode (after duplicate check passes)
	async function proceedToCreateMode(producerName: string) {
		addWineStore.setMode('producer', 'create');
		addWineStore.updateProducer('producerName', producerName);

		// Wait for DOM to update, then focus producer name input
		await tick();
		const nameInput = document.querySelector<HTMLInputElement>('input[name="producerName"]');
		nameInput?.focus();
	}

	// Handle duplicate modal actions
	function handleUseExisting(e: CustomEvent<DuplicateMatch>) {
		// Select the existing producer and advance to next step
		addWineStore.useExistingMatch(e.detail);
		addWineStore.nextStep();
	}

	function handleCreateNewAnyway() {
		addWineStore.dismissDuplicateWarning();
		proceedToCreateMode(pendingCreateValue);
	}

	function handleCancelDuplicate() {
		addWineStore.dismissDuplicateWarning();
		pendingCreateValue = '';
	}

	// Clear selection
	function handleClear() {
		addWineStore.clearSelection('producer');
		searchValue = '';
	}

	// AI generation
	async function handleAIGenerate() {
		await addWineStore.generateProducerAI();
	}

	// Toggle manual expansion (without AI)
	function handleManualExpand() {
		addWineStore.toggleAIExpanded('producer');
	}
</script>

<div class="step-content">
	<div class="section-header">
		<h2 class="section-title">Producer</h2>
		<p class="section-subtitle">Who made this wine?</p>
	</div>

	<!-- Search existing producers -->
	<SearchDropdown
		placeholder="Search existing producers..."
		value={searchValue}
		items={producers}
		selectedItem={state.selected.producer
			? { id: state.selected.producer.producerID, name: state.selected.producer.producerName }
			: null}
		createNewLabel="+ Add new producer..."
		on:search={handleSearch}
		on:select={handleSelect}
		on:createNew={handleCreateNew}
		on:clear={handleClear}
	/>

	<!-- Create new producer form -->
	{#if isCreateMode}
		<FormInput
			label="Producer Name"
			name="producerName"
			value={state.producer.producerName}
			placeholder="e.g., Penfolds"
			required
			error={producerErrors.producerName}
			on:input={(e) => addWineStore.updateProducer('producerName', e.detail)}
		/>

		<!-- AI Generate Button -->
		<AIGenerateButton
			label="Get More Information About This Producer..."
			loading={state.isAILoading && state.aiLoadingStep === 2}
			disabled={!state.producer.producerName}
			on:click={handleAIGenerate}
		/>

		<!-- Manual expand link -->
		{#if !aiExpanded}
			<button type="button" class="manual-expand-link" on:click={handleManualExpand}>
				Or add details manually...
			</button>
		{/if}

		<!-- AI Expanded Section -->
		<AIExpandedSection expanded={aiExpanded} badgeText={state.isAILoading ? 'Generating...' : 'Additional Details'}>
			<FormRow>
				<FormInput
					label="Town"
					name="producerTown"
					value={state.producer.town}
					placeholder="Producer location..."
					on:input={(e) => addWineStore.updateProducer('town', e.detail)}
				/>
				<FormInput
					label="Founded"
					name="producerFounded"
					value={state.producer.founded}
					placeholder="Year established..."
					on:input={(e) => addWineStore.updateProducer('founded', e.detail)}
				/>
			</FormRow>
			<FormInput
				label="Ownership"
				name="producerOwnership"
				value={state.producer.ownership}
				placeholder="e.g., Family, Cooperative, LVMH..."
				on:input={(e) => addWineStore.updateProducer('ownership', e.detail)}
			/>
			<FormTextarea
				label="Description"
				name="producerDescription"
				value={state.producer.description}
				placeholder="About this producer..."
				rows={3}
				on:input={(e) => addWineStore.updateProducer('description', e.detail)}
			/>
		</AIExpandedSection>
	{/if}

</div>

<!-- Duplicate Warning Modal -->
{#if showDuplicateModal && duplicateWarning}
	<DuplicateWarningModal
		warning={duplicateWarning}
		on:useExisting={handleUseExisting}
		on:createNew={handleCreateNewAnyway}
		on:cancel={handleCancelDuplicate}
	/>
{/if}

<style>
	.step-content {
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

	.section-header {
		margin-bottom: var(--space-6);
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-weight: 400;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
	}

	.section-subtitle {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	.manual-expand-link {
		display: block;
		width: 100%;
		text-align: center;
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--accent);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: var(--space-2);
		margin-bottom: var(--space-4);
		transition: opacity 0.15s var(--ease-out);
	}

	.manual-expand-link:hover {
		text-decoration: underline;
	}
</style>
