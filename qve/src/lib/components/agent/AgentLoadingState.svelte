<script lang="ts">
	/**
	 * AgentLoadingState
	 * Wine-themed loading animation with cycling messages
	 *
	 * Switches to "deep search" mode after a delay, indicating
	 * the backend is working harder (model escalation)
	 */
	import { onMount, onDestroy } from 'svelte';
	import { getMessageArrayByKey, getMessageByKey } from '$lib/agent/messages';
	import { MessageKey } from '$lib/agent/messageKeys';

	/** Delay before switching to deep search messages (ms) */
	export let deepSearchDelay: number = 2500;

	const normalMessages = getMessageArrayByKey(MessageKey.LOADING_NORMAL);
	const deepSearchMessages = getMessageArrayByKey(MessageKey.LOADING_DEEP_SEARCH);
	const deepSearchHintText = getMessageByKey(MessageKey.LOADING_DEEP_SEARCH_HINT);

	let currentIndex = 0;
	let isDeepSearch = false;
	let messageInterval: ReturnType<typeof setInterval>;
	let deepSearchTimeout: ReturnType<typeof setTimeout>;

	$: messages = isDeepSearch ? deepSearchMessages : normalMessages;
	$: currentMessage = messages[currentIndex % messages.length];

	onMount(() => {
		// Cycle through messages
		messageInterval = setInterval(() => {
			currentIndex = (currentIndex + 1) % messages.length;
		}, 2000);

		// Switch to deep search mode after delay
		deepSearchTimeout = setTimeout(() => {
			isDeepSearch = true;
			currentIndex = 0; // Reset to first deep search message
		}, deepSearchDelay);
	});

	onDestroy(() => {
		if (messageInterval) clearInterval(messageInterval);
		if (deepSearchTimeout) clearTimeout(deepSearchTimeout);
	});
</script>

<div class="loading-state" class:deep-search={isDeepSearch} role="status" aria-live="polite">
	<div class="icon-container">
		<svg class="wine-glass" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
			<!-- Glass outline -->
			<path
				class="glass-outline"
				d="M16 4h16l2 12c0 6-4 10-9 10.5V36h6v4H17v-4h6V26.5C18 26 14 22 14 16l2-12z"
			/>
			<!-- Animated wine -->
			<ellipse class="wine-fill" cx="24" cy="14" rx="6" ry="3" />
			<!-- Wine swirl effect -->
			<path class="wine-swirl" d="M18 14 Q24 11 30 14 Q24 17 18 14" />
		</svg>

		<!-- Deep search sparkle effects -->
		{#if isDeepSearch}
			<div class="sparkles">
				<span class="sparkle s1"></span>
				<span class="sparkle s2"></span>
				<span class="sparkle s3"></span>
			</div>
		{/if}
	</div>

	<p class="message">{currentMessage}</p>

	<div class="dots">
		<span class="dot"></span>
		<span class="dot"></span>
		<span class="dot"></span>
		{#if isDeepSearch}
			<span class="dot"></span>
			<span class="dot"></span>
		{/if}
	</div>

	{#if isDeepSearch}
		<p class="deep-search-hint">{deepSearchHintText}</p>
	{/if}
</div>

<style>
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
		gap: var(--space-4);
		transition: all 0.3s var(--ease-out);
	}

	.loading-state.deep-search {
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(166, 155, 138, 0.05) 50%,
			transparent 100%
		);
	}

	.icon-container {
		position: relative;
	}

	.wine-glass {
		animation: gentleSway 2s ease-in-out infinite;
		transition: transform 0.3s var(--ease-out);
	}

	.deep-search .wine-glass {
		animation: intenseSway 1.2s ease-in-out infinite;
		filter: drop-shadow(0 0 8px rgba(166, 155, 138, 0.4));
	}

	.glass-outline {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.deep-search .glass-outline {
		stroke-width: 2;
	}

	.wine-fill {
		fill: var(--rating-wine);
		opacity: 0.6;
		animation: wineWave 1.5s ease-in-out infinite;
		transform-origin: center;
	}

	.deep-search .wine-fill {
		animation: wineSwirl 1s ease-in-out infinite;
		opacity: 0.8;
	}

	.wine-swirl {
		fill: none;
		stroke: var(--rating-wine);
		stroke-width: 1;
		opacity: 0.4;
		animation: swirlPulse 2s ease-in-out infinite;
	}

	.deep-search .wine-swirl {
		animation: swirlIntense 0.8s ease-in-out infinite;
		opacity: 0.6;
	}

	/* Sparkle effects for deep search */
	.sparkles {
		position: absolute;
		inset: -8px;
		pointer-events: none;
	}

	.sparkle {
		position: absolute;
		width: 4px;
		height: 4px;
		background: var(--accent);
		border-radius: 50%;
		animation: sparkle 1.5s ease-in-out infinite;
	}

	.sparkle.s1 {
		top: 0;
		left: 50%;
		animation-delay: 0s;
	}

	.sparkle.s2 {
		top: 30%;
		right: 0;
		animation-delay: 0.5s;
	}

	.sparkle.s3 {
		bottom: 20%;
		left: 0;
		animation-delay: 1s;
	}

	.message {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-style: italic;
		color: var(--text-secondary);
		margin: 0;
		min-height: 1.5em;
		text-align: center;
		transition: all 0.3s var(--ease-out);
	}

	.deep-search .message {
		font-size: 1.0625rem;
		color: var(--text-primary);
	}

	.deep-search-hint {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--text-tertiary);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		animation: fadeIn 0.5s var(--ease-out);
	}

	.dots {
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		animation: bounce 1.4s ease-in-out infinite;
	}

	.deep-search .dot {
		animation: bounceIntense 1s ease-in-out infinite;
	}

	.dot:nth-child(1) {
		animation-delay: 0s;
	}

	.dot:nth-child(2) {
		animation-delay: 0.1s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(4) {
		animation-delay: 0.3s;
	}

	.dot:nth-child(5) {
		animation-delay: 0.4s;
	}

	/* Normal animations */
	@keyframes gentleSway {
		0%,
		100% {
			transform: rotate(-5deg);
		}
		50% {
			transform: rotate(5deg);
		}
	}

	@keyframes wineWave {
		0%,
		100% {
			transform: scaleX(1) translateY(0);
		}
		25% {
			transform: scaleX(0.95) translateY(1px);
		}
		50% {
			transform: scaleX(1.05) translateY(-1px);
		}
		75% {
			transform: scaleX(0.98) translateY(0.5px);
		}
	}

	@keyframes swirlPulse {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-6px);
		}
	}

	/* Deep search (intense) animations */
	@keyframes intenseSway {
		0%,
		100% {
			transform: rotate(-8deg) scale(1.05);
		}
		50% {
			transform: rotate(8deg) scale(1.05);
		}
	}

	@keyframes wineSwirl {
		0% {
			transform: scaleX(1) translateY(0) rotate(0deg);
		}
		25% {
			transform: scaleX(0.9) translateY(2px) rotate(3deg);
		}
		50% {
			transform: scaleX(1.1) translateY(-2px) rotate(-3deg);
		}
		75% {
			transform: scaleX(0.95) translateY(1px) rotate(2deg);
		}
		100% {
			transform: scaleX(1) translateY(0) rotate(0deg);
		}
	}

	@keyframes swirlIntense {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	@keyframes bounceIntense {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-8px) scale(1.2);
		}
	}

	@keyframes sparkle {
		0%,
		100% {
			opacity: 0;
			transform: scale(0);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
