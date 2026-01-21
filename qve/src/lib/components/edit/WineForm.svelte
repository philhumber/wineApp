<script lang="ts">
	/**
	 * WineForm component
	 * Form fields for editing wine details (Tab 1)
	 */
	import { createEventDispatcher } from 'svelte';
	import {
		FormInput,
		FormSelect,
		FormTextarea,
		FormRow,
		ImageUploadZone
	} from '$lib/components';
	import type { EditWineFormData } from '$lib/stores/editWine';

	export let state: EditWineFormData;
	export let wineTypeOptions: Array<{ value: string; label: string }> = [];
	export let errors: Record<string, string> = {};
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		input: { field: keyof EditWineFormData; value: string };
		imageSelect: File;
		imageClear: void;
	}>();

	function handleInput(field: keyof EditWineFormData, value: string) {
		dispatch('input', { field, value });
	}

	function handleImageSelect(event: CustomEvent<File>) {
		dispatch('imageSelect', event.detail);
	}

	function handleImageClear() {
		dispatch('imageClear');
	}
</script>

<div class="wine-form">
	<!-- Wine Name -->
	<FormInput
		label="Wine Name"
		name="wineName"
		value={state.wineName}
		required
		{disabled}
		error={errors['wine.wineName'] || ''}
		on:input={(e) => handleInput('wineName', e.detail)}
	/>

	<!-- Year + Type Row -->
	<FormRow>
		<FormInput
			label="Vintage Year"
			name="wineYear"
			value={state.wineYear}
			placeholder="e.g., 2019 or leave empty for NV"
			{disabled}
			on:input={(e) => handleInput('wineYear', e.detail)}
		/>
		<FormSelect
			label="Wine Type"
			name="wineType"
			value={state.wineType}
			options={wineTypeOptions}
			required
			{disabled}
			error={errors['wine.wineType'] || ''}
			on:change={(e) => handleInput('wineType', e.detail)}
		/>
	</FormRow>

	<!-- Description -->
	<FormTextarea
		label="Description"
		name="wineDescription"
		value={state.wineDescription}
		rows={3}
		required
		{disabled}
		error={errors['wine.wineDescription'] || ''}
		on:input={(e) => handleInput('wineDescription', e.detail)}
	/>

	<!-- Tasting Notes -->
	<FormTextarea
		label="Tasting Notes"
		name="wineTasting"
		value={state.wineTasting}
		rows={3}
		required
		{disabled}
		error={errors['wine.wineTasting'] || ''}
		on:input={(e) => handleInput('wineTasting', e.detail)}
	/>

	<!-- Food Pairing -->
	<FormTextarea
		label="Food Pairing"
		name="winePairing"
		value={state.winePairing}
		rows={2}
		required
		{disabled}
		error={errors['wine.winePairing'] || ''}
		on:input={(e) => handleInput('winePairing', e.detail)}
	/>

	<!-- Wine Image -->
	<div class="form-group">
		<label class="form-label">
			Wine Image
			<span class="required">*</span>
		</label>
		<ImageUploadZone
			imagePreview={state.picturePreview}
			fileName={state.pictureFile?.name || (state.winePicture ? 'Current image' : null)}
			{disabled}
			on:select={handleImageSelect}
			on:clear={handleImageClear}
		/>
		{#if errors['wine.winePicture']}
			<span class="error-text">{errors['wine.winePicture']}</span>
		{/if}
	</div>
</div>

<style>
	.wine-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-label {
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
	}

	.form-label .required {
		color: var(--error);
	}

	.error-text {
		font-size: 0.75rem;
		color: var(--error);
	}
</style>
