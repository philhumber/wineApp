<script lang="ts">
	/**
	 * TypingIndicator
	 * Wine glass fill animation for loading states
	 * Sommelier-style messaging
	 */

	export let text: string = 'Consulting the cellar...';
</script>

<div class="typing-indicator" role="status" aria-label="Thinking">
	<div class="wine-glass" aria-hidden="true">
		<div class="glass-bowl">
			<div class="wine-fill"></div>
		</div>
		<div class="glass-stem"></div>
		<div class="glass-base"></div>
	</div>
	<span class="typing-text">{text}</span>
</div>

<style>
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		animation: fadeIn 0.3s var(--ease-out);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Wine glass structure */
	.wine-glass {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 18px;
		flex-shrink: 0;
	}

	.glass-bowl {
		width: 16px;
		height: 14px;
		border: 1.5px solid var(--accent);
		border-radius: 0 0 8px 8px;
		border-top: none;
		position: relative;
		overflow: hidden;
	}

	.wine-fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--accent);
		animation: pour 1.8s ease-in-out infinite;
	}

	@keyframes pour {
		0%,
		100% {
			height: 15%;
			opacity: 0.4;
		}
		50% {
			height: 70%;
			opacity: 0.8;
		}
	}

	.glass-stem {
		width: 2px;
		height: 6px;
		background: var(--accent);
	}

	.glass-base {
		width: 10px;
		height: 2px;
		background: var(--accent);
		border-radius: 1px;
	}

	.typing-text {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-style: italic;
		color: var(--text-tertiary);
		letter-spacing: 0.01em;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.typing-indicator {
			animation: none;
		}

		.wine-fill {
			animation: none;
			height: 40%;
			opacity: 0.6;
		}
	}
</style>
