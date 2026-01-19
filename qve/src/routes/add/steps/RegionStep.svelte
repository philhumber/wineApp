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
		AIExpandedSection
	} from '$lib/components';
	import type { Region, Country } from '$lib/api/types';

	// Local state
	let regions: Array<{ id: number; name: string; meta?: string }> = [];
	let countries: Country[] = [];
	let searchLoading = false;
	let searchValue = '';

	// Subscribe to store
	$: state = $addWineStore;
	$: regionErrors = state.errors.region;
	$: isCreateMode = state.mode.region === 'create';
	$: aiExpanded = state.aiExpanded.region;

	// Country options for dropdown
	$: countryOptions = countries.map((c) => ({
		value: c.countryName,
		label: c.countryName
	}));

	// Drink type options
	const drinkTypeOptions = [
		{ value: 'Wine', label: 'Wine' },
		{ value: 'Cider', label: 'Cider' },
		{ value: 'Beer', label: 'Beer' },
		{ value: 'Spirit', label: 'Spirit' },
		{ value: 'Sake', label: 'Sake' }
	];

	// Fetch initial data
	onMount(async () => {
		try {
			const [regionsData, countriesData] = await Promise.all([
				api.getRegions({ withBottleCount: false }),
				api.getCountries(false)
			]);

			regions = regionsData.map((r) => ({
				id: r.regionID,
				name: r.regionName,
				meta: r.countryName
			}));

			countries = countriesData;
		} catch (error) {
			console.error('Failed to load region data:', error);
		}
	});

	// Search handler
	async function handleSearch(e: CustomEvent<string>) {
		searchValue = e.detail;
	}

	// Select existing region
	function handleSelect(e: CustomEvent<{ id: number; name: string; meta?: string }>) {
		const region = e.detail;
		addWineStore.selectRegion({
			regionID: region.id,
			regionName: region.name,
			countryName: region.meta,
			countryID: 0 // Will be resolved by backend
		});
	}

	// Switch to create mode
	async function handleCreateNew(e: CustomEvent<{ searchValue: string }>) {
		const hadSearchValue = e.detail.searchValue.trim() !== '';
		addWineStore.setMode('region', 'create');
		addWineStore.updateRegion('regionName', e.detail.searchValue);

		// Wait for DOM to update, then focus appropriate field
		await tick();
		if (hadSearchValue) {
			// Focus country select if name was pre-filled
			const countrySelect = document.querySelector<HTMLSelectElement>('select[name="country"]');
			countrySelect?.focus();
		} else {
			// Focus region name input if starting fresh
			const nameInput = document.querySelector<HTMLInputElement>('input[name="regionName"]');
			nameInput?.focus();
		}
	}

	// Clear selection
	function handleClear() {
		addWineStore.clearSelection('region');
		searchValue = '';
	}

	// AI generation
	async function handleAIGenerate() {
		await addWineStore.generateRegionAI();
	}

	// Toggle manual expansion (without AI)
	function handleManualExpand() {
		addWineStore.toggleAIExpanded('region');
	}
</script>

<div class="step-content">
	<div class="section-header">
		<h2 class="section-title">Region</h2>
		<p class="section-subtitle">Where does this wine come from?</p>
	</div>

	<!-- Search existing regions -->
	<SearchDropdown
		placeholder="Search existing regions..."
		value={searchValue}
		items={regions}
		selectedItem={state.selected.region
			? { id: state.selected.region.regionID, name: state.selected.region.regionName }
			: null}
		createNewLabel="+ Add new region..."
		on:search={handleSearch}
		on:select={handleSelect}
		on:createNew={handleCreateNew}
		on:clear={handleClear}
	/>

	<!-- Create new region form -->
	{#if isCreateMode}
		<FormInput
			label="Region Name"
			name="regionName"
			value={state.region.regionName}
			placeholder="e.g., Barossa Valley"
			required
			error={regionErrors.regionName}
			on:input={(e) => addWineStore.updateRegion('regionName', e.detail)}
		/>

		<FormRow>
			<FormSelect
				label="Country"
				name="country"
				value={state.region.country}
				options={countryOptions}
				placeholder="Select country..."
				required
				error={regionErrors.country}
				on:change={(e) => addWineStore.updateRegion('country', e.detail)}
			/>
			<FormSelect
				label="Drink Type"
				name="drinkType"
				value={state.region.drinkType}
				options={drinkTypeOptions}
				required
				error={regionErrors.drinkType}
				on:change={(e) => addWineStore.updateRegion('drinkType', e.detail)}
			/>
		</FormRow>

		<!-- AI Generate Button -->
		<AIGenerateButton
			label="Get More Information About This Region..."
			loading={state.isAILoading && state.aiLoadingStep === 1}
			disabled={!state.region.regionName || !state.region.country}
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
				name="regionDescription"
				value={state.region.description}
				placeholder="Describe this wine region..."
				rows={4}
				on:input={(e) => addWineStore.updateRegion('description', e.detail)}
			/>
			<FormRow>
				<FormTextarea
					label="Climate"
					name="regionClimate"
					value={state.region.climate}
					placeholder="Climate characteristics..."
					rows={3}
					on:input={(e) => addWineStore.updateRegion('climate', e.detail)}
				/>
				<FormTextarea
					label="Soil"
					name="regionSoil"
					value={state.region.soil}
					placeholder="Soil composition..."
					rows={3}
					on:input={(e) => addWineStore.updateRegion('soil', e.detail)}
				/>
			</FormRow>
		</AIExpandedSection>
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
