<script lang="ts">
	/**
	 * FieldTypewriter (WIN-181)
	 * Typewriter animation for streaming field values.
	 * Handles conversion of various value types (strings, arrays, etc.) to displayable text.
	 */
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';

	export let value: unknown;
	export let isTyping: boolean = true;
	export let speed: number = 18; // ms per character

	const dispatch = createEventDispatcher<{ complete: void }>();

	let displayedText = '';
	let complete = false;

	// Convert value to display string
	function formatValue(val: unknown): string {
		if (val === null || val === undefined) return '';
		if (typeof val === 'string') return val;
		if (typeof val === 'number') return String(val);
		if (Array.isArray(val)) {
			// For arrays (e.g., grapes), join with commas
			return val.map(formatValue).filter(Boolean).join(', ');
		}
		if (typeof val === 'object') {
			// For objects (e.g., drink window), format specially
			const obj = val as Record<string, unknown>;
			if ('start' in obj && 'end' in obj) {
				return `${obj.start || '?'} - ${obj.end || '?'}`;
			}
			// Generic object - just stringify key parts
			return Object.entries(obj)
				.filter(([, v]) => v !== null && v !== undefined)
				.map(([k, v]) => `${k}: ${formatValue(v)}`)
				.join(', ');
		}
		return String(val);
	}

	$: text = formatValue(value);

	// Check reduced motion preference
	$: prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	onMount(() => {
		// Skip animation if user prefers reduced motion or not typing
		if (prefersReducedMotion || !isTyping) {
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

	// If not typing (animation done), show full text
	$: if (!isTyping && !complete) {
		displayedText = text;
		complete = true;
	}
</script>

<span class="field-value" class:typing={!complete && isTyping}>
	{displayedText}{#if !complete && isTyping}<span class="cursor">|</span>{/if}
</span>

<style>
	.field-value {
		display: inline;
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
