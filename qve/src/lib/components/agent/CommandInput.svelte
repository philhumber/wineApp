<script lang="ts">
	/**
	 * CommandInput
	 * Text input with image picker and send button
	 * Layout: [Camera] [Text Input] [Send]
	 */
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		submit: { text: string };
		image: { file: File };
	}>();

	export let placeholder: string = 'Type wine name...';
	export let disabled: boolean = false;
	export let value: string = '';

	let fileInput: HTMLInputElement;
	let cameraInput: HTMLInputElement;

	// Exposed methods for parent component
	export function triggerCamera() {
		cameraInput?.click();
	}

	export function triggerGallery() {
		fileInput?.click();
	}

	function handleSubmit() {
		const trimmed = value.trim();
		if (trimmed && !disabled) {
			dispatch('submit', { text: trimmed });
			value = '';
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function handleCameraClick() {
		fileInput?.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			dispatch('image', { file });
			// Reset both inputs so same file can be selected again
			fileInput.value = '';
			cameraInput.value = '';
		}
	}

	$: canSubmit = value.trim().length > 0 && !disabled;
</script>

<div class="command-input">
	<!-- Hidden file input for gallery -->
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="file-input"
		on:change={handleFileChange}
		{disabled}
	/>

	<!-- Hidden file input for camera capture -->
	<input
		bind:this={cameraInput}
		type="file"
		accept="image/*"
		capture="environment"
		class="file-input"
		on:change={handleFileChange}
		{disabled}
	/>

	<!-- Camera/Gallery button -->
	<button
		type="button"
		class="camera-btn"
		on:click={handleCameraClick}
		{disabled}
		aria-label="Take photo or select image"
	>
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<rect x="2" y="7" width="20" height="14" rx="2" />
			<circle cx="12" cy="14" r="4" />
			<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	</button>

	<!-- Text input -->
	<input
		type="text"
		class="text-input"
		bind:value
		{placeholder}
		{disabled}
		on:keydown={handleKeyDown}
		aria-label="Wine name or description"
	/>

	<!-- Send button -->
	<button
		type="button"
		class="send-btn"
		class:active={canSubmit}
		on:click={handleSubmit}
		disabled={!canSubmit}
		aria-label="Send"
	>
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	</button>
</div>

<style>
	.command-input {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--bg-subtle);
		border-top: 1px solid var(--divider-subtle);
	}

	.file-input {
		display: none;
	}

	.camera-btn {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;

		background: transparent;
		border: 1px solid var(--divider);
		border-radius: var(--radius-md);
		cursor: pointer;
		touch-action: manipulation;

		color: var(--text-secondary);
		transition:
			background 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.camera-btn:hover:not(:disabled) {
		background: var(--bg-subtle);
		border-color: var(--accent);
		color: var(--accent);
	}

	.camera-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.camera-btn svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.text-input {
		flex: 1;
		height: 44px;
		padding: var(--space-3) var(--space-4);

		background: var(--surface);
		border: 1px solid var(--divider);
		border-radius: var(--radius-pill);

		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);

		transition:
			border-color 0.15s var(--ease-out),
			box-shadow 0.15s var(--ease-out);
	}

	.text-input::placeholder {
		color: var(--text-tertiary);
	}

	.text-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.1);
	}

	.text-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;

		background: var(--divider);
		border: none;
		border-radius: 50%;
		cursor: not-allowed;
		touch-action: manipulation;

		color: var(--bg);
		transition:
			background 0.15s var(--ease-out),
			transform 0.15s var(--ease-out),
			opacity 0.15s var(--ease-out);
	}

	.send-btn.active {
		background: var(--text-primary);
		cursor: pointer;
	}

	.send-btn.active:hover {
		transform: scale(1.05);
	}

	.send-btn:disabled {
		opacity: 0.5;
	}

	.send-btn svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
