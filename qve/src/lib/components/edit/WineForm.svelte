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
		input: { field: keyof EditWineFormData; value: string | boolean };
		imageSelect: File;
		imageClear: void;
	}>();

	function handleInput(field: keyof EditWineFormData, value: string | boolean) {
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
		<div class="year-field">
			<FormInput
				label="Vintage Year"
				name="wineYear"
				value={state.wineYear}
				placeholder="e.g., 2019"
				disabled={disabled || state.isNonVintage}
				on:input={(e) => handleInput('wineYear', e.detail)}
			/>
			<!-- WIN-176: NV Toggle -->
			<label class="nv-toggle">
				<input
					type="checkbox"
					checked={state.isNonVintage}
					{disabled}
					on:change={(e) => {
						const isNV = e.currentTarget.checked;
						handleInput('isNonVintage', isNV);
						if (isNV) {
							handleInput('wineYear', '');
						}
					}}
				/>
				<span>Non-Vintage (NV)</span>
			</label>
		</div>
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
	<ImageUploadZone
		label="Wine Image"
		required
		imagePreview={state.picturePreview}
		fileName={state.pictureFile?.name || (state.winePicture ? 'Current image' : null)}
		error={errors['wine.winePicture'] || ''}
		{disabled}
		on:select={handleImageSelect}
		on:clear={handleImageClear}
	/>
</div>

<style>
	.wine-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* WIN-176: NV Toggle Styles */
	.year-field {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.nv-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.nv-toggle input[type="checkbox"] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.nv-toggle input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.nv-toggle span {
		user-select: none;
	}
</style>
