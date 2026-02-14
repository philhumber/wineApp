<script lang="ts">
	/**
	 * FoodPairingsSection
	 * Displays food pairing recommendations
	 */
	// Slot props from DataCard
	export let state: 'skeleton' | 'streaming' | 'static';
	export let getFieldValue: (field: string) => any;
	export let hasField: (field: string) => boolean;
	export let isFieldTyping: (field: string) => boolean;
	export let handleFieldComplete: (field: string) => void;
	export let isTextStreaming = false;
	void isFieldTyping;
	void handleFieldComplete;

	// Handle field name variations (pairingNotes or pairings)
	$: pairingNotes = getFieldValue('pairingNotes') || getFieldValue('pairings');
	$: hasPairingNotes = hasField('pairingNotes') || hasField('pairings');
</script>

<section class="section">
	<h4 class="section-title">Food Pairings</h4>
	{#if state === 'skeleton' || !hasPairingNotes}
		<div class="shimmer-container">
			<span class="shimmer-bar" style="width: 100%;"></span>
			<span class="shimmer-bar" style="width: 75%;"></span>
		</div>
	{:else}
		<p class="narrative-text">
			{pairingNotes}{#if isTextStreaming}<span class="streaming-cursor">&#9611;</span>{/if}
		</p>
	{/if}
</section>

<style>
	.section {
		margin-bottom: var(--space-5);
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.narrative-text {
		font-family: var(--font-serif);
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--text-primary);
	}

	.streaming-cursor {
		animation: blink 0.7s step-end infinite;
		color: var(--accent);
		font-weight: 300;
		margin-left: 2px;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.shimmer-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.shimmer-bar {
		display: block;
		height: 1em;
		background: linear-gradient(
			90deg,
			var(--bg-subtle) 25%,
			var(--bg-elevated) 50%,
			var(--bg-subtle) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-sm);
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shimmer-bar {
			animation: none;
			background: var(--bg-subtle);
		}
		.streaming-cursor {
			animation: none;
		}
	}
</style>
