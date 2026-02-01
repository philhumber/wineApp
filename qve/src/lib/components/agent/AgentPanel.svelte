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
		agentErrorMessage,
		agentErrorRetryable,
		agentErrorSupportRef,
		agentMessages,
		agentPhase,
		agentIsTyping,
		agentHasStarted,
		agentAugmentationContext,
		agentPendingNewSearch,
		agentEnriching,
		agentAddState,
		addWineStore,
		wines as winesStore,
		targetWineID,
		viewMode
	} from '$lib/stores';
	import type { AgentPhase, AgentMessage, AgentChip, AgentAddState } from '$lib/stores';
	import { get } from 'svelte/store';
	import CommandInput from './CommandInput.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import { EnrichmentSkeleton } from './enrichment';
	import type { AgentParsedWine, AgentCandidate, AgentAction, AgentEscalationMeta, AgentIdentificationResult, Region, Producer, Wine, AddWinePayload, DuplicateMatch } from '$lib/api/types';
	import { api } from '$lib/api';
	import { detectCommand, detectChipResponse, isBriefInput, type CommandType } from '$lib/utils';

	// Chip actions that can be triggered by positive/negative text responses
	const POSITIVE_CHIP_ACTIONS = ['correct', 'confirm_direction', 'use_grape_as_name'];
	const NEGATIVE_CHIP_ACTIONS = ['not_correct', 'wrong_direction'];

	// Reactive bindings
	$: isOpen = $agentPanelOpen;
	$: isLoading = $agentLoading;
	$: messages = $agentMessages;
	$: phase = $agentPhase;
	$: isTyping = $agentIsTyping;
	$: hasStarted = $agentHasStarted;
	$: parsed = $agentParsed;

	// Track original image and input type for re-identification with supplementary text
	let lastImageFile: File | null = null;
	let lastInputType: 'text' | 'image' | null = null;

	// Track last action for retry functionality
	interface LastAction {
		type: 'text' | 'image' | 'imageWithText' | 'opus';
		text?: string;
		file?: File;
		supplementaryText?: string;
	}
	let lastAction: LastAction | null = null;

	// Track pending brief search for confirmation flow
	let pendingBriefSearch: string | null = null;

	// Operation locking for add wine flow - prevents race conditions from rapid clicks
	let isProcessingAction = false;
	let advanceTimeoutId: ReturnType<typeof setTimeout> | null = null;

	function cancelPendingAdvance() {
		if (advanceTimeoutId) {
			clearTimeout(advanceTimeoutId);
			advanceTimeoutId = null;
		}
	}

	// Check if we have meaningful progress worth preserving
	function hasActiveIdentification(): boolean {
		const progressPhases: AgentPhase[] = ['result_confirm', 'action_select'];
		if (!progressPhases.includes(phase)) return false;

		const parsed = $agentAugmentationContext?.originalResult?.parsed || $agent.lastResult?.parsed;
		if (!parsed) return false;

		// Meaningful if we have producer OR wine name identified
		const hasProducer = !!(parsed.producer && parsed.producer !== 'Unknown');
		const hasWineName = !!(parsed.wineName && parsed.wineName !== 'Unknown Wine');
		return hasProducer || hasWineName;
	}

	// Auto-scroll logic
	let messageContainer: HTMLElement;
	let userScrolledUp = false;
	let messageElements: HTMLElement[] = [];

	// CommandInput ref for triggering camera/gallery
	let commandInputRef: CommandInput;

	// Typing indicator text based on phase
	$: typingText = phase === 'identifying' ? 'Consulting the cellar...' : 'Thinking...';

	// Input placeholder based on phase (input is always visible)
	$: inputPlaceholder = (() => {
		// Image-originated augmentation needs distinct guidance
		if (phase === 'augment_input' && $agentAugmentationContext?.originalInputType === 'image') {
			return 'Add details visible in the image...';
		}

		switch (phase) {
			case 'augment_input':
				return 'Tell me more about this wine...';
			case 'handle_incorrect':
				return 'Describe what I got wrong...';
			case 'result_confirm':
				return 'Or type to search again...';
			case 'action_select':
				return 'Or identify another wine...';
			case 'confirm_new_search':
				return 'Choose an option above...';
			case 'identifying':
			case 'complete':
				return 'Processing...';
			// greeting, path_selection, coming_soon, await_input, escalation_choice
			default:
				return 'Type wine name or take a photo...';
		}
	})();

	// Initialize conversation when panel opens
	onMount(() => {
		if ($agentMessages.length === 0) {
			agent.startSession();
		}
	});

	// Scroll to show top of new message when messages arrive
	$: if (messages.length > 0) {
		scrollToNewMessage();
	}

	function handleScroll(e: Event) {
		const el = e.target as HTMLElement;
		const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
		userScrolledUp = !isAtBottom;
	}

	async function scrollToNewMessage() {
		if (!userScrolledUp && messageContainer) {
			await tick();
			requestAnimationFrame(() => {
				const lastMessage = messageElements[messageElements.length - 1];
				if (lastMessage) {
					lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	}

	/**
	 * Scroll to show form content fully (used when async form content loads)
	 */
	async function scrollToFormContent() {
		if (messageContainer) {
			await tick();
			requestAnimationFrame(() => {
				// Scroll container to bottom to show the full form
				messageContainer.scrollTo({
					top: messageContainer.scrollHeight,
					behavior: 'smooth'
				});
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
		cancelPendingAdvance();
		agent.setPendingNewSearch(null);
		agent.clearAddState();
		agent.setAugmentationContext(null);
		lastImageFile = null;
		lastInputType = null;
		lastAction = null;
		agent.resetConversation();
	}

	/**
	 * Retry the last failed action
	 */
	async function handleRetry() {
		if (!lastAction) {
			// No action to retry - fall back to start over
			handleStartOver();
			return;
		}

		// Clear any error state
		agent.clearError();

		switch (lastAction.type) {
			case 'text':
				if (lastAction.text) {
					// Re-submit the text
					await handleTextSubmit({ detail: { text: lastAction.text } } as CustomEvent<{ text: string }>);
				}
				break;

			case 'image':
				if (lastAction.file) {
					// Re-submit the image
					await handleImageSubmit({ detail: { file: lastAction.file } } as CustomEvent<{ file: File }>);
				}
				break;

			case 'imageWithText':
				if (lastAction.file && lastAction.supplementaryText) {
					// Re-submit image with supplementary text
					agent.setPhase('identifying');
					agent.setTyping(true);
					try {
						const result = await agent.identifyImageWithSupplementaryText(
							lastAction.file,
							lastAction.supplementaryText
						);
						agent.setTyping(false);
						if (!handleIdentificationResult(result, lastAction.supplementaryText)) {
							showErrorWithRetry($agentErrorMessage || 'I couldn\'t identify that wine.');
						}
					} catch (err) {
						agent.setTyping(false);
						showErrorWithRetry('Something went wrong.');
					}
				}
				break;

			case 'opus':
				// Re-attempt Opus escalation
				await handleTryOpus();
				break;
		}
	}

	/**
	 * Handle conversational commands locally (no API call)
	 */
	function handleConversationalCommand(command: CommandType, originalText: string) {
		// Always add user message first - shows what they typed
		agent.addMessage({ role: 'user', type: 'text', content: originalText });

		switch (command) {
			case 'start_over':
				// User message shown above, then handleStartOver adds divider + greeting
				handleStartOver();
				break;

			case 'cancel':
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "No problem. I'll be here when you need me."
				});
				setTimeout(() => agent.closePanel(), 600);
				break;

			case 'go_back':
				handleGoBack();
				break;

			case 'try_again':
				// handleRetry already exists and handles all retry logic
				handleRetry();
				break;

			case 'help':
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "I'm your wine sommelier! Here's what I can do:\n\n" +
						"📸 Identify wines — Take a photo of a label or describe a wine\n" +
						"🍷 Add to cellar — I'll guide you through adding wines step by step\n" +
						"📝 Enrich details — I can find grape varieties, critic scores, and drink windows\n\n" +
						"Just start by sharing an image or telling me about a wine!"
				});
				agent.setPhase('await_input');
				break;
		}
	}

	/**
	 * Phase-aware back navigation
	 */
	function handleGoBack() {
		const currentPhase = $agentPhase;

		switch (currentPhase) {
			case 'result_confirm':
			case 'action_select':
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "Of course. Let's revisit that."
				});
				agent.setPhase('await_input');
				break;

			case 'augment_input':
			case 'handle_incorrect':
			case 'escalation_choice':
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "Let's try a different approach."
				});
				agent.setPhase('await_input');
				break;

			default:
				// greeting, path_selection, identifying, complete, await_input
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: 'Share an image or tell me about the wine.'
				});
				agent.setPhase('await_input');
		}
	}

	/**
	 * Show error message with retry and start over chips
	 */
	function showErrorWithRetry(errorMessage: string) {
		const chips: AgentChip[] = [];

		// Only show retry if error is retryable and we have an action to retry
		if ($agentErrorRetryable && lastAction) {
			chips.push({ id: 'retry', label: 'Try Again', icon: 'refresh', action: 'retry' });
		}

		chips.push({ id: 'start_over_error', label: 'Start Over', icon: 'x', action: 'start_over_error' });

		// Include support reference if available
		const supportRef = $agentErrorSupportRef;
		const content = supportRef
			? `${errorMessage}\n\nReference: ${supportRef}`
			: errorMessage;

		agent.addMessage({
			role: 'agent',
			type: 'error',
			content,
			chips
		});
		agent.setPhase('await_input');
	}

	// ─────────────────────────────────────────────────────
	// LOW CONFIDENCE MESSAGE BUILDER
	// ─────────────────────────────────────────────────────

	/**
	 * Build a conversational sommelier-style message for low-confidence results.
	 * Mentions what was found and asks about what's missing.
	 */
	function buildLowConfidenceMessage(parsed: AgentParsedWine, isRetry: boolean): string {
		const knownParts: string[] = [];
		const missingParts: string[] = [];

		// Check each field for known vs missing
		if (parsed.wineName && parsed.wineName !== 'Unknown Wine') {
			knownParts.push(`the name might be "${parsed.wineName}"`);
		} else {
			missingParts.push('the wine name');
		}

		if (parsed.producer && parsed.producer !== 'Unknown') {
			knownParts.push(`the producer could be "${parsed.producer}"`);
		} else {
			missingParts.push('the producer');
		}

		if (parsed.vintage) {
			knownParts.push(`it appears to be a ${parsed.vintage}`);
		} else {
			missingParts.push('the vintage');
		}

		if (parsed.region) {
			knownParts.push(`possibly from ${parsed.region}`);
		} else {
			missingParts.push('the region');
		}

		if (parsed.country) {
			knownParts.push(`from ${parsed.country}`);
		} else if (!parsed.region) {
			missingParts.push('the country');
		}

		if (parsed.wineType) {
			knownParts.push(`it looks like a ${parsed.wineType.toLowerCase()}`);
		}

		// Build the message
		let message: string;

		if (knownParts.length === 0) {
			// Nothing found at all
			message = isRetry
				? "I'm still having difficulty identifying this wine. Could you try describing it differently?"
				: "I'm having difficulty identifying this wine from what I have.";
		} else {
			// Some data found
			const opening = isRetry
				? "I'm still not quite certain, but here's what I've gathered so far"
				: "I wasn't able to identify this wine with certainty, but I have a few leads";

			message = `${opening} — ${knownParts.join(', ')}.`;

			if (missingParts.length > 0) {
				const missingStr = missingParts.length === 1
					? missingParts[0]
					: `${missingParts.slice(0, -1).join(', ')} or ${missingParts[missingParts.length - 1]}`;
				message += ` If you could tell me ${missingStr}, that would help me narrow it down.`;
			}
		}

		return message;
	}

	/**
	 * Merge new LLM result with previous result from augmentation context.
	 * NEW result takes precedence (it incorporates user feedback),
	 * previous result fills gaps where new result has no data.
	 */
	function mergeWithAugmentationContext(
		newParsed: AgentParsedWine,
		augContext: { originalResult: { parsed: AgentParsedWine } }
	): AgentParsedWine {
		const prev = augContext.originalResult.parsed;
		return {
			// New result takes precedence (incorporates user feedback)
			producer: newParsed.producer || ((prev.producer && prev.producer !== 'Unknown') ? prev.producer : null),
			wineName: newParsed.wineName || ((prev.wineName && prev.wineName !== 'Unknown Wine') ? prev.wineName : null),
			vintage: newParsed.vintage || prev.vintage,
			region: newParsed.region || prev.region,
			country: newParsed.country || prev.country,
			wineType: newParsed.wineType || prev.wineType,
			grapes: newParsed.grapes || prev.grapes,
			appellation: newParsed.appellation || prev.appellation,  // WIN-148
			confidence: newParsed.confidence // Always use latest LLM confidence
		};
	}

	/**
	 * Check if parsed wine has all minimum required fields for add-wine.
	 */
	function hasMinimumFields(parsed: AgentParsedWine): boolean {
		return !!(
			parsed.region &&
			parsed.producer && parsed.producer !== 'Unknown' &&
			parsed.wineName && parsed.wineName !== 'Unknown Wine' &&
			parsed.wineType
		);
	}

	/**
	 * Build a progress message for the progressive identification flow.
	 * Summarises what's known and lists what's still needed.
	 */
	function buildProgressMessage(parsed: AgentParsedWine): string {
		const known: string[] = [];
		const missing: string[] = [];

		if (parsed.region) known.push(parsed.region);
		if (parsed.producer && parsed.producer !== 'Unknown') known.push(parsed.producer);
		if (parsed.wineName && parsed.wineName !== 'Unknown Wine') known.push(`"${parsed.wineName}"`);
		if (parsed.wineType) known.push(parsed.wineType.toLowerCase());
		if (parsed.vintage) known.push(parsed.vintage);

		if (!parsed.producer || parsed.producer === 'Unknown') missing.push('the producer');
		if (!parsed.wineName || parsed.wineName === 'Unknown Wine') missing.push('the wine name');
		if (!parsed.wineType) missing.push('the wine type');
		if (!parsed.region) missing.push('the region');

		const knownStr = known.length > 0
			? `So far I have: ${known.join(', ')}.`
			: '';

		const missingStr = missing.length > 0
			? `I still need ${missing.join(' and ')} to complete the identification.`
			: '';

		return `Getting closer. ${knownStr} ${missingStr}`.trim();
	}

	/**
	 * Build a conversational partial-match message.
	 * Mentions what was found and asks for confirmation before drilling down.
	 */
	function buildPartialMatchMessage(parsed: AgentParsedWine): string {
		// Build a comprehensive description for user confirmation
		const details: string[] = [];

		// Producer and wine name are the primary identifiers
		if (parsed.producer && parsed.producer !== 'Unknown') {
			if (parsed.wineName && parsed.wineName !== 'Unknown Wine') {
				details.push(`${parsed.producer} "${parsed.wineName}"`);
			} else {
				details.push(parsed.producer);
			}
		} else if (parsed.wineName && parsed.wineName !== 'Unknown Wine') {
			details.push(`"${parsed.wineName}"`);
		}

		// Add vintage if available
		if (parsed.vintage) {
			details.push(parsed.vintage);
		}

		// Add region/country context
		const location = [parsed.region, parsed.country].filter(Boolean).join(', ');
		if (location) {
			details.push(`from ${location}`);
		}

		// Add wine type if available
		if (parsed.wineType) {
			details.push(`(${parsed.wineType})`);
		}

		if (details.length === 0) {
			return "I couldn't identify much from that. Can you tell me more about the wine?";
		}

		return `I found ${details.join(' ')}. Does this look right?`;
	}

	/**
	 * Get a prompt string for missing fields.
	 */
	function getMissingFieldsPrompt(parsed: AgentParsedWine): string {
		const missing: string[] = [];
		if (!parsed.wineName || parsed.wineName === 'Unknown Wine') missing.push('the wine name');
		if (!parsed.vintage) missing.push('the vintage');
		if (!parsed.region) missing.push('the region');
		if (!parsed.wineType) missing.push('the wine type');

		if (missing.length === 0) return '';
		if (missing.length === 1) return `Can you tell me ${missing[0]}?`;
		return `Can you tell me ${missing.slice(0, -1).join(', ')} or ${missing[missing.length - 1]}?`;
	}

	/**
	 * Get chips for quick-fill options based on missing fields.
	 * Provides shortcuts like "No specific name" or "NV" (non-vintage).
	 */
	function getMissingFieldChips(parsed: AgentParsedWine): AgentChip[] {
		const chips: AgentChip[] = [];

		// If wineName is missing but producer exists, offer "Use producer name"
		if ((!parsed.wineName || parsed.wineName === 'Unknown Wine') && parsed.producer && parsed.producer !== 'Unknown') {
			chips.push({
				id: 'use_producer_name',
				label: 'No Specific Name',
				icon: 'wine-bottle',
				action: 'use_producer_name'
			});
		}

		// If wineName is missing but grapes exist, offer to use grape as name
		if ((!parsed.wineName || parsed.wineName === 'Unknown Wine') &&
			parsed.grapes && parsed.grapes.length > 0) {
			const primaryGrape = parsed.grapes[0];
			chips.push({
				id: `use_grape_as_name:${encodeURIComponent(primaryGrape)}`,
				label: `Use "${primaryGrape}"`,
				icon: 'wine-bottle',
				action: 'use_grape_as_name'
			});
		}

		// If vintage is missing, offer "NV" option
		if (!parsed.vintage) {
			chips.push({
				id: 'nv_vintage',
				label: 'NV (Non-Vintage)',
				icon: 'calendar',
				action: 'nv_vintage'
			});
		}

		return chips;
	}

	/**
	 * Check if Opus escalation should be offered.
	 * Only show "Try Harder" if tier2 (Sonnet) has been attempted and Opus hasn't.
	 */
	function canTryOpus(escalation: AgentEscalationMeta | undefined): boolean {
		if (!escalation?.tiers) return false;

		const { tiers, final_tier } = escalation;

		// Only show "Try Opus" if we've auto-escalated through tier2 (Sonnet)
		const hasTriedTier2 = !!tiers.tier2;
		const opusNotYetTried = final_tier !== 'tier3' && !tiers.tier3;

		return hasTriedTier2 && opusNotYetTried;
	}

	/**
	 * Handle identification result with branching logic.
	 * Routes to: partial_match (with/without mini-cards), wine card (85%+), or error.
	 * When in retry mode (augmentation), merges results with locked-in fields and
	 * checks minimum required fields before allowing add-wine.
	 */
	function handleIdentificationResult(
		result: { parsed: AgentParsedWine; confidence: number; candidates?: AgentCandidate[]; action?: string } | null,
		inputText: string
	) {
		if (!result) return false;

		const hasCandidates = (result.candidates?.length ?? 0) > 0;
		const augContext = $agentAugmentationContext;
		const isRetry = augContext !== null;

		// ── RETRY MODE: merge with locked-in fields, enforce minimum ──
		if (isRetry && augContext?.originalResult?.parsed) {
			const merged = mergeWithAugmentationContext(result.parsed, augContext);

			// Determine if merged result has enough data to show a card
		const mergedIsValidWine = (merged.wineName || merged.producer) &&
			merged.wineName !== 'Unknown Wine' &&
			merged.producer !== 'Unknown';
		const mergedConfidence = result.confidence ?? 0;

		if (hasCandidates) {
				// Disambiguation returned during retry — show list but keep locked fields
				agent.setAugmentationContext({
					...augContext,
					originalResult: {
						...augContext.originalResult,
						parsed: merged,
						confidence: result.confidence
					}
				});
				agent.addMessage({
					role: 'agent',
					type: 'disambiguation',
					content: 'I found a few possibilities. Does one of these look right?',
					candidates: result.candidates!
				});
				agent.setPhase('result_confirm');

			} else if (mergedConfidence >= 85 && mergedIsValidWine) {
				// High confidence — show wine card.
				// If all minimum fields present, clear augmentation context (ready for add).
				// If some fields missing, keep context so handleAddToCellar can redirect.
				if (hasMinimumFields(merged)) {
					agent.setAugmentationContext(null);
				} else {
					agent.setAugmentationContext({
						...augContext,
						originalResult: {
							...augContext.originalResult,
							parsed: merged,
							confidence: result.confidence
						}
					});
				}
				agent.addMessage({
					role: 'agent',
					type: 'wine_result',
					content: 'Is this the wine you\'re seeking?',
					wineResult: merged,
					confidence: result.confidence,
					chips: [
						{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
						{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
					]
				});
				agent.setPhase('result_confirm');

			} else {
				// Low confidence or no valid data — continue progressive identification
				const message = buildProgressMessage(merged);
				agent.addMessage({
					role: 'agent',
					type: 'partial_match',
					content: message,
					wineResult: merged,
					confidence: result.confidence,
					chips: [
						{ id: 'provide_more', label: 'Tell Me More', icon: 'edit', action: 'provide_more' },
						{ id: 'see_result', label: 'See What I Found', icon: 'search', action: 'see_result' },
						{ id: 'start_fresh', label: 'Start Fresh', icon: 'refresh', action: 'start_fresh' }
					]
				});
				agent.setAugmentationContext({
					...augContext,
					originalResult: {
						...augContext.originalResult,
						parsed: merged,
						confidence: result.confidence
					}
				});
				agent.setPhase('augment_input');
			}

			return true;
		}

		// ── FIRST ATTEMPT: six-way branch ──
		const confidence = result.confidence ?? 0;
		const isValidWine = result.parsed &&
			(result.parsed.wineName || result.parsed.producer) &&
			result.parsed.wineName !== 'Unknown Wine' &&
			result.parsed.producer !== 'Unknown';

		// All partial matches (< 85%) go through Yes/No confirmation first
		if (hasCandidates) {
			// CANDIDATES: Partial match text + mini-cards
			const chips: AgentChip[] = [
				{ id: 'none_of_these', label: 'None of These', icon: 'x', action: 'not_correct' }
			];
			// Add "Try Harder" if Opus is available
			const resultWithEscalation = result as AgentIdentificationResult;
			if (canTryOpus(resultWithEscalation.escalation)) {
				chips.unshift({ id: 'try_opus', label: 'Try Harder', icon: 'sparkle', action: 'try_opus' });
			}
			agent.addMessage({
				role: 'agent',
				type: 'partial_match',
				content: buildPartialMatchMessage(result.parsed),
				candidates: result.candidates,
				chips
			});
			agent.setAugmentationContext({
				originalInput: inputText,
				originalInputType: lastInputType || 'text',
				originalResult: {
					intent: 'add',
					parsed: result.parsed,
					confidence: result.confidence,
					action: (result.action ?? 'disambiguate') as AgentAction,
					candidates: result.candidates ?? []
				}
			});
			agent.setPhase('result_confirm');

		} else if (confidence < 85) {
			// LOW/MEDIUM without candidates: Ask for confirmation before drilling down
			const chips: AgentChip[] = [
				{ id: 'confirm_direction', label: 'Yes', icon: 'check', action: 'confirm_direction' },
				{ id: 'wrong_direction', label: 'No', icon: 'x', action: 'wrong_direction' }
			];
			// Add "Try Harder" if Opus is available
			const resultWithEscalation = result as AgentIdentificationResult;
			if (canTryOpus(resultWithEscalation.escalation)) {
				chips.push({ id: 'try_opus', label: 'Try Harder', icon: 'sparkle', action: 'try_opus' });
			}
			agent.addMessage({
				role: 'agent',
				type: 'partial_match',
				content: buildPartialMatchMessage(result.parsed),
				wineResult: result.parsed,
				confidence: result.confidence,
				chips
			});
			// Preserve cumulative input chain if this came from a "No" flow
			// (where originalResult was null but originalInput existed)
			const existingAugContext = $agentAugmentationContext;
			const cumulativeInput = existingAugContext?.originalInput && !existingAugContext?.originalResult
				? `${existingAugContext.originalInput}. ${inputText}`  // Append to chain
				: inputText;  // Fresh start
			agent.setAugmentationContext({
				originalInput: cumulativeInput,
				originalInputType: lastInputType || 'text',
				originalResult: {
					intent: 'add',
					parsed: result.parsed,
					confidence: result.confidence,
					action: (result.action ?? 'disambiguate') as AgentAction,
					candidates: result.candidates ?? []
				}
			});
			agent.setPhase('result_confirm');

		} else if (isValidWine) {
			// CARD: medium/high confidence — show wine card
			// Check if wine is incomplete (e.g., missing wine name but has grapes)
			const isIncomplete = !hasMinimumFields(result.parsed);
			const quickFillChips = isIncomplete ? getMissingFieldChips(result.parsed) : [];

			// If incomplete, keep augmentation context for quick-fill handlers
			if (isIncomplete) {
				agent.setAugmentationContext({
					originalInput: inputText,
					originalInputType: lastInputType || 'text',
					originalResult: {
						intent: 'add',
						parsed: result.parsed,
						confidence: result.confidence,
						action: (result.action ?? 'suggest') as AgentAction,
						candidates: result.candidates ?? []
					}
				});
			} else {
				agent.setAugmentationContext(null);
			}

			// Build chips based on completeness
			const cardChips: AgentChip[] = isIncomplete
				? [
					// Incomplete: show quick-fill options + "doesn't look right" (no Correct yet)
					...quickFillChips,
					{ id: 'not_correct', label: "Doesn't Look Right", icon: 'x', action: 'not_correct' }
				]
				: [
					// Complete: show standard Correct/Not Correct
					{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
					{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
				];

			agent.addMessage({
				role: 'agent',
				type: 'wine_result',
				content: isIncomplete
					? 'I found this wine but need a bit more detail.'
					: 'Is this the wine you\'re seeking?',
				wineResult: result.parsed,
				confidence: result.confidence,
				chips: cardChips
			});
			agent.setPhase('result_confirm');

		} else {
			// ERROR: not identifiable — show error with try again (preserved)
			agent.setAugmentationContext(null);
			agent.addMessage({
				role: 'agent',
				type: 'wine_result',
				content: 'I couldn\'t identify this wine clearly.',
				wineResult: result.parsed,
				confidence: result.confidence,
				chips: [{ id: 'not_correct', label: 'Try Again', icon: 'x', action: 'not_correct' }]
			});
			agent.setPhase('result_confirm');
		}

		return true;
	}

	// ─────────────────────────────────────────────────────
	// ADD WINE FLOW HELPERS
	// ─────────────────────────────────────────────────────

	/**
	 * Fetch entity from addState matches or wines store
	 * For region/producer: look up from matches populated by checkDuplicate
	 * For wine: look up from wines store
	 */
	function fetchEntity(type: 'region' | 'producer' | 'wine', id: number): Region | Producer | Wine | null {
		const addState = get(agent).addState;

		if (type === 'wine') {
			const wines = get(winesStore);
			return wines.find(w => w.wineID === id) || null;
		}

		if (type === 'producer' && addState?.matches.producer) {
			const match = addState.matches.producer.find(m => m.id === id);
			if (match) {
				// Return producer with required fields - regionID is not used in payload
				return { producerID: match.id, producerName: match.name, regionID: 0 };
			}
			return null;
		}

		if (type === 'region' && addState?.matches.region) {
			const match = addState.matches.region.find(m => m.id === id);
			if (match) {
				// Return region with required fields - countryID is not used in payload
				return { regionID: match.id, regionName: match.name, countryID: 0 };
			}
			return null;
		}

		return null;
	}

	/**
	 * Advance to the next step in the add wine flow
	 */
	function advanceToNextStep(currentStep: string) {
		const addState = get(agent).addState;
		if (!addState) return;

		switch (currentStep) {
			case 'region':
				agent.setPhase('add_producer');
				startProducerMatching();
				break;
			case 'producer':
				agent.setPhase('add_wine');
				startWineMatching();
				break;
			case 'wine':
				agent.setPhase('add_bottle_part1');
				agent.addMessage({
					role: 'agent',
					type: 'bottle_form',
					content: "Now let's record the bottle details.",
					bottleFormPart: 1
				});
				break;
		}
	}

	/**
	 * Start region matching using checkDuplicate API
	 */
	async function startRegionMatching() {
		const addState = get(agent).addState;
		if (!addState?.regionData.regionName) {
			// No region to match - auto-advance to create new
			agent.setAddSelection('region', 'create');
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I'll create a new region entry."
			});
			advanceTimeoutId = setTimeout(() => {
				advanceTimeoutId = null;
				advanceToNextStep('region');
			}, 800);
			return;
		}

		try {
			const result = await api.checkDuplicate({
				type: 'region',
				name: addState.regionData.regionName
			});

			const matches = [
				...(result.exactMatch ? [result.exactMatch] : []),
				...(result.similarMatches || [])
			];

			agent.setAddMatches('region', matches);

			if (matches.length === 0) {
				// No matches - auto-proceed to create new
				agent.setAddSelection('region', 'create');
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: `No existing regions match "${addState.regionData.regionName}". I'll create a new entry.`
				});
				advanceTimeoutId = setTimeout(() => {
					advanceTimeoutId = null;
					advanceToNextStep('region');
				}, 800);
			} else {
				// Show match selection
				agent.addMessage({
					role: 'agent',
					type: 'match_selection',
					content: `I found some regions that might match "${addState.regionData.regionName}".`,
					matches,
					matchType: 'region',
					chips: [
						{ id: 'add_new_region', label: 'Add as New', icon: 'plus', action: 'add_new:region' },
						{ id: 'help_region', label: 'Help Me Decide', icon: 'sparkle', action: 'clarify:region' }
					]
				});
			}
		} catch (error) {
			console.error('Region matching failed:', error);
			// Fall back to create new on error
			agent.setAddSelection('region', 'create');
			advanceToNextStep('region');
		}
	}

	/**
	 * Start producer matching using checkDuplicate API
	 */
	async function startProducerMatching() {
		const addState = get(agent).addState;
		if (!addState?.producerData.producerName) {
			// No producer to match - auto-advance to create new
			agent.setAddSelection('producer', 'create');
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I'll create a new producer entry."
			});
			advanceTimeoutId = setTimeout(() => {
				advanceTimeoutId = null;
				advanceToNextStep('producer');
			}, 800);
			return;
		}

		try {
			const result = await api.checkDuplicate({
				type: 'producer',
				name: addState.producerData.producerName,
				regionId: addState.selected.region?.regionID,
				regionName: addState.regionData.regionName || undefined
			});

			const matches = [
				...(result.exactMatch ? [result.exactMatch] : []),
				...(result.similarMatches || [])
			];

			agent.setAddMatches('producer', matches);

			if (matches.length === 0) {
				// No matches - auto-proceed to create new
				agent.setAddSelection('producer', 'create');
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: `No existing producers match "${addState.producerData.producerName}". I'll create a new entry.`
				});
				advanceTimeoutId = setTimeout(() => {
					advanceTimeoutId = null;
					advanceToNextStep('producer');
				}, 800);
			} else {
				// Show match selection
				agent.addMessage({
					role: 'agent',
					type: 'match_selection',
					content: `I found some producers that might match "${addState.producerData.producerName}".`,
					matches,
					matchType: 'producer',
					chips: [
						{ id: 'add_new_producer', label: 'Add as New', icon: 'plus', action: 'add_new:producer' },
						{ id: 'help_producer', label: 'Help Me Decide', icon: 'sparkle', action: 'clarify:producer' }
					]
				});
			}
		} catch (error) {
			console.error('Producer matching failed:', error);
			// Fall back to create new on error
			agent.setAddSelection('producer', 'create');
			advanceToNextStep('producer');
		}
	}

	/**
	 * Start wine matching using checkDuplicate API
	 */
	async function startWineMatching() {
		const addState = get(agent).addState;
		if (!addState?.wineData.wineName) {
			// No wine to match - auto-advance to create new
			agent.setAddSelection('wine', 'create');
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I'll create a new wine entry."
			});
			advanceTimeoutId = setTimeout(() => {
				advanceTimeoutId = null;
				advanceToNextStep('wine');
			}, 800);
			return;
		}

		try {
			const result = await api.checkDuplicate({
				type: 'wine',
				name: addState.wineData.wineName,
				producerId: addState.selected.producer?.producerID,
				producerName: addState.producerData.producerName || undefined,
				year: addState.wineData.wineYear || undefined
			});

			// Check if this exact wine already exists with bottles (WIN-145)
			if (result.existingWineId && result.existingBottles > 0) {
				// Wine exists - offer choice to add bottle or create new
				agent.addMessage({
					role: 'agent',
					type: 'existing_wine_choice',
					content: `I found "${addState.wineData.wineName}" already in your cellar with ${result.existingBottles} bottle${result.existingBottles > 1 ? 's' : ''}.`,
					existingWineId: result.existingWineId,
					existingBottles: result.existingBottles,
					chips: [
						{ id: 'add_bottle', label: 'Add Another Bottle', icon: 'plus', action: 'add_bottle_existing' },
						{ id: 'create_new', label: 'Create New Wine', icon: 'wine', action: 'create_new_wine' }
					]
				});
				return;
			}

			const matches = [
				...(result.exactMatch ? [result.exactMatch] : []),
				...(result.similarMatches || [])
			];

			agent.setAddMatches('wine', matches);

			if (matches.length === 0) {
				// No matches - auto-proceed to create new
				agent.setAddSelection('wine', 'create');
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: `No existing wines match "${addState.wineData.wineName}". I'll create a new entry.`
				});
				advanceTimeoutId = setTimeout(() => {
					advanceTimeoutId = null;
					advanceToNextStep('wine');
				}, 800);
			} else {
				// Show match selection
				agent.addMessage({
					role: 'agent',
					type: 'match_selection',
					content: `I found some wines that might match "${addState.wineData.wineName}".`,
					matches,
					matchType: 'wine',
					chips: [
						{ id: 'add_new_wine', label: 'Add as New', icon: 'plus', action: 'add_new:wine' },
						{ id: 'help_wine', label: 'Help Me Decide', icon: 'sparkle', action: 'clarify:wine' }
					]
				});
			}
		} catch (error) {
			console.error('Wine matching failed:', error);
			// Fall back to create new on error
			agent.setAddSelection('wine', 'create');
			advanceToNextStep('wine');
		}
	}

	/**
	 * Build AddWinePayload from AgentAddState
	 */
	function buildPayloadFromAddState(state: AgentAddState): AddWinePayload {
		const isCreateRegion = state.mode.region === 'create';
		const isCreateProducer = state.mode.producer === 'create';
		const isCreateWine = state.mode.wine === 'create';

		return {
			// Region - mutual exclusivity pattern
			findRegion: !isCreateRegion && state.selected.region
				? state.selected.region.regionName
				: '',
			regionName: isCreateRegion ? state.regionData.regionName : '',
			regionCountry: isCreateRegion ? state.regionData.country : '',
			regionDescription: '',
			regionClimate: '',
			regionSoil: '',
			regionMap: '',

			// Producer
			findProducer: !isCreateProducer && state.selected.producer
				? state.selected.producer.producerName
				: '',
			producerName: isCreateProducer ? state.producerData.producerName : '',
			producerTown: '',
			producerFounded: '',
			producerOwnership: '',
			producerDescription: '',

			// Wine
			findWine: !isCreateWine && state.selected.wine
				? state.selected.wine.wineName
				: '',
			wineName: isCreateWine ? state.wineData.wineName : '',
			wineYear: state.wineData.wineYear || '',
			wineType: state.wineData.wineType,
			appellation: state.identified?.appellation || '', // WIN-148: Pass appellation from identification
			wineDescription: '',
			wineTasting: '',
			winePairing: '',
			winePicture: 'images/wines/placeBottle.png',

			// Bottle
			bottleType: state.bottleData.bottleSize,
			storageLocation: state.bottleData.storageLocation,
			bottleSource: state.bottleData.source,
			bottlePrice: state.bottleData.price || '',
			bottleCurrency: state.bottleData.currency || '',
			bottlePurchaseDate: state.bottleData.purchaseDate || ''
		};
	}

	/**
	 * Stub for background enrichment (future implementation)
	 */
	function triggerBackgroundEnrichment(wineId: number, addState: AgentAddState, immediate: boolean) {
		// STUB: Future implementation will queue PHP background job
		console.log('[Enrichment Hook] Wine ID:', wineId, {
			immediate,
			isNewRegion: addState.mode.region === 'create',
			isNewProducer: addState.mode.producer === 'create',
			isNewWine: addState.mode.wine === 'create'
		});
	}

	/**
	 * Handle successful wine addition
	 */
	async function handleAddSuccess(wineId: number, wineName: string) {
		agent.setPhase('add_complete');
		agent.addMessage({
			role: 'agent',
			type: 'add_complete',
			content: `Perfect! I've added "${wineName}" to your cellar.`
		});

		// Clear state before navigation
		cancelPendingAdvance();
		agent.clearAddState();
		agent.setAugmentationContext(null);

		// Brief delay to show success message, then close and navigate
		setTimeout(async () => {
			// Close panel first
			agent.closePanel();

			// Navigate to home (no-op if already there, but ensures consistent state)
			await goto('/qve/');

			// Wait for navigation to settle
			await tick();

			// Scroll to top instantly before refresh to avoid jarring jump
			// User will only see smooth scroll down to their new wine
			window.scrollTo({ top: 0, behavior: 'instant' });

			// Refresh wine list using current view mode filter
			try {
				const bottleCountFilter = get(viewMode) === 'ourWines' ? '1' : '0';
				const wineList = await api.getWines({ bottleCount: bottleCountFilter });
				winesStore.set(wineList);

				// Wait for DOM to render the new wine cards
				await tick();

				// Set targetWineID - the page's reactive will handle scroll then highlight
				// Use a small delay to ensure cards are fully rendered
				// Cast to number to ensure type match with wine.wineID from getWines
				setTimeout(() => {
					targetWineID.set(Number(wineId));
				}, 100);
			} catch (error) {
				console.error('Failed to refresh wine list:', error);
			}
		}, 1500);
	}

	/**
	 * Submit the wine using the add wine flow state
	 */
	async function submitAddWine(enrichNow: boolean) {
		const addState = get(agent).addState;
		if (!addState) return;

		// WIN-145: Check if adding bottle to existing wine
		if (addState.existingWineId) {
			await submitAddBottleToExisting(addState.existingWineId);
			return;
		}

		// Validate state
		const validationError = agent.validateAddState();
		if (validationError) {
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: validationError,
				chips: [
					{ id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }
				]
			});
			return;
		}

		agent.setTyping(true);

		try {
			const payload = buildPayloadFromAddState(addState);
			const result = await api.addWine(payload);

			agent.setTyping(false);

			// api.addWine throws on failure, so if we get here it succeeded
			// Trigger background enrichment (stub)
			triggerBackgroundEnrichment(result.wineID, addState, enrichNow);

			// Show success and navigate
			const wineName = addState.wineData.wineName || addState.selected.wine?.wineName || 'your wine';
			await handleAddSuccess(result.wineID, wineName);
		} catch (error) {
			agent.setTyping(false);
			console.error('Add wine failed:', error);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong adding the wine.',
				chips: [
					{ id: 'retry_add', label: 'Try Again', icon: 'refresh', action: 'retry_add' },
					{ id: 'start_over', label: 'Start Over', icon: 'x', action: 'start_over' }
				]
			});
		}
	}

	/**
	 * WIN-145: Submit bottle to existing wine (skip wine creation)
	 */
	async function submitAddBottleToExisting(existingWineId: number) {
		const addState = get(agent).addState;
		if (!addState) return;

		agent.setTyping(true);

		try {
			const bottlePayload = {
				wineID: existingWineId,
				bottleSize: addState.bottleData.bottleSize || '750ml',
				bottleLocation: addState.bottleData.storageLocation,
				bottleSource: addState.bottleData.source,
				bottlePrice: addState.bottleData.price ? parseFloat(addState.bottleData.price) : undefined,
				bottleCurrency: addState.bottleData.currency,
				purchaseDate: addState.bottleData.purchaseDate
			};

			await api.addBottle(bottlePayload);

			agent.setTyping(false);

			// Show success and navigate
			const wineName = addState.wineData.wineName || addState.identified.wineName || 'this wine';
			await handleAddSuccess(existingWineId, wineName);
		} catch (error) {
			agent.setTyping(false);
			console.error('Add bottle failed:', error);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong adding the bottle.',
				chips: [
					{ id: 'retry_add', label: 'Try Again', icon: 'refresh', action: 'retry_add' },
					{ id: 'start_over', label: 'Start Over', icon: 'x', action: 'start_over' }
				]
			});
		}
	}

	// ─────────────────────────────────────────────────────
	// CHIP ACTION HANDLERS
	// ─────────────────────────────────────────────────────

	async function handleChipAction(e: CustomEvent<{ action: string; data?: unknown }>) {
		// Operation locking - prevent race conditions
		if (isProcessingAction) return;
		isProcessingAction = true;

		try {
		const { action } = e.detail;

		// Clear chips immediately to prevent reselection
		agent.clearLastChips();

		switch (action) {
			case 'retry':
				await handleRetry();
				break;

			case 'start_over_error':
				handleStartOver();
				break;

			case 'confirm_brief_search':
				if (pendingBriefSearch) {
					const searchText = pendingBriefSearch;
					pendingBriefSearch = null;
					lastAction = { type: 'text', text: searchText };
					// Set phase to identifying BEFORE recursive call to skip brief input check
					agent.setPhase('identifying');
					await handleTextSubmit({ detail: { text: searchText } } as CustomEvent<{ text: string }>);
				}
				break;

			case 'confirm_new_search': {
				// User confirmed they want to start new search
				const pending = $agentPendingNewSearch;
				if (!pending) {
					// Edge case: state lost, fall back gracefully
					agent.addMessage({
						role: 'agent',
						type: 'text',
						content: "Something went wrong. Let's start fresh."
					});
					agent.setPhase('await_input');
					break;
				}

				const searchText = pending.text;
				agent.setPendingNewSearch(null);

				// Clear context for fresh search
				lastImageFile = null;
				lastInputType = 'text';
				agent.setAugmentationContext(null);
				agent.setPhase('identifying');
				agent.setTyping(true);

				try {
					lastAction = { type: 'text', text: searchText };
					const result = await agent.identify(searchText);
					agent.setTyping(false);

					if (!handleIdentificationResult(result, searchText)) {
						showErrorWithRetry($agentErrorMessage || "I couldn't identify that wine.");
					}
				} catch {
					agent.setTyping(false);
					showErrorWithRetry($agentErrorMessage || 'Something went wrong.');
				}
				break;
			}

			case 'continue_current': {
				// User wants to stay with current wine
				const pending = $agentPendingNewSearch;
				agent.setPendingNewSearch(null);

				// Validate previousPhase before restoring
				const targetPhase = pending?.previousPhase;

				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "No problem, let's continue."
				});

				if (targetPhase === 'action_select') {
					agent.addMessage({
						role: 'agent',
						type: 'chips',
						content: 'What would you like to do?',
						chips: [
							{ id: 'add', label: 'Add to Cellar', icon: 'plus', action: 'add' },
							{ id: 'learn', label: 'Learn More', icon: 'info', action: 'learn' },
							{ id: 'remember', label: 'Remember', icon: 'bookmark', action: 'remember' }
						]
					});
					agent.setPhase('action_select');
				} else {
					// Default to result_confirm (safest fallback)
					agent.addMessage({
						role: 'agent',
						type: 'chips',
						content: 'Is this correct?',
						chips: [
							{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
							{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
						]
					});
					agent.setPhase('result_confirm');
				}
				break;
			}

			case 'add_more_detail':
				// User wants to add more - keep pendingBriefSearch so next input accumulates
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: 'Tell me more — the producer name, vintage, region, or grape variety would help.'
				});
				agent.setPhase('await_input');
				break;

			case 'identify':
				agent.setPhase('await_input');
				agent.addMessage({
					role: 'agent',
					type: 'chips',
					content: 'Share an image, or type what you know.',
					chips: [
						{ id: 'take_photo', label: 'Take Photo', icon: 'camera', action: 'take_photo' },
						{ id: 'choose_photo', label: 'Choose from Library', icon: 'gallery', action: 'choose_photo' }
					]
				});
				break;

			case 'take_photo':
				commandInputRef?.triggerCamera();
				break;

			case 'choose_photo':
				commandInputRef?.triggerGallery();
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

			case 'learn': {
				// Enrich the identified wine with additional details
				// Use the most recent wine result shown to the user (may contain merged data
				// from progressive identification, like grape used as wine name)
				const lastWineResultMsg = [...$agentMessages].reverse().find(
					(m) => m.type === 'wine_result' && m.wineResult
				);
				const wineToEnrich = lastWineResultMsg?.wineResult || $agentParsed;
				if (wineToEnrich) {
					agent.setTyping(true);
					await agent.enrichWine(wineToEnrich);
					agent.setTyping(false);
				}
				break;
			}

			case 'remember':
				agent.addMessage({
					role: 'agent',
					type: 'coming_soon',
					content: 'This feature is being prepared for a future vintage.'
				});
				break;

			case 'provide_more':
				// Phase is already augment_input, input is visible — just prompt
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: 'Of course. Tell me anything more you know — the producer, country, region, grape variety, or anything on the label.'
				});
				break;

			case 'see_result': {
				// Show the low-confidence result as a card for the user to accept or reject
				const augCtx = $agentAugmentationContext;
				if (augCtx?.originalResult?.parsed) {
					agent.addMessage({
						role: 'agent',
						type: 'wine_result',
						content: "Here's what I found — is this close?",
						wineResult: augCtx.originalResult.parsed,
						confidence: augCtx.originalResult.confidence,
						chips: [
							{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
							{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
						]
					});
					agent.setPhase('result_confirm');
				}
				break;
			}

			case 'start_fresh':
				// Clear tracking state and restart
				lastImageFile = null;
				lastInputType = null;
				agent.setAugmentationContext(null);
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: 'Let\'s start fresh. Share an image or tell me about the wine.'
				});
				agent.setPhase('await_input');
				break;

			case 'try_opus':
				// User chose to escalate to Claude Opus
				await handleTryOpus();
				break;

			case 'use_conversation':
				// User chose conversational flow instead of Opus
				handleUseConversation();
				break;

			case 'what_wrong':
				// User wants to provide correct information after a high-confidence miss
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "No problem. What's the correct producer, region, or other details you know about this wine?"
				});
				// Store ONLY the original input (image/text) for re-analysis, NOT the wrong parsed result
				agent.setAugmentationContext({
					originalInput: $agentAugmentationContext?.originalInput || '',
					originalInputType: lastInputType || 'text',
					originalResult: null as unknown as AgentIdentificationResult,  // Don't preserve the wrong result
					userFeedback: undefined
				});
				agent.setPhase('augment_input');
				break;

			case 'new_input':
				// Clear state and prompt for new image/text
				lastImageFile = null;
				lastInputType = null;
				agent.setAugmentationContext(null);
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "Let's try again. Share a different image or describe the wine differently."
				});
				agent.setPhase('await_input');
				break;

			case 'confirm_direction': {
				// User confirms partial match is on right track → Ask for clarifying details
				const augCtx = $agentAugmentationContext;
				if (augCtx?.originalResult?.parsed) {
					const missingPrompt = getMissingFieldsPrompt(augCtx.originalResult.parsed);
					const quickFillChips = getMissingFieldChips(augCtx.originalResult.parsed);

					// If we have quick-fill options, show them as chips
					if (quickFillChips.length > 0) {
						agent.addMessage({
							role: 'agent',
							type: 'chips',
							content: missingPrompt || 'Great! What else can you tell me about this wine?',
							chips: quickFillChips
						});
					} else {
						agent.addMessage({
							role: 'agent',
							type: 'text',
							content: missingPrompt || 'Great! What else can you tell me about this wine?'
						});
					}
				} else {
					agent.addMessage({
						role: 'agent',
						type: 'text',
						content: 'Great! Can you tell me more details like the vintage or specific wine name?'
					});
				}
				agent.setPhase('augment_input');
				break;
			}

			case 'wrong_direction': {
				// User says partial match is wrong → Clear wrong result, keep original input for re-identification
				const augCtx = $agentAugmentationContext;
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "No problem. Can you tell me more about the wine? For example, the producer name, country, or grape variety."
				});
				// Keep original input but CLEAR the wrong parsed result
				// Next submission will combine: original input + new user context
				agent.setAugmentationContext({
					originalInput: augCtx?.originalInput || '',
					originalInputType: augCtx?.originalInputType || 'text',
					originalResult: null as unknown as AgentIdentificationResult,  // Clear wrong result
					userFeedback: undefined
				});
				agent.setPhase('augment_input');
				break;
			}

			case 'use_producer_name': {
				// User confirms wine has no specific name - use producer as wine name
				const augCtx = $agentAugmentationContext;
				if (augCtx?.originalResult?.parsed) {
					const updatedParsed: AgentParsedWine = {
						...augCtx.originalResult.parsed,
						wineName: augCtx.originalResult.parsed.producer // Use producer as wine name
					};
					// Update the augmentation context with the new parsed data
					agent.setAugmentationContext({
						...augCtx,
						originalResult: {
							...augCtx.originalResult,
							parsed: updatedParsed
						}
					});
					// Check if we now have all required fields
					if (hasMinimumFields(updatedParsed)) {
						// Show the wine card for confirmation
						agent.addMessage({
							role: 'agent',
							type: 'wine_result',
							content: 'Is this the wine you\'re seeking?',
							wineResult: updatedParsed,
							confidence: augCtx.originalResult.confidence,
							chips: [
								{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
								{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
							]
						});
						agent.setPhase('result_confirm');
					} else {
						// Still missing fields, ask for more
						const remainingChips = getMissingFieldChips(updatedParsed);
						const missingPrompt = getMissingFieldsPrompt(updatedParsed);
						if (remainingChips.length > 0) {
							agent.addMessage({
								role: 'agent',
								type: 'chips',
								content: `Got it. ${missingPrompt}`,
								chips: remainingChips
							});
						} else {
							agent.addMessage({
								role: 'agent',
								type: 'text',
								content: `Got it. ${missingPrompt}`
							});
						}
					}
				}
				break;
			}

			case 'nv_vintage': {
				// User confirms wine is non-vintage
				const augCtx = $agentAugmentationContext;
				if (augCtx?.originalResult?.parsed) {
					const updatedParsed: AgentParsedWine = {
						...augCtx.originalResult.parsed,
						vintage: 'NV'
					};
					// Update the augmentation context with the new parsed data
					agent.setAugmentationContext({
						...augCtx,
						originalResult: {
							...augCtx.originalResult,
							parsed: updatedParsed
						}
					});
					// Check if we now have all required fields
					if (hasMinimumFields(updatedParsed)) {
						// Show the wine card for confirmation
						agent.addMessage({
							role: 'agent',
							type: 'wine_result',
							content: 'Is this the wine you\'re seeking?',
							wineResult: updatedParsed,
							confidence: augCtx.originalResult.confidence,
							chips: [
								{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
								{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
							]
						});
						agent.setPhase('result_confirm');
					} else {
						// Still missing fields, ask for more
						const remainingChips = getMissingFieldChips(updatedParsed);
						const missingPrompt = getMissingFieldsPrompt(updatedParsed);
						if (remainingChips.length > 0) {
							agent.addMessage({
								role: 'agent',
								type: 'chips',
								content: `Got it, non-vintage. ${missingPrompt}`,
								chips: remainingChips
							});
						} else {
							agent.addMessage({
								role: 'agent',
								type: 'text',
								content: `Got it, non-vintage. ${missingPrompt}`
							});
						}
					}
				}
				break;
			}

			case 'use_grape_as_name': {
				// User confirms wine has no specific name - use grape variety as wine name
				// Example: "Au Bon Climat Pinot Noir" → wineName = "Pinot Noir"
				const augCtx = $agentAugmentationContext;
				if (!augCtx?.originalResult?.parsed) {
					break; // Guard clause - no context to work with
				}

				// Extract grape from chip ID (handles multi-grape wines correctly)
				// Chip ID format: "use_grape_as_name:Pinot%20Noir"
				const lastChipMessage = [...$agentMessages]
					.reverse()
					.find(m => m.chips?.some(c => c.action === 'use_grape_as_name'));

				const chipWithGrape = lastChipMessage?.chips?.find(c => c.action === 'use_grape_as_name');
				const chipId = chipWithGrape?.id || '';

				let grapeToUse: string;
				if (chipId.includes(':')) {
					grapeToUse = decodeURIComponent(chipId.split(':')[1]);
				} else {
					// Fallback: use first grape from parsed data
					grapeToUse = augCtx.originalResult.parsed.grapes?.[0] || '';
				}

				if (!grapeToUse) {
					break; // No grape to use
				}

				const updatedParsedGrape: AgentParsedWine = {
					...augCtx.originalResult.parsed,
					wineName: grapeToUse
				};

				// Update augmentation context with new parsed data
				agent.setAugmentationContext({
					...augCtx,
					originalResult: {
						...augCtx.originalResult,
						parsed: updatedParsedGrape
					}
				});

				// Check if we now have all required fields
				if (hasMinimumFields(updatedParsedGrape)) {
					// Show wine card for confirmation
					agent.addMessage({
						role: 'agent',
						type: 'wine_result',
						content: 'Is this the wine you\'re seeking?',
						wineResult: updatedParsedGrape,
						confidence: augCtx.originalResult.confidence,
						chips: [
							{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
							{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
						]
					});
					agent.setPhase('result_confirm');
				} else {
					// Still missing other fields - ask for more info
					const remainingChips = getMissingFieldChips(updatedParsedGrape);
					const missingPrompt = getMissingFieldsPrompt(updatedParsedGrape);

					if (remainingChips.length > 0) {
						agent.addMessage({
							role: 'agent',
							type: 'chips',
							content: `Got it, using "${grapeToUse}" as the wine name. ${missingPrompt}`,
							chips: remainingChips
						});
					} else {
						agent.addMessage({
							role: 'agent',
							type: 'text',
							content: `Got it, using "${grapeToUse}" as the wine name. ${missingPrompt}`
						});
					}
				}
				break;
			}

			// ─────────────────────────────────────────────────────
			// ADD WINE FLOW ACTIONS
			// ─────────────────────────────────────────────────────

			case 'add_to_cellar': {
				// Start the add wine flow from identification result
				const lastWineMsg = [...$agentMessages].reverse().find(
					(m) => m.type === 'wine_result' && m.wineResult
				);
				const identified = lastWineMsg?.wineResult || $agentParsed;

				if (!identified) {
					agent.addMessage({
						role: 'agent',
						type: 'error',
						content: 'No wine identified to add.',
						chips: [{ id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }]
					});
					break;
				}

				// Check for missing required fields
				const missing: string[] = [];
				if (!identified.producer) missing.push('producer');
				if (!identified.wineName) missing.push('wine name');
				if (!identified.region) missing.push('region');
				if (!identified.wineType) missing.push('wine type');

				if (missing.length > 0) {
					// Initialize add flow state even with missing fields
					agent.initializeAddFlow(identified);
					agent.setPhase('add_manual_entry');
					agent.addMessage({
						role: 'agent',
						type: 'manual_entry',
						content: `I need a few more details: ${missing.join(', ')}.`
					});
					break;
				}

				// All required fields present - check for existing wine first (WIN-145)
				agent.initializeAddFlow(identified);

				// Early check: does this exact wine already exist?
				try {
					const existingCheck = await api.checkDuplicate({
						type: 'wine',
						name: identified.wineName!,
						producerName: identified.producer || undefined,
						year: identified.vintage || undefined
					});

					if (existingCheck.existingWineId && existingCheck.existingBottles > 0) {
						// Wine exists - offer choice immediately (skip region/producer matching)
						agent.setPhase('add_wine');
						agent.addMessage({
							role: 'agent',
							type: 'existing_wine_choice',
							content: `I found "${identified.wineName}" by ${identified.producer} already in your cellar with ${existingCheck.existingBottles} bottle${existingCheck.existingBottles > 1 ? 's' : ''}.`,
							existingWineId: existingCheck.existingWineId,
							existingBottles: existingCheck.existingBottles,
							chips: [
								{ id: 'add_bottle', label: 'Add Another Bottle', icon: 'plus', action: 'add_bottle_existing' },
								{ id: 'create_new', label: 'Create New Wine', icon: 'wine', action: 'create_new_wine' }
							]
						});
						break;
					}
				} catch (error) {
					// If check fails, proceed with normal flow
					console.error('Early wine check failed:', error);
				}

				// No existing wine found - start normal matching flow
				agent.setPhase('add_region');
				await startRegionMatching();
				break;
			}

			case 'remember_wine': {
				// Wishlist feature - placeholder for future implementation
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "The wishlist feature is coming soon! For now, you can add this wine to your cellar.",
					chips: [
						{ id: 'add_to_cellar', label: 'Add to Cellar', icon: 'plus', action: 'add_to_cellar' }
					]
				});
				break;
			}

			case 'manual_entry_complete': {
				// User completed manual entry form
				const data = e.detail.data as { producer: string; wineName: string; region: string; wineType: string };
				const currentAddState = get(agent).addState;

				if (!currentAddState) break;

				// Update the identified data with manual entries
				const updatedIdentified = {
					...currentAddState.identified,
					producer: data.producer || currentAddState.identified.producer,
					wineName: data.wineName || currentAddState.identified.wineName,
					region: data.region || currentAddState.identified.region,
					wineType: data.wineType || currentAddState.identified.wineType
				};

				// Re-initialize with updated data
				agent.initializeAddFlow(updatedIdentified as AgentParsedWine);
				agent.setPhase('add_region');
				await startRegionMatching();
				break;
			}

			// Handle match selection from MatchSelectionList
			default:
				if (action.startsWith('select_match:')) {
					const [, matchType, idStr] = action.split(':');
					const id = parseInt(idStr, 10);
					const entity = fetchEntity(matchType as 'region' | 'producer' | 'wine', id);

					if (!entity) {
						agent.addMessage({
							role: 'agent',
							type: 'error',
							content: 'Could not find that selection. Please try again.'
						});
						break;
					}

					// Set selection in state
					agent.setAddSelection(matchType as 'region' | 'producer' | 'wine', 'search', entity);

					// Show confirmation message
					const entityName = matchType === 'region' ? (entity as Region).regionName
						: matchType === 'producer' ? (entity as Producer).producerName
						: (entity as Wine).wineName;

					agent.addMessage({
						role: 'agent',
						type: 'match_confirmed',
						content: `Got it - using "${entityName}".`
					});

					// Brief delay then advance to next step
					advanceTimeoutId = setTimeout(() => {
						advanceTimeoutId = null;
						advanceToNextStep(matchType);
					}, 800);
					break;
				}

				// Handle "Add as new" actions
				if (action.startsWith('add_new:')) {
					const [, entityType] = action.split(':');
					const currentAddState = get(agent).addState;

					if (!currentAddState) break;

					agent.setAddSelection(entityType as 'region' | 'producer' | 'wine', 'create');

					const entityName = entityType === 'region' ? currentAddState.regionData.regionName
						: entityType === 'producer' ? currentAddState.producerData.producerName
						: currentAddState.wineData.wineName;

					agent.addMessage({
						role: 'agent',
						type: 'match_confirmed',
						content: `I'll create a new ${entityType} called "${entityName}".`
					});

					// Brief delay then advance to next step
					advanceTimeoutId = setTimeout(() => {
						advanceTimeoutId = null;
						advanceToNextStep(entityType);
					}, 800);
					break;
				}

				// Handle clarify/help actions
				if (action.startsWith('clarify:')) {
					const [, entityType] = action.split(':');
					if (!['region', 'producer', 'wine'].includes(entityType)) {
						console.error('Invalid clarify entity type:', entityType);
						break;
					}
					await handleClarifyRequest(entityType as 'region' | 'producer' | 'wine');
					break;
				}
				break;

			case 'add_bottle_existing': {
				// WIN-145: Add bottle to existing wine
				const lastExistingWineMsg = [...$agentMessages].reverse().find(
					(m) => m.type === 'existing_wine_choice' && m.existingWineId
				);
				const existingWineId = lastExistingWineMsg?.existingWineId;

				if (!existingWineId) {
					agent.addMessage({
						role: 'agent',
						type: 'error',
						content: 'Could not find existing wine. Please try again.',
						chips: [{ id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }]
					});
					break;
				}

				// Store existingWineId in addState and skip to bottle form
				agent.updateAddState({ existingWineId });
				agent.setPhase('add_bottle_part1');
				agent.addMessage({
					role: 'agent',
					type: 'bottle_form',
					content: "Great, I'll add another bottle. What are the details?",
					bottleFormPart: 1
				});
				break;
			}

			case 'create_new_wine': {
				// WIN-145: User chose to create new wine despite existing
				const currentAddState = get(agent).addState;
				if (!currentAddState) break;

				const wineName = currentAddState.wineData.wineName || currentAddState.identified.wineName;
				agent.addMessage({
					role: 'agent',
					type: 'match_confirmed',
					content: `I'll create a new entry for "${wineName}".`
				});

				// Start the full region/producer/wine matching flow
				advanceTimeoutId = setTimeout(async () => {
					advanceTimeoutId = null;
					agent.setPhase('add_region');
					await startRegionMatching();
				}, 800);
				break;
			}

			case 'bottle_next': {
				// Part 1 complete - advance to part 2
				agent.advanceBottleFormPart();
				agent.setPhase('add_bottle_part2');
				agent.addMessage({
					role: 'agent',
					type: 'bottle_form',
					content: 'And the purchase details?',
					bottleFormPart: 2
				});
				break;
			}

			case 'bottle_submit': {
				// Part 2 complete - proceed to enrichment choice
				agent.setPhase('add_enrichment');
				agent.addMessage({
					role: 'agent',
					type: 'enrichment_choice',
					content: 'Would you like me to research this wine now, or add it quickly and enrich later?',
					chips: [
						{ id: 'enrich_now', label: 'Enrich Now', icon: 'sparkle', action: 'enrich_now' },
						{ id: 'add_quickly', label: 'Add Quickly', icon: 'plus', action: 'add_quickly' }
					]
				});
				break;
			}

			case 'enrich_now':
			case 'add_quickly': {
				const enrichNow = action === 'enrich_now';
				await submitAddWine(enrichNow);
				break;
			}

			case 'retry_add': {
				// Retry the add wine submission
				const currentAddState = get(agent).addState;
				if (currentAddState) {
					await submitAddWine(false);
				}
				break;
			}
		}
		} finally {
			isProcessingAction = false;
		}
	}

	/**
	 * Handle user choosing to escalate to Claude Opus for premium identification
	 */
	async function handleTryOpus() {
		const augContext = $agentAugmentationContext;
		if (!augContext?.originalResult) return;

		// Track this action for retry
		lastAction = { type: 'opus' };

		agent.addMessage({
			role: 'agent',
			type: 'text',
			content: 'Consulting our premium analysis...'
		});

		agent.setPhase('identifying');
		agent.setTyping(true);

		try {
			let input: string;
			let mimeType: string | undefined;

			// For image inputs, re-compress the stored file or use persisted base64
			if (augContext.originalInputType === 'image') {
				if (lastImageFile) {
					const compressed = await api.compressImageForIdentification(lastImageFile);
					input = compressed.imageData;
					mimeType = compressed.mimeType;
				} else if ($agent.lastImageData) {
					// Use persisted base64 (session was restored)
					input = $agent.lastImageData;
					mimeType = $agent.lastImageMimeType ?? 'image/jpeg';
				} else {
					// No image available - inform user
					agent.setTyping(false);
					agent.addMessage({
						role: 'agent',
						type: 'text',
						content: 'The image from your previous session is no longer available. Please upload the image again.'
					});
					agent.setPhase('await_input');
					return;
				}
			} else {
				// Text input - use original input
				input = augContext.originalInput;
			}

			const result = await agent.identifyWithOpus(
				input,
				augContext.originalInputType,
				augContext.originalResult,
				mimeType,
				augContext.userFeedback
			);

			agent.setTyping(false);

			if (result) {
				// Handle the Opus result with the standard flow
				if (!handleIdentificationResult(result, augContext.originalInput)) {
					showErrorWithRetry($agentErrorMessage || 'Premium analysis could not identify the wine.');
				}
				// Only clear augmentation context AFTER result handling, and only if result was complete
				if (hasMinimumFields(result.parsed)) {
					agent.setAugmentationContext(null);
				}
			} else {
				// Opus failed - offer conversational fallback
				agent.addMessage({
					role: 'agent',
					type: 'text',
					content: "The premium analysis wasn't able to identify this wine either. Let's work through it together."
				});
				handleUseConversation();
			}
		} catch (err) {
			agent.setTyping(false);
			showErrorWithRetry($agentErrorMessage || 'Something went wrong with the premium analysis.');
		}
	}

	/**
	 * Handle user choosing conversational flow instead of Opus escalation
	 */
	function handleUseConversation() {
		const augContext = $agentAugmentationContext;
		if (!augContext?.originalResult?.parsed) {
			agent.setPhase('augment_input');
			return;
		}

		const message = buildProgressMessage(augContext.originalResult.parsed);
		agent.addMessage({
			role: 'agent',
			type: 'partial_match',
			content: `Let's work through this together. ${message}`,
			wineResult: augContext.originalResult.parsed,
			confidence: augContext.originalResult.confidence,
			chips: [
				{ id: 'provide_more', label: 'Tell Me More', icon: 'edit', action: 'provide_more' },
				{ id: 'see_result', label: 'See What I Found', icon: 'search', action: 'see_result' },
				{ id: 'start_fresh', label: 'Start Fresh', icon: 'refresh', action: 'start_fresh' }
			]
		});
		agent.setPhase('augment_input');
	}

	function handleIncorrectResult() {
		const candidates = $agentCandidates;
		const augContext = $agentAugmentationContext;

		// Use the most recent wine result (may contain merged data from progressive flow)
		const lastWineMsg = [...$agentMessages].reverse().find(
			(m) => m.type === 'wine_result' && m.wineResult
		);
		const wineData = lastWineMsg?.wineResult || parsed;
		const lastResultConfidence = augContext?.originalResult?.confidence ?? $agentConfidence ?? 0;
		const wasHighConfidence = lastResultConfidence >= 85;

		if (wasHighConfidence) {
			// High confidence miss - don't assume the path is right, give clear escape options
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I apologize for the confusion. Let's try a different approach.",
				chips: [
					{ id: 'what_wrong', label: "Tell Me What's Wrong", icon: 'edit', action: 'what_wrong' },
					{ id: 'new_input', label: 'Try Different Input', icon: 'camera', action: 'new_input' },
					{ id: 'start_fresh', label: 'Start Over', icon: 'refresh', action: 'start_fresh' }
				]
			});
			// Clear augmentation context - don't lock in wrong data
			agent.setAugmentationContext(null);
			agent.setPhase('handle_incorrect');

		} else if (candidates.length > 0) {
			// Show alternatives using partial_match with mini-cards
			agent.setPhase('handle_incorrect');
			agent.addMessage({
				role: 'agent',
				type: 'partial_match',
				content: 'Perhaps one of these?',
				candidates,
				chips: [
					{ id: 'none_of_these', label: 'None of These', icon: 'x', action: 'start_fresh' }
				]
			});
		} else {
			// Ask for more details
			agent.setPhase('augment_input');
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: "I'd like to understand better. Could you tell me more about this wine? (e.g., producer, region, or grape variety)"
			});
			// Store augmentation context with tracked input type
			if (wineData) {
				agent.setAugmentationContext({
					originalInput: '',
					originalInputType: lastInputType || 'text',
					originalResult: {
						intent: 'add',
						parsed: wineData,
						confidence: $agentConfidence ?? 0,
						action: $agentAction ?? 'suggest',
						candidates: []
					}
				});
			}
		}
	}

	async function handleAddToCellar() {
		// Use the most recent wine result shown to the user (may contain merged data
		// from progressive identification), falling back to the store's parsed value
		const lastWineMsg = [...$agentMessages].reverse().find(
			(m) => m.type === 'wine_result' && m.wineResult
		);
		const wineData = lastWineMsg?.wineResult || parsed;
		if (!wineData) {
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'No wine identified to add.',
				chips: [{ id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }]
			});
			return;
		}

		// Check for missing required fields
		const missing: string[] = [];
		if (!wineData.producer) missing.push('producer');
		if (!wineData.wineName) missing.push('wine name');
		if (!wineData.region) missing.push('region');
		if (!wineData.wineType) missing.push('wine type');

		if (missing.length > 0) {
			// Initialize add flow state even with missing fields
			agent.initializeAddFlow(wineData);
			agent.setPhase('add_manual_entry');
			agent.addMessage({
				role: 'agent',
				type: 'manual_entry',
				content: `I need a bit more information. Please fill in the missing details: ${missing.join(', ')}.`
			});
			return;
		}

		// All required fields present - check for existing wine first (WIN-145)
		agent.initializeAddFlow(wineData);

		// Early check: does this exact wine already exist?
		try {
			const existingCheck = await api.checkDuplicate({
				type: 'wine',
				name: wineData.wineName!,
				producerName: wineData.producer || undefined,
				year: wineData.vintage || undefined
			});

			if (existingCheck.existingWineId && existingCheck.existingBottles > 0) {
				// Wine exists - offer choice immediately (skip region/producer matching)
				agent.setPhase('add_wine');
				agent.addMessage({
					role: 'agent',
					type: 'existing_wine_choice',
					content: `I found "${wineData.wineName}" by ${wineData.producer} already in your cellar with ${existingCheck.existingBottles} bottle${existingCheck.existingBottles > 1 ? 's' : ''}.`,
					existingWineId: existingCheck.existingWineId,
					existingBottles: existingCheck.existingBottles,
					chips: [
						{ id: 'add_bottle', label: 'Add Another Bottle', icon: 'plus', action: 'add_bottle_existing' },
						{ id: 'create_new', label: 'Create New Wine', icon: 'wine', action: 'create_new_wine' }
					]
				});
				return;
			}
		} catch (error) {
			// If check fails, proceed with normal flow
			console.error('Early wine check failed:', error);
		}

		// No existing wine found - start normal matching flow
		agent.setPhase('add_region');
		await startRegionMatching();
	}

	/**
	 * Build selection chips for match selection (used by clarify and fallback)
	 */
	function buildMatchSelectionChips(
		matches: DuplicateMatch[],
		entityType: 'region' | 'producer' | 'wine',
		idPrefix = 'select'
	) {
		return [
			...matches.slice(0, 3).map((m, i) => ({
				id: `${idPrefix}_${i}`,
				label: m.name.length > 20 ? m.name.substring(0, 18) + '...' : m.name,
				action: `select_match:${entityType}:${m.id}`
			})),
			{ id: `${idPrefix}_add_new`, label: 'Add as New', icon: 'plus', action: `add_new:${entityType}` }
		];
	}

	/**
	 * Handle "Help Me Decide" clarification request
	 * Calls LLM to explain which option best matches the wine being added
	 * Note: Called from handleChipAction which manages isProcessingAction
	 */
	async function handleClarifyRequest(entityType: 'region' | 'producer' | 'wine') {
		const addState = get(agent).addState;
		if (!addState) {
			return;
		}

		const matches = addState.matches[entityType];
		if (matches.length === 0) {
			console.error('Clarify called with no matches for:', entityType);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong. Please select "Add as New" instead.',
				chips: [
					{ id: 'add_new_fallback', label: 'Add as New', icon: 'plus', action: `add_new:${entityType}` }
				]
			});
			return;
		}

		agent.setTyping(true);

		try {
			const result = await api.clarifyMatch({
				type: entityType,
				identified: addState.identified,
				options: matches
			});

			agent.setTyping(false);

			// Re-display selection chips with the explanation (without "Help Me Decide")
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: result.explanation,
				chips: buildMatchSelectionChips(matches, entityType)
			});
		} catch (error) {
			agent.setTyping(false);
			console.error(`${entityType} clarification failed:`, error);
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: "I couldn't help narrow down the choices. Please select from the list or add as new.",
				chips: buildMatchSelectionChips(matches, entityType, 'fallback')
			});
		}
	}

	// ─────────────────────────────────────────────────────
	// INPUT HANDLERS
	// ─────────────────────────────────────────────────────

	async function handleTextSubmit(e: CustomEvent<{ text: string }>) {
		const text = e.detail.text;

		// Check for conversational commands BEFORE wine identification
		const detection = detectCommand(text);
		if (detection.type === 'command' && detection.command) {
			handleConversationalCommand(detection.command, text);
			return;
		}

		// Check for chip responses when in result_confirm phase
		// This must run BEFORE hasActiveIdentification() so "yes", "yep", etc. work
		if (phase === 'result_confirm') {
			const lastChipMessage = [...$agentMessages].reverse().find((m) => m.chips?.length);
			if (lastChipMessage?.chips?.length) {
				const chipDetection = detectChipResponse(text);

				if (chipDetection.type === 'chip_response' && chipDetection.chipResponse) {
					const chips = lastChipMessage.chips;
					let targetChip;

					if (chipDetection.chipResponse === 'positive') {
						targetChip = chips.find((c) => POSITIVE_CHIP_ACTIONS.includes(c.action));
					} else {
						targetChip = chips.find((c) => NEGATIVE_CHIP_ACTIONS.includes(c.action));
					}

					if (targetChip) {
						// Add user message showing what they typed
						agent.addMessage({ role: 'user', type: 'text', content: text });
						// Trigger chip action
						await handleChipAction({
							detail: { action: targetChip.action }
						} as CustomEvent<{ action: string }>);
						return;
					}
				}

				// Fallback for unrecognized short input - show gentle prompt
				// Only for short input (1-3 words) that isn't clearly a wine query
				const wordCount = text.trim().split(/\s+/).length;
				if (wordCount <= 3 && chipDetection.type === 'wine_query') {
					// Check it's not a wine indicator (those should proceed to identification)
					const normalized = text.toLowerCase().trim();
					const hasWineIndicator = [
						'château',
						'chateau',
						'domaine',
						'bodega',
						'winery',
						'vineyard',
						'estate',
						'reserve',
						'vintage',
						'wine'
					].some((w) => normalized.includes(w));

					if (!hasWineIndicator) {
						// Show user message and gentle fallback
						agent.addMessage({ role: 'user', type: 'text', content: text });
						agent.addMessage({
							role: 'agent',
							type: 'text',
							content:
								"I didn't quite catch that. Please tap one of the options above, or type a new wine to search."
						});
						return;
					}
				}
			}
		}

		// Check if we should confirm before starting new search
		// Note: Commands like "start over" already handled above - they execute immediately
		if (hasActiveIdentification()) {
			// Store pending search in store (persisted to sessionStorage)
			agent.setPendingNewSearch({ text, previousPhase: phase as AgentPhase });

			// Show user's message
			agent.addMessage({
				role: 'user',
				type: 'text',
				content: text
			});

			// Ask for confirmation
			agent.addMessage({
				role: 'agent',
				type: 'chips',
				content: 'I have a wine ready. Did you want to search for something new instead?',
				chips: [
					{ id: 'confirm_new_search', label: 'Search New', icon: 'search', action: 'confirm_new_search' },
					{ id: 'continue_current', label: 'Keep Current', icon: 'wine-bottle', action: 'continue_current' }
				]
			});

			agent.setPhase('confirm_new_search');
			return;
		}

		// Handle text during chip-driven phases
		// In these phases, treat text as starting a new identification
		if (['greeting', 'path_selection', 'result_confirm', 'action_select', 'handle_incorrect'].includes(phase)) {
			// Clear any existing context since user is starting fresh
			agent.setAugmentationContext(null);
		}

		const augContext = $agentAugmentationContext;
		const wasInAugmentPhase = phase === 'augment_input'; // Capture before any state changes

		// ─────────────────────────────────────────────────────
		// BRIEF INPUT CHECK
		// ─────────────────────────────────────────────────────

		// Determine if this is a fresh identification (not providing more detail)
		// Use $agentPhase directly (not cached `phase`) to ensure we see synchronous updates
		const freshIdentificationPhases = [
			'greeting',
			'path_selection',
			'await_input',
			'result_confirm',
			'action_select',
			'handle_incorrect'
		];
		const isFreshIdentification = freshIdentificationPhases.includes($agentPhase) && !augContext;

		// Check for brief input - but first handle accumulated text
		if (pendingBriefSearch) {
			// User typed more during confirmation - accumulate and proceed
			const accumulatedText = `${pendingBriefSearch} ${text}`;
			pendingBriefSearch = null;
			// Recursively call with accumulated text (will skip this block since pendingBriefSearch is now null)
			await handleTextSubmit({ detail: { text: accumulatedText } } as CustomEvent<{ text: string }>);
			return;
		}

		// Show confirmation for brief input on fresh identification
		if (isBriefInput(text) && isFreshIdentification) {
			pendingBriefSearch = text;

			// Add user message
			agent.addMessage({ role: 'user', type: 'text', content: text });

			// Show confirmation prompt
			agent.addMessage({
				role: 'agent',
				type: 'chips',
				content: `Just "${text}"? Adding more detail like the producer, vintage, or region will improve the match.`,
				chips: [
					{ id: 'confirm_brief', label: 'Search Anyway', icon: 'search', action: 'confirm_brief_search' },
					{ id: 'add_detail', label: "I'll Add More", icon: 'edit', action: 'add_more_detail' }
				]
			});
			agent.setPhase('await_input');
			return;
		}

		// ─────────────────────────────────────────────────────
		// END BRIEF INPUT CHECK
		// ─────────────────────────────────────────────────────

		// Add user message
		agent.addMessage({
			role: 'user',
			type: 'text',
			content: text
		});

		// Set identifying phase
		agent.setPhase('identifying');
		agent.setTyping(true);

		try {
			let result: { parsed: AgentParsedWine; confidence: number; candidates?: AgentCandidate[]; action?: string } | null = null;

			// Check if we're augmenting an image-originated flow
			if (phase === 'augment_input' && augContext?.originalInputType === 'image') {
				if (lastImageFile) {
					// Track this action for retry
					lastAction = { type: 'imageWithText', file: lastImageFile, supplementaryText: text };
					result = await agent.identifyImageWithSupplementaryText(lastImageFile, text);
				} else if ($agent.lastImageData) {
					// Use persisted base64 - call identifyWithOpus with supplementary text
					// since we can't re-compress the File
					const priorResult = augContext.originalResult || {
						intent: 'add' as const,
						parsed: {},
						confidence: 0,
						action: 'suggest' as const,
						candidates: []
					};
					result = await agent.identifyWithOpus(
						$agent.lastImageData,
						'image',
						priorResult,
						$agent.lastImageMimeType ?? 'image/jpeg',
						text
					);
				} else {
					// Fall through to text-based identification
				}
			}

			if (!result) {
				// Text-based identification (possibly augmented with previous result)
				let queryText = text;
				if (phase === 'augment_input' && augContext) {
					if (augContext.originalResult?.parsed) {
						// Combine original wine info with new user input (user confirmed direction)
						const orig = augContext.originalResult.parsed;
						const parts: string[] = [];

						if (orig.producer) parts.push(`Producer: ${orig.producer}`);
						if (orig.wineName && orig.wineName !== 'Unknown Wine') parts.push(`Wine: ${orig.wineName}`);
						if (orig.vintage) parts.push(`Vintage: ${orig.vintage}`);
						if (orig.region) parts.push(`Region: ${orig.region}`);
						if (orig.country) parts.push(`Country: ${orig.country}`);
						if (orig.wineType) parts.push(`Type: ${orig.wineType}`);

						parts.push(`Additional info: ${text}`);
						queryText = parts.join('. ');
					} else if (augContext.originalInput) {
						// User said "No" - combine original input with new context (discard wrong result)
						queryText = `${augContext.originalInput}. Additional context: ${text}`;
					}
				} else {
					// Fresh text submission — track input type
					lastInputType = 'text';
				}

				// Track this action for retry
				lastAction = { type: 'text', text: queryText };
				result = await agent.identify(queryText);
			}

			agent.setTyping(false);

			// Post-AI grape detection: if wine name still missing but user typed a grape, offer to use it
			if (result?.parsed && wasInAugmentPhase) {
				const parsedResult = result.parsed;
				const stillMissingWineName = !parsedResult.wineName || parsedResult.wineName === 'Unknown Wine';

				if (stillMissingWineName && parsedResult.grapes?.length) {
					// Check if user's input matches any of the identified grapes (case-insensitive exact match)
					const normalizedInput = text.trim().toLowerCase();
					const matchedGrape = parsedResult.grapes.find(
						g => g.trim().toLowerCase() === normalizedInput
					);

					if (matchedGrape) {
						// User typed a grape name that matches - offer to use it as wine name
						agent.addMessage({
							role: 'agent',
							type: 'chips',
							content: `I found the wine but still need a name. "${matchedGrape}" is the grape variety - should I use it as the wine name?`,
							chips: [
								{
									id: `use_grape_as_name:${encodeURIComponent(matchedGrape)}`,
									label: 'Yes, use it',
									icon: 'check',
									action: 'use_grape_as_name'
								},
								{
									id: 'provide_more',
									label: 'No, I\'ll clarify',
									icon: 'edit',
									action: 'provide_more'
								}
							]
						});

						// Store context for the handler
						agent.setAugmentationContext({
							originalInput: text,
							originalInputType: lastInputType || 'text',
							originalResult: {
								intent: 'add',
								parsed: result.parsed,
								confidence: result.confidence,
								action: (result.action ?? 'suggest') as AgentAction,
								candidates: result.candidates ?? []
							}
						});
						agent.setPhase('augment_input');
						return; // Skip normal result handling - waiting for user confirmation
					}
				}
			}

			// Use four-way branch handler
			if (!handleIdentificationResult(result, text)) {
				// Null result — error occurred
				showErrorWithRetry($agentErrorMessage || 'I couldn\'t identify that wine.');
			}
		} catch (err) {
			agent.setTyping(false);
			showErrorWithRetry($agentErrorMessage || 'Something went wrong.');
		}
	}

	async function handleImageSubmit(e: CustomEvent<{ file: File }>) {
		const file = e.detail.file;

		// Store File object for potential re-send with supplementary text
		lastImageFile = file;
		lastInputType = 'image';

		// Track this action for retry
		lastAction = { type: 'image', file };

		// Compress image early for both preview and API call
		const { imageData, mimeType } = await api.compressImageForIdentification(file);

		// Use data URL for preview (persists across page reload)
		const imageUrl = `data:${mimeType};base64,${imageData}`;

		// Add user message with data URL preview
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

			// Use four-way branch handler
			if (!handleIdentificationResult(result, '')) {
				// Null result — error occurred
				showErrorWithRetry($agentErrorMessage || 'I couldn\'t identify the wine from this image.');
			}
		} catch (err) {
			agent.setTyping(false);
			showErrorWithRetry($agentErrorMessage || 'Something went wrong processing the image.');
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
		const isAppellation = !!data.appellationName;
		const existingContext = $agentAugmentationContext;

		// Build AgentParsedWine from selected candidate
		let selectedParsed: AgentParsedWine;

		if (isAppellation) {
			// Appellation candidate — map appellation fields to wine fields
			const wineTypes = data.wineTypes as string[] | undefined;
			selectedParsed = {
				producer: null,
				wineName: null,
				vintage: null,
				region: (data.appellationName as string) || (data.region as string) || null,
				country: (data.country as string) || null,
				wineType: (wineTypes?.[0] as AgentParsedWine['wineType']) || null,
				grapes: (data.primaryGrapes as string[]) || null,
				appellation: null,  // WIN-148
				confidence: candidate.confidence
			};
		} else {
			// Wine candidate
			selectedParsed = {
				producer: (data.producer as string) || null,
				wineName: (data.wineName as string) || (data.name as string) || null,
				vintage: (data.vintage as string) || null,
				region: (data.region as string) || null,
				country: (data.country as string) || null,
				wineType: (data.wineType as AgentParsedWine['wineType']) || null,
				grapes: (data.grapes as string[]) || null,
				appellation: (data.appellation as string) || null,  // WIN-148
				confidence: candidate.confidence
			};
		}

		// Merge with existing augmentation context — candidate's fields take priority,
		// but previously locked-in fields fill the gaps
		if (existingContext?.originalResult?.parsed) {
			const prev = existingContext.originalResult.parsed;
			selectedParsed = {
				producer: selectedParsed.producer || prev.producer,
				wineName: selectedParsed.wineName || ((prev.wineName && prev.wineName !== 'Unknown Wine') ? prev.wineName : null),
				vintage: selectedParsed.vintage || prev.vintage,
				region: selectedParsed.region || prev.region,
				country: selectedParsed.country || prev.country,
				wineType: selectedParsed.wineType || prev.wineType,
				grapes: selectedParsed.grapes || prev.grapes,
				appellation: selectedParsed.appellation || prev.appellation,  // WIN-148
				confidence: candidate.confidence
			};
		}

		if (hasMinimumFields(selectedParsed)) {
			// Full wine identified — proceed to add-wine flow
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: 'Perfect choice. Opening the cellar for you...'
			});
			addWineStore.populateFromAgent(selectedParsed);
			agent.setPhase('complete');
			setTimeout(() => {
				agent.closePanel();
				goto('/qve/add');
			}, 500);
		} else {
			// Incomplete identification — continue with augmentation
			const message = buildProgressMessage(selectedParsed);

			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: isAppellation
					? `Narrowing to ${selectedParsed.region || 'this selection'}. ${message}`
					: message
			});

			// Set augmentation context with merged data so next submission builds on it
			agent.setAugmentationContext({
				originalInput: '',
				originalInputType: lastInputType || 'text',
				originalResult: {
					intent: 'add',
					parsed: selectedParsed,
					confidence: candidate.confidence,
					action: 'disambiguate' as AgentAction,
					candidates: []
				}
			});
			agent.setPhase('augment_input');
		}
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
			<!-- Spacer pushes content to bottom while preserving scroll -->
			<div class="message-spacer"></div>

			{#if messages.length === 0}
				<!-- Loading state while session initializes -->
				<div class="loading-greeting">
					<p class="agent-text">Preparing...</p>
				</div>
			{:else}
				{#each messages as message, index (message.id)}
					<div bind:this={messageElements[index]}>
						<ChatMessage
							{message}
							on:chipSelect={handleChipAction}
							on:addToCellar={handleWineAddToCellar}
							on:tryAgain={handleWineTryAgain}
							on:confirm={handleWineConfirm}
							on:edit={handleWineEdit}
							on:selectCandidate={handleCandidateSelect}
							on:formReady={scrollToFormContent}
							on:chipsReady={scrollToFormContent}
						/>
					</div>
				{/each}
			{/if}

			{#if isTyping}
				<TypingIndicator text={typingText} />
			{/if}

			{#if $agentEnriching}
				<EnrichmentSkeleton />
			{/if}
		</div>

		<!-- Input area (always visible) -->
		<div class="panel-input">
			<CommandInput
				bind:this={commandInputRef}
				disabled={isLoading || isTyping || phase === 'complete' || phase === 'confirm_new_search'}
				placeholder={inputPlaceholder}
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

	/* Spacer pushes messages to bottom while preserving scroll */
	.message-spacer {
		flex: 1 1 auto;
	}

	/* Input area */
	.panel-input {
		flex-shrink: 0;
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
