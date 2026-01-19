<script lang="ts">
	import { addWineStore } from '$lib/stores';
	import { FormInput, FormSelect, FormRow } from '$lib/components';

	// Subscribe to store
	$: state = $addWineStore;
	$: bottleErrors = state.errors.bottle;

	// Bottle size options
	const bottleSizeOptions = [
		{ value: 'Piccolo (187.5ml)', label: 'Piccolo (187.5ml)' },
		{ value: 'Quarter (200ml)', label: 'Quarter (200ml)' },
		{ value: 'Demi (375ml)', label: 'Demi (375ml)' },
		{ value: 'Standard (750ml)', label: 'Standard (750ml)' },
		{ value: 'Litre (1L)', label: 'Litre (1L)' },
		{ value: 'Magnum (1.5L)', label: 'Magnum (1.5L)' },
		{ value: 'Jeroboam (3L)', label: 'Jeroboam (3L)' },
		{ value: 'Rehoboam (4.5L)', label: 'Rehoboam (4.5L)' },
		{ value: 'Methuselah (6L)', label: 'Methuselah (6L)' },
		{ value: 'Salmanazar (9L)', label: 'Salmanazar (9L)' },
		{ value: 'Balthazar (12L)', label: 'Balthazar (12L)' },
		{ value: 'Nebuchadnezzar (15L)', label: 'Nebuchadnezzar (15L)' }
	];

	// Storage location options
	const storageOptions = [
		{ value: 'Wine Fridge', label: 'Wine Fridge' },
		{ value: 'Wine Cellar', label: 'Wine Cellar' },
		{ value: 'Spirit Cupboard', label: 'Spirit Cupboard' },
		{ value: 'Kitchen', label: 'Kitchen' },
		{ value: 'Other', label: 'Other' }
	];

	// Currency options
	const currencyOptions = [
		{ value: 'GBP', label: 'GBP' },
		{ value: 'EUR', label: 'EUR' },
		{ value: 'USD', label: 'USD' },
		{ value: 'AUD', label: 'AUD' },
		{ value: 'NZD', label: 'NZD' },
		{ value: 'CHF', label: 'CHF' },
		{ value: 'DKK', label: 'DKK' },
		{ value: 'NOK', label: 'NOK' },
		{ value: 'SEK', label: 'SEK' },
		{ value: 'JPY', label: 'JPY' },
		{ value: 'HKD', label: 'HKD' }
	];
</script>

<div class="step-content">
	<div class="section-header">
		<h2 class="section-title">Bottle</h2>
		<p class="section-subtitle">Details about this specific bottle</p>
	</div>

	<FormRow>
		<FormSelect
			label="Bottle Size"
			name="bottleSize"
			value={state.bottle.bottleSize}
			options={bottleSizeOptions}
			placeholder="Select size..."
			required
			error={bottleErrors.bottleSize}
			on:change={(e) => addWineStore.updateBottle('bottleSize', e.detail)}
		/>
		<FormSelect
			label="Storage Location"
			name="storageLocation"
			value={state.bottle.storageLocation}
			options={storageOptions}
			placeholder="Select location..."
			required
			error={bottleErrors.storageLocation}
			on:change={(e) => addWineStore.updateBottle('storageLocation', e.detail)}
		/>
	</FormRow>

	<FormInput
		label="Source"
		name="source"
		value={state.bottle.source}
		placeholder="e.g., Waitrose, Majestic, Gift..."
		required
		error={bottleErrors.source}
		on:input={(e) => addWineStore.updateBottle('source', e.detail)}
	/>

	<FormRow>
		<FormInput
			label="Price"
			name="price"
			type="number"
			value={state.bottle.price}
			placeholder="e.g., 45.00"
			on:input={(e) => addWineStore.updateBottle('price', e.detail)}
		/>
		<FormSelect
			label="Currency"
			name="currency"
			value={state.bottle.currency}
			options={currencyOptions}
			on:change={(e) => addWineStore.updateBottle('currency', e.detail)}
		/>
	</FormRow>

	<FormInput
		label="Purchase Date"
		name="purchaseDate"
		type="date"
		value={state.bottle.purchaseDate}
		on:input={(e) => addWineStore.updateBottle('purchaseDate', e.detail)}
	/>

	<!-- Summary of what's being added -->
	<div class="summary">
		<h3 class="summary-title">Summary</h3>
		<div class="summary-content">
			<div class="summary-row">
				<span class="summary-label">Region:</span>
				<span class="summary-value">
					{state.selected.region?.regionName || state.region.regionName || 'Not set'}
				</span>
			</div>
			<div class="summary-row">
				<span class="summary-label">Producer:</span>
				<span class="summary-value">
					{state.selected.producer?.producerName || state.producer.producerName || 'Not set'}
				</span>
			</div>
			<div class="summary-row">
				<span class="summary-label">Wine:</span>
				<span class="summary-value">
					{state.selected.wine?.wineName || state.wine.wineName || 'Not set'}
					{#if state.wine.wineYear}
						({state.wine.wineYear})
					{/if}
				</span>
			</div>
		</div>
	</div>
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

	.summary {
		margin-top: var(--space-6);
		padding: var(--space-4);
		background: var(--bg-subtle);
		border: 1px solid var(--divider-subtle);
		border-radius: 8px;
	}

	.summary-title {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin-bottom: var(--space-3);
	}

	.summary-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.summary-row {
		display: flex;
		gap: var(--space-2);
	}

	.summary-label {
		font-size: 0.8125rem;
		color: var(--text-tertiary);
		min-width: 70px;
	}

	.summary-value {
		font-size: 0.8125rem;
		color: var(--text-primary);
		font-weight: 500;
	}
</style>
