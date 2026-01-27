<script lang="ts">
	/**
	 * AgentPanel
	 * Bottom sheet (mobile) / Side panel (desktop) for Wine Assistant
	 *
	 * Mobile: Fixed bottom, slides up, max-height 80vh
	 * Desktop: Fixed right side, 400px width, slides in
	 */
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import {
		agent,
		agentPanelOpen,
		agentLoading,
		agentParsed,
		agentAction,
		agentConfidence,
		agentCandidates,
		agentError,
		addWineStore
	} from '$lib/stores';
	import CommandInput from './CommandInput.svelte';
	import WineIdentificationCard from './WineIdentificationCard.svelte';
	import DisambiguationList from './DisambiguationList.svelte';
	import AgentLoadingState from './AgentLoadingState.svelte';
	import type { AgentParsedWine, AgentCandidate } from '$lib/api/types';

	$: isOpen = $agentPanelOpen;
	$: isLoading = $agentLoading;
	$: parsed = $agentParsed;
	$: action = $agentAction;
	$: confidence = $agentConfidence;
	$: candidates = $agentCandidates;
	$: error = $agentError;

	// Determine what to show in the result area
	$: hasResult = parsed !== null;
	$: showDisambiguation = action === 'disambiguate' && candidates.length > 0;

	function handleClose() {
		agent.closePanel();
	}

	function handleBackdropClick() {
		agent.closePanel();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			e.preventDefault();
			agent.closePanel();
		}
	}

	async function handleTextSubmit(e: CustomEvent<{ text: string }>) {
		await agent.identify(e.detail.text);
	}

	async function handleImageSubmit(e: CustomEvent<{ file: File }>) {
		await agent.identifyImage(e.detail.file);
	}

	function handleAddToCellar(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		// Pre-fill the add wine wizard with identified data
		addWineStore.populateFromAgent(e.detail.parsed);
		// Close the panel (it will persist state, user can reopen)
		agent.closePanel();
		// Reset agent state since we're proceeding
		agent.reset();
		// Navigate to the add wine wizard
		goto('/qve/add');
	}

	function handleTryAgain() {
		agent.reset();
	}

	function handleConfirm(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		// Same as add to cellar - user confirmed the identification
		handleAddToCellar(e);
	}

	function handleEdit(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		// Same as add to cellar - user wants to edit in the wizard
		// The wizard allows editing all fields, so this is the same flow
		handleAddToCellar(e);
	}

	function handleCandidateSelect(e: CustomEvent<{ candidate: AgentCandidate }>) {
		// Build AgentParsedWine from selected candidate
		const candidate = e.detail.candidate;
		const data = candidate.data as Record<string, unknown>;

		const parsed: AgentParsedWine = {
			producer: (data.producer as string) || null,
			wineName: (data.wineName as string) || (data.name as string) || null,
			vintage: (data.vintage as string) || null,
			region: (data.region as string) || null,
			country: (data.country as string) || null,
			wineType: (data.wineType as AgentParsedWine['wineType']) || null,
			grapes: (data.grapes as string[]) || null,
			confidence: candidate.confidence
		};

		// Pre-fill and navigate
		addWineStore.populateFromAgent(parsed);
		agent.closePanel();
		agent.reset();
		goto('/qve/add');
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<!-- Backdrop (mobile only via CSS) -->
	<div
		class="backdrop"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Enter' && handleBackdropClick()}
		role="button"
		tabindex="-1"
		aria-label="Close panel"
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="panel-title"
		transition:fly={{ y: 300, x: 0, duration: 300, easing: cubicOut }}
	>
		<!-- Drag handle (mobile only) -->
		<div class="drag-handle" aria-hidden="true"></div>

		<!-- Header -->
		<header class="panel-header">
			<div class="header-title">
				<svg class="header-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path d="M8 2h8l1 6c0 3-2 5-4.5 5.5V18h3v2H8.5v-2h3v-4.5C9 13 7 11 7 8l1-6z" />
				</svg>
				<h2 id="panel-title">Wine Assistant</h2>
			</div>
			<button
				class="close-btn"
				on:click={handleClose}
				aria-label="Close Wine Assistant"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<!-- Content area -->
		<div class="panel-content">
			{#if error}
				<!-- Error state -->
				<div class="error-state">
					<p class="error-message">{error}</p>
					<button class="retry-btn" on:click={handleTryAgain}>Try Again</button>
				</div>
			{:else if isLoading}
				<!-- Loading state -->
				<AgentLoadingState />
			{:else if showDisambiguation}
				<!-- Multiple candidates - low confidence -->
				<DisambiguationList
					{candidates}
					on:select={handleCandidateSelect}
					on:tryAgain={handleTryAgain}
				/>
			{:else if hasResult && parsed && action && confidence !== null}
				<!-- Single result -->
				<WineIdentificationCard
					{parsed}
					{action}
					{confidence}
					on:addToCellar={handleAddToCellar}
					on:tryAgain={handleTryAgain}
					on:confirm={handleConfirm}
					on:edit={handleEdit}
				/>
			{:else}
				<!-- Empty state -->
				<div class="empty-state">
					<svg class="empty-icon" viewBox="0 0 48 48" width="64" height="64" aria-hidden="true">
						<path
							class="glass"
							d="M16 4h16l2 12c0 6-4 10-9 10.5V36h6v4H17v-4h6V26.5C18 26 14 22 14 16l2-12z"
						/>
						<ellipse class="wine" cx="24" cy="14" rx="6" ry="3" />
					</svg>
					<p class="empty-text">Type a wine name or take a photo of the label to identify it.</p>
				</div>
			{/if}
		</div>

		<!-- Input area -->
		<div class="panel-input">
			<CommandInput
				disabled={isLoading}
				placeholder="Type wine name..."
				on:submit={handleTextSubmit}
				on:image={handleImageSubmit}
			/>
		</div>
	</div>
{/if}

<style>
	/* Backdrop - visible on mobile only */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 139;
		background: rgba(45, 41, 38, 0.4);
	}

	:global([data-theme='dark']) .backdrop {
		background: rgba(12, 11, 10, 0.6);
	}

	/* Panel base styles */
	.panel {
		position: fixed;
		z-index: 140;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Mobile: Bottom sheet */
	@media (max-width: 767px) {
		.panel {
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 80vh;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			box-shadow: var(--shadow-xl);
		}
	}

	/* Desktop: Side panel */
	@media (min-width: 768px) {
		.backdrop {
			display: none;
		}

		.panel {
			top: 16px;
			right: 16px;
			bottom: 16px;
			width: 400px;
			border-radius: var(--radius-lg);
			border: 1px solid var(--divider-subtle);
			box-shadow: var(--shadow-xl);
		}

		.drag-handle {
			display: none;
		}
	}

	/* Drag handle */
	.drag-handle {
		width: 40px;
		height: 4px;
		background: var(--divider);
		border-radius: var(--radius-pill);
		margin: var(--space-3) auto;
		flex-shrink: 0;
	}

	/* Header */
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		border-bottom: 1px solid var(--divider-subtle);
		flex-shrink: 0;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.header-icon {
		color: var(--accent);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.panel-header h2 {
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
	}

	.close-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		touch-action: manipulation;
		color: var(--text-tertiary);
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.close-btn:hover {
		background: var(--bg-subtle);
		color: var(--text-secondary);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.close-btn svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	/* Content area */
	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-5);
		min-height: 200px;
	}

	/* Input area */
	.panel-input {
		flex-shrink: 0;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-6);
		height: 100%;
		min-height: 200px;
	}

	.empty-icon {
		margin-bottom: var(--space-4);
		opacity: 0.4;
	}

	.empty-icon .glass {
		fill: none;
		stroke: var(--text-tertiary);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.empty-icon .wine {
		fill: var(--text-tertiary);
		opacity: 0.3;
	}

	.empty-text {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-tertiary);
		margin: 0;
		max-width: 280px;
		line-height: 1.5;
	}

	/* Error state */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-6);
		gap: var(--space-4);
	}

	.error-message {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--error);
		margin: 0;
		max-width: 280px;
		line-height: 1.5;
	}

	.retry-btn {
		padding: var(--space-3) var(--space-5);
		background: transparent;
		border: 1px solid var(--divider);
		border-radius: var(--radius-pill);
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			background 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}

	.retry-btn:hover {
		background: var(--bg-subtle);
		border-color: var(--accent);
	}
</style>
