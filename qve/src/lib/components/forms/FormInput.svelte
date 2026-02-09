<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label: string = '';
	export let name: string = '';
	export let value: string = '';
	export let placeholder: string = '';
	export let type: 'text' | 'number' | 'date' | 'email' | 'tel' = 'text';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let error: string = '';
	export let maxlength: number | undefined = undefined;
	export let id: string = name || `input-${Math.random().toString(36).slice(2, 9)}`;

	const dispatch = createEventDispatcher<{
		input: string;
		change: string;
		blur: void;
	}>();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		dispatch('input', value);
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		dispatch('change', target.value);
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
	<input
		{id}
		{type}
		{name}
		{value}
		{placeholder}
		{disabled}
		{maxlength}
		class="form-input"
		class:invalid={!!error}
		class:date-input={type === 'date'}
		on:input={handleInput}
		on:change={handleChange}
		on:blur={handleBlur}
	/>
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

	.form-input {
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

	.form-input:focus {
		border-color: var(--accent);
		background: var(--surface);
		box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
	}

	.form-input::placeholder {
		color: var(--text-tertiary);
	}

	.form-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-input.invalid {
		border-color: var(--error);
		background: rgba(184, 122, 122, 0.05);
	}

	.form-error {
		font-size: 0.75rem;
		color: var(--error);
		margin-top: var(--space-1);
	}

	/* Date input styling */
	.form-input.date-input {
		color-scheme: light;
		cursor: pointer;
	}

	:global([data-theme='dark']) .form-input.date-input {
		color-scheme: dark;
	}

	/* Style the calendar icon */
	.form-input.date-input::-webkit-calendar-picker-indicator {
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.2s var(--ease-out);
		filter: none;
	}

	:global([data-theme='dark']) .form-input.date-input::-webkit-calendar-picker-indicator {
		filter: invert(0.8);
	}

	.form-input.date-input::-webkit-calendar-picker-indicator:hover {
		opacity: 1;
	}
</style>
