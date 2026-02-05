<script lang="ts">
	/**
	 * AgentPanelNew
	 * Slim replacement for the 4,037-line AgentPanel monolith.
	 * All business logic is in handleAgentAction.ts.
	 */
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';

	// Stores
	import {
		agent,
		agentPanelOpen,
		wines,
		winesLoading,
		targetWineID,
		viewMode
	} from '$lib/stores';
	import {
		agentMessages,
		agentPhase,
		initializeConversation,
		startSession,
		setOrigin,
		clearOrigin,
		agentOrigin
	} from '$lib/stores/agentConversation';
	import { isIdentifying, streamingFields } from '$lib/stores/agentIdentification';
	import { isEnriching, enrichmentStreamingFields } from '$lib/stores/agentEnrichment';
	import { addedWineId, resetAddWine } from '$lib/stores/agentAddWine';
	import { api } from '$lib/api';
	import type { OriginViewMode } from '$lib/stores/agentConversation';

	// Action handler
	import { handleAgentAction } from '$lib/agent/handleAgentAction';
	import type { AgentAction } from '$lib/agent/types';

	// Components
	import AgentChatContainer from './conversation/AgentChatContainer.svelte';
	import MessageList from './conversation/MessageList.svelte';
	import InputArea from './conversation/InputArea.svelte';
	import WineCard from './cards/WineCard.svelte';
	import EnrichmentCard from './cards/EnrichmentCard.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import { Icon } from '$lib/components';

	// ===========================================
	// Constants
	// ===========================================

	const COMPLETION_DELAY_MS = 2000; // Delay before closing panel after success
	const SCROLL_DELAY_MS = 100; // Small delay for DOM rendering before scroll
	const SCROLL_ANIMATION_MS = 600; // Time for scroll animation to complete
	const HIGHLIGHT_DURATION_MS = 2500; // Duration of highlight animation

	// ===========================================
	// Reactive bindings
	// ===========================================

	$: isOpen = $agentPanelOpen;
	$: phase = $agentPhase;
	$: isWineStreaming = $streamingFields.size > 0 && !$isEnriching;
	$: isEnrichmentStreaming = $enrichmentStreamingFields.size > 0;

	// Track completion for navigation
	let completionHandled = false;
	let previousAddedWineId: number | null = null;

	// Initialize on mount
	onMount(() => {
		initializeConversation();
	});

	// ===========================================
	// Origin Tracking
	// ===========================================

	// Track origin when panel opens
	$: if (isOpen && !$agentOrigin) {
		const currentPath = $page.url.pathname;
		const currentViewMode: OriginViewMode = $viewMode;
		setOrigin({
			path: currentPath,
			viewMode: currentViewMode
		});
	}

	// Handle panel open - start session if no messages
	$: if (isOpen && $agentMessages.length === 0) {
		startSession();
	}

	// ===========================================
	// Completion Handling
	// ===========================================

	/**
	 * Watch for wine addition completion and handle:
	 * 1. Close panel with delay
	 * 2. Refresh wine list
	 * 3. Navigate to cellar/all wines view
	 * 4. Scroll to added wine
	 * 5. Highlight the wine
	 */
	$: if (
		phase === 'complete' &&
		$addedWineId !== null &&
		$addedWineId !== previousAddedWineId &&
		!completionHandled
	) {
		completionHandled = true;
		previousAddedWineId = $addedWineId;
		handleWineAddCompletion($addedWineId);
	}

	// Reset completion flag when phase changes away from complete
	$: if (phase !== 'complete') {
		completionHandled = false;
	}

	async function handleWineAddCompletion(wineId: number): Promise<void> {
		// Get origin before we clear it
		const origin = $agentOrigin;

		// Determine target view and path
		// If user was on history, redirect to cellar; otherwise use their origin
		const isFromHistory = origin?.path?.includes('/history');
		const targetViewMode: OriginViewMode = isFromHistory
			? 'ourWines'
			: (origin?.viewMode || 'ourWines');
		const targetPath = `${base}/`;

		// Wait for user to read success message
		await delay(COMPLETION_DELAY_MS);

		// Close the panel
		agent.closePanel();

		// Clear origin tracking
		clearOrigin();

		// Reset add wine state
		resetAddWine();

		// Set view mode to match where we're navigating
		viewMode.set(targetViewMode);

		// Navigate to cellar/all wines
		await goto(targetPath);

		// Wait for navigation to complete
		await tick();

		// Refresh wines with the correct view filter
		const bottleCountFilter = targetViewMode === 'ourWines' ? '1' : '0';
		try {
			const wineList = await api.getWines({ bottleCount: bottleCountFilter });
			wines.set(wineList);
		} catch (error) {
			console.error('[AgentPanelNew] Failed to refresh wines:', error);
		}

		// Wait for wines to load and render
		await tick();
		await delay(SCROLL_DELAY_MS);

		// Scroll to the new wine and highlight it
		scrollToWineAndHighlight(wineId);
	}

	/**
	 * Scroll to a wine card and then highlight it.
	 * Uses the same pattern as +page.svelte for consistency.
	 */
	function scrollToWineAndHighlight(wineId: number): void {
		const targetCard = document.querySelector(`[data-wine-id="${wineId}"]`);
		const header = document.querySelector('.header');

		if (targetCard) {
			// Calculate scroll position accounting for fixed header
			const headerHeight = header?.getBoundingClientRect().height ?? 160;
			const cardTop = targetCard.getBoundingClientRect().top + window.scrollY;
			const scrollTarget = cardTop - headerHeight - 16; // 16px extra padding

			window.scrollTo({
				top: scrollTarget,
				behavior: 'smooth'
			});

			// After scroll completes, trigger the highlight animation
			setTimeout(() => {
				targetWineID.set(wineId);
				// Clear targetWineID after animation is done
				setTimeout(() => {
					targetWineID.set(null);
				}, HIGHLIGHT_DURATION_MS);
			}, SCROLL_ANIMATION_MS);
		}
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Event handlers
	function handleAction(event: CustomEvent<AgentAction>) {
		handleAgentAction(event.detail);
	}

	function handleClose() {
		agent.closePanel();
	}

	function handleStartOver() {
		handleAgentAction({ type: 'start_over' });
	}

	function handleBackdropClick() {
		handleClose();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleClose();
	}

	// Check if input should be disabled
	$: isInputDisabled = phase === 'identifying' || phase === 'enriching';
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="agent-backdrop"
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKeydown}
		role="button"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="agent-panel"
		transition:fly={{ x: 400, duration: 300, easing: cubicOut }}
		role="dialog"
		aria-label="Wine Assistant"
	>
		<!-- Header -->
		<header class="panel-header">
			<h2>Wine Assistant</h2>
			<button class="close-button" on:click={handleClose} aria-label="Close">
				<Icon name="x" size={20} />
			</button>
		</header>

		<!-- Chat Area -->
		<div class="chat-area">
			<AgentChatContainer messages={$agentMessages} on:action={handleAction}>
			<svelte:fragment slot="messages" let:handleAction>
				<!-- Message List -->
				<MessageList messages={$agentMessages} on:action={handleAction} />

				<!-- Typing Indicator -->
				{#if $isIdentifying || $isEnriching}
					<div class="indicator-wrapper">
						<TypingIndicator
							text={$isEnriching ? 'Researching wine details...' : 'Consulting the cellar...'}
						/>
					</div>
				{/if}

				<!-- Streaming Wine Card -->
				{#if isWineStreaming}
					<div class="streaming-card" data-streaming-card>
						<WineCard state="streaming" />
					</div>
				{/if}

				<!-- Streaming Enrichment Card -->
				{#if isEnrichmentStreaming}
					<div class="streaming-card" data-enrichment-card>
						<EnrichmentCard state="streaming" />
					</div>
				{/if}
			</svelte:fragment>

			<svelte:fragment slot="input" let:handleAction>
				<InputArea {phase} disabled={isInputDisabled} on:action={handleAction} />
			</svelte:fragment>
		</AgentChatContainer>
		</div>

		<!-- Footer -->
		<footer class="panel-footer">
			<button
				class="start-over-button"
				on:click={handleStartOver}
				disabled={phase === 'greeting'}
			>
				<Icon name="refresh" size={14} />
				Start Over
			</button>
		</footer>
	</div>
{/if}

<style>
	.agent-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 999;
	}

	:global(html[data-theme='dark']) .agent-backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.agent-panel {
		position: fixed;
		top: 16px;
		right: 16px;
		bottom: 16px;
		width: 400px;
		max-width: calc(100vw - 32px);
		background: var(--surface);
		border: 1px solid var(--divider-subtle);
		box-shadow: var(--shadow-xl);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-lg);
		overflow: hidden; /* Ensures header/content respect border-radius */
	}

	/* Mobile: bottom sheet */
	@media (max-width: 640px) {
		.agent-panel {
			top: auto;
			left: 0;
			right: 0;
			width: 100%;
			max-height: 85vh;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		}
	}

	.chat-area {
		flex: 1;
		min-height: 0; /* Critical: allows flex child to shrink below content size */
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		border-bottom: 1px solid var(--divider);
		background: var(--surface);
	}

	.panel-header h2 {
		font-family: var(--font-serif);
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		color: var(--text-tertiary);
		transition: all 0.15s var(--ease-out);
	}

	.close-button:hover {
		background: var(--bg-subtle);
		color: var(--text-primary);
	}

	.indicator-wrapper {
		padding: 0 var(--space-4);
	}

	.streaming-card {
		padding: 0 var(--space-4);
		margin-bottom: var(--space-4);
	}

	.panel-footer {
		display: flex;
		justify-content: center;
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--divider);
		background: var(--surface);
	}

	.start-over-button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all 0.15s var(--ease-out);
	}

	.start-over-button:hover:not(:disabled) {
		background: var(--bg-subtle);
		color: var(--text-primary);
	}

	.start-over-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
