<script lang="ts">
	/**
	 * AgentPanel
	 * Bottom sheet (mobile) / Side panel (desktop) for Wine Assistant
	 * Conversational flow with sommelier-style messaging
	 *
	 * Mobile: Fixed bottom, slides up, max-height 80vh
	 * Desktop: Fixed right side, 400px width, slides in
	 */
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import {
		agent,
		agentPanelOpen,
		agentLoading,
		agentParsed,
		agentAction,
		agentConfidence,
		agentCandidates,
		agentError,
		agentMessages,
		agentPhase,
		agentIsTyping,
		agentHasStarted,
		agentAugmentationContext,
		addWineStore
	} from '$lib/stores';
	import type { AgentPhase, AgentMessage, AgentChip } from '$lib/stores';
	import CommandInput from './CommandInput.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import type { AgentParsedWine, AgentCandidate } from '$lib/api/types';

	// Reactive bindings
	$: isOpen = $agentPanelOpen;
	$: isLoading = $agentLoading;
	$: messages = $agentMessages;
	$: phase = $agentPhase;
	$: isTyping = $agentIsTyping;
	$: hasStarted = $agentHasStarted;
	$: parsed = $agentParsed;

	// Auto-scroll logic
	let messageContainer: HTMLElement;
	let userScrolledUp = false;

	// Typing indicator text based on phase
	$: typingText = phase === 'identifying' ? 'Consulting the cellar...' : 'Thinking...';

	// Show input based on phase
	$: showInput = ['await_input', 'augment_input'].includes(phase);

	// Input placeholder based on phase
	$: inputPlaceholder =
		phase === 'augment_input' ? 'Tell me more about this wine...' : 'Type wine name...';

	// Initialize conversation when panel opens
	onMount(() => {
		// Panel is now visible - start session if no messages exist
		console.log('[Agent] Panel mounted. Messages:', $agentMessages.length, 'hasStarted:', $agentHasStarted);
		if ($agentMessages.length === 0) {
			console.log('[Agent] Starting session...');
			agent.startSession();
		}
	});

	// Debug: log when messages change
	$: console.log('[Agent] Messages updated:', messages.length, messages.map(m => m.type));

	// Scroll to bottom when new messages arrive
	$: if (messages.length > 0) {
		scrollToBottom();
	}

	function handleScroll(e: Event) {
		const el = e.target as HTMLElement;
		const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
		userScrolledUp = !isAtBottom;
	}

	async function scrollToBottom() {
		if (!userScrolledUp && messageContainer) {
			await tick();
			requestAnimationFrame(() => {
				if (messageContainer) {
					messageContainer.scrollTop = messageContainer.scrollHeight;
				}
			});
		}
	}

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

	function handleStartOver() {
		agent.resetConversation();
	}

	// ─────────────────────────────────────────────────────
	// CHIP ACTION HANDLERS
	// ─────────────────────────────────────────────────────

	async function handleChipAction(e: CustomEvent<{ action: string }>) {
		const { action } = e.detail;

		switch (action) {
			case 'identify':
				agent.setPhase('await_input');
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: 'Share an image of the label, or tell me what you know about it.'
				});
				break;

			case 'recommend':
				agent.addMessage({
					role: 'agent',
					type: 'coming_soon',
					content: 'Recommendations are being prepared for a future vintage.'
				});
				// Re-prompt with choices after a moment
				setTimeout(() => {
					agent.addMessage({
						role: 'agent',
						type: 'chips',
						content: 'What else can I help you with?',
						chips: [
							{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
							{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
						]
					});
					agent.setPhase('path_selection');
				}, 800);
				break;

			case 'correct':
				agent.setPhase('action_select');
				agent.addMessage({
					role: 'agent',
					type: 'chips',
					content: 'Excellent. What would you like to do?',
					chips: [
						{ id: 'add', label: 'Add to Cellar', icon: 'plus', action: 'add' },
						{ id: 'learn', label: 'Learn More', icon: 'info', action: 'learn' },
						{ id: 'remember', label: 'Remember', icon: 'bookmark', action: 'remember' }
					]
				});
				break;

			case 'not_correct':
				handleIncorrectResult();
				break;

			case 'add':
				await handleAddToCellar();
				break;

			case 'learn':
			case 'remember':
				agent.addMessage({
					role: 'agent',
					type: 'coming_soon',
					content: 'This feature is being prepared for a future vintage.'
				});
				break;
		}
	}

	function handleIncorrectResult() {
		const candidates = $agentCandidates;

		// Debug logging
		console.log('[Agent] Not Correct clicked. Candidates:', candidates);

		if (candidates.length > 0) {
			// Show alternatives
			agent.setPhase('handle_incorrect');
			agent.addMessage({
				role: 'agent',
				type: 'disambiguation',
				content: 'Perhaps one of these?',
				candidates
			});
		} else {
			// Ask for more details
			agent.setPhase('augment_input');
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I'd like to understand better. Could you tell me more about this wine? (e.g., producer, region, or grape variety)"
			});
			// Store augmentation context
			if (parsed) {
				agent.setAugmentationContext({
					originalInput: '', // We don't have this stored, could enhance later
					originalInputType: 'text',
					originalResult: {
						intent: 'add',
						parsed,
						confidence: $agentConfidence ?? 0,
						action: $agentAction ?? 'suggest',
						candidates: []
					}
				});
			}
		}
	}

	async function handleAddToCellar() {
		if (!parsed) return;

		// Pre-fill the add wine wizard with identified data
		await addWineStore.populateFromAgent(parsed);

		// Add completion message
		agent.addMessage({
			role: 'agent',
			type: 'text',
			content: 'Opening the cellar for you...'
		});

		agent.setPhase('complete');

		// Brief delay for message to appear
		await tick();
		setTimeout(() => {
			agent.closePanel();
			goto('/qve/add');
		}, 500);
	}

	// ─────────────────────────────────────────────────────
	// INPUT HANDLERS
	// ─────────────────────────────────────────────────────

	async function handleTextSubmit(e: CustomEvent<{ text: string }>) {
		const text = e.detail.text;
		const augContext = $agentAugmentationContext;

		// Add user message
		agent.addMessage({
			role: 'user',
			type: 'text',
			content: text
		});

		// Set identifying phase
		agent.setPhase('identifying');
		agent.setTyping(true);

		// Build the query - combine with augmentation context if available
		let queryText = text;
		if (phase === 'augment_input' && augContext?.originalResult?.parsed) {
			// Combine original wine info with new user input for better identification
			const orig = augContext.originalResult.parsed;
			const parts: string[] = [];

			// Add any known info from original result
			if (orig.producer) parts.push(`Producer: ${orig.producer}`);
			if (orig.wineName && orig.wineName !== 'Unknown Wine') parts.push(`Wine: ${orig.wineName}`);
			if (orig.vintage) parts.push(`Vintage: ${orig.vintage}`);
			if (orig.region) parts.push(`Region: ${orig.region}`);
			if (orig.country) parts.push(`Country: ${orig.country}`);
			if (orig.wineType) parts.push(`Type: ${orig.wineType}`);

			// Add user's additional context
			parts.push(`Additional info: ${text}`);

			queryText = parts.join('. ');
			console.log('[Agent] Augmented query:', queryText);
		}

		try {
			const result = await agent.identify(queryText);
			agent.setTyping(false);

			// Debug logging
			console.log('[Agent] Text identification result:', JSON.stringify(result, null, 2));

			if (result) {
				// Clear augmentation context after retry
				agent.setAugmentationContext(null);

				// Check if this is a valid result (not "Unknown Wine")
				const isValidWine = result.parsed &&
					(result.parsed.wineName || result.parsed.producer) &&
					result.parsed.wineName !== 'Unknown Wine' &&
					result.parsed.producer !== 'Unknown';

				// Add result message with conditional confirmation chips
				agent.addMessage({
					role: 'agent',
					type: 'wine_result',
					content: isValidWine ? 'Is this the wine you\'re seeking?' : 'I couldn\'t identify this wine clearly.',
					wineResult: result.parsed,
					confidence: result.confidence,
					chips: isValidWine ? [
						{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
						{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
					] : [
						{ id: 'not_correct', label: 'Try Again', icon: 'x', action: 'not_correct' }
					]
				});
				agent.setPhase('result_confirm');
			} else {
				// Error occurred - re-prompt with options
				agent.addMessage({
					role: 'agent',
					type: 'error',
					content: $agentError || 'I couldn\'t identify that wine.'
				});
				// Re-prompt with choices
				setTimeout(() => {
					agent.addMessage({
						role: 'agent',
						type: 'chips',
						content: 'Would you like to try again?',
						chips: [
							{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
							{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
						]
					});
					agent.setPhase('path_selection');
				}, 500);
			}
		} catch (err) {
			agent.setTyping(false);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong.'
			});
			// Re-prompt with choices
			setTimeout(() => {
				agent.addMessage({
					role: 'agent',
					type: 'chips',
					content: 'Would you like to try again?',
					chips: [
						{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
						{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
					]
				});
				agent.setPhase('path_selection');
			}, 500);
		}
	}

	async function handleImageSubmit(e: CustomEvent<{ file: File }>) {
		const file = e.detail.file;

		// Create preview URL for user message
		const imageUrl = URL.createObjectURL(file);

		// Add user message with image preview
		agent.addMessage({
			role: 'user',
			type: 'image_preview',
			content: 'Wine label image',
			imageUrl
		});

		// Set identifying phase
		agent.setPhase('identifying');
		agent.setTyping(true);

		try {
			const result = await agent.identifyImage(file);
			agent.setTyping(false);

			// Debug logging
			console.log('[Agent] Image identification result:', JSON.stringify(result, null, 2));

			if (result) {
				// Check if this is a valid result (not "Unknown Wine")
				const isValidWine = result.parsed &&
					(result.parsed.wineName || result.parsed.producer) &&
					result.parsed.wineName !== 'Unknown Wine' &&
					result.parsed.producer !== 'Unknown';

				// Add result message with conditional confirmation chips
				agent.addMessage({
					role: 'agent',
					type: 'wine_result',
					content: isValidWine ? 'Is this the wine you\'re seeking?' : 'I couldn\'t identify this wine clearly.',
					wineResult: result.parsed,
					confidence: result.confidence,
					chips: isValidWine ? [
						{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
						{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
					] : [
						{ id: 'not_correct', label: 'Try Again', icon: 'x', action: 'not_correct' }
					]
				});
				agent.setPhase('result_confirm');
			} else {
				// Error occurred - re-prompt with options
				agent.addMessage({
					role: 'agent',
					type: 'error',
					content: $agentError || 'I couldn\'t identify the wine from this image.'
				});
				// Re-prompt with choices
				setTimeout(() => {
					agent.addMessage({
						role: 'agent',
						type: 'chips',
						content: 'Would you like to try again?',
						chips: [
							{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
							{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
						]
					});
					agent.setPhase('path_selection');
				}, 500);
			}
		} catch (err) {
			agent.setTyping(false);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong processing the image.'
			});
			// Re-prompt with choices
			setTimeout(() => {
				agent.addMessage({
					role: 'agent',
					type: 'chips',
					content: 'Would you like to try again?',
					chips: [
						{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
						{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
					]
				});
				agent.setPhase('path_selection');
			}, 500);
		}
	}

	// ─────────────────────────────────────────────────────
	// WINE RESULT HANDLERS
	// ─────────────────────────────────────────────────────

	function handleWineAddToCellar(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		handleAddToCellar();
	}

	function handleWineTryAgain() {
		agent.addMessage({
			role: 'agent',
			type: 'text',
			content: 'Let\'s try again. Share an image or tell me about the wine.'
		});
		agent.setPhase('await_input');
		agent.reset();
	}

	function handleWineConfirm(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		handleAddToCellar();
	}

	function handleWineEdit(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		handleAddToCellar();
	}

	function handleCandidateSelect(e: CustomEvent<{ candidate: AgentCandidate }>) {
		const candidate = e.detail.candidate;
		const data = candidate.data as Record<string, unknown>;

		// Build AgentParsedWine from selected candidate
		const selectedParsed: AgentParsedWine = {
			producer: (data.producer as string) || null,
			wineName: (data.wineName as string) || (data.name as string) || null,
			vintage: (data.vintage as string) || null,
			region: (data.region as string) || null,
			country: (data.country as string) || null,
			wineType: (data.wineType as AgentParsedWine['wineType']) || null,
			grapes: (data.grapes as string[]) || null,
			confidence: candidate.confidence
		};

		// Add confirmation message and proceed
		agent.addMessage({
			role: 'agent',
			type: 'text',
			content: 'Perfect choice. Opening the cellar for you...'
		});

		// Pre-fill and navigate
		addWineStore.populateFromAgent(selectedParsed);
		agent.setPhase('complete');

		setTimeout(() => {
			agent.closePanel();
			goto('/qve/add');
		}, 500);
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
			<div class="header-actions">
				{#if hasStarted}
					<button
						class="start-over-btn"
						on:click={handleStartOver}
						aria-label="Start new conversation"
					>
						Start Over
					</button>
				{/if}
				<button
					class="close-btn"
					on:click={handleClose}
					aria-label="Minimize Wine Assistant"
					title="Minimize"
				>
					<!-- Minimize/chevron-down icon -->
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
			</div>
		</header>

		<!-- Decorative flourish -->
		<div class="header-flourish" aria-hidden="true">—◇—</div>

		<!-- Message history -->
		<div
			class="message-history"
			bind:this={messageContainer}
			on:scroll={handleScroll}
		>
			{#if messages.length === 0}
				<!-- Loading state while session initializes -->
				<div class="loading-greeting">
					<p class="agent-text">Preparing...</p>
				</div>
			{:else}
				{#each messages as message (message.id)}
					<ChatMessage
						{message}
						on:chipSelect={handleChipAction}
						on:addToCellar={handleWineAddToCellar}
						on:tryAgain={handleWineTryAgain}
						on:confirm={handleWineConfirm}
						on:edit={handleWineEdit}
						on:selectCandidate={handleCandidateSelect}
					/>
				{/each}
			{/if}

			{#if isTyping}
				<TypingIndicator text={typingText} />
			{/if}
		</div>

		<!-- Input area (conditional based on phase) -->
		{#if showInput}
			<div class="panel-input">
				<CommandInput
					disabled={isLoading || isTyping}
					placeholder={inputPlaceholder}
					on:submit={handleTextSubmit}
					on:image={handleImageSubmit}
				/>
			</div>
		{/if}
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.start-over-btn {
		font-family: var(--font-sans);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		border: 1px solid var(--divider);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			background 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.start-over-btn:hover {
		background: var(--bg-subtle);
		border-color: var(--accent);
		color: var(--text-secondary);
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

	/* Decorative flourish */
	.header-flourish {
		text-align: center;
		color: var(--divider);
		font-size: 0.625rem;
		letter-spacing: 0.5em;
		padding: var(--space-2) 0;
		flex-shrink: 0;
	}

	/* Message history */
	.message-history {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-height: 200px;
	}

	/* Input area */
	.panel-input {
		flex-shrink: 0;
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
