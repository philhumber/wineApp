<script lang="ts">
	/**
	 * TypewriterText
	 * Character-by-character text animation for agent messages
	 * WIN-168: Agent text should grow like being typed
	 *
	 * Note: The `text` prop must not change after mount. Animation runs once
	 * in onMount() and won't react to prop changes. This is fine for agent
	 * messages which are immutable.
	 */
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';

	export let text: string;
	export let speed: number = 18; // ms per character (~55 chars/sec)
	export let className: string = '';

	const dispatch = createEventDispatcher<{ complete: void }>();

	let displayedText = '';
	let complete = false;

	// Check reduced motion preference
	$: prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	onMount(() => {
		// Skip animation if user prefers reduced motion
		if (prefersReducedMotion) {
			displayedText = text;
			complete = true;
			dispatch('complete');
			return;
		}

		let i = 0;
		const interval = setInterval(() => {
			if (i < text.length) {
				displayedText = text.slice(0, i + 1);
				i++;
			} else {
				complete = true;
				clearInterval(interval);
				dispatch('complete');
			}
		}, speed);

		return () => clearInterval(interval);
	});
</script>

<p class={className} class:typing={!complete}>
	{displayedText}{#if !complete}<span class="cursor">|</span>{/if}
</p>

<style>
	p {
		margin: 0;
	}

	.cursor {
		animation: blink 0.7s step-end infinite;
		color: var(--accent, #a69b8a);
		font-weight: 300;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.cursor {
			animation: none;
		}
	}
</style>
