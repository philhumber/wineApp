<script lang="ts">
	/**
	 * TypewriterText
	 * Word-by-word text animation for agent messages
	 * WIN-168: Agent text should grow like being typed
	 *
	 * Supports inline HTML (e.g., <span class="wine-name">) by keeping tags
	 * intact during animation. Tags are treated as invisible wrappers around
	 * their content words.
	 *
	 * Note: The `text` prop must not change after mount. Animation runs once
	 * in onMount() and won't react to prop changes. This is fine for agent
	 * messages which are immutable.
	 */
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';

	export let text: string;
	export let speed: number = 80; // ms per word (~16 words/sec)
	export let className: string = '';

	const dispatch = createEventDispatcher<{ complete: void }>();

	let displayedText = '';
	let complete = false;

	// Check reduced motion preference
	$: prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/**
	 * Parse text into segments of HTML tags and plain text words.
	 * Returns array where each item is either an HTML tag (kept intact)
	 * or a plain text word to animate.
	 */
	function parseSegments(input: string): { type: 'tag' | 'word'; value: string }[] {
		const segments: { type: 'tag' | 'word'; value: string }[] = [];
		// Match HTML tags or sequences of non-whitespace
		const regex = /<[^>]+>|[^\s<]+/g;
		let match;

		while ((match = regex.exec(input)) !== null) {
			const value = match[0];
			if (value.startsWith('<')) {
				segments.push({ type: 'tag', value });
			} else {
				segments.push({ type: 'word', value });
			}
		}

		return segments;
	}

	/**
	 * Build display string from segments up to wordCount visible words.
	 * HTML tags are included when their content words are reached.
	 */
	function buildDisplay(
		segments: { type: 'tag' | 'word'; value: string }[],
		wordCount: number
	): string {
		let result = '';
		let wordsShown = 0;
		let openTags: string[] = []; // Track unclosed tags

		for (const seg of segments) {
			if (seg.type === 'tag') {
				// Check if opening or closing tag
				if (seg.value.startsWith('</')) {
					// Closing tag - include if we've started showing content
					if (wordsShown > 0 && openTags.length > 0) {
						result += seg.value;
						openTags.pop();
					}
				} else if (!seg.value.endsWith('/>')) {
					// Opening tag - include with next word
					openTags.push(seg.value);
				}
			} else {
				// Word - include if within count
				if (wordsShown < wordCount) {
					// Add any pending open tags
					result += openTags.join('');
					openTags = [];
					// Add space if not first word
					if (result && !result.endsWith('>')) {
						result += ' ';
					}
					result += seg.value;
					wordsShown++;
				} else {
					break;
				}
			}
		}

		// Close any open tags
		// (This happens when we stop mid-tag content)
		while (openTags.length > 0) {
			openTags.pop();
			// Find matching close tag - simplified for span tags
			result += '</span>';
		}

		return result;
	}

	onMount(() => {
		// Skip animation if user prefers reduced motion
		if (prefersReducedMotion) {
			displayedText = text;
			complete = true;
			dispatch('complete');
			return;
		}

		const segments = parseSegments(text);
		const totalWords = segments.filter((s) => s.type === 'word').length;

		let wordIndex = 0;
		const interval = setInterval(() => {
			if (wordIndex < totalWords) {
				wordIndex++;
				displayedText = buildDisplay(segments, wordIndex);
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
	{@html displayedText}{#if !complete}<span class="cursor">|</span>{/if}
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
