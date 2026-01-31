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
		agentEnriching,
		addWineStore
	} from '$lib/stores';
	import type { AgentPhase, AgentMessage, AgentChip } from '$lib/stores';
	import CommandInput from './CommandInput.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import { EnrichmentSkeleton } from './enrichment';
	import type { AgentParsedWine, AgentCandidate, AgentAction, AgentEscalationMeta, AgentIdentificationResult } from '$lib/api/types';
	import { api } from '$lib/api';

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
		if ($agentMessages.length === 0) {
			agent.startSession();
		}
	});

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
		lastImageFile = null;
		lastInputType = null;
		agent.resetConversation();
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
				icon: 'wine',
				action: 'use_producer_name'
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
			// CARD: medium/high confidence — show wine card (preserved)
			agent.setAugmentationContext(null);
			agent.addMessage({
				role: 'agent',
				type: 'wine_result',
				content: 'Is this the wine you\'re seeking?',
				wineResult: result.parsed,
				confidence: result.confidence,
				chips: [
					{ id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
					{ id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
				]
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
				// Enrich the identified wine with additional details
				const parsedWine = $agentParsed;
				if (parsedWine) {
					agent.setTyping(true);
					await agent.enrichWine(parsedWine);
					agent.setTyping(false);
				}
				break;

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
		}
	}

	/**
	 * Handle user choosing to escalate to Claude Opus for premium identification
	 */
	async function handleTryOpus() {
		const augContext = $agentAugmentationContext;
		if (!augContext?.originalResult) return;

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

			// For image inputs, re-compress the stored file
			if (augContext.originalInputType === 'image' && lastImageFile) {
				const compressed = await api.compressImageForIdentification(lastImageFile);
				input = compressed.imageData;
				mimeType = compressed.mimeType;
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
				// Clear augmentation context since we got a new result
				agent.setAugmentationContext(null);

				// Handle the Opus result with the standard flow
				if (!handleIdentificationResult(result, augContext.originalInput)) {
					agent.addMessage({
						role: 'agent',
						type: 'error',
						content: $agentError || 'Premium analysis could not identify the wine.'
					});
					agent.setPhase('augment_input');
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
			agent.addMessage({
				role: 'agent',
				type: 'error',
				content: 'Something went wrong with the premium analysis.'
			});
			agent.setPhase('augment_input');
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
		if (!wineData) return;

		// Check minimum required fields before navigating to add-wine
		if (!hasMinimumFields(wineData)) {
			// Missing required fields — redirect to augmentation
			const message = buildProgressMessage(wineData);
			agent.addMessage({
				role: 'agent',
				type: 'text',
				content: `Almost there! ${message} Can you help fill in the gaps?`
			});
			agent.setAugmentationContext({
				originalInput: '',
				originalInputType: lastInputType || 'text',
				originalResult: {
					intent: 'add',
					parsed: wineData,
					confidence: wineData.confidence ?? 0,
					action: 'suggest' as AgentAction,
					candidates: []
				}
			});
			agent.setPhase('augment_input');
			return;
		}

		// Pre-fill the add wine wizard with identified data
		await addWineStore.populateFromAgent(wineData);

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

		try {
			let result: { parsed: AgentParsedWine; confidence: number; candidates?: AgentCandidate[]; action?: string } | null = null;

			// Check if we're augmenting an image-originated flow
			if (phase === 'augment_input' && augContext?.originalInputType === 'image' && lastImageFile) {
				result = await agent.identifyImageWithSupplementaryText(lastImageFile, text);
			} else {
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

				result = await agent.identify(queryText);
			}

			agent.setTyping(false);

			// Use four-way branch handler
			if (!handleIdentificationResult(result, text)) {
				// Null result — error occurred
				agent.addMessage({
					role: 'agent',
					type: 'error',
					content: $agentError || 'I couldn\'t identify that wine.'
				});
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

		// Store File object for potential re-send with supplementary text
		lastImageFile = file;
		lastInputType = 'image';

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

			// Use four-way branch handler
			if (!handleIdentificationResult(result, '')) {
				// Null result — error occurred
				agent.addMessage({
					role: 'agent',
					type: 'error',
					content: $agentError || 'I couldn\'t identify the wine from this image.'
				});
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

			{#if $agentEnriching}
				<EnrichmentSkeleton />
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
