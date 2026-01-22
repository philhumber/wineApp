<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { api } from '$lib/api/client';
	import { addWineStore } from '$lib/stores';
	import {
		FormInput,
		FormSelect,
		FormTextarea,
		FormRow,
		SearchDropdown,
		AIGenerateButton,
		AIExpandedSection,
		ImageUploadZone
	} from '$lib/components';
	import type { Wine, WineType } from '$lib/api/types';

	// Local state
	let wines: Array<{ id: number; name: string; meta?: string }> = [];
	let wineTypes: WineType[] = [];
	let searchValue = '';

	// Subscribe to store
	$: state = $addWineStore;
	$: wineErrors = state.errors.wine;
	$: isCreateMode = state.mode.wine === 'create';
	$: aiExpanded = state.aiExpanded.wine;

	// Get producer context for filtering
	$: producerName = state.selected.producer?.producerName || state.producer.producerName;

	// Wine type options for dropdown
	$: wineTypeOptions = wineTypes.map((t) => ({
		value: t.wineTypeName,
		label: t.wineTypeName
	}));

	// Fetch wines (filtered by producer if available) and wine types
	async function loadData() {
		try {
			const [typesData] = await Promise.all([
				api.getTypes(false)
			]);
			wineTypes = typesData;

			// Load wines filtered by producer
			if (producerName) {
				const winesData = await api.getWines({
					producerDropdown: producerName,
					bottleCount: '0'
				});
				wines = winesData.map((w) => ({
					id: w.wineID,
					name: w.wineName,
					meta: w.year ? `${w.year}` : undefined
				}));
			}
		} catch (error) {
			console.error('Failed to load wine data:', error);
		}
	}

	onMount(() => {
		loadData();
	});

	// Reload wines when producer changes
	$: if (producerName) {
		loadData();
	}

	// Search handler
	async function handleSearch(e: CustomEvent<string>) {
		searchValue = e.detail;
	}

	// Select existing wine
	function handleSelect(e: CustomEvent<{ id: number; name: string; meta?: string }>) {
		const wine = e.detail;
		// Find full wine data
		const fullWine = wines.find(w => w.id === wine.id);
		addWineStore.selectWine({
			wineID: wine.id,
			wineName: wine.name,
			year: wine.meta || null,
			wineType: '',
			producerName: producerName,
			regionName: '',
			countryName: '',
			code: '',
			bottleCount: 0,
			avgRating: null,
			rating: null,
			pictureURL: null,
			description: null,
			tastingNotes: null,
			pairing: null
		});
	}

	// Switch to create mode
	async function handleCreateNew(e: CustomEvent<{ searchValue: string }>) {
		const hadSearchValue = e.detail.searchValue.trim() !== '';
		addWineStore.setMode('wine', 'create');
		addWineStore.updateWine('wineName', e.detail.searchValue);

		// Wait for DOM to update, then focus appropriate field
		await tick();
		if (hadSearchValue) {
			// Focus vintage year if name was pre-filled
			const yearInput = document.querySelector<HTMLInputElement>('input[name="wineYear"]');
			yearInput?.focus();
		} else {
			// Focus wine name input if starting fresh
			const nameInput = document.querySelector<HTMLInputElement>('input[name="wineName"]');
			nameInput?.focus();
		}
	}

	// Clear selection
	function handleClear() {
		addWineStore.clearSelection('wine');
		searchValue = '';
	}

	// AI generation
	async function handleAIGenerate() {
		await addWineStore.generateWineAI();
	}

	// Toggle manual expansion (without AI)
	function handleManualExpand() {
		addWineStore.toggleAIExpanded('wine');
	}

	// Image upload handlers
	function handleImageSelect(e: CustomEvent<File>) {
		addWineStore.setImageFile(e.detail);
	}

	function handleImageClear() {
		addWineStore.setImageFile(null);
	}
</script>

<div class="step-content">
	<div class="section-header">
		<h2 class="section-title">Wine</h2>
		<p class="section-subtitle">Tell us about the wine</p>
	</div>

	<!-- Search existing wines -->
	<SearchDropdown
		placeholder="Search existing wines..."
		value={searchValue}
		items={wines}
		selectedItem={state.selected.wine
			? { id: state.selected.wine.wineID, name: state.selected.wine.wineName }
			: null}
		createNewLabel="+ Add new wine..."
		on:search={handleSearch}
		on:select={handleSelect}
		on:createNew={handleCreateNew}
		on:clear={handleClear}
	/>

	<!-- Create new wine form -->
	{#if isCreateMode}
		<FormInput
			label="Wine Name"
			name="wineName"
			value={state.wine.wineName}
			placeholder="e.g., Grange"
			required
			error={wineErrors.wineName}
			on:input={(e) => addWineStore.updateWine('wineName', e.detail)}
		/>

		<FormRow>
			<FormInput
				label="Vintage Year"
				name="wineYear"
				value={state.wine.wineYear}
				placeholder="e.g., 2019"
				on:input={(e) => addWineStore.updateWine('wineYear', e.detail)}
			/>
			<FormSelect
				label="Wine Type"
				name="wineType"
				value={state.wine.wineType}
				options={wineTypeOptions}
				placeholder="Select type..."
				required
				error={wineErrors.wineType}
				on:change={(e) => addWineStore.updateWine('wineType', e.detail)}
			/>
		</FormRow>

		<!-- AI Generate Button -->
		<AIGenerateButton
			label="Get More Information About This Wine..."
			loading={state.isAILoading && state.aiLoadingStep === 3}
			disabled={!state.wine.wineName}
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
			<FormTextarea
				label="Description"
				name="wineDescription"
				value={state.wine.description}
				placeholder="Brief wine description..."
				rows={3}
				on:input={(e) => addWineStore.updateWine('description', e.detail)}
			/>
			<FormTextarea
				label="Tasting Notes"
				name="wineTasting"
				value={state.wine.tastingNotes}
				placeholder="Nose and palate description..."
				rows={3}
				on:input={(e) => addWineStore.updateWine('tastingNotes', e.detail)}
			/>
			<FormTextarea
				label="Food Pairing"
				name="winePairing"
				value={state.wine.pairing}
				placeholder="Recommended pairings..."
				rows={2}
				on:input={(e) => addWineStore.updateWine('pairing', e.detail)}
			/>
		</AIExpandedSection>

		<!-- Image Upload -->
		<ImageUploadZone
			imagePreview={state.wine.imagePreview}
			fileName={state.wine.imageFile?.name}
			on:select={handleImageSelect}
			on:clear={handleImageClear}
		/>
	{/if}

</div>

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
