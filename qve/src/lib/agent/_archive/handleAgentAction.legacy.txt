/**
 * Agent Action Handler
 *
 * Central action router that dispatches all agent actions to appropriate stores.
 * Implements the Command Pattern for clean separation of concerns.
 *
 * Part of the Phase 4 store refactoring.
 */

import type {
  AgentAction,
  AgentChip,
  EntityType,
  AgentErrorInfo,
  WineIdentificationResult,
  BottleFormData,
} from './types';
import { getMessage, messageTemplates, wn } from './messages';
import * as conversation from '$lib/stores/agentConversation';
import { addMessageWithDelay } from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import type { AddWineFlowState } from '$lib/stores/agentAddWine';
import { detectCommand, detectChipResponse, isBriefInput } from '$lib/utils';
import { api } from '$lib/api';
import { AgentError, type AgentParsedWine, type AddWinePayload, type AgentEnrichmentData } from '$lib/api/types';

// ===========================================
// Module State for Retry Support
// ===========================================

/** Track last action for retry functionality */
let lastAction: { type: 'text' | 'image'; text?: string; data?: string; mimeType?: string } | null = null;

/** Pending brief search text (for "Search Anyway" confirmation) */
let pendingBriefSearch: string | null = null;

/** Track last enrichment action for retry functionality */
let lastEnrichmentAction: {
  producer: string;
  wineName: string;
  vintage?: string | null;
  type?: string | null;
  region?: string | null;
} | null = null;

// ===========================================
// Type Conversion Helpers
// ===========================================

/**
 * Convert AgentParsedWine (from API, uses null) to WineIdentificationResult (local, uses undefined).
 */
function convertParsedWineToResult(
  parsed: AgentParsedWine,
  confidence?: number
): WineIdentificationResult {
  return {
    producer: parsed.producer ?? undefined,
    wineName: parsed.wineName ?? undefined,
    vintage: parsed.vintage ?? undefined,
    region: parsed.region ?? undefined,
    country: parsed.country ?? undefined,
    grapes: parsed.grapes ?? undefined,
    type: parsed.wineType ?? undefined,
    appellation: parsed.appellation ?? undefined,
    confidence: confidence ?? parsed.confidence ?? undefined,
  };
}

// ===========================================
// Result Quality Analysis
// ===========================================

interface ResultQuality {
  isComplete: boolean;
  isLowConfidence: boolean;
  missingProducer: boolean;
  missingWineName: boolean;
  missingVintage: boolean;
  hasProducer: boolean;
  hasGrapes: boolean;
  primaryGrape: string | undefined;
  confidence: number;
}

/**
 * Analyze the quality of an identification result.
 * Determines what's missing and what options to show.
 */
function analyzeResultQuality(
  result: WineIdentificationResult,
  confidence: number
): ResultQuality {
  const hasProducer = !!result.producer;
  const hasWineName = !!result.wineName;
  const hasVintage = result.vintage !== undefined;
  const hasGrapes = !!(result.grapes && result.grapes.length > 0);
  const primaryGrape = hasGrapes ? result.grapes![0] : undefined;

  // Consider low confidence if below 70%
  const isLowConfidence = confidence < 0.7;

  // Result is incomplete if missing required fields
  const missingProducer = !hasProducer;
  const missingWineName = !hasWineName;
  const missingVintage = !hasVintage;

  // Complete means we have producer + wine name + vintage with decent confidence
  const isComplete = hasProducer && hasWineName && hasVintage && !isLowConfidence;

  return {
    isComplete,
    isLowConfidence,
    missingProducer,
    missingWineName,
    missingVintage,
    hasProducer,
    hasGrapes,
    primaryGrape,
    confidence,
  };
}

/**
 * Build chips for an incomplete or low-confidence result.
 *
 * Chip sets by scenario:
 * - No producer (has wine name): Specify Producer, Search Again
 * - No vintage (has producer + wine name): Specify Vintage, Non-Vintage
 * - No wine name: Use Producer Name (if has producer), Use Grape (if has grapes), Add Details, Search Again
 */
function buildIncompleteResultChips(quality: ResultQuality): AgentChip[] {
  const chips: AgentChip[] = [];

  // Scenario: Missing producer only (has wine name and vintage)
  const onlyMissingProducer = quality.missingProducer && !quality.missingWineName && !quality.missingVintage;

  // Scenario: Missing vintage only (has producer and wine name)
  const onlyMissingVintage = quality.missingVintage && !quality.missingWineName && !quality.missingProducer;

  if (onlyMissingProducer) {
    // No producer: specify manually or search again
    chips.push({
      id: 'specify_producer',
      label: 'Specify Producer',
      action: 'add_missing_details',
    });
    chips.push({
      id: 'search_again',
      label: 'Search Again',
      action: 'provide_more',
    });
  } else if (onlyMissingVintage) {
    // No vintage: specify vintage or mark as NV
    chips.push({
      id: 'specify_vintage',
      label: getMessage('chips.specifyVintage'),
      action: 'add_missing_details',
    });
    chips.push({
      id: 'nv',
      label: getMessage('chips.nonVintage'),
      action: 'nv_vintage',
    });
  } else if (quality.missingWineName) {
    // No wine name: offer substitutes, manual entry, or search again
    if (quality.hasProducer) {
      chips.push({
        id: 'use_producer',
        label: getMessage('chips.useProducerName'),
        action: 'use_producer_name',
      });
    }
    if (quality.hasGrapes && quality.primaryGrape) {
      chips.push({
        id: 'use_grape',
        label: getMessage('chips.useGrapeName'),
        action: 'use_grape_as_name',
      });
    }
    chips.push({
      id: 'add_details',
      label: getMessage('chips.addDetails'),
      action: 'add_missing_details',
    });
    chips.push({
      id: 'search_again',
      label: 'Search Again',
      action: 'provide_more',
    });
  } else {
    // Generic incomplete (multiple fields missing or other edge cases)
    chips.push({
      id: 'add_details',
      label: getMessage('chips.addDetails'),
      action: 'add_missing_details',
    });
    chips.push({
      id: 'search_again',
      label: 'Search Again',
      action: 'provide_more',
    });
  }

  // If low confidence, also offer to try harder (in addition to above chips)
  if (quality.isLowConfidence) {
    chips.push({
      id: 'try_harder',
      label: getMessage('chips.tryHarder'),
      action: 'try_opus',
    });
  }

  return chips;
}

/**
 * Handle the identification result flow.
 * Shows appropriate message based on what was identified.
 *
 * - If we have producer OR wine name: show Correct/Not Correct confirmation
 * - If we ONLY have grape/region (no producer, no wine name): skip confirmation, ask for more info
 * - If we have nothing: show not found message with retry options
 */
function handleIdentificationResultFlow(
  wineResult: WineIdentificationResult,
  confidence: number
): void {
  // Build the wine name for display
  const wineName = [wineResult.producer, wineResult.wineName]
    .filter(Boolean)
    .join(' ');

  const hasProducerOrWineName = !!wineResult.producer || !!wineResult.wineName;
  const hasOnlyGrapes = !hasProducerOrWineName && !!(wineResult.grapes?.length);

  // Add wine result message (the card) - only if we have something to show
  if (wineName || wineResult.grapes?.length) {
    conversation.addMessage({
      category: 'wine_result',
      role: 'agent',
      data: {
        category: 'wine_result',
        result: wineResult,
        confidence,
      },
    });
  }

  // Case 1: We have producer and/or wine name - show confirmation chips
  if (hasProducerOrWineName) {
    const foundMessage = messageTemplates.identification.foundWithConfidence(wineName, confidence);
    conversation.addMessage(
      conversation.createTextMessage(foundMessage)
    );

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'correct', label: getMessage('chips.correct'), action: 'correct' },
        { id: 'not_correct', label: getMessage('chips.notCorrect'), action: 'not_correct' },
      ])
    );

    conversation.setPhase('confirming');
    return;
  }

  // Case 2: We only have grape variety (no producer, no wine name) - skip confirmation
  if (hasOnlyGrapes) {
    const quality = analyzeResultQuality(wineResult, confidence);

    conversation.addMessage(
      conversation.createTextMessage(
        `I detected ${wn(wineResult.grapes![0])} as the grape variety, but couldn't identify the wine or producer. Can you provide more details?`
      )
    );

    // Show incomplete result chips (Use Grape as Name, Add Details, Search Again)
    const chips = buildIncompleteResultChips(quality);
    conversation.addMessage(
      conversation.createChipsMessage(chips)
    );

    conversation.setPhase('awaiting_input');
    return;
  }

  // Case 3: Nothing meaningful identified - show not found with retry options
  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.notFound'))
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'try_again', label: 'Try Again', action: 'provide_more' },
      { id: 'start_over', label: 'Start Over', action: 'start_over' },
    ])
  );

  conversation.setPhase('awaiting_input');
}

/**
 * After user provides a missing field, check if more fields are needed.
 * If complete, show the updated wine card for confirmation before action chips.
 * If still incomplete, prompt for next field.
 */
function handleMissingFieldProvided(
  updatedResult: WineIdentificationResult,
  confidence: number
): void {
  const quality = analyzeResultQuality(updatedResult, confidence);
  const wineName = [updatedResult.producer, updatedResult.wineName]
    .filter(Boolean)
    .join(' ');

  if (quality.isComplete) {
    // All fields present after user filled in gaps
    // For high confidence matches, go directly to action chips (user already confirmed initially)
    // For low confidence, offer re-identification since user input might improve the match
    if (!quality.isLowConfidence) {
      // High confidence - go directly to action chips
      conversation.addMessage(
        conversation.createTextMessage(`Excellent. What would you like to do with ${wn(wineName)}?`)
      );

      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'add', label: getMessage('chips.addToCellar'), action: 'add_to_cellar', variant: 'primary' },
          { id: 'learn', label: getMessage('chips.learnMore'), action: 'learn' },
          { id: 'remember', label: getMessage('chips.remember'), action: 'remember' },
        ])
      );

      conversation.setPhase('confirming');
    } else {
      // Low confidence - show wine card and offer re-identification
      // Since user provided details, we might get a better match by re-identifying
      conversation.addMessage({
        category: 'wine_result',
        role: 'agent',
        data: {
          category: 'wine_result',
          result: updatedResult,
          confidence,
        },
      });

      // Offer to re-identify with the more complete information
      conversation.addMessage(
        conversation.createTextMessage(getMessage('identification.suggestReidentify'))
      );

      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'reidentify', label: getMessage('chips.reidentify'), action: 'reidentify', variant: 'primary' },
          { id: 'continue_as_is', label: getMessage('chips.continueAsIs'), action: 'continue_as_is' },
          { id: 'not_correct', label: getMessage('chips.notCorrect'), action: 'not_correct' },
        ])
      );

      conversation.setPhase('confirming');
    }
  } else {
    // Still missing fields - prompt for next one without re-confirming
    let promptMessage: string;

    if (quality.missingWineName && quality.hasGrapes && quality.primaryGrape) {
      promptMessage = messageTemplates.identification.incompleteWithGrapes(
        updatedResult.producer,
        quality.primaryGrape
      );
    } else if (quality.missingWineName && quality.hasProducer) {
      promptMessage = messageTemplates.identification.incompleteWithProducer(
        updatedResult.producer!
      );
    } else if (quality.missingProducer && !quality.missingWineName) {
      // We have wine name but no producer
      promptMessage = messageTemplates.identification.missingProducerPrompt(
        updatedResult.wineName!
      );
    } else if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
      // We have producer and wine name but no vintage
      promptMessage = messageTemplates.identification.missingVintagePrompt(wineName);
    } else if (quality.isLowConfidence && wineName) {
      promptMessage = messageTemplates.identification.lowConfidencePrompt(wineName, confidence);
    } else {
      promptMessage = getMessage('identification.incomplete');
    }

    conversation.addMessage(
      conversation.createTextMessage(promptMessage)
    );

    const chips = buildIncompleteResultChips(quality);
    conversation.addMessage(
      conversation.createChipsMessage(chips)
    );

    conversation.setPhase('awaiting_input');
  }
}

// ===========================================
// Main Action Handler
// ===========================================

/**
 * Handle any agent action.
 * Routes to appropriate sub-handlers based on action type.
 */
export async function handleAgentAction(action: AgentAction): Promise<void> {
  console.log('[AgentAction]', action.type, action);

  try {
    switch (action.type) {
      // ─────────────────────────────────────────────
      // Input Actions
      // ─────────────────────────────────────────────
      case 'submit_text':
        await handleTextSubmit(action.payload);
        break;

      case 'submit_image':
        await handleImageSubmit(action.payload.data, action.payload.mimeType);
        break;

      // ─────────────────────────────────────────────
      // Navigation Actions
      // ─────────────────────────────────────────────
      case 'start_over':
        handleStartOver();
        break;

      case 'go_back':
        handleGoBack();
        break;

      case 'cancel':
        handleCancel();
        break;

      case 'retry':
      case 'try_again':
        await handleRetry();
        break;

      // ─────────────────────────────────────────────
      // Confirmation Actions
      // ─────────────────────────────────────────────
      case 'correct':
        await handleCorrect(action.messageId);
        break;

      case 'not_correct':
        await handleNotCorrect(action.messageId);
        break;

      case 'confirm_direction':
        await handleConfirmDirection(action.messageId);
        break;

      case 'wrong_direction':
        await handleWrongDirection(action.messageId);
        break;

      case 'confirm_new_search':
        await handleConfirmNewSearch(action.messageId);
        break;

      case 'continue_current':
        handleContinueCurrent(action.messageId);
        break;

      case 'confirm_brief_search':
        await handleConfirmBriefSearch(action.messageId);
        break;

      case 'add_more_detail':
        handleAddMoreDetail(action.messageId);
        break;

      case 'confirm_cache_match':
        await handleConfirmCacheMatch(action.messageId);
        break;

      case 'force_refresh':
        await handleForceRefresh(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Identification Actions
      // ─────────────────────────────────────────────
      case 'identify':
        await handleIdentify(action.messageId);
        break;

      case 'try_opus':
        await handleTryOpus(action.messageId);
        break;

      case 'see_result':
        handleSeeResult(action.messageId);
        break;

      case 'see_partial_result':
        handleSeePartialResult(action.messageId);
        break;

      case 'use_conversation':
        await handleUseConversation(action.messageId);
        break;

      case 'add_missing_details':
        handleAddMissingDetails(action.messageId);
        break;

      case 'use_producer_name':
        await handleUseProducerName(action.messageId, action.payload?.name);
        break;

      case 'use_grape_as_name':
        await handleUseGrapeAsName(action.messageId, action.payload?.name);
        break;

      case 'nv_vintage':
        await handleNvVintage(action.messageId);
        break;

      case 'provide_more':
        handleProvideMore(action.messageId);
        break;

      case 'new_input':
        handleNewInput(action.messageId);
        break;

      case 'start_fresh':
        handleStartFresh(action.messageId);
        break;

      case 'reidentify':
        await handleReidentify(action.messageId);
        break;

      case 'continue_as_is':
        handleContinueAsIs(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Wine Flow Actions
      // ─────────────────────────────────────────────
      case 'add':
      case 'add_to_cellar':
        await handleAddToCellar(action.messageId);
        break;

      case 'learn':
        await handleLearnMore(action.messageId);
        break;

      case 'remember':
      case 'remember_wine':
        await handleRemember(action.messageId);
        break;

      case 'recommend':
        await handleRecommend(action.messageId);
        break;

      case 'enrich_now':
        await handleEnrichNow(action.messageId);
        break;

      case 'add_quickly':
        await handleAddQuickly(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Entity Matching Actions
      // ─────────────────────────────────────────────
      case 'select_match':
        handleSelectMatch(action.payload.entityType, action.payload.matchId, action.messageId);
        break;

      case 'add_new':
        await handleAddNew(action.payload.entityType, action.messageId);
        break;

      case 'clarify':
        await handleClarify(action.payload.entityType, action.messageId);
        break;

      case 'add_bottle_existing':
        await handleAddBottleExisting(action.messageId);
        break;

      case 'create_new_wine':
        handleCreateNewWine(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Form Actions
      // ─────────────────────────────────────────────
      case 'submit_bottle':
        await handleBottleSubmit(action.payload);
        break;

      case 'manual_entry_submit':
        await handleManualEntrySubmit(action.payload);
        break;

      case 'manual_entry_complete':
        await handleManualEntryComplete(action.payload, action.messageId);
        break;

      case 'bottle_next':
        handleBottleNext(action.messageId, action.payload);
        break;

      case 'bottle_submit':
        await handleBottleSubmitFinal(action.messageId);
        break;

      case 'retry_add':
        await handleRetryAdd(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Camera Actions
      // ─────────────────────────────────────────────
      case 'take_photo':
        handleTakePhoto(action.messageId);
        break;

      case 'choose_photo':
        handleChoosePhoto(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Error Actions
      // ─────────────────────────────────────────────
      case 'start_over_error':
        handleStartOverError(action.messageId);
        break;

      // ─────────────────────────────────────────────
      // Generic Chip Tap (unwrap and route)
      // ─────────────────────────────────────────────
      case 'chip_tap':
        // Unwrap the chip_tap and dispatch the nested action
        await handleAgentAction({
          type: action.payload.action,
          messageId: action.payload.messageId,
          payload: action.payload.data,
        } as AgentAction);
        break;

      default:
        console.warn('[AgentAction] Unknown action type:', (action as any).type);
    }
  } catch (error) {
    console.error('[AgentAction] Error handling action:', error);
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.generic'))
    );
    conversation.setPhase('error');
  }
}

// ===========================================
// Input Handlers
// ===========================================

async function handleTextSubmit(text: string): Promise<void> {
  // Get current phase for chip response detection
  const currentPhase = conversation.getCurrentPhase();
  const hasAugmentation = identification.getAugmentationContext() !== null;

  // ─────────────────────────────────────────────
  // 1. Command Detection (highest priority)
  // ─────────────────────────────────────────────
  const commandResult = detectCommand(text);
  if (commandResult.type === 'command' && commandResult.command) {
    switch (commandResult.command) {
      case 'start_over':
        handleStartOver();
        return;
      case 'cancel':
        handleCancel();
        return;
      case 'go_back':
        handleGoBack();
        return;
      case 'try_again':
        await handleRetry();
        return;
      case 'help':
        // Add help message
        conversation.addMessage(
          conversation.createTextMessage(
            "I can help you identify wines! Type a wine name, description, or take a photo of a label."
          )
        );
        return;
    }
  }

  // ─────────────────────────────────────────────
  // 2. Explicit Field Clarification (works with augmentation context)
  // ─────────────────────────────────────────────
  // Detect patterns like "region is Western Cape" or "producer is Visio Vintners"
  // This should run even when augmentation context is set (e.g., after "Add Details"
  // following "Not Correct") so user can correct/add specific fields without re-identification.
  // ─────────────────────────────────────────────
  const existingResult = identification.getResult();
  if (existingResult && currentPhase === 'awaiting_input') {
    const fieldMatch = text.match(/^(region|country|producer|winery|vintage|year|grape|variety)\s+(?:is|:|=)\s*(.+)$/i);
    if (fieldMatch) {
      const fieldType = fieldMatch[1].toLowerCase();
      const fieldValue = fieldMatch[2].trim();

      let updatedResult = { ...existingResult };
      let fieldUpdated = false;

      if (fieldType === 'region') {
        updatedResult.region = fieldValue;
        fieldUpdated = true;
      } else if (fieldType === 'country') {
        updatedResult.country = fieldValue;
        fieldUpdated = true;
      } else if (fieldType === 'producer' || fieldType === 'winery') {
        updatedResult.producer = fieldValue;
        fieldUpdated = true;
      } else if (fieldType === 'vintage' || fieldType === 'year') {
        const yearMatch = fieldValue.match(/^(\d{4})$/);
        const isNV = fieldValue.toUpperCase() === 'NV' || fieldValue.toUpperCase() === 'N/V';
        if (yearMatch || isNV) {
          updatedResult.vintage = isNV ? 'NV' : yearMatch![1];
          fieldUpdated = true;
        }
      } else if (fieldType === 'grape' || fieldType === 'variety') {
        updatedResult.grapes = [fieldValue];
        fieldUpdated = true;
      }

      if (fieldUpdated) {
        const confidence = existingResult.confidence ?? 1;
        identification.setResult(updatedResult, confidence);

        // Clear augmentation context since we handled the field directly
        if (hasAugmentation) {
          identification.clearAugmentationContext();
        }

        // Add user message
        conversation.addMessage(
          conversation.createTextMessage(text, { role: 'user' })
        );

        // Check if more fields needed, or show action chips if complete
        handleMissingFieldProvided(updatedResult, confidence);
        return;
      }
    }
  }

  // ─────────────────────────────────────────────
  // 3. Direct Field Input (only without augmentation context)
  // ─────────────────────────────────────────────
  // When user clicks "Specify Producer" or "Specify Vintage", they want to provide
  // the missing value directly. But when they click "Search Again", augmentation
  // context is set and they want to re-search with combined info.
  // ─────────────────────────────────────────────
  if (existingResult && currentPhase === 'awaiting_input' && !hasAugmentation) {
    const quality = analyzeResultQuality(existingResult, existingResult.confidence ?? 1);

    // Check if we're awaiting vintage and input looks like a year or "NV"
    if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
      const trimmed = text.trim().toUpperCase();
      const yearMatch = trimmed.match(/^(\d{4})$/);
      const isNV = trimmed === 'NV' || trimmed === 'N/V' || trimmed === 'NON-VINTAGE' || trimmed === 'NONVINTAGE';

      if (yearMatch || isNV) {
        // User entered a vintage - update the result
        const vintage = isNV ? 'NV' : yearMatch![1];
        const updatedResult = {
          ...existingResult,
          vintage,
        };
        const confidence = existingResult.confidence ?? 1;
        identification.setResult(updatedResult, confidence);

        // Add user message
        conversation.addMessage(
          conversation.createTextMessage(text, { role: 'user' })
        );

        // Check if more fields needed, or show action chips if complete
        handleMissingFieldProvided(updatedResult, confidence);
        return;
      }
    }

    // Check if we're awaiting producer (have wine name but no producer)
    if (quality.missingProducer && !quality.missingWineName) {
      // User entered a producer name - update the result
      const updatedResult = {
        ...existingResult,
        producer: text.trim(),
      };
      const confidence = existingResult.confidence ?? 1;
      identification.setResult(updatedResult, confidence);

      // Add user message
      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );

      // Check if more fields needed, or show action chips if complete
      handleMissingFieldProvided(updatedResult, confidence);
      return;
    }

    // Check if we're awaiting wine name
    if (quality.missingWineName) {
      // User entered a wine name - update the result
      const updatedResult = {
        ...existingResult,
        wineName: text.trim(),
      };
      const confidence = existingResult.confidence ?? 1;
      identification.setResult(updatedResult, confidence);

      // Add user message
      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );

      // Check if more fields needed, or show action chips if complete
      handleMissingFieldProvided(updatedResult, confidence);
      return;
    }
  }

  // ─────────────────────────────────────────────
  // 4. Chip Response Detection (only in confirming phase)
  // ─────────────────────────────────────────────
  if (currentPhase === 'confirming') {
    const chipResult = detectChipResponse(text);
    if (chipResult.type === 'chip_response') {
      // Get the most recent chips message to pass its ID
      const lastChipsMessage = conversation.getLastChipsMessage();
      const messageId = lastChipsMessage?.id ?? '';

      if (chipResult.chipResponse === 'positive') {
        await handleCorrect(messageId);
        return;
      } else if (chipResult.chipResponse === 'negative') {
        await handleNotCorrect(messageId);
        return;
      }
    }

    // In confirming phase with a result, typing something new triggers new search confirmation
    const hasResult = identification.getResult() !== null;
    if (hasResult) {
      // Store pending search and show confirmation
      identification.setPendingNewSearch(text);
      conversation.addMessage(
        conversation.createTextMessage(getMessage('confirm.newSearch'))
      );
      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'search_new', label: 'Search New', action: 'confirm_new_search' },
          { id: 'keep_current', label: 'Keep Current', action: 'continue_current' },
        ])
      );
      return;
    }
  }

  // ─────────────────────────────────────────────
  // 5. Brief Input Check (only without augmentation context)
  // ─────────────────────────────────────────────
  if (!hasAugmentation && isBriefInput(text)) {
    pendingBriefSearch = text;
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );
    conversation.addMessage(
      conversation.createTextMessage(
        `Just '${text}'? Adding more detail will improve the match.`
      )
    );
    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'search_anyway', label: 'Search Anyway', action: 'confirm_brief_search' },
        { id: 'add_more', label: "I'll Add More", action: 'add_more_detail' },
      ])
    );
    return;
  }

  // ─────────────────────────────────────────────
  // 6. Proceed with Identification (using augmentation context if available)
  // ─────────────────────────────────────────────
  const augContext = identification.getAugmentationContext();

  if (augContext?.imageData && augContext?.imageMimeType) {
    // Re-run image identification with the new text as supplementary context
    // Add user message first
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );

    // Track last action for retry (combine image with new text)
    lastAction = { type: 'image', data: augContext.imageData, mimeType: augContext.imageMimeType };

    // Clear augmentation context after using it
    identification.clearAugmentationContext();

    await executeImageIdentification(augContext.imageData, augContext.imageMimeType, text);
  } else if (augContext?.originalInput) {
    // Text-based augmentation: use the accumulated wine result (with all manual edits)
    // as context for re-identification, NOT the original search text
    // Add user message first (display just their new input)
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );

    // Parse the accumulated result to build a rich context string
    let contextParts: string[] = [];
    try {
      const accumulatedResult = JSON.parse(augContext.originalInput) as WineIdentificationResult;
      if (accumulatedResult.producer) contextParts.push(`Producer: ${accumulatedResult.producer}`);
      if (accumulatedResult.wineName) contextParts.push(`Wine: ${accumulatedResult.wineName}`);
      if (accumulatedResult.vintage) contextParts.push(`Vintage: ${accumulatedResult.vintage}`);
      if (accumulatedResult.region) contextParts.push(`Region: ${accumulatedResult.region}`);
      if (accumulatedResult.country) contextParts.push(`Country: ${accumulatedResult.country}`);
      if (accumulatedResult.type) contextParts.push(`Type: ${accumulatedResult.type}`);
      if (accumulatedResult.grapes?.length) contextParts.push(`Grapes: ${accumulatedResult.grapes.join(', ')}`);
    } catch {
      // Fallback to original input if parsing fails
      contextParts = [augContext.originalInput];
    }

    // Build context from accumulated result + user's new clarification
    const accumulatedContext = contextParts.length > 0 ? contextParts.join('. ') : '';
    const combinedText = accumulatedContext
      ? `${accumulatedContext}. User clarification: ${text}`
      : text;

    // Clear augmentation context after using it
    identification.clearAugmentationContext();

    // Update lastAction to the combined text for retry purposes
    lastAction = { type: 'text', text: combinedText };

    // Execute with combined text, skip user message (already added) and lastAction update (already done)
    await executeTextIdentification(combinedText, { skipUserMessage: true, skipLastActionUpdate: true });
  } else {
    await executeTextIdentification(text);
  }
}

/**
 * Execute the actual text identification API call.
 * Separated for reuse by handleConfirmBriefSearch and handleRetry.
 *
 * @param text The text to identify
 * @param options.skipUserMessage Skip adding user message (used when already added with different display text)
 * @param options.skipLastActionUpdate Skip updating lastAction (used when already updated)
 */
async function executeTextIdentification(
  text: string,
  options: { skipUserMessage?: boolean; skipLastActionUpdate?: boolean } = {}
): Promise<void> {
  // Add user message (if not already added by brief input check)
  if (!options.skipUserMessage) {
    const messages = conversation.getMessages();
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || lastUserMessage.data.category !== 'text' || (lastUserMessage.data as any).content !== text) {
      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );
    }
  }

  // Track last action for retry
  if (!options.skipLastActionUpdate) {
    lastAction = { type: 'text', text };
  }

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('text');

  // Add "thinking" message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.thinking'))
  );

  try {
    // Call API with streaming callbacks
    const result = await api.identifyTextStream(
      text,
      // onField callback - update streaming fields as they arrive
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      }
    );

    // Convert AgentParsedWine (null) to WineIdentificationResult (undefined)
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);

    // Store the result
    identification.setResult(wineResult, result.confidence);

    // Handle the result (shows appropriate message and chips based on quality)
    handleIdentificationResultFlow(wineResult, result.confidence ?? 1);

  } catch (error) {
    handleIdentificationError(error);
  }
}

async function handleImageSubmit(data: string, mimeType: string): Promise<void> {
  // Extract base64 from data URL (data:image/xxx;base64,<base64>) for API calls
  // Keep full data URL for display purposes
  const base64Data = data.includes(',') ? data.split(',')[1] : data;

  // Store base64 data for retry and supplementary text
  identification.setLastImageData(base64Data, mimeType);
  lastAction = { type: 'image', data: base64Data, mimeType };

  // Add user image message (use full data URL for display)
  conversation.addMessage({
    category: 'image',
    role: 'user',
    data: { category: 'image', src: data, mimeType },
  });

  // Execute the image identification with base64 data
  await executeImageIdentification(base64Data, mimeType);
}

/**
 * Execute the actual image identification API call.
 * Separated for reuse by handleRetry and augmentation flow.
 */
async function executeImageIdentification(
  data: string,
  mimeType: string,
  supplementaryText?: string
): Promise<void> {
  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('image');

  // Add "analyzing" message for image (different from text "thinking")
  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.analyzing'))
  );

  try {
    // Call API with streaming callbacks
    const result = await api.identifyImageStream(
      data,
      mimeType,
      supplementaryText,
      // onField callback - update streaming fields as they arrive
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      }
    );

    // Convert AgentParsedWine (null) to WineIdentificationResult (undefined)
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);

    // Store the result
    identification.setResult(wineResult, result.confidence);

    // Handle the result (shows appropriate message and chips based on quality)
    handleIdentificationResultFlow(wineResult, result.confidence ?? 1);

  } catch (error) {
    handleIdentificationError(error);
  }
}

// ===========================================
// Navigation Handlers
// ===========================================

function handleStartOver(): void {
  // Disable all chips
  conversation.disableAllChips();

  // Clear identification
  identification.clearIdentification();

  // Clear enrichment
  enrichment.clearEnrichment();

  // Cancel add flow if active
  addWine.cancelAddFlow();

  // Reset conversation
  conversation.resetConversation();
}

function handleGoBack(): void {
  const phase = conversation.agentPhase;
  // TODO: Implement go back logic based on current phase
  conversation.setPhase('awaiting_input');
}

function handleCancel(): void {
  // Close panel - this will be handled by the UI layer
  // Just reset to awaiting input
  conversation.setPhase('awaiting_input');
}

async function handleRetry(): Promise<void> {
  if (!lastAction) {
    conversation.addMessage(
      conversation.createTextMessage("Nothing to retry. Please start a new search.")
    );
    return;
  }

  // Re-execute based on last action type
  if (lastAction.type === 'text' && lastAction.text) {
    await executeTextIdentification(lastAction.text);
  } else if (lastAction.type === 'image' && lastAction.data && lastAction.mimeType) {
    // Use executeImageIdentification directly to avoid duplicate user message
    await executeImageIdentification(lastAction.data, lastAction.mimeType);
  }
}

// ===========================================
// Confirmation Handlers
// ===========================================

async function handleCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get the result and analyze completeness
  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.noResult'))
    );
    return;
  }

  const confidence = result.confidence ?? 1;
  const quality = analyzeResultQuality(result, confidence);
  const wineName = [result.producer, result.wineName].filter(Boolean).join(' ');

  // If result is incomplete, ask for missing details before proceeding
  if (!quality.isComplete) {
    // Build appropriate prompt message based on what's missing
    let promptMessage: string;

    if (quality.missingWineName && quality.hasGrapes && quality.primaryGrape) {
      promptMessage = messageTemplates.identification.incompleteWithGrapes(
        result.producer,
        quality.primaryGrape
      );
    } else if (quality.missingWineName && quality.hasProducer) {
      promptMessage = messageTemplates.identification.incompleteWithProducer(
        result.producer!
      );
    } else if (quality.missingProducer && !quality.missingWineName) {
      // We have wine name but no producer
      promptMessage = messageTemplates.identification.missingProducerPrompt(
        result.wineName!
      );
    } else if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
      // We have producer and wine name but no vintage
      promptMessage = messageTemplates.identification.missingVintagePrompt(wineName);
    } else if (quality.isLowConfidence && wineName) {
      promptMessage = messageTemplates.identification.lowConfidencePrompt(wineName, confidence);
    } else {
      promptMessage = getMessage('identification.incomplete');
    }

    conversation.addMessage(
      conversation.createTextMessage(promptMessage)
    );

    // Build and show chips for fixing incomplete result
    const chips = buildIncompleteResultChips(quality);
    conversation.addMessage(
      conversation.createChipsMessage(chips)
    );

    // Set phase to awaiting_input so user can type vintage/details directly
    conversation.setPhase('awaiting_input');
    return;
  }

  // Result is complete - show action chips
  conversation.addMessage(
    conversation.createTextMessage(`Excellent. What would you like to do with ${wn(wineName)}?`)
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'add', label: getMessage('chips.addToCellar'), action: 'add_to_cellar', variant: 'primary' },
      { id: 'learn', label: getMessage('chips.learnMore'), action: 'learn' },
      { id: 'remember', label: getMessage('chips.remember'), action: 'remember' },
    ])
  );

  // Stay in confirming phase but with action chips now
  conversation.setPhase('confirming');
}

async function handleNotCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get current result for augmentation context
  const result = identification.getResult();
  const imageData = identification.getCurrentState().lastImageData;

  // Set augmentation context (preserve original data for re-identification)
  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
    imageData: imageData?.data,
    imageMimeType: imageData?.mimeType,
  });

  // Add message asking for clarification
  conversation.addMessage(
    conversation.createTextMessage(getMessage('confirm.incorrect'))
  );

  // Add chips for user options
  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'provide_more', label: 'Add Details', action: 'provide_more' },
      { id: 'try_opus', label: 'Try Harder', action: 'try_opus' },
      { id: 'start_fresh', label: 'Start Over', action: 'start_fresh' },
    ])
  );

  // Set phase to awaiting_input so user can type directly
  conversation.setPhase('awaiting_input');
}

async function handleConfirmDirection(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Continue with current direction
}

async function handleWrongDirection(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Allow user to correct direction
}

async function handleConfirmNewSearch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const pendingText = identification.getCurrentState().pendingNewSearch;
  if (pendingText) {
    identification.setPendingNewSearch(null);
    identification.clearIdentification();
    await handleTextSubmit(pendingText);
  }
}

function handleContinueCurrent(messageId: string): void {
  conversation.disableMessage(messageId);
  identification.setPendingNewSearch(null);
  conversation.setPhase('confirming');
}

async function handleConfirmBriefSearch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Retrieve and clear pending brief search
  const searchText = pendingBriefSearch;
  pendingBriefSearch = null;

  if (searchText) {
    await executeTextIdentification(searchText);
  } else {
    // Fallback - shouldn't happen normally
    conversation.addMessage(
      conversation.createTextMessage("I'm not sure what you wanted to search. Please try again.")
    );
    conversation.setPhase('awaiting_input');
  }
}

function handleAddMoreDetail(messageId: string): void {
  conversation.disableMessage(messageId);
  conversation.setPhase('awaiting_input');
}

async function handleConfirmCacheMatch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get the last enrichment action params
  if (!lastEnrichmentAction) {
    const result = identification.getResult();
    if (!result || !result.producer || !result.wineName) {
      conversation.addMessage(
        conversation.createTextMessage(getMessage('errors.noResult'))
      );
      return;
    }

    lastEnrichmentAction = {
      producer: result.producer,
      wineName: result.wineName,
      vintage: result.vintage !== undefined ? String(result.vintage) : null,
      type: result.type || null,
      region: result.region || null,
    };
  }

  // Restart enrichment with confirmMatch = true
  enrichment.startEnrichment({
    producer: lastEnrichmentAction.producer,
    wineName: lastEnrichmentAction.wineName,
    vintage: lastEnrichmentAction.vintage ?? undefined,
    region: lastEnrichmentAction.region ?? undefined,
  });

  conversation.setPhase('enriching');

  conversation.addMessage(
    conversation.createTextMessage('Using cached data...')
  );

  await executeEnrichment(
    lastEnrichmentAction.producer,
    lastEnrichmentAction.wineName,
    lastEnrichmentAction.vintage ?? null,
    lastEnrichmentAction.type ?? null,
    lastEnrichmentAction.region ?? null,
    true,  // confirmMatch - user confirmed the cache match
    false  // forceRefresh
  );
}

async function handleForceRefresh(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get the last enrichment action params
  if (!lastEnrichmentAction) {
    const result = identification.getResult();
    if (!result || !result.producer || !result.wineName) {
      conversation.addMessage(
        conversation.createTextMessage(getMessage('errors.noResult'))
      );
      return;
    }

    lastEnrichmentAction = {
      producer: result.producer,
      wineName: result.wineName,
      vintage: result.vintage !== undefined ? String(result.vintage) : null,
      type: result.type || null,
      region: result.region || null,
    };
  }

  // Restart enrichment with forceRefresh = true
  enrichment.startEnrichment({
    producer: lastEnrichmentAction.producer,
    wineName: lastEnrichmentAction.wineName,
    vintage: lastEnrichmentAction.vintage ?? undefined,
    region: lastEnrichmentAction.region ?? undefined,
  });

  conversation.setPhase('enriching');

  conversation.addMessage(
    conversation.createTextMessage('Searching for fresh data...')
  );

  await executeEnrichment(
    lastEnrichmentAction.producer,
    lastEnrichmentAction.wineName,
    lastEnrichmentAction.vintage ?? null,
    lastEnrichmentAction.type ?? null,
    lastEnrichmentAction.region ?? null,
    false, // confirmMatch
    true   // forceRefresh - skip cache entirely
  );
}

// ===========================================
// Identification Handlers
// ===========================================

async function handleIdentify(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  conversation.setPhase('awaiting_input');
}

async function handleTryOpus(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Start escalation to tier 3 (Opus)
  identification.startEscalation(3);
  conversation.setPhase('identifying');

  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.escalating'))
  );

  try {
    const currentResult = identification.getResult();
    const imageData = identification.getCurrentState().lastImageData;
    const augContext = identification.getAugmentationContext();

    let result;

    // Build prior result for Opus API
    const priorResult = {
      intent: 'add' as const,
      parsed: (currentResult ?? {}) as AgentParsedWine,
      confidence: currentResult?.confidence ?? 0,
      action: 'suggest' as const,
      candidates: [],
    };

    if (imageData?.data) {
      // Image-based identification
      result = await api.identifyWithOpus(
        imageData.data,
        'image',
        priorResult,
        imageData.mimeType
      );
    } else if (lastAction?.text) {
      // Text-based identification
      result = await api.identifyWithOpus(
        lastAction.text,
        'text',
        priorResult
      );
    } else if (augContext?.originalInput) {
      // Fallback to original input from augmentation context
      result = await api.identifyWithOpus(
        augContext.originalInput,
        'text',
        priorResult
      );
    } else {
      throw new Error('No input available for Opus identification');
    }

    // Convert result and store it
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
    identification.setResult(wineResult, result.confidence);
    identification.completeEscalation();

    // Build the wine name for display
    const wineName = [wineResult.producer, wineResult.wineName]
      .filter(Boolean)
      .join(' ');

    // Add wine result message (only if we have something to show)
    if (wineName || wineResult.grapes?.length) {
      conversation.addMessage({
        category: 'wine_result',
        role: 'agent',
        data: {
          category: 'wine_result',
          result: wineResult,
          confidence: result.confidence,
        },
      });
    }

    // Add found message based on what was identified
    let foundMessage: string;
    if (wineName) {
      foundMessage = messageTemplates.identification.foundWithConfidence(
        wineName,
        result.confidence ?? 1
      );
    } else if (wineResult.grapes?.length) {
      foundMessage = `I detected ${wn(wineResult.grapes[0])} as the grape variety, but couldn't identify the wine or producer.`;
    } else {
      foundMessage = getMessage('identification.notFound');
    }
    conversation.addMessage(
      conversation.createTextMessage(foundMessage)
    );

    // Add confirmation chips
    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'correct', label: getMessage('chips.correct'), action: 'correct' },
        { id: 'not_correct', label: getMessage('chips.notCorrect'), action: 'not_correct' },
      ])
    );

    conversation.setPhase('confirming');

  } catch (error) {
    identification.completeEscalation();
    handleIdentificationError(error);
  }
}

function handleSeeResult(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result) {
    // Show the result with confirmation chips
    conversation.addMessage({
      category: 'wine_result',
      role: 'agent',
      data: { category: 'wine_result', result },
    });

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'correct', label: 'Correct', action: 'correct' },
        { id: 'not_correct', label: 'Not Correct', action: 'not_correct' },
      ])
    );

    conversation.setPhase('confirming');
  }
}

function handleSeePartialResult(messageId: string): void {
  conversation.disableMessage(messageId);
  // TODO: Show partial result with missing fields
}

async function handleUseConversation(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Use conversation history for identification
}

function handleAddMissingDetails(messageId: string): void {
  conversation.disableMessage(messageId);

  // Check what's missing and prompt accordingly
  const result = identification.getResult();
  const quality = result ? analyzeResultQuality(result, result.confidence ?? 1) : null;

  let prompt: string;
  if (quality?.missingProducer && !quality.missingWineName) {
    prompt = "Who makes this wine? Enter the producer or winery name.";
  } else if (quality?.missingVintage && !quality.missingWineName && !quality.missingProducer) {
    prompt = "What year is this wine? Enter the vintage (e.g., 2019) or type 'NV' for non-vintage.";
  } else if (quality?.missingWineName) {
    prompt = "What's the name of this wine? You can also include the vintage.";
  } else {
    prompt = "What details would you like to add or correct?";
  }

  conversation.addMessage(
    conversation.createTextMessage(prompt)
  );

  conversation.setPhase('awaiting_input');
}

async function handleUseProducerName(messageId: string, name?: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result) {
    // Use producer name as wine name (for wines without specific names)
    const producerName = name || result.producer;
    const updatedResult = {
      ...result,
      wineName: producerName,
    };
    const confidence = result.confidence ?? 1;
    identification.setResult(updatedResult, confidence);

    // Check if more fields needed, or show action chips if complete
    handleMissingFieldProvided(updatedResult, confidence);
  }
}

async function handleUseGrapeAsName(messageId: string, name?: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result) {
    // Use grape variety as wine name (for varietal wines like "Chardonnay")
    const grapeName = name || (result.grapes && result.grapes.length > 0 ? result.grapes[0] : undefined);
    if (grapeName) {
      const updatedResult = {
        ...result,
        wineName: grapeName,
      };
      const confidence = result.confidence ?? 1;
      identification.setResult(updatedResult, confidence);

      // Check if more fields needed, or show action chips if complete
      handleMissingFieldProvided(updatedResult, confidence);
    }
  }
}

async function handleNvVintage(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result) {
    // Set vintage to Non-Vintage (for Champagne, Port, etc.)
    const updatedResult = {
      ...result,
      vintage: 'NV' as const,
    };
    const confidence = result.confidence ?? 1;
    identification.setResult(updatedResult, confidence);

    // Check if more fields needed, or show action chips if complete
    handleMissingFieldProvided(updatedResult, confidence);
  }
}

function handleProvideMore(messageId: string): void {
  conversation.disableMessage(messageId);

  // Get current result for augmentation context (so re-search uses original context)
  const result = identification.getResult();
  const imageData = identification.getCurrentState().lastImageData;

  // Set augmentation context (preserve original data for re-identification)
  // This ensures user's input triggers a re-search rather than being taken literally
  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
    imageData: imageData?.data,
    imageMimeType: imageData?.mimeType,
  });

  conversation.addMessage(
    conversation.createTextMessage(
      "Tell me what's different about this wine, and I'll try again. The producer, country, region, or grape variety would help."
    )
  );

  conversation.setPhase('awaiting_input');
}

function handleNewInput(messageId: string): void {
  conversation.disableMessage(messageId);
  identification.clearIdentification();
  conversation.setPhase('awaiting_input');
}

function handleStartFresh(messageId: string): void {
  conversation.disableMessage(messageId);
  handleStartOver();
}

/**
 * Re-identify the wine using the manually-completed result data.
 * Builds a search query from producer, wine name, vintage, region, etc.
 */
async function handleReidentify(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.noResult'))
    );
    return;
  }

  // Build a comprehensive search query from the result data
  const queryParts: string[] = [];
  if (result.producer) queryParts.push(result.producer);
  if (result.wineName) queryParts.push(result.wineName);
  if (result.vintage) queryParts.push(String(result.vintage));
  if (result.region) queryParts.push(result.region);
  if (result.country) queryParts.push(result.country);
  if (result.type) queryParts.push(result.type);

  const searchQuery = queryParts.join(' ');

  if (!searchQuery.trim()) {
    conversation.addMessage(
      conversation.createTextMessage("I don't have enough information to search. Please provide more details.")
    );
    conversation.setPhase('awaiting_input');
    return;
  }

  // Clear the current result and re-identify
  identification.clearIdentification();

  conversation.addMessage(
    conversation.createTextMessage("Let me try to find a better match...")
  );

  // Trigger text-based identification with the combined query
  await handleTextSubmit(searchQuery);
}

/**
 * Continue with the manually-entered data as-is (same as confirming "Correct").
 */
function handleContinueAsIs(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.noResult'))
    );
    return;
  }

  // Show confirmation message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('confirm.correct'))
  );

  // Show action chips (same as handleCorrect for complete results)
  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'add', label: getMessage('chips.addToCellar'), action: 'add_to_cellar', variant: 'primary' },
      { id: 'learn', label: getMessage('chips.learnMore'), action: 'learn' },
      { id: 'remember', label: getMessage('chips.remember'), action: 'remember' },
    ])
  );

  conversation.setPhase('adding_wine');
}

// ===========================================
// Error Handling Helpers
// ===========================================

/**
 * Handle identification errors with user-friendly messages and retry support.
 */
function handleIdentificationError(error: unknown): void {
  let errorInfo: AgentErrorInfo;

  if (AgentError.isAgentError(error)) {
    errorInfo = {
      type: error.type,
      userMessage: error.userMessage,
      retryable: error.retryable,
      supportRef: error.supportRef ?? undefined,
    };
  } else if (error instanceof Error) {
    errorInfo = {
      type: 'server_error',
      userMessage: error.message || getMessage('errors.generic'),
      retryable: true,
    };
  } else {
    errorInfo = {
      type: 'unknown',
      userMessage: getMessage('errors.generic'),
      retryable: true,
    };
  }

  // Set error in identification store
  identification.setError(errorInfo);

  // Build error message with optional support reference
  let errorMessage = errorInfo.userMessage;
  if (errorInfo.supportRef) {
    errorMessage = messageTemplates.errors.withReference(
      errorInfo.userMessage,
      errorInfo.supportRef
    );
  }

  // Add error message to conversation
  conversation.addMessage({
    category: 'error',
    role: 'agent',
    data: {
      category: 'error',
      error: errorInfo,
      retryable: errorInfo.retryable,
    },
  });

  // Add retry/start-over chips based on retryability
  const chips = errorInfo.retryable
    ? [
        { id: 'retry', label: getMessage('chips.tryAgain'), action: 'try_again' },
        { id: 'start_over', label: getMessage('chips.startOver'), action: 'start_over' },
      ]
    : [
        { id: 'start_over', label: getMessage('chips.startOver'), action: 'start_over' },
      ];

  conversation.addMessage(
    conversation.createChipsMessage(chips)
  );

  conversation.setPhase('error');
}

// ===========================================
// Wine Flow Handlers
// ===========================================

async function handleAddToCellar(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.noResult'))
    );
    return;
  }

  // Start add flow
  addWine.startAddFlow(result);
  conversation.setPhase('adding_wine', 'confirm');

  conversation.addMessage(
    conversation.createTextMessage(getMessage('addFlow.start'))
  );

  // Check for duplicates first (existing wine with same producer + name + vintage)
  try {
    const duplicateResult = await api.checkDuplicate({
      type: 'wine',
      name: result.wineName || '',
      producerName: result.producer || '',
      year: typeof result.vintage === 'number' ? String(result.vintage) : result.vintage,
    });

    if (duplicateResult.existingWineId && duplicateResult.existingBottles > 0) {
      // Found existing wine - offer to add bottle or create new
      addWine.setExistingWine(
        duplicateResult.existingWineId,
        duplicateResult.existingBottles
      );

      const wineName = result.wineName || result.producer || 'Unknown';
      const producer = result.producer || '';
      const displayName = producer && result.wineName
        ? `${wn(result.wineName)} by ${wn(producer)}`
        : wn(wineName);

      conversation.addMessage(
        conversation.createTextMessage(
          `I found ${displayName} already in your cellar with ${duplicateResult.existingBottles} bottle${duplicateResult.existingBottles > 1 ? 's' : ''}.`
        )
      );

      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'add_bottle', label: 'Add Another Bottle', action: 'add_bottle_existing', variant: 'primary' },
          { id: 'create_new', label: 'Create New Wine', action: 'create_new_wine' },
        ])
      );
      return;
    }
  } catch (error) {
    console.warn('Duplicate check failed, continuing with add flow:', error);
  }

  // No duplicate - start entity matching
  await startEntityMatching();
}

// ===========================================
// Entity Matching Flow
// ===========================================

/**
 * Start the entity matching flow from region.
 */
async function startEntityMatching(): Promise<void> {
  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  conversation.setPhase('adding_wine', 'entity_matching');

  // Start with region matching
  await matchEntity('region');
}

/**
 * Match a specific entity type against the database.
 */
async function matchEntity(entityType: EntityType): Promise<void> {
  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  const result = flow.wineResult;
  let searchTerm = '';
  let entityName = '';

  switch (entityType) {
    case 'region':
      searchTerm = result.region || result.country || '';
      entityName = searchTerm || 'Unknown Region';
      break;
    case 'producer':
      searchTerm = result.producer || '';
      entityName = searchTerm || 'Unknown Producer';
      break;
    case 'wine':
      // For wine, we just move to bottle form (wine will be created)
      await showBottleForm();
      return;
  }

  // If no search term, auto-create new entity
  if (!searchTerm) {
    await addMessageWithDelay(
      conversation.createTextMessage(`I'll create a new ${entityType} entry.`)
    );
    addWine.createNewEntity(entityType, entityName);
    await advanceEntityMatching(entityType);
    return;
  }

  try {
    const duplicateResult = await api.checkDuplicate({
      type: entityType,
      name: searchTerm,
      // Include region context for producer matching
      ...(entityType === 'producer' && flow.selectedEntities.region
        ? { regionId: flow.selectedEntities.region.id }
        : {}),
    });

    // Combine exact and similar matches
    const matches = [
      ...(duplicateResult.exactMatch ? [duplicateResult.exactMatch] : []),
      ...(duplicateResult.similarMatches || []),
    ];

    if (matches.length === 0) {
      // No matches - auto-create new entity
      addWine.createNewEntity(entityType, searchTerm);
      await addMessageWithDelay(
        conversation.createTextMessage(
          `No existing ${entityType}s match "${searchTerm}". I'll create a new entry.`
        )
      );
      await advanceEntityMatching(entityType);
    } else if (matches.length === 1 && duplicateResult.exactMatch) {
      // Single exact match - auto-select
      const match = matches[0];
      addWine.selectMatch(entityType, { id: match.id, name: match.name });
      await addMessageWithDelay(
        conversation.createTextMessage(`Found existing ${entityType}: ${wn(match.name)}`)
      );
      await advanceEntityMatching(entityType);
    } else {
      // Multiple matches or non-exact - show selection
      addWine.setEntityMatches(
        entityType,
        matches.map((m) => ({ id: m.id, name: m.name }))
      );

      await addMessageWithDelay(
        conversation.createTextMessage(
          `I found ${matches.length} ${entityType}${matches.length > 1 ? 's' : ''} that might match "${searchTerm}".`
        )
      );

      // Show as form message with match selection
      conversation.addMessage({
        category: 'form',
        role: 'agent',
        data: {
          category: 'form',
          formType: 'match_selection',
          formData: {
            entityType,
            matches: matches.map((m) => ({
              id: m.id,
              name: m.name,
              meta: m.meta,
            })),
            createNewLabel: `Add new ${entityType}`,
          },
        },
      });
    }
  } catch (error) {
    console.error(`Error matching ${entityType}:`, error);
    // On error, auto-create new entity
    addWine.createNewEntity(entityType, searchTerm);
    await addMessageWithDelay(
      conversation.createTextMessage(`I'll create a new ${entityType} entry.`)
    );
    await advanceEntityMatching(entityType);
  }
}

/**
 * Advance to the next entity in the matching flow.
 */
async function advanceEntityMatching(completedType: EntityType): Promise<void> {
  switch (completedType) {
    case 'region':
      await matchEntity('producer');
      break;
    case 'producer':
      await matchEntity('wine');
      break;
    case 'wine':
      await showBottleForm();
      break;
  }
}

/**
 * Show the bottle details form.
 */
async function showBottleForm(): Promise<void> {
  conversation.setPhase('adding_wine', 'bottle_details');

  await addMessageWithDelay(
    conversation.createTextMessage("Great! Now let's add the bottle details.")
  );

  // Show bottle form (no delay - form follows text immediately)
  conversation.addMessage({
    category: 'form',
    role: 'agent',
    data: {
      category: 'form',
      formType: 'bottle_details',
      formData: {
        step: 1,
      },
    },
  });
}

/**
 * Build the AddWinePayload from the current flow state.
 */
function buildAddWinePayload(flow: AddWineFlowState): AddWinePayload {
  const { wineResult, selectedEntities, newEntities, bottleFormData } = flow;

  const isCreateRegion = !selectedEntities.region && !!newEntities.region;
  const isCreateProducer = !selectedEntities.producer && !!newEntities.producer;
  const isCreateWine = !selectedEntities.wine;

  // Handle vintage - could be number or string like "NV"
  let wineYear = '';
  let isNonVintage = false;
  if (wineResult.vintage) {
    if (wineResult.vintage === 'NV' || wineResult.vintage === 'nv') {
      isNonVintage = true;
      wineYear = '';
    } else {
      wineYear = String(wineResult.vintage);
    }
  }

  return {
    // Region - mutual exclusivity pattern
    findRegion: !isCreateRegion && selectedEntities.region
      ? selectedEntities.region.name
      : '',
    regionName: isCreateRegion ? (newEntities.region || '') : '',
    regionCountry: isCreateRegion ? (wineResult.country || '') : '',
    regionDescription: '',
    regionClimate: '',
    regionSoil: '',
    regionMap: '',

    // Producer
    findProducer: !isCreateProducer && selectedEntities.producer
      ? selectedEntities.producer.name
      : '',
    producerName: isCreateProducer
      ? (newEntities.producer || wineResult.producer || '')
      : '',
    producerTown: '',
    producerFounded: '',
    producerOwnership: '',
    producerDescription: '',

    // Wine
    findWine: !isCreateWine && selectedEntities.wine
      ? selectedEntities.wine.name
      : '',
    wineName: isCreateWine ? (wineResult.wineName || '') : '',
    wineYear,
    isNonVintage,
    wineType: wineResult.type || 'Red',
    appellation: wineResult.appellation || '',
    wineDescription: '',
    wineTasting: '',
    winePairing: '',
    winePicture: 'images/wines/placeBottle.png',

    // Bottle
    bottleType: bottleFormData.size || '750ml',
    storageLocation: bottleFormData.location || '',
    bottleSource: bottleFormData.source || '',
    bottlePrice: bottleFormData.price !== undefined ? String(bottleFormData.price) : '',
    bottleCurrency: bottleFormData.currency || '',
    bottlePurchaseDate: bottleFormData.purchaseDate || '',
  };
}

/**
 * Submit the wine to the API.
 */
async function submitWine(): Promise<void> {
  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  // Check if adding bottle to existing wine
  if (flow.existingWineId) {
    await submitAddBottleToExisting(flow.existingWineId);
    return;
  }

  addWine.startSubmission();
  conversation.addMessage(
    conversation.createTextMessage('Adding to your cellar...')
  );

  try {
    // Build and submit payload
    const payload = buildAddWinePayload(flow);
    const result = await api.addWine(payload);

    // Success
    addWine.completeSubmission(result.wineID);
    conversation.setPhase('complete');

    const wineName = flow.wineResult.wineName || 'Wine';
    conversation.addMessage(
      conversation.createTextMessage(
        messageTemplates.addFlow.addComplete(wineName)
      )
    );

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'identify_another', label: 'Identify Another', action: 'start_over' },
      ])
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add wine';
    addWine.setSubmissionError({
      type: 'server_error',
      userMessage: errorMessage,
      retryable: true,
    });

    conversation.addMessage(
      conversation.createTextMessage(getMessage('addFlow.addFailed'))
    );

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'retry', label: 'Try Again', action: 'retry_add' },
        { id: 'cancel', label: 'Cancel', action: 'start_over' },
      ])
    );
  }
}

/**
 * Submit a bottle to an existing wine (duplicate flow).
 */
async function submitAddBottleToExisting(existingWineId: number): Promise<void> {
  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  addWine.startSubmission();
  conversation.addMessage(
    conversation.createTextMessage('Adding bottle to your cellar...')
  );

  try {
    const bottlePayload = {
      wineID: existingWineId,
      bottleSize: flow.bottleFormData.size || '750ml',
      bottleLocation: flow.bottleFormData.location,
      bottleSource: flow.bottleFormData.source,
      bottlePrice: flow.bottleFormData.price,
      bottleCurrency: flow.bottleFormData.currency,
      purchaseDate: flow.bottleFormData.purchaseDate,
    };

    await api.addBottle(bottlePayload);

    // Success
    addWine.completeSubmission(existingWineId);
    conversation.setPhase('complete');

    const wineName = flow.wineResult.wineName || flow.wineResult.producer || 'the wine';
    conversation.addMessage(
      conversation.createTextMessage(`Added another bottle of ${wn(wineName)} to your cellar!`)
    );

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'identify_another', label: 'Identify Another', action: 'start_over' },
      ])
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add bottle';
    addWine.setSubmissionError({
      type: 'server_error',
      userMessage: errorMessage,
      retryable: true,
    });

    conversation.addMessage(
      conversation.createTextMessage('Something went wrong adding the bottle.')
    );

    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'retry', label: 'Try Again', action: 'retry_add' },
        { id: 'cancel', label: 'Cancel', action: 'start_over' },
      ])
    );
  }
}

async function handleLearnMore(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result || !result.producer || !result.wineName) {
    conversation.addMessage(
      conversation.createTextMessage(getMessage('errors.noResult'))
    );
    return;
  }

  // Start enrichment in store
  enrichment.startEnrichment({
    producer: result.producer,
    wineName: result.wineName,
    vintage: result.vintage,
    region: result.region,
    country: result.country,
  });

  // Track for retry support
  lastEnrichmentAction = {
    producer: result.producer,
    wineName: result.wineName,
    vintage: result.vintage !== undefined ? String(result.vintage) : null,
    type: result.type || null,
    region: result.region || null,
  };

  conversation.setPhase('enriching');

  // Add loading message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('enrichment.loading'))
  );

  await executeEnrichment(
    result.producer,
    result.wineName,
    result.vintage !== undefined ? String(result.vintage) : null,
    result.type || null,
    result.region || null,
    false, // confirmMatch
    false  // forceRefresh
  );
}

/**
 * Execute the enrichment API call with streaming.
 * Separated for reuse by cache confirmation and force refresh handlers.
 */
async function executeEnrichment(
  producer: string,
  wineName: string,
  vintage: string | null,
  wineType: string | null,
  region: string | null,
  confirmMatch: boolean,
  forceRefresh: boolean
): Promise<void> {
  try {
    // Call streaming enrichment API
    const enrichmentResult = await api.enrichWineStream(
      producer,
      wineName,
      vintage,
      wineType,
      region,
      confirmMatch,
      forceRefresh,
      // onField callback - update streaming fields as they arrive
      (field, value) => {
        enrichment.updateEnrichmentStreamingField(field, String(value), true);
      }
    );

    // Handle pending confirmation (cache match that needs user approval)
    if (enrichmentResult.pendingConfirmation && enrichmentResult.matchedTo) {
      handleCacheConfirmationRequired(enrichmentResult);
      return;
    }

    // Map API data to local type
    const enrichmentData = mapAgentEnrichmentToLocal(enrichmentResult.data);

    // Store the enrichment data in the store
    enrichment.setEnrichmentData(enrichmentData, enrichmentResult.source);

    // Add enrichment result message (the card will be rendered by EnrichmentMessage)
    conversation.addMessage({
      category: 'enrichment',
      role: 'agent',
      data: {
        category: 'enrichment',
        data: enrichmentData,
      },
    });

    // Build wine name for display
    const displayName = [producer, wineName].filter(Boolean).join(' ');

    // Add completion message
    conversation.addMessage(
      conversation.createTextMessage(
        `Here's what I found about ${displayName}. What would you like to do next?`
      )
    );

    // Add action chips
    conversation.addMessage(
      conversation.createChipsMessage([
        { id: 'add', label: getMessage('chips.addToCellar'), action: 'add_to_cellar', variant: 'primary' },
        { id: 'remember', label: getMessage('chips.remember'), action: 'remember' },
        { id: 'identify_another', label: 'New Search', action: 'start_over' },
      ])
    );

    conversation.setPhase('confirming');

  } catch (error) {
    handleEnrichmentError(error);
  }
}

/**
 * Handle cache confirmation required response from enrichment API.
 */
function handleCacheConfirmationRequired(enrichmentResult: {
  matchType?: string;
  searchedFor?: { producer: string | null; wineName: string | null; vintage: string | null };
  matchedTo?: { producer: string | null; wineName: string | null; vintage: string | null };
  confidence?: number;
}): void {
  const matchedTo = enrichmentResult.matchedTo;
  const matchedName = matchedTo
    ? [matchedTo.producer, matchedTo.wineName, matchedTo.vintage].filter(Boolean).join(' ')
    : 'a similar wine';

  conversation.addMessage(
    conversation.createTextMessage(
      `I found cached data for ${wn(matchedName)}. Is this the wine you're looking for?`
    )
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'confirm_cache', label: 'Yes, use cached data', action: 'confirm_cache_match' },
      { id: 'force_refresh', label: 'No, search online', action: 'force_refresh' },
    ])
  );

  // Stay in enriching phase but waiting for user decision
  conversation.setPhase('confirming');
}

/**
 * Map AgentEnrichmentData from API to local EnrichmentData type.
 */
function mapAgentEnrichmentToLocal(data: AgentEnrichmentData | null): import('./types').EnrichmentData {
  if (!data) {
    return {};
  }

  // Build drinkWindow with required non-null types
  let drinkWindow: { start: number; end: number; peak?: number } | undefined;
  if (data.drinkWindow && data.drinkWindow.start !== null && data.drinkWindow.end !== null) {
    drinkWindow = {
      start: data.drinkWindow.start,
      end: data.drinkWindow.end,
    };
  }

  return {
    overview: data.overview ?? undefined,
    grapeComposition: data.grapeVarieties?.map(g => ({
      grape: g.grape,
      percentage: g.percentage ?? undefined,
    })),
    styleProfile: {
      ...(data.body ? { body: data.body } : {}),
      ...(data.tannin ? { tannin: data.tannin } : {}),
      ...(data.acidity ? { acidity: data.acidity } : {}),
      ...(data.sweetness ? { sweetness: data.sweetness } : {}),
    },
    tastingNotes: data.tastingNotes ? {
      // Parse tasting notes string back to structured format if possible
      palate: [data.tastingNotes],
    } : undefined,
    criticScores: data.criticScores?.map(c => ({
      critic: c.critic,
      score: c.score,
      vintage: c.year, // API uses 'year' not 'vintage'
    })),
    drinkWindow,
    foodPairings: data.pairingNotes ? data.pairingNotes.split(', ') : undefined,
  };
}

/**
 * Handle enrichment errors with user-friendly messages and retry support.
 */
function handleEnrichmentError(error: unknown): void {
  let errorInfo: AgentErrorInfo;

  if (AgentError.isAgentError(error)) {
    errorInfo = {
      type: error.type,
      userMessage: error.userMessage,
      retryable: error.retryable,
      supportRef: error.supportRef ?? undefined,
    };
  } else if (error instanceof Error) {
    errorInfo = {
      type: 'enrichment_error',
      userMessage: error.message || 'Failed to get wine details',
      retryable: true,
    };
  } else {
    errorInfo = {
      type: 'enrichment_error',
      userMessage: 'Failed to get wine details. Please try again.',
      retryable: true,
    };
  }

  // Set error in enrichment store
  enrichment.setEnrichmentError(errorInfo);

  // Add error message to conversation
  conversation.addMessage({
    category: 'error',
    role: 'agent',
    data: {
      category: 'error',
      error: errorInfo,
      retryable: errorInfo.retryable,
    },
  });

  // Add retry/action chips based on retryability
  const chips = errorInfo.retryable
    ? [
        { id: 'retry_learn', label: 'Try Again', action: 'learn' },
        { id: 'add_anyway', label: 'Add Without Details', action: 'add_to_cellar' },
        { id: 'start_over', label: getMessage('chips.startOver'), action: 'start_over' },
      ]
    : [
        { id: 'add_anyway', label: 'Add Without Details', action: 'add_to_cellar' },
        { id: 'start_over', label: getMessage('chips.startOver'), action: 'start_over' },
      ];

  conversation.addMessage(
    conversation.createChipsMessage(chips)
  );

  conversation.setPhase('error');
}

async function handleRemember(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get wine name for display
  const result = identification.getResult();
  const wineName = result
    ? [result.producer, result.wineName].filter(Boolean).join(' ') || 'the wine'
    : 'the wine';

  // For now, just acknowledge - this could save to a "remembered wines" list in the future
  conversation.addMessage(
    conversation.createTextMessage(
      `Memories are a function coming later. You'll have to remember ${wn(wineName)} yourself!`
      //`I'll remember ${wn(wineName)} for you! You can always search for it again later.`
    )
  );

  // Add option to identify another wine
  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'identify_another', label: 'Identify Another', action: 'start_over' },
    ])
  );

  conversation.setPhase('complete');
}

async function handleRecommend(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Implement recommendation flow
}

async function handleEnrichNow(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(true);

  // For now, submit and enrich in background (future: enrich first)
  // The enrichment will happen after the wine is added
  await submitWine();
}

async function handleAddQuickly(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(false);

  // Skip enrichment and add directly
  await submitWine();
}

// ===========================================
// Entity Matching Handlers
// ===========================================

function handleSelectMatch(entityType: EntityType, matchId: number, messageId: string): void {
  conversation.disableMessage(messageId);
  addWine.selectMatchById(entityType, matchId);

  // Get the match name for display
  const flow = addWine.getCurrentFlow();
  const match = flow?.entityMatches[entityType]?.find((m) => m.id === matchId);
  if (match) {
    conversation.addMessage(
      conversation.createTextMessage(`Selected: ${wn(match.name)}`)
    );
  }

  // Advance to next entity
  advanceEntityMatching(entityType);
}

async function handleAddNew(entityType: EntityType, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  const result = flow.wineResult;
  let name = '';
  switch (entityType) {
    case 'region':
      name = result.region || result.country || 'Unknown Region';
      break;
    case 'producer':
      name = result.producer || 'Unknown Producer';
      break;
    case 'wine':
      name = result.wineName || 'Unknown Wine';
      break;
  }

  addWine.createNewEntity(entityType, name);
  conversation.addMessage(
    conversation.createTextMessage(`Creating new ${entityType}: ${wn(name)}`)
  );

  await advanceEntityMatching(entityType);
}

async function handleClarify(entityType: EntityType, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  // Get current matches for LLM clarification
  const matches = flow.entityMatches[entityType] || [];
  if (matches.length === 0) {
    conversation.addMessage(
      conversation.createTextMessage('No matches to clarify. Creating new entry.')
    );
    await handleAddNew(entityType, messageId);
    return;
  }

  conversation.addMessage(
    conversation.createTextMessage('Let me help you decide...')
  );

  try {
    const result = await api.clarifyMatch({
      type: entityType,
      identified: {
        producer: flow.wineResult.producer || null,
        wineName: flow.wineResult.wineName || null,
        vintage: flow.wineResult.vintage !== undefined ? String(flow.wineResult.vintage) : null,
        region: flow.wineResult.region || null,
        appellation: flow.wineResult.appellation || null,
        country: flow.wineResult.country || null,
        wineType: (flow.wineResult.type as 'Red' | 'White' | 'Rosé' | 'Sparkling' | 'Dessert' | 'Fortified') || null,
        grapes: flow.wineResult.grapes || null,
        confidence: flow.wineResult.confidence ?? 1,
      },
      options: matches.map((m) => ({ id: m.id, name: m.name })),
    });

    conversation.addMessage(
      conversation.createTextMessage(result.explanation)
    );

    // Re-show the selection form
    conversation.addMessage({
      category: 'form',
      role: 'agent',
      data: {
        category: 'form',
        formType: 'match_selection',
        formData: {
          entityType,
          matches: matches.map((m) => ({ id: m.id, name: m.name })),
          createNewLabel: `Add new ${entityType}`,
        },
      },
    });
  } catch (error) {
    console.error('Clarification failed:', error);
    conversation.addMessage(
      conversation.createTextMessage(
        "I couldn't get more details. Please select from the options above or create a new entry."
      )
    );
  }
}

async function handleAddBottleExisting(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Skip entity matching, go straight to bottle form
  // Note: showBottleForm adds its own message, so we don't add one here
  await showBottleForm();
}

async function handleCreateNewWine(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.clearExistingWine();

  await addMessageWithDelay(
    conversation.createTextMessage("I'll create this as a new wine entry.")
  );

  // Continue with entity matching flow
  await startEntityMatching();
}

// ===========================================
// Form Handlers
// ===========================================

async function handleBottleSubmit(data: BottleFormData): Promise<void> {
  addWine.updateBottleFormData(data);

  // Show enrichment choice
  conversation.setPhase('adding_wine', 'enrichment');

  await addMessageWithDelay(
    conversation.createTextMessage(
      'Almost done! Would you like to add enrichment data (grape info, critic scores)?'
    )
  );

  // Chips follow text immediately (no delay)
  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'enrich', label: 'Yes, Enrich Now', action: 'enrich_now', variant: 'primary' },
      { id: 'quick', label: 'No, Add Quickly', action: 'add_quickly' },
    ])
  );
}

async function handleManualEntrySubmit(data: import('./types').ManualEntryData): Promise<void> {
  // Update wine result with manual entry data
  const flow = addWine.getCurrentFlow();
  if (!flow) return;

  // Merge manual entry data into the result
  const updatedResult: WineIdentificationResult = {
    ...flow.wineResult,
    ...(data.producer && { producer: String(data.producer) }),
    ...(data.wineName && { wineName: String(data.wineName) }),
    ...(data.vintage && { vintage: String(data.vintage) }),
    ...(data.region && { region: String(data.region) }),
    ...(data.country && { country: String(data.country) }),
    ...(data.type && { type: String(data.type) }),
  };

  // Restart add flow with updated result
  addWine.startAddFlow(updatedResult);
  await startEntityMatching();
}

async function handleManualEntryComplete(data: import('./types').ManualEntryData, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  await handleManualEntrySubmit(data);
}

function handleBottleNext(messageId: string, partialData?: BottleFormData): void {
  conversation.disableMessage(messageId);

  // Store partial data from Part 1 if provided
  if (partialData) {
    addWine.updateBottleFormData(partialData);
  }

  addWine.setBottleFormStep(2);

  // Show step 2 of bottle form with Part 1 data preserved
  conversation.addMessage({
    category: 'form',
    role: 'agent',
    data: {
      category: 'form',
      formType: 'bottle_details',
      formData: {
        step: 2,
        part: 2,
        ...addWine.getBottleFormData(),
      },
    },
  });
}

async function handleBottleSubmitFinal(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get current bottle form data and submit
  const bottleData = addWine.getBottleFormData();
  await handleBottleSubmit(bottleData);
}

async function handleRetryAdd(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Retry the submission
  await submitWine();
}

// ===========================================
// Camera Handlers
// ===========================================

function handleTakePhoto(messageId: string): void {
  conversation.disableMessage(messageId);
  // Camera opening is handled by UI layer
}

function handleChoosePhoto(messageId: string): void {
  conversation.disableMessage(messageId);
  // Photo picker is handled by UI layer
}

// ===========================================
// Error Handlers
// ===========================================

function handleStartOverError(messageId: string): void {
  conversation.disableMessage(messageId);
  handleStartOver();
}

// ===========================================
// Generic Chip Handler (Fallback)
// ===========================================

async function handleGenericChipTap(payload: {
  action: string;
  messageId: string;
  data?: unknown;
}): Promise<void> {
  const { action, messageId, data } = payload;

  // Disable the chip message
  conversation.disableMessage(messageId);

  console.warn('[AgentAction] Unhandled chip action:', action, data);

  // For now, just acknowledge the action
  conversation.addMessage(
    conversation.createTextMessage(`Processing: ${action}...`)
  );
}

// ===========================================
// Export for Testing
// ===========================================

export const __test__ = {
  handleTextSubmit,
  handleImageSubmit,
  executeImageIdentification,
  handleStartOver,
  handleCorrect,
  handleNotCorrect,
};
