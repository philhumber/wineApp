<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label: string = '';
	export let name: string = '';
	export let value: string = '';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let error: string = '';
	export let options: Array<{ value: string; label: string }> = [];
	export let placeholder: string = 'Select...';
	export let id: string = name || `select-${Math.random().toString(36).slice(2, 9)}`;

	const dispatch = createEventDispatcher<{
		change: string;
		blur: void;
	}>();

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		dispatch('change', value);
	}

	function handleBlur() {
		dispatch('blur');
	}
</script>

<div class="form-group">
	{#if label}
		<label class="form-label" for={id}>
			{label}
			{#if required}<span class="required">*</span>{/if}
		</label>
	{/if}
	<select
		{id}
		{name}
		{value}
		{disabled}
		class="form-select"
		class:invalid={!!error}
		on:change={handleChange}
		on:blur={handleBlur}
	>
		{#if placeholder}
			<option value="" disabled={required}>{placeholder}</option>
		{/if}
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error}
		<p class="form-error">{error}</p>
	{/if}
</div>

<style>
	.form-group {
		margin-bottom: var(--space-5);
	}

	.form-label {
		display: block;
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
		margin-bottom: var(--space-2);
	}

	.form-label .required {
		color: var(--error);
	}

	.form-select {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		padding-right: var(--space-10);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 8px;
		outline: none;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A847D' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--space-4) center;
		transition: all 0.2s var(--ease-out);
	}

	.form-select:focus {
		border-color: var(--accent);
		background-color: var(--surface);
		box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
	}

	.form-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-select option {
		color: #2D2926;
		background-color: #FFFFFF;
	}

	.form-select.invalid {
		border-color: var(--error);
		background-color: rgba(184, 122, 122, 0.05);
	}

	.form-error {
		font-size: 0.75rem;
		color: var(--error);
		margin-top: var(--space-1);
	}
</style>
