<script lang="ts">
	/**
	 * BottleForm component
	 * Form fields for editing bottle details (Tab 2)
	 */
	import { createEventDispatcher } from 'svelte';
	import { FormInput, FormSelect, FormRow } from '$lib/components';
	import { bottleSizeSelectOptions, currencySelectOptions, storageOptions } from '$lib/stores';
	import type { EditBottleFormData } from '$lib/stores/editWine';

	export let state: EditBottleFormData;
	export let errors: Record<string, string> = {};
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		input: { field: keyof EditBottleFormData; value: string };
	}>();

	function handleInput(field: keyof EditBottleFormData, value: string) {
		dispatch('input', { field, value });
	}
</script>

<div class="bottle-form">
	<!-- Size + Location Row -->
	<FormRow>
		<FormSelect
			label="Bottle Size"
			name="bottleSize"
			value={state.bottleSize}
			options={$bottleSizeSelectOptions}
			required
			{disabled}
			error={errors['bottle.bottleSize'] || ''}
			on:change={(e) => handleInput('bottleSize', e.detail)}
		/>
		<FormSelect
			label="Storage Location"
			name="location"
			value={state.location}
			options={storageOptions}
			required
			{disabled}
			error={errors['bottle.location'] || ''}
			on:change={(e) => handleInput('location', e.detail)}
		/>
	</FormRow>

	<!-- Source -->
	<FormInput
		label="Source"
		name="source"
		value={state.source}
		placeholder="Where was this purchased?"
		required
		{disabled}
		error={errors['bottle.source'] || ''}
		on:input={(e) => handleInput('source', e.detail)}
	/>

	<!-- Price + Currency Row -->
	<FormRow>
		<FormInput
			label="Price"
			name="price"
			type="number"
			value={state.price}
			placeholder="0.00"
			{disabled}
			on:input={(e) => handleInput('price', e.detail)}
		/>
		<FormSelect
			label="Currency"
			name="currency"
			value={state.currency}
			options={$currencySelectOptions}
			{disabled}
			on:change={(e) => handleInput('currency', e.detail)}
		/>
	</FormRow>

	<!-- Purchase Date -->
	<FormInput
		label="Purchase Date"
		name="purchaseDate"
		type="date"
		value={state.purchaseDate}
		{disabled}
		on:input={(e) => handleInput('purchaseDate', e.detail)}
	/>
</div>

<style>
	.bottle-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
