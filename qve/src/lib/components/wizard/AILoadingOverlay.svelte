<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { aiLoadingMessages } from '$lib/stores';

	export let visible: boolean = false;

	const dispatch = createEventDispatcher<{
		cancel: void;
	}>();

	let currentMessageIndex = 0;
	let messageInterval: ReturnType<typeof setInterval> | null = null;
	let portalTarget: HTMLElement | null = null;

	$: currentMessage = aiLoadingMessages[currentMessageIndex];

	// Create portal target in body (no positioning so children's position:fixed works correctly)
	onMount(() => {
		if (browser) {
			portalTarget = document.createElement('div');
			portalTarget.id = 'ai-overlay-portal';
			document.body.appendChild(portalTarget);
		}
	});

	// Svelte action to portal an element to a target
	function portal(node: HTMLElement) {
		if (portalTarget) {
			portalTarget.appendChild(node);
		}
		return {
			destroy() {
				// Element will be removed when component unmounts
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	// Lock/unlock body scroll
	function setBodyScroll(lock: boolean) {
		if (!browser) return;
		if (lock) {
			document.body.style.overflow = 'hidden';
			document.body.style.touchAction = 'none';
		} else {
			document.body.style.overflow = '';
			document.body.style.touchAction = '';
		}
	}

	// Start/stop message cycle and scroll lock based on visibility
	$: {
		if (visible && !messageInterval) {
			currentMessageIndex = 0;
			messageInterval = setInterval(() => {
				currentMessageIndex = (currentMessageIndex + 1) % aiLoadingMessages.length;
			}, 1500);
			setBodyScroll(true);
		} else if (!visible && messageInterval) {
			clearInterval(messageInterval);
			messageInterval = null;
			setBodyScroll(false);
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && visible) {
			handleCancel();
		}
	}

	onDestroy(() => {
		if (messageInterval) {
			clearInterval(messageInterval);
			messageInterval = null;
		}
		setBodyScroll(false);
		// Clean up portal
		if (portalTarget && portalTarget.parentNode) {
			portalTarget.parentNode.removeChild(portalTarget);
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<div
		use:portal
		class="ai-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="AI is generating content"
	>
		<div class="ai-overlay-content">
			<div class="ai-spinner" aria-hidden="true"></div>
			<p class="ai-loading-text">{currentMessage}</p>
			<button type="button" class="ai-cancel" on:click={handleCancel}>
				Cancel
			</button>
		</div>
	</div>
{/if}

<style>
	/* Global styles needed because element is portaled to body */
	:global(.ai-overlay) {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		background: rgba(45, 41, 38, 0.6);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: overlayFadeIn 0.2s var(--ease-out);
	}

	@keyframes overlayFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	:global([data-theme='dark'] .ai-overlay) {
		background: rgba(12, 11, 10, 0.8);
	}

	:global(.ai-overlay-content) {
		position: fixed;
		top: 50vh;
		left: 50vw;
		transform: translate(-50%, -50%);
		text-align: center;
		color: var(--bg);
		max-width: 300px;
		padding: var(--space-6);
		z-index: 10001;
	}

	:global([data-theme='dark'] .ai-overlay-content) {
		color: var(--text-primary);
	}

	:global(.ai-spinner) {
		width: 48px;
		height: 48px;
		margin: 0 auto var(--space-5);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	:global([data-theme='dark'] .ai-spinner) {
		border-color: rgba(166, 155, 138, 0.2);
		border-top-color: var(--accent);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.ai-loading-text) {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-style: italic;
		margin-bottom: var(--space-4);
		min-height: 1.5em;
	}

	:global(.ai-cancel) {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.7);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: var(--space-2) var(--space-4);
		transition: color 0.15s var(--ease-out);
	}

	:global(.ai-cancel:hover) {
		color: white;
	}

	:global([data-theme='dark'] .ai-cancel) {
		color: var(--text-tertiary);
	}

	:global([data-theme='dark'] .ai-cancel:hover) {
		color: var(--text-secondary);
	}
</style>
