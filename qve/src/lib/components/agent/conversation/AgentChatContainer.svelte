<script lang="ts">
	/**
	 * AgentChatContainer
	 *
	 * Centralized scroll management for the agent chat UI.
	 * Observes store changes and handles scroll behavior reactively.
	 *
	 * Scroll scenarios (from WIN-181):
	 * 1. New message added -> scroll to show the message
	 * 2. Wine card streaming starts -> scroll to show card + chips area
	 * 3. Enrichment card streaming starts -> scroll so card top is at window top
	 */
	import { onMount, onDestroy, tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import type { AgentMessage, AgentAction } from '$lib/agent/types';

	// Import stores for reactive scroll triggers
	import { agentMessages, agentPhase } from '$lib/stores/agentConversation';
	import { isIdentifying, streamingFields } from '$lib/stores/agentIdentification';
	import { isEnriching, enrichmentStreamingFields } from '$lib/stores/agentEnrichment';
	import { isScrollLocked } from '$lib/agent/requestLifecycle';

	export let messages: AgentMessage[] = [];

	const dispatch = createEventDispatcher<{ action: AgentAction }>();

	// ─────────────────────────────────────────────────────────────────────────────
	// SCROLL STATE
	// ─────────────────────────────────────────────────────────────────────────────

	let scrollContainer: HTMLElement;
	let userScrolledUp = false;
	let lastSeenMessageId: string | null = null;
	let wasIdentifying = false;
	let wasShowingWineCard = false;
	let wasShowingEnrichmentCard = false;

	// ─────────────────────────────────────────────────────────────────────────────
	// SCROLL DETECTION
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Track if user manually scrolled up (disable auto-scroll when they do)
	 */
	function handleScroll(e: Event) {
		const el = e.target as HTMLElement;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		// Consider "at bottom" if within 50px
		userScrolledUp = distanceFromBottom > 50;
	}

	// Handle actions from child components
	function handleAction(event: CustomEvent<AgentAction>) {
		dispatch('action', event.detail);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// SCROLL HELPERS
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Scroll to bottom of container.
	 * Uses double RAF for DOM stability (ensures layout is complete).
	 */
	function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
		if (!scrollContainer) return;
		if (isScrollLocked()) return;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (scrollContainer) {
					scrollContainer.scrollTo({
						top: scrollContainer.scrollHeight,
						behavior
					});
				}
			});
		});
	}

	/**
	 * Scroll to show the latest message.
	 */
	async function scrollToNewMessage() {
		if (!scrollContainer) return;
		if (isScrollLocked()) return;

		// Reset user scroll state - new message takes priority
		userScrolledUp = false;

		await tick();
		scrollToBottom();
	}

	/**
	 * Scroll to show wine card + chips area (scroll to bottom).
	 */
	async function scrollToStreamingWineCard() {
		if (!scrollContainer) return;
		if (isScrollLocked()) return;

		await tick();
		// Use double RAF with small delay to ensure text wrapping/layout is complete
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setTimeout(() => {
					if (scrollContainer) {
						// Try to find the streaming wine card
						const wineCard = scrollContainer.querySelector('[data-streaming-card]');
						if (wineCard) {
							wineCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
						} else {
							// Fallback to bottom scroll
							scrollContainer.scrollTo({
								top: scrollContainer.scrollHeight,
								behavior: 'smooth'
							});
						}
					}
				}, 50);
			});
		});
	}

	/**
	 * Scroll so enrichment card top is at the top of the chat window.
	 */
	async function scrollToEnrichmentCardTop() {
		if (!scrollContainer) return;
		if (isScrollLocked()) return;

		await tick();
		requestAnimationFrame(() => {
			// Find the enrichment card (could be multiple, get the latest)
			const enrichmentCards = scrollContainer.querySelectorAll('[data-enrichment-card]');
			const enrichmentCard = enrichmentCards[enrichmentCards.length - 1];
			if (enrichmentCard) {
				enrichmentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		});
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// REACTIVE SCROLL TRIGGERS
	// ─────────────────────────────────────────────────────────────────────────────

	// 1. Scroll when new messages arrive (track by ID, not just length)
	$: {
		const lastMessage = $agentMessages[$agentMessages.length - 1];
		const lastId = lastMessage?.id ?? null;
		if (lastId && lastId !== lastSeenMessageId) {
			lastSeenMessageId = lastId;
			scrollToNewMessage();

			// Form messages have async loading - schedule extra scroll after form loads
			if (lastMessage?.data?.category === 'form') {
				setTimeout(() => scrollToBottom('smooth'), 300);
			}
		}
	}

	// 2. Scroll when wine card streaming starts (identification, not enrichment)
	$: {
		const isShowingWineCard =
			$streamingFields.size > 0 && !$isEnriching && $enrichmentStreamingFields.size === 0;
		if (isShowingWineCard && !wasShowingWineCard) {
			scrollToStreamingWineCard();
		}
		wasShowingWineCard = isShowingWineCard;
	}

	// 3. Scroll when enrichment card streaming starts
	$: {
		const isShowingEnrichmentCard =
			$enrichmentStreamingFields.size > 0 || ($isEnriching && $streamingFields.size > 0);
		if (isShowingEnrichmentCard && !wasShowingEnrichmentCard) {
			scrollToEnrichmentCardTop();
		}
		wasShowingEnrichmentCard = isShowingEnrichmentCard;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// RESIZE OBSERVER (for multi-line text expansion during typewriter animation)
	// ─────────────────────────────────────────────────────────────────────────────

	let resizeObserver: ResizeObserver | null = null;
	let lastContentHeight = 0;

	function setupResizeObserver() {
		if (!scrollContainer) return;

		// Clean up previous observer
		if (resizeObserver) {
			resizeObserver.disconnect();
		}

		const contentWrapper = scrollContainer.querySelector('.messages-content');
		if (!contentWrapper) return;

		lastContentHeight = contentWrapper.scrollHeight;

		resizeObserver = new ResizeObserver((entries) => {
			if (userScrolledUp) return;

			for (const entry of entries) {
				const newHeight = entry.contentRect.height;
				// Only scroll if height increased (text wrapped to new line)
				if (newHeight > lastContentHeight + 10) {
					lastContentHeight = newHeight;
					scrollToBottom();
				}
			}
		});

		resizeObserver.observe(contentWrapper);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// LIFECYCLE
	// ─────────────────────────────────────────────────────────────────────────────

	onMount(() => {
		// Set up resize observer after DOM is ready
		tick().then(() => setupResizeObserver());

		// If there are existing messages (restored from session), scroll to bottom immediately
		if ($agentMessages.length > 0) {
			tick().then(() => {
				if (scrollContainer) {
					scrollContainer.scrollTo({
						top: scrollContainer.scrollHeight,
						behavior: 'instant'
					});
				}
			});
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});

	// Re-setup observer when messages change (to observe latest message)
	$: if ($agentMessages.length > 0) {
		tick().then(() => setupResizeObserver());
	}
</script>

<div class="agent-chat-container">
	<div class="chat-viewport" bind:this={scrollContainer} on:scroll={handleScroll}>
		<div class="messages-content">
			<slot name="messages" {messages} {handleAction} />
		</div>
	</div>

	<div class="input-container">
		<slot name="input" {handleAction} />
	</div>
</div>

<style>
	.agent-chat-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0; /* Critical: allows nested flex containers to shrink */
		/* Inherit background from parent panel for visual consistency */
	}

	.chat-viewport {
		flex: 1;
		min-height: 0; /* Critical: allows flex child to shrink and enable scrolling */
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.messages-content {
		min-height: 100%;
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.input-container {
		flex-shrink: 0;
	}
</style>
