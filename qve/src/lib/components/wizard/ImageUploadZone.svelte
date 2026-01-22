<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let imagePreview: string | null = null;
	export let fileName: string | null = null;
	export let disabled: boolean = false;
	export let accept: string = 'image/jpeg,image/png,image/gif,image/webp';
	export let maxSizeMB: number = 10;
	export let label: string = 'Wine Image';
	export let required: boolean = false;
	export let error: string = '';

	let isDragging = false;
	let fileInput: HTMLInputElement;
	let internalError: string = '';

	const dispatch = createEventDispatcher<{
		select: File;
		clear: void;
		error: string;
	}>();

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleClick() {
		if (!disabled) {
			fileInput?.click();
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleFile(file: File) {
		internalError = '';

		// Validate file type
		const validTypes = accept.split(',').map((t) => t.trim());
		if (!validTypes.includes(file.type)) {
			internalError = 'Please select a valid image file (JPG, PNG, GIF, or WebP)';
			dispatch('error', internalError);
			return;
		}

		// Validate file size
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		if (file.size > maxSizeBytes) {
			internalError = `File size must be less than ${maxSizeMB}MB`;
			dispatch('error', internalError);
			return;
		}

		dispatch('select', file);
	}

	function handleReplace(e: Event) {
		e.stopPropagation();
		fileInput?.click();
	}

	function handleClear(e: Event) {
		e.stopPropagation();
		dispatch('clear');
		if (fileInput) {
			fileInput.value = '';
		}
	}

	$: displayFileName = fileName || 'wine-image.jpg';
</script>

<div class="form-group">
	<label class="form-label">
		{label}
		{#if required}<span class="required">*</span>{/if}
	</label>

	<div
		class="upload-zone"
		class:dragover={isDragging}
		class:has-preview={imagePreview !== null}
		class:disabled
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
		on:click={handleClick}
		role="button"
		tabindex={disabled ? -1 : 0}
		on:keydown={(e) => e.key === 'Enter' && handleClick()}
	>
		{#if imagePreview}
			<div class="upload-preview">
				<img src={imagePreview} alt="Preview" class="preview-image" />
				<div class="preview-info">
					<p class="preview-name">{displayFileName}</p>
					<div class="preview-actions">
						<button type="button" class="preview-replace" on:click={handleReplace}>
							Replace
						</button>
						<span class="preview-separator">·</span>
						<button type="button" class="preview-clear" on:click={handleClear}>
							Remove
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="upload-default">
				<svg class="upload-icon" viewBox="0 0 24 24">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				<p class="upload-text">Drag & drop image here</p>
				<p class="upload-hint">or click to browse · PNG, JPG up to {maxSizeMB}MB</p>
			</div>
		{/if}

		<input
			bind:this={fileInput}
			type="file"
			{accept}
			class="file-input"
			on:change={handleFileSelect}
			{disabled}
		/>
	</div>

	{#if internalError || error}
		<p class="upload-error">{internalError || error}</p>
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

	.upload-zone {
		position: relative;
		border: 2px dashed var(--divider);
		border-radius: 12px;
		padding: var(--space-8);
		text-align: center;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.upload-zone:hover:not(.disabled) {
		border-color: var(--accent-subtle);
		background: rgba(166, 155, 138, 0.02);
	}

	.upload-zone:focus-visible {
		outline: 1px solid var(--accent-subtle);
		outline-offset: 2px;
	}

	.upload-zone.dragover {
		border-color: var(--accent);
		background: rgba(166, 155, 138, 0.05);
	}

	.upload-zone.has-preview {
		padding: var(--space-4);
		border-style: solid;
	}

	.upload-zone.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.file-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.upload-default {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.upload-icon {
		width: 48px;
		height: 48px;
		margin-bottom: var(--space-4);
		stroke: var(--accent-muted);
		stroke-width: 1;
		fill: none;
	}

	.upload-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: var(--space-1);
	}

	.upload-hint {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.upload-preview {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.preview-image {
		width: 80px;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--divider);
	}

	.preview-info {
		flex: 1;
		text-align: left;
	}

	.preview-name {
		font-size: 0.875rem;
		color: var(--text-primary);
		margin-bottom: var(--space-1);
		word-break: break-all;
	}

	.preview-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.preview-replace,
	.preview-clear {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--accent);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: opacity 0.15s var(--ease-out);
	}

	.preview-replace:hover,
	.preview-clear:hover {
		text-decoration: underline;
	}

	.preview-separator {
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	.upload-error {
		font-size: 0.75rem;
		color: var(--error);
		margin-top: var(--space-2);
	}
</style>
