<script lang="ts">
	/**
	 * ManualEntryForm
	 * Form for filling in missing required fields during add wine flow
	 * Shows only the fields that are missing, with confirmed fields as context
	 */
	import { createEventDispatcher, onMount } from 'svelte';
	import type { AgentParsedWine } from '$lib/api/types';
	import { api } from '$lib/api';
	import type { WineType } from '$lib/api/types';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	const dispatch = createEventDispatcher<{
		complete: {
			producer: string;
			wineName: string;
			region: string;
			wineType: string;
		};
	}>();

	export let partialData: AgentParsedWine;
	export let missingFields: string[] = [];

	// Wine types from API
	let wineTypes: WineType[] = [];
	let loading = true;

	// Form state (only for missing fields)
	let producer = partialData?.producer || '';
	let wineName = partialData?.wineName || '';
	let region = partialData?.region || '';
	let wineType = partialData?.wineType || '';

	// Which fields are missing
	$: needsProducer = missingFields.includes('producer');
	$: needsWineName = missingFields.includes('wine name');
	$: needsRegion = missingFields.includes('region');
	$: needsWineType = missingFields.includes('wine type');

	// Validation
	$: canSubmit =
		(!needsProducer || producer.trim()) &&
		(!needsWineName || wineName.trim()) &&
		(!needsRegion || region.trim()) &&
		(!needsWineType || wineType.trim());

	// Fields that are already filled (for display as context)
	$: confirmedFields = [
		partialData?.producer ? { label: 'Producer', value: partialData.producer } : null,
		partialData?.wineName ? { label: 'Wine', value: partialData.wineName } : null,
		partialData?.vintage ? { label: 'Vintage', value: partialData.vintage } : null,
		partialData?.region ? { label: 'Region', value: partialData.region } : null,
		partialData?.country ? { label: 'Country', value: partialData.country } : null,
		partialData?.wineType ? { label: 'Type', value: partialData.wineType } : null
	].filter(Boolean) as Array<{ label: string; value: string }>;

	onMount(async () => {
		try {
			const types = await api.getTypes({});
			wineTypes = types || [];
		} catch (error) {
			console.error('Failed to fetch wine types:', error);
			// Fallback to common types
			wineTypes = [
				{ wineTypeName: 'Red' },
				{ wineTypeName: 'White' },
				{ wineTypeName: 'Rosé' },
				{ wineTypeName: 'Sparkling' },
				{ wineTypeName: 'Dessert' },
				{ wineTypeName: 'Fortified' }
			];
		} finally {
			loading = false;
		}
	});

	function handleSubmit() {
		if (canSubmit) {
			dispatch('complete', {
				producer: needsProducer ? producer.trim() : (partialData?.producer || ''),
				wineName: needsWineName ? wineName.trim() : (partialData?.wineName || ''),
				region: needsRegion ? region.trim() : (partialData?.region || ''),
				wineType: needsWineType ? wineType.trim() : (partialData?.wineType || '')
			});
		}
	}

	// Wine type options
	$: typeOptions = wineTypes.map((t) => ({
		value: t.wineTypeName || t.wineType || '',
		label: t.wineTypeName || t.wineType || ''
	}));
</script>

<div class="manual-entry-form">
	<!-- Show confirmed fields as context -->
	{#if confirmedFields.length > 0}
		<div class="confirmed-context">
			<span class="context-label">Identified:</span>
			<span class="context-values">
				{confirmedFields.map((f) => `${f.value}`).join(' · ')}
			</span>
		</div>
	{/if}

	{#if loading}
		<div class="loading">Loading...</div>
	{:else}
		<div class="form-fields">
			{#if needsProducer}
				<FormInput
					id="manual-producer"
					label="Producer"
					bind:value={producer}
					placeholder="e.g., Château Margaux"
					required
					maxlength={255}
					on:input={(e) => (producer = e.detail)}
				/>
			{/if}

			{#if needsWineName}
				<FormInput
					id="manual-wine-name"
					label="Wine Name"
					bind:value={wineName}
					placeholder="e.g., Grand Vin"
					required
					maxlength={50}
					on:input={(e) => (wineName = e.detail)}
				/>
			{/if}

			{#if needsRegion}
				<FormInput
					id="manual-region"
					label="Region"
					bind:value={region}
					placeholder="e.g., Margaux, Bordeaux"
					required
					maxlength={50}
					on:input={(e) => (region = e.detail)}
				/>
			{/if}

			{#if needsWineType}
				<div class="form-group">
					<label class="form-label" for="manual-wine-type">
						Wine Type <span class="required">*</span>
					</label>
					<select
						id="manual-wine-type"
						class="form-select"
						bind:value={wineType}
					>
						<option value="" disabled>Select type...</option>
						{#each typeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/if}

			<button class="btn btn-primary" disabled={!canSubmit} on:click={handleSubmit}>
				Continue
			</button>
		</div>
	{/if}
</div>

<style>
	.manual-entry-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.confirmed-context {
		padding: var(--space-3);
		background: var(--bg-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.context-label {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
	}

	.context-values {
		font-family: var(--font-serif);
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.loading {
		padding: var(--space-4);
		text-align: center;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: 0.875rem;
	}

	.form-fields {
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

	.form-select option {
		color: #2D2926;
		background-color: #FFFFFF;
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
