<script lang="ts">
	/**
	 * DisambiguationList
	 * Radio-style list for selecting from multiple wine candidates
	 * Used when confidence is low (<60%)
	 */
	import { createEventDispatcher } from 'svelte';
	import type { AgentCandidate } from '$lib/api/types';

	const dispatch = createEventDispatcher<{
		select: { candidate: AgentCandidate };
		tryAgain: void;
	}>();

	export let candidates: AgentCandidate[] = [];

	let selectedIndex: number | null = null;

	function handleSelect(index: number) {
		selectedIndex = index;
	}

	function handleConfirm() {
		if (selectedIndex !== null && candidates[selectedIndex]) {
			dispatch('select', { candidate: candidates[selectedIndex] });
		}
	}

	function handleTryAgain() {
		dispatch('tryAgain');
	}

	// Detect if candidates are appellation/region references
	$: isAppellationList = candidates.length > 0 &&
		candidates.some((c) => !!(c.data as Record<string, unknown>)?.appellationName);

	// Dynamic header text based on candidate type
	$: headerTitle = isAppellationList ? 'Multiple appellations found' : 'Multiple matches found';
	$: headerSubtitle = isAppellationList
		? 'Which region best matches this wine?'
		: 'Please select the correct wine:';

	// Extract display data from candidate
	function getCandidateDisplay(candidate: AgentCandidate): {
		name: string;
		metadata: string;
		source: string;
	} {
		const data = candidate.data as Record<string, unknown>;

		// Check if this is an appellation/region candidate
		if (data.appellationName) {
			const name = String(data.appellationName);

			const parts: string[] = [];
			if (data.subRegion) parts.push(String(data.subRegion));
			if (data.classificationLevel) parts.push(String(data.classificationLevel));
			if (data.primaryGrapes && Array.isArray(data.primaryGrapes)) {
				parts.push((data.primaryGrapes as string[]).slice(0, 3).join(', '));
			}

			const metadata = parts.join(' · ') || `${data.region ?? ''} · ${data.country ?? ''}`;
			const source = 'Appellation reference';

			return { name, metadata, source };
		}

		// Wine candidate — try to extract name from various possible fields
		const name =
			(data.producer as string) ||
			(data.wineName as string) ||
			(data.name as string) ||
			'Unknown Wine';

		// Build metadata string
		const parts: string[] = [];
		if (data.vintage) parts.push(String(data.vintage));
		if (data.region) parts.push(String(data.region));
		if (data.country) parts.push(String(data.country));

		const metadata = parts.join(' · ') || 'No details available';

		// Source indicator
		const source = candidate.source === 'collection' ? 'In your cellar' : 'Wine database';

		return { name, metadata, source };
	}

	$: canConfirm = selectedIndex !== null;
</script>

<div class="disambiguation">
	<header class="header">
		<h3 class="title">{headerTitle}</h3>
		<p class="subtitle">{headerSubtitle}</p>
	</header>

	<div class="candidates">
		{#each candidates as candidate, index}
			{@const display = getCandidateDisplay(candidate)}
			<button
				type="button"
				class="candidate"
				class:selected={selectedIndex === index}
				on:click={() => handleSelect(index)}
				aria-pressed={selectedIndex === index}
			>
				<div class="radio">
					<div class="radio-inner"></div>
				</div>
				<div class="candidate-info">
					<span class="candidate-name">{display.name}</span>
					<span class="candidate-meta">{display.metadata}</span>
					<span class="candidate-source">{display.source}</span>
				</div>
				<span class="confidence">{Math.round(candidate.confidence)}%</span>
			</button>
		{/each}
	</div>

	<div class="actions">
		<button
			class="btn btn-primary"
			disabled={!canConfirm}
			on:click={handleConfirm}
		>
			Select
		</button>
		<button class="btn btn-secondary" on:click={handleTryAgain}>Try Again</button>
	</div>
</div>

<style>
	.disambiguation {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.header {
		text-align: left;
	}

	.title {
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 var(--space-1) 0;
	}

	.subtitle {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.candidates {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.candidate {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-4);
		background: var(--bg-subtle);
		border: 1px solid var(--divider);
		border-radius: var(--radius-md);
		cursor: pointer;
		touch-action: manipulation;
		text-align: left;
		transition:
			background 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}

	.candidate:hover {
		background: var(--surface);
	}

	.candidate.selected {
		background: var(--surface);
		border-color: var(--accent);
	}

	.candidate:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Radio button */
	.radio {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		margin-top: 2px;
		border: 2px solid var(--divider);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s var(--ease-out);
	}

	.candidate.selected .radio {
		border-color: var(--accent);
	}

	.radio-inner {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--accent);
		transform: scale(0);
		transition: transform 0.15s var(--ease-out);
	}

	.candidate.selected .radio-inner {
		transform: scale(1);
	}

	/* Candidate info */
	.candidate-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.candidate-name {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.3;
	}

	.candidate-meta {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.candidate-source {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
		opacity: 0.8;
	}

	.confidence {
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	/* Actions */
	.actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.btn {
		flex: 1;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;

		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;

		border: none;
		border-radius: var(--radius-pill);
		cursor: pointer;
		touch-action: manipulation;

		transition:
			background 0.15s var(--ease-out),
			transform 0.15s var(--ease-out),
			opacity 0.15s var(--ease-out);
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--text-primary);
		color: var(--bg);
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--divider);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--bg-subtle);
		border-color: var(--accent);
	}
</style>
