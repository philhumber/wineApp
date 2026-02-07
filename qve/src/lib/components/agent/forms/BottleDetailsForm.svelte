<script lang="ts">
	/**
	 * BottleDetailsForm
	 * Two-part inline form for bottle details during add wine flow
	 * Part 1: Size, Location, Source (required)
	 * Part 2: Price, Currency, Date (optional)
	 *
	 * Clean architecture: No store imports, local state, events with data payloads
	 */
	import { createEventDispatcher, onMount } from 'svelte';
	import { api } from '$lib/api';
	import type { BottleSize, Currency } from '$lib/api/types';
	import type { BottleFormData } from '$lib/agent/types';

	const dispatch = createEventDispatcher<{
		next: BottleFormData;
		submit: BottleFormData;
		ready: void;
	}>();

	export let part: 1 | 2 = 1;
	export let initialData: Partial<BottleFormData> = {};
	export let disabled: boolean = false;

	// Options from API
	let bottleSizes: BottleSize[] = [];
	let currencies: Currency[] = [];
	let loading = true;

	// WIN-228: Local flag to prevent double-clicks
	let isSubmitting = false;

	// Local form state (not store-driven)
	let formData: BottleFormData = {
		size: initialData.size ?? '',
		location: initialData.location ?? '',
		source: initialData.source ?? '',
		price: initialData.price,
		currency: initialData.currency ?? '',
		purchaseDate: initialData.purchaseDate ?? ''
	};

	// Validation
	$: canProceed =
		part === 1
			? formData.size && formData.location && formData.source
			: true; // Part 2 is all optional

	onMount(async () => {
		try {
			const data = await api.getCurrencies();
			bottleSizes = data.bottleSizes || [];
			currencies = data.currencies || [];

			// Set default currency if none selected
			if (!formData.currency && currencies.length > 0) {
				const defaultCurrency = currencies.find((c) => c.currencyCode === 'GBP') || currencies[0];
				formData = { ...formData, currency: defaultCurrency.currencyCode };
			}

			// Set default size if none selected
			if (!formData.size && bottleSizes.length > 0) {
				const standardSize = bottleSizes.find((s) => s.sizeCode === 'standard') || bottleSizes[0];
				formData = { ...formData, size: standardSize.sizeCode };
			}
		} catch (error) {
			console.error('Failed to fetch currencies:', error);
		} finally {
			loading = false;
			// Signal that form is ready (for scroll positioning)
			dispatch('ready');
		}
	});

	function updateField<K extends keyof BottleFormData>(field: K, value: BottleFormData[K]) {
		formData = { ...formData, [field]: value };
	}

	function handleNext() {
		// WIN-228: Prevent double-click
		if (isSubmitting || !canProceed) return;
		isSubmitting = true;
		dispatch('next', { ...formData });
	}

	function handleSubmit() {
		// WIN-228: Prevent double-click
		if (isSubmitting) return;
		isSubmitting = true;
		dispatch('submit', { ...formData });
	}

	// Convert bottle sizes to options format
	$: sizeOptions = bottleSizes.map((s) => ({
		value: s.sizeCode,
		label: `${s.sizeName} (${s.volumeLitres}L)`
	}));

	// Convert currencies to options format
	$: currencyOptions = currencies.map((c) => ({
		value: c.currencyCode,
		label: `${c.currencyCode} - ${c.currencyName}`
	}));
</script>

<div class="bottle-form">
	{#if loading}
		<div class="loading">Loading options...</div>
	{:else if part === 1}
		<!-- Part 1: Required fields -->
		<div class="form-section">
			<div class="form-group">
				<label class="form-label" for="bottle-size">
					Bottle Size <span class="required">*</span>
				</label>
				<select
					id="bottle-size"
					class="form-select"
					value={formData.size}
					{disabled}
					on:change={(e) => updateField('size', e.currentTarget.value)}
				>
					<option value="" disabled>Select size...</option>
					{#each sizeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label class="form-label" for="storage-location">
					Storage Location <span class="required">*</span>
				</label>
				<input
					id="storage-location"
					type="text"
					class="form-input"
					placeholder="e.g., Wine cellar, Rack A3"
					value={formData.location}
					{disabled}
					on:input={(e) => updateField('location', e.currentTarget.value)}
				/>
			</div>

			<div class="form-group">
				<label class="form-label" for="source">
					Source <span class="required">*</span>
				</label>
				<input
					id="source"
					type="text"
					class="form-input"
					placeholder="e.g., Berry Bros, Gift, Auction"
					value={formData.source}
					{disabled}
					on:input={(e) => updateField('source', e.currentTarget.value)}
				/>
			</div>

			<button class="btn btn-primary" disabled={!canProceed || disabled || isSubmitting} on:click={handleNext}>
				Next
			</button>
		</div>
	{:else}
		<!-- Part 2: Optional purchase details -->
		<div class="form-section">
			<div class="form-row">
				<div class="form-group price-group">
					<label class="form-label" for="price">Price</label>
					<input
						id="price"
						type="number"
						step="0.01"
						min="0"
						class="form-input"
						placeholder="0.00"
						value={formData.price ?? ''}
						{disabled}
						on:input={(e) => {
							const val = e.currentTarget.value;
							updateField('price', val ? parseFloat(val) : undefined);
						}}
					/>
				</div>

				<div class="form-group currency-group">
					<label class="form-label" for="currency">Currency</label>
					<select
						id="currency"
						class="form-select"
						value={formData.currency}
						{disabled}
						on:change={(e) => updateField('currency', e.currentTarget.value)}
					>
						{#each currencyOptions as option}
							<option value={option.value}>{option.value}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="form-group">
				<label class="form-label" for="purchase-date">Purchase Date</label>
				<input
					id="purchase-date"
					type="date"
					class="form-input date-input"
					value={formData.purchaseDate}
					{disabled}
					on:input={(e) => updateField('purchaseDate', e.currentTarget.value)}
				/>
			</div>

			<button class="btn btn-primary" disabled={disabled || isSubmitting} on:click={handleSubmit}>
				Add to Cellar
			</button>
		</div>
	{/if}
</div>

<style>
	.bottle-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.loading {
		padding: var(--space-4);
		text-align: center;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: 0.875rem;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-row {
		display: flex;
		gap: var(--space-3);
	}

	.price-group {
		flex: 2;
	}

	.currency-group {
		flex: 1;
	}

	.form-label {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
	}

	.form-label .required {
		color: var(--error);
	}

	.form-input,
	.form-select {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 8px;
		outline: none;
		transition: all 0.2s var(--ease-out);
	}

	.form-input:focus,
	.form-select:focus {
		border-color: var(--accent);
		background: var(--surface);
		box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
	}

	.form-input::placeholder {
		color: var(--text-tertiary);
	}

	.form-select {
		padding-right: var(--space-10);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A847D' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--space-4) center;
	}

	/* Date input styling */
	.date-input {
		color-scheme: light;
		cursor: pointer;
	}

	:global([data-theme='dark']) .date-input {
		color-scheme: dark;
	}

	.date-input::-webkit-calendar-picker-indicator {
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.2s var(--ease-out);
	}

	:global([data-theme='dark']) .date-input::-webkit-calendar-picker-indicator {
		filter: invert(0.8);
	}

	.date-input::-webkit-calendar-picker-indicator:hover {
		opacity: 1;
	}

	.btn {
		width: 100%;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: var(--space-2);

		font-family: var(--font-sans);
		font-size: 0.875rem;
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
</style>
