<script lang="ts">
	/**
	 * AgentBubble
	 * Floating action button to open the Wine Assistant panel
	 *
	 * Position: Fixed bottom-right
	 * Size: 56x56px (touch-friendly)
	 * States: idle, hover, loading, hasResult, panelOpen
	 */
	import { agent, agentLoading, agentHasResult, agentPanelOpen } from '$lib/stores';

	// Reactive state
	$: isLoading = $agentLoading;
	$: hasResult = $agentHasResult;
	$: isPanelOpen = $agentPanelOpen;

	function handleClick() {
		agent.togglePanel();
	}
</script>

<button
	class="agent-bubble"
	class:loading={isLoading}
	class:has-result={hasResult && !isPanelOpen}
	class:panel-open={isPanelOpen}
	on:click={handleClick}
	aria-label={isPanelOpen ? 'Close Wine Assistant' : 'Open Wine Assistant'}
	aria-expanded={isPanelOpen}
>
	<svg
		class="bubble-icon"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
	>
		<!-- Wine glass with sparkle -->
		<path
			class="glass"
			d="M8 2h8l1 6c0 3-2 5-4.5 5.5V18h3v2H8.5v-2h3v-4.5C9 13 7 11 7 8l1-6z"
		/>
		<ellipse class="wine" cx="12" cy="7" rx="3" ry="2" />
		<!-- Sparkle -->
		<path
			class="sparkle"
			d="M18 3l.5 1.5L20 5l-1.5.5L18 7l-.5-1.5L16 5l1.5-.5L18 3z"
		/>
	</svg>
</button>

<style>
	.agent-bubble {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
		right: 16px;
		z-index: 100;

		width: 56px;
		height: 56px;
		border-radius: 50%;

		background: var(--surface);
		border: 1px solid var(--divider);
		box-shadow: var(--shadow-md);

		cursor: pointer;
		touch-action: manipulation;

		display: flex;
		align-items: center;
		justify-content: center;

		transition:
			transform 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			border-color 0.2s var(--ease-out),
			opacity 0.2s var(--ease-out);
	}

	.agent-bubble:hover {
		transform: scale(1.05);
		box-shadow: var(--shadow-lg);
		border-color: var(--accent);
	}

	.agent-bubble:active {
		transform: scale(0.98);
	}

	.agent-bubble:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Panel open state */
	.agent-bubble.panel-open {
		transform: scale(0.9);
		opacity: 0.8;
	}

	.agent-bubble.panel-open:hover {
		transform: scale(0.95);
		opacity: 1;
	}

	/* Loading state */
	.agent-bubble.loading .bubble-icon {
		animation: gentleSpin 3s linear infinite;
	}

	/* Has result state - pulse effect */
	.agent-bubble.has-result {
		animation: gentlePulse 2s ease-in-out infinite;
	}

	/* Icon styling */
	.bubble-icon {
		color: var(--accent);
		transition: transform 0.2s var(--ease-out);
	}

	.bubble-icon .glass {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.bubble-icon .wine {
		fill: var(--rating-wine);
		opacity: 0.6;
	}

	.bubble-icon .sparkle {
		fill: var(--warning);
		opacity: 0.8;
	}

	/* Animations */
	@keyframes gentlePulse {
		0%,
		100% {
			box-shadow:
				var(--shadow-md),
				0 0 0 0 rgba(166, 155, 138, 0.4);
		}
		50% {
			box-shadow:
				var(--shadow-md),
				0 0 0 8px rgba(166, 155, 138, 0);
		}
	}

	@keyframes gentleSpin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
