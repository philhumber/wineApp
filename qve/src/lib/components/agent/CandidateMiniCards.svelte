<script lang="ts">
	/**
	 * CandidateMiniCards
	 * Horizontally-scrolling tappable cards for wine/appellation disambiguation
	 * Single tap dispatches select event and proceeds immediately
	 */
	import { createEventDispatcher } from 'svelte';
	import type { AgentCandidate } from '$lib/api/types';

	export let candidates: AgentCandidate[] = [];

	const dispatch = createEventDispatcher<{ select: { candidate: AgentCandidate } }>();

	// Auto-detect disambiguation type from candidate data
	$: isAppellationList = candidates.some(
		(c) => !!(c.data as Record<string, unknown>)?.appellationName
	);

	// Touch handling to distinguish scroll from tap
	let touchStartX = 0;
	let touchStartY = 0;
	const SCROLL_THRESHOLD = 10;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent, candidate: AgentCandidate) {
		const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
		const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
		if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) return;
		dispatch('select', { candidate });
	}

	function handleClick(candidate: AgentCandidate) {
		dispatch('select', { candidate });
	}

	// Helper to safely access candidate data fields
	function getData(candidate: AgentCandidate, field: string): string {
		const value = (candidate.data as Record<string, unknown>)?.[field];
		return typeof value === 'string' ? value : '';
	}

	function getGrapes(candidate: AgentCandidate): string {
		const grapes = (candidate.data as Record<string, unknown>)?.primaryGrapes;
		if (Array.isArray(grapes)) return grapes.slice(0, 3).join(', ');
		return '';
	}
</script>

<div class="mini-cards-section">
	<p class="mini-cards-header">
		{isAppellationList ? 'Which appellation?' : 'Which wine is this?'}
	</p>
	<div class="mini-cards" role="listbox" aria-label="Choose from candidates">
		{#each candidates as candidate (candidate.data)}
			<button
				class="mini-card"
				role="option"
				aria-selected="false"
				on:touchstart|passive={handleTouchStart}
				on:touchend={(e) => handleTouchEnd(e, candidate)}
				on:click={() => handleClick(candidate)}
			>
				{#if isAppellationList}
					<span class="mini-card-name">{getData(candidate, 'appellationName')}</span>
					{#if getData(candidate, 'subRegion') || getData(candidate, 'classificationLevel')}
						<span class="mini-card-subtitle">
							{[getData(candidate, 'subRegion'), getData(candidate, 'classificationLevel')]
								.filter(Boolean)
								.join(' · ')}
						</span>
					{/if}
					{#if getGrapes(candidate)}
						<span class="mini-card-meta">{getGrapes(candidate)}</span>
					{/if}
				{:else}
					<!-- Producer → Wine → Meta order -->
					<span class="mini-card-name">{getData(candidate, 'producerName')}</span>
					{#if getData(candidate, 'wineName')}
						<span class="mini-card-subtitle">{getData(candidate, 'wineName')}</span>
					{/if}
					<span class="mini-card-meta">
						{[getData(candidate, 'vintage'), getData(candidate, 'regionName')]
							.filter(Boolean)
							.join(' · ')}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.mini-cards-section {
		margin: var(--space-3) 0;
	}

	.mini-cards-header {
		font-family: var(--font-serif);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
	}

	.mini-cards {
		display: flex;
		gap: var(--space-3);
		overflow-x: auto;
		padding-bottom: var(--space-2);
		-webkit-overflow-scrolling: touch;
		/* Use pan-x on container */
		touch-action: pan-x;
	}

	/* Use proximity not mandatory */
	@media (max-width: 640px) {
		.mini-cards {
			scroll-snap-type: x proximity;
		}
		.mini-card {
			scroll-snap-align: start;
		}
	}

	/* Hide scrollbar for cleaner look */
	.mini-cards::-webkit-scrollbar {
		display: none;
	}
	.mini-cards {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.mini-card {
		flex: 0 0 auto;
		min-width: 140px;
		max-width: calc(50% - var(--space-3));
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		transition:
			box-shadow 0.15s ease,
			border-color 0.15s ease;
		/* Use manipulation on individual cards */
		touch-action: manipulation;
	}

	@media (min-width: 768px) {
		.mini-card {
			max-width: calc(33.333% - var(--space-3));
		}
	}

	.mini-card:hover {
		box-shadow: var(--shadow-sm);
	}

	.mini-card:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.mini-card:active {
		border-color: var(--accent);
	}

	.mini-card-name {
		font-family: var(--font-serif);
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.mini-card-subtitle {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.mini-card-meta {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
</style>
