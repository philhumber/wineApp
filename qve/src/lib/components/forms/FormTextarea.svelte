<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let label: string = '';
	export let name: string = '';
	export let value: string = '';
	export let placeholder: string = '';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let error: string = '';
	export let rows: number = 4;
	export let autoGrow: boolean = true;
	export let id: string = name || `textarea-${Math.random().toString(36).slice(2, 9)}`;

	let textareaEl: HTMLTextAreaElement;
	let lastValue = '';

	const dispatch = createEventDispatcher<{
		input: string;
		change: string;
		blur: void;
	}>();

	// Auto-resize textarea based on content (non-async, simpler)
	function autoResize() {
		if (!autoGrow || !textareaEl) return;
		// Use requestAnimationFrame to batch DOM reads/writes
		requestAnimationFrame(() => {
			if (!textareaEl) return;
			textareaEl.style.height = 'auto';
			textareaEl.style.height = `${textareaEl.scrollHeight}px`;
		});
	}

	// Auto-resize when value changes externally (e.g., AI filling data)
	// Only trigger if value actually changed
	$: if (textareaEl && value !== lastValue) {
		lastValue = value;
		autoResize();
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		lastValue = value;
		dispatch('input', value);
		autoResize();
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		dispatch('change', target.value);
	}

	function handleBlur() {
		dispatch('blur');
	}

	onMount(() => {
		lastValue = value;
		autoResize();
	});
</script>

<div class="form-group">
	{#if label}
		<label class="form-label" for={id}>
			{label}
			{#if required}<span class="required">*</span>{/if}
		</label>
	{/if}
	<textarea
		bind:this={textareaEl}
		{id}
		{name}
		{placeholder}
		{disabled}
		{rows}
		class="form-textarea"
		class:auto-grow={autoGrow}
		class:invalid={!!error}
		on:input={handleInput}
		on:change={handleChange}
		on:blur={handleBlur}
	>{value}</textarea>
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

	.form-textarea {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: 8px;
		outline: none;
		resize: vertical;
		min-height: 80px;
		line-height: 1.6;
		transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}

	.form-textarea.auto-grow {
		resize: none;
		overflow: hidden;
	}

	.form-textarea:focus {
		border-color: var(--accent);
		background: var(--surface);
		box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
	}

	.form-textarea::placeholder {
		color: var(--text-tertiary);
	}

	.form-textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-textarea.invalid {
		border-color: var(--error);
		background: rgba(184, 122, 122, 0.05);
	}

	.form-error {
		font-size: 0.75rem;
		color: var(--error);
		margin-top: var(--space-1);
	}
</style>
