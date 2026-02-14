/**
 * Identification Handlers
 *
 * Handles all identification-related actions:
 * - submit_text: Text-based wine identification
 * - submit_image: Image-based wine identification
 * - try_opus: Escalate to premium model
 * - reidentify: Re-identify with accumulated result
 * - correct/not_correct: Confirmation flow
 * - Field completion actions (use_producer_name, use_grape_as_name, nv_vintage, etc.)
 * - Brief search confirmation (confirm_brief_search, add_more_detail)
 * - New search confirmation (confirm_new_search, continue_current)
 *
 * Sprint 2 extraction from handleAgentAction.ts monolith.
 */

import type { AgentAction, WineIdentificationResult, AgentErrorInfo, TextMessageData } from '../types';
import type { AgentParsedWine } from '$lib/api/types';
import { getMessageByKey, buildWineName } from '../messages';
import { MessageKey } from '../messageKeys';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import { api } from '$lib/api';
import { AgentError } from '$lib/api/types';
import {
  analyzeResultQuality,
  generateConfirmationChips,
  generateImageConfirmationChips,
  generateIncompleteChips,
  generateActionChips,
  generateErrorChips,
  generateNotCorrectChips,
  generateCorrectionConfirmationChips,
  generateNewSearchConfirmationChips,
  generateBriefSearchChips,
  detectCommand,
  detectChipResponse,
  detectFieldInput,
  detectDirectValue,
  checkBriefInput,
} from '../services';
import { ChipKey, getChip, getChips } from '../services/chipRegistry';
import { setLastAction, getLastAction } from '../middleware/retryTracker';
import {
  handleStartOver,
  handleCancel,
  handleGoBack,
  handleRetry,
} from './conversation';
import { createAbortController, wasCancelled, getRequestId } from '../requestLifecycle';

// ===========================================
// Action Types
// ===========================================

type IdentificationActionType =
  | 'submit_text'
  | 'submit_image'
  | 'try_opus'
  | 'reidentify'
  | 'correct'
  | 'not_correct'
  | 'confirm_brief_search'
  | 'add_more_detail'
  | 'confirm_new_search'
  | 'continue_current'
  | 'use_producer_name'
  | 'use_grape_as_name'
  | 'nv_vintage'
  | 'add_missing_details'
  | 'provide_more'
  | 'continue_as_is'
  | 'see_result'
  | 'identify'
  | 'correct_field'
  | 'confirm_corrections'
  | 'verify';

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
// Result Flow Helpers
// ===========================================

/**
 * Handle the identification result flow.
 * Shows appropriate message based on what was identified.
 */
function handleIdentificationResultFlow(
  wineResult: WineIdentificationResult,
  confidence: number,
  options?: { skipVerifyChip?: boolean }
): void {
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
    const normalizedConf = confidence > 1 ? confidence / 100 : confidence;
    const messageKey = normalizedConf < 0.7 ? MessageKey.ID_LOW_CONFIDENCE : MessageKey.ID_FOUND;
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(messageKey, { wineName }))
    );

    // Image identifications get a "Verify" chip for optional grounded verification
    // (skip if already auto-verified via escalation)
    const isImage = identification.getCurrentState().inputType === 'image';
    const chips = (isImage && !options?.skipVerifyChip) ? generateImageConfirmationChips() : generateConfirmationChips();
    conversation.addMessage(
      conversation.createChipsMessage(chips)
    );

    conversation.setPhase('confirming');
    return;
  }

  // Case 2: We only have grape variety - skip confirmation
  if (hasOnlyGrapes) {
    const quality = analyzeResultQuality(wineResult, confidence);

    conversation.addMessage(
      conversation.createTextMessage(
        getMessageByKey(MessageKey.ID_GRAPE_ONLY, { grape: wineResult.grapes![0] })
      )
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateIncompleteChips(quality))
    );

    conversation.setPhase('awaiting_input');
    return;
  }

  // Case 3: Nothing meaningful identified
  conversation.addMessage(
    conversation.createTextMessage(getMessageByKey(MessageKey.ID_NOT_FOUND))
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      getChip(ChipKey.SEARCH_AGAIN),
      getChip(ChipKey.START_OVER),
    ])
  );

  conversation.setPhase('awaiting_input');
}

/**
 * After user provides a missing field, check if more fields are needed.
 */
function handleMissingFieldProvided(
  updatedResult: WineIdentificationResult,
  confidence: number
): void {
  const quality = analyzeResultQuality(updatedResult, confidence);
  const wineName = [updatedResult.producer, updatedResult.wineName]
    .filter(Boolean)
    .join(' ');

  // Check if all required fields are present (regardless of confidence)
  if (quality.hasAllFields) {
    if (!quality.isLowConfidence) {
      // High confidence - go directly to action chips
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_ACTION_PROMPT, { wineName }))
      );

      conversation.addMessage(
        conversation.createChipsMessage(generateActionChips(false))
      );

      conversation.setPhase('confirming');
    } else {
      // Low confidence but all fields present - show wine card and offer to reidentify with context
      // Messages sequence automatically via isPrecedingReady in MessageWrapper
      conversation.addMessage({
        category: 'wine_result',
        role: 'agent',
        data: {
          category: 'wine_result',
          result: updatedResult,
          confidence: quality.confidence, // Use normalized confidence (0-1)
        },
      });

      conversation.addMessage(
        conversation.createTextMessage(
          getMessageByKey(MessageKey.ID_LOW_CONFIDENCE_COMPLETE, { wineName })
        )
      );

      conversation.addMessage(
        conversation.createChipsMessage(getChips(ChipKey.REIDENTIFY, ChipKey.CONTINUE_AS_IS))
      );

      conversation.setPhase('confirming');
    }
  } else {
    // Still missing fields - prompt for next one
    let promptMessage: string;

    if (quality.missingWineName && quality.hasGrapes && quality.primaryGrape) {
      promptMessage = updatedResult.producer
        ? getMessageByKey(MessageKey.ID_INCOMPLETE_GRAPES_WITH_PRODUCER, { producer: updatedResult.producer, grape: quality.primaryGrape })
        : getMessageByKey(MessageKey.ID_INCOMPLETE_GRAPES_NO_PRODUCER, { grape: quality.primaryGrape });
    } else if (quality.missingWineName && quality.hasProducer) {
      promptMessage = getMessageByKey(MessageKey.ID_MISSING_WINE_NAME, { producer: updatedResult.producer });
    } else if (quality.missingProducer && !quality.missingWineName) {
      promptMessage = getMessageByKey(MessageKey.ID_MISSING_PRODUCER, { wineName: updatedResult.wineName });
    } else if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
      promptMessage = getMessageByKey(MessageKey.ID_MISSING_VINTAGE, { wineName });
    } else {
      // Generic fallback for edge cases (shouldn't normally reach here)
      promptMessage = getMessageByKey(MessageKey.ID_INCOMPLETE);
    }

    conversation.addMessage(
      conversation.createTextMessage(promptMessage)
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateIncompleteChips(quality))
    );

    conversation.setPhase('awaiting_input');
  }
}

/**
 * Handle identification errors with user-friendly messages.
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
      userMessage: error.message || getMessageByKey(MessageKey.ERROR_GENERIC),
      retryable: true,
    };
  } else {
    errorInfo = {
      type: 'server_error',
      userMessage: getMessageByKey(MessageKey.ERROR_GENERIC),
      retryable: true,
    };
  }

  identification.setError(errorInfo);

  conversation.addMessage({
    category: 'error',
    role: 'agent',
    data: {
      category: 'error',
      error: errorInfo,
      retryable: errorInfo.retryable,
    },
  });

  conversation.addMessage(
    conversation.createChipsMessage(generateErrorChips(errorInfo.retryable ?? false))
  );

  conversation.setPhase('error');
}

// ===========================================
// Core Identification Functions
// ===========================================

/**
 * Execute text-based identification API call.
 * WIN-187: Uses AbortController for cancellation support.
 */
async function executeTextIdentification(
  text: string,
  options: { skipUserMessage?: boolean; skipLastActionUpdate?: boolean } = {}
): Promise<void> {
  // Add user message
  if (!options.skipUserMessage) {
    const messages = conversation.getMessages();
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || lastUserMessage.data.category !== 'text' || (lastUserMessage.data as TextMessageData).content !== text) {
      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );
    }
  }

  // Track last action for retry
  if (!options.skipLastActionUpdate) {
    setLastAction({ type: 'submit_text', payload: text });
  }

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('text');

  // Typing indicator participates in message queue with scroll behavior
  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_THINKING));

  // WIN-187: Create abort controller for this request
  const abortController = createAbortController();

  try {
    // Track escalated result if background refinement improves confidence
    let escalatedResult: { parsed: AgentParsedWine; confidence: number } | null = null;
    const lockedFields = identification.getLockedFields();

    const result = await api.identifyTextStream(
      text,
      (field, value) => {
        // Always update streaming fields — the streaming card in AgentPanel
        // shows progressive field arrival. Escalation field events update
        // the streaming card in-place (e.g., better producer/region).
        identification.updateStreamingField(field, String(value), true);
      },
      (event) => {
        if (event.type === 'refining') {
          // Show "Refining..." badge on the streaming card
          identification.startEscalation(2);
        } else if (event.type === 'refined' && event.data.escalated) {
          // Capture escalated result — will be used after stream completes
          escalatedResult = { parsed: event.data.parsed, confidence: event.data.confidence };
        }
        // 'result' event: handled by processSSEStream internally (sets finalResult)
        // 'refined' non-escalated: nothing to do (Tier 1 result is already best)
      },
      abortController.signal,
      getRequestId(),
      lockedFields
    );

    // WIN-187: Skip processing if cancelled during the await
    if (wasCancelled()) {
      return;
    }

    conversation.removeTypingMessage();

    // Use escalated result if refinement improved confidence, otherwise Tier 1
    // Note: TypeScript can't track that the callback above may have mutated escalatedResult,
    // so we reassign to a new const to satisfy control flow analysis.
    const esc = escalatedResult as { parsed: AgentParsedWine; confidence: number } | null;
    const finalParsed = esc ? esc.parsed : result.parsed;
    const finalConfidence = esc ? esc.confidence : result.confidence;

    const wineResult = convertParsedWineToResult(finalParsed, finalConfidence);
    applyLockedFieldsClient(wineResult, lockedFields);
    identification.setResult(wineResult, finalConfidence); // Clears streamingFields + isEscalating
    handleIdentificationResultFlow(wineResult, finalConfidence ?? 1);

  } catch (error) {
    // WIN-187: Don't show error for intentional cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    conversation.removeTypingMessage();
    handleIdentificationError(error);
  }
}

/**
 * Execute image-based identification API call.
 * WIN-187: Uses AbortController for cancellation support.
 */
async function executeImageIdentification(
  data: string,
  mimeType: string,
  supplementaryText?: string
): Promise<void> {
  conversation.setPhase('identifying');
  identification.startIdentification('image');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_ANALYZING));

  // WIN-187: Create abort controller for this request
  const abortController = createAbortController();

  try {
    // Track escalated result if background refinement improves confidence
    let escalatedResult: { parsed: AgentParsedWine; confidence: number } | null = null;
    const lockedFields = identification.getLockedFields();

    const result = await api.identifyImageStream(
      data,
      mimeType,
      supplementaryText,
      (field, value) => {
        // Always update streaming fields — the streaming card shows progressive
        // field arrival. Escalation field events update in-place.
        identification.updateStreamingField(field, String(value), true);
      },
      (event) => {
        if (event.type === 'refining') {
          // Show "Refining..." badge on the streaming card
          identification.startEscalation(2);
        } else if (event.type === 'refined' && event.data.escalated) {
          // Capture escalated result — will be used after stream completes
          escalatedResult = { parsed: event.data.parsed, confidence: event.data.confidence };
        }
      },
      abortController.signal,
      getRequestId(),
      lockedFields
    );

    // WIN-187: Skip processing if cancelled during the await
    if (wasCancelled()) {
      return;
    }

    conversation.removeTypingMessage();

    // Use escalated result if refinement improved confidence, otherwise Tier 1
    const esc = escalatedResult as { parsed: AgentParsedWine; confidence: number } | null;
    const finalParsed = esc ? esc.parsed : result.parsed;
    const finalConfidence = esc ? esc.confidence : result.confidence;

    let wineResult = convertParsedWineToResult(finalParsed, finalConfidence);
    applyLockedFieldsClient(wineResult, lockedFields);

    // Auto-verify low confidence images — the honest prompt now gives
    // meaningful scores, so we can trust < 60 means the label was hard to read.
    // Don't call setResult() yet — keep the streaming card visible with
    // the "Refining..." badge during verification.
    const AUTO_VERIFY_THRESHOLD = 60;
    if ((finalConfidence ?? 0) < AUTO_VERIFY_THRESHOLD) {
      identification.startEscalation(2);
      conversation.addTypingMessage(getMessageByKey(MessageKey.ID_VERIFYING));

      try {
        const priorResult = {
          intent: 'add' as const,
          parsed: finalParsed as AgentParsedWine,
          confidence: finalConfidence ?? 0,
          action: 'suggest' as const,
          candidates: [],
        };

        const verified = await api.verifyImage(data, mimeType, priorResult, lockedFields);

        if (wasCancelled()) return;

        conversation.removeTypingMessage();

        // Update streaming fields in-place so the card refreshes before transitioning
        const vp = verified.parsed;
        for (const [field, value] of Object.entries(vp)) {
          if (value != null && field !== 'confidence') {
            const display = Array.isArray(value) ? value.join(', ') : String(value);
            identification.updateStreamingField(field, display, false);
          }
        }
        if (verified.confidence != null) {
          identification.updateStreamingField('confidence', String(verified.confidence), false);
        }

        wineResult = convertParsedWineToResult(verified.parsed, verified.confidence);
        applyLockedFieldsClient(wineResult, lockedFields);

        // Transition streaming card → message card
        identification.setResult(wineResult, verified.confidence);
        handleIdentificationResultFlow(wineResult, verified.confidence, { skipVerifyChip: true });
        return;
      } catch (verifyError) {
        // Verification failed — show original Tier 1 result with Verify chip
        conversation.removeTypingMessage();
        identification.completeEscalation();
      }
    }

    // Normal flow (high confidence or failed verification fallback)
    identification.setResult(wineResult, finalConfidence);
    handleIdentificationResultFlow(wineResult, finalConfidence ?? 1);

  } catch (error) {
    // WIN-187: Don't show error for intentional cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    conversation.removeTypingMessage();
    handleIdentificationError(error);
  }
}

// ===========================================
// Input Handlers
// ===========================================

/**
 * Handle text submission.
 */
async function handleTextSubmit(text: string): Promise<void> {
  const currentPhase = conversation.getCurrentPhase();
  const hasAugmentation = identification.getAugmentationContext() !== null;
  const existingResult = identification.getResult();

  // 0. Field Correction Intercept — capture typed value for awaiting field
  const awaitingField = identification.getAwaitingFieldCorrection();
  if (awaitingField && existingResult) {
    const trimmed = text.trim();
    if (!trimmed) {
      identification.setAwaitingFieldCorrection(null);
      showFieldCorrectionChips(existingResult);
      return;
    }

    const updatedResult = { ...existingResult, [awaitingField]: trimmed };
    const confidence = identification.getConfidence() ?? existingResult.confidence ?? 1;
    identification.setResult(updatedResult, confidence);
    identification.lockField(awaitingField, trimmed);
    identification.setAwaitingFieldCorrection(null);

    conversation.addMessage(conversation.createTextMessage(text, { role: 'user' }));

    // Show updated card with correction applied + confirmation chips including "Look Closer"
    const wineName = [updatedResult.producer, updatedResult.wineName].filter(Boolean).join(' ');
    conversation.addMessages([
      conversation.createTextMessage(getMessageByKey(MessageKey.ID_CORRECTION_ACKNOWLEDGED)),
      { category: 'wine_result', role: 'agent', data: { category: 'wine_result', result: updatedResult, confidence } },
      conversation.createTextMessage(getMessageByKey(MessageKey.ID_FOUND, { wineName })),
      conversation.createChipsMessage(generateCorrectionConfirmationChips()),
    ]);
    conversation.setPhase('confirming');
    return;
  }

  // 1. Command Detection - dispatch to conversation handlers
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
        handleRetry();
        return;
    }
  }

  // 2. Field Input Detection (with augmentation context)
  if (existingResult && currentPhase === 'awaiting_input') {
    const fieldResult = detectFieldInput(text, existingResult);
    if (fieldResult.detected && fieldResult.updatedResult) {
      // Use stored confidence (authoritative) rather than result object property
      const confidence = identification.getConfidence() ?? existingResult.confidence ?? 1;
      identification.setResult(fieldResult.updatedResult, confidence);

      if (hasAugmentation) {
        identification.clearAugmentationContext();
      }

      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );

      handleMissingFieldProvided(fieldResult.updatedResult, confidence);
      return;
    }
  }

  // 3. Direct Value Detection (without augmentation)
  if (existingResult && currentPhase === 'awaiting_input' && !hasAugmentation) {
    // Use stored confidence (authoritative) rather than result object property
    const storedConfidence = identification.getConfidence() ?? existingResult.confidence ?? 1;
    const quality = analyzeResultQuality(existingResult, storedConfidence);

    // Determine awaiting field based on quality
    let awaitingField: 'producer' | 'wineName' | 'vintage' | null = null;
    if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
      awaitingField = 'vintage';
    } else if (quality.missingProducer && !quality.missingWineName) {
      awaitingField = 'producer';
    } else if (quality.missingWineName) {
      awaitingField = 'wineName';
    }

    const directResult = detectDirectValue(text, existingResult, awaitingField);
    if (directResult.detected && directResult.updatedResult) {
      // Use storedConfidence from above (authoritative) rather than result object property
      identification.setResult(directResult.updatedResult, storedConfidence);

      conversation.addMessage(
        conversation.createTextMessage(text, { role: 'user' })
      );

      handleMissingFieldProvided(directResult.updatedResult, storedConfidence);
      return;
    }
  }

  // 4. Chip Response Detection (confirming phase)
  if (currentPhase === 'confirming') {
    const chipResult = detectChipResponse(text);
    if (chipResult.type === 'chip_response') {
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

    // New search confirmation
    const hasResult = identification.getResult() !== null;
    if (hasResult) {
      identification.setPendingNewSearch(text);
      identification.setAwaitingFieldCorrection(null);
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_NEW_SEARCH))
      );
      conversation.addMessage(
        conversation.createChipsMessage(generateNewSearchConfirmationChips())
      );
      return;
    }
  }

  // 5. Brief Input Check
  const briefResult = checkBriefInput(text, hasAugmentation);
  if (briefResult.shouldConfirm) {
    identification.setPendingBriefSearch(text);
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );
    conversation.addMessage(
      conversation.createTextMessage(
        getMessageByKey(MessageKey.ID_BRIEF_INPUT_CONFIRM, { text })
      )
    );
    conversation.addMessage(
      conversation.createChipsMessage(generateBriefSearchChips())
    );
    return;
  }

  // 6. Execute Identification
  const augContext = identification.getAugmentationContext();

  // WIN-270: Handle brief input continuation (e.g., "rose" + "imperial" → "rose imperial")
  if (augContext?.briefInputPrefix) {
    const prefix = augContext.briefInputPrefix;

    // Deduplication: if new input already starts with prefix, just use new input
    // e.g., prefix="Rose", text="Rose Imperial" → search "Rose Imperial" (not "Rose Rose Imperial")
    const normalizedPrefix = prefix.toLowerCase().trim();
    const normalizedText = text.toLowerCase().trim();
    const combinedText = normalizedText.startsWith(normalizedPrefix)
      ? text
      : `${prefix} ${text}`;

    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );

    identification.clearAugmentationContext();
    setLastAction({ type: 'submit_text', payload: combinedText });

    await executeTextIdentification(combinedText, { skipUserMessage: true, skipLastActionUpdate: true });
    return;
  }

  if (augContext?.imageData && augContext?.imageMimeType) {
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );

    setLastAction({ type: 'submit_image', payload: { data: augContext.imageData, mimeType: augContext.imageMimeType } });
    identification.clearAugmentationContext();

    await executeImageIdentification(augContext.imageData, augContext.imageMimeType, text);
  } else if (augContext?.originalInput) {
    conversation.addMessage(
      conversation.createTextMessage(text, { role: 'user' })
    );

    // Parse accumulated result for context
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
      contextParts = [augContext.originalInput];
    }

    const accumulatedContext = contextParts.length > 0 ? contextParts.join('. ') : '';
    const combinedText = accumulatedContext
      ? `${accumulatedContext}. User clarification: ${text}`
      : text;

    identification.clearAugmentationContext();
    setLastAction({ type: 'submit_text', payload: combinedText });

    await executeTextIdentification(combinedText, { skipUserMessage: true, skipLastActionUpdate: true });
  } else {
    await executeTextIdentification(text);
  }
}

/**
 * Handle image submission.
 */
async function handleImageSubmit(data: string, mimeType: string): Promise<void> {
  const base64Data = data.includes(',') ? data.split(',')[1] : data;

  // Release old image data from previous messages to prevent memory accumulation.
  // On mobile, multiple image data URLs in memory + sessionStorage can cause crashes.
  const existingMessages = conversation.getMessages();
  for (const msg of existingMessages) {
    if (msg.category === 'image' && msg.data.category === 'image' && msg.data.src) {
      conversation.updateMessage(msg.id, {
        data: { ...msg.data, src: '' },
      });
    }
  }

  identification.setLastImageData(base64Data, mimeType);
  setLastAction({ type: 'submit_image', payload: { data: base64Data, mimeType } });

  conversation.addMessage({
    category: 'image',
    role: 'user',
    data: { category: 'image', src: data, mimeType },
  });

  await executeImageIdentification(base64Data, mimeType);
}

// ===========================================
// Confirmation Handlers
// ===========================================

async function handleCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
    );
    return;
  }

  // Use stored confidence (authoritative) rather than result object property
  const confidence = identification.getConfidence() ?? result.confidence ?? 1;
  const quality = analyzeResultQuality(result, confidence);
  const wineName = [result.producer, result.wineName].filter(Boolean).join(' ');

  // Check if all required fields are present
  if (quality.hasAllFields) {
    if (!quality.isLowConfidence) {
      // High confidence - show action chips
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_ACTION_PROMPT, { wineName }))
      );

      conversation.addMessage(
        conversation.createChipsMessage(generateActionChips(false))
      );

      conversation.setPhase('confirming');
    } else {
      // Low confidence but all fields present - offer to reidentify or add manually
      // Messages sequence automatically via isPrecedingReady in MessageWrapper
      conversation.addMessage({
        category: 'wine_result',
        role: 'agent',
        data: {
          category: 'wine_result',
          result,
          confidence: quality.confidence,
        },
      });

      conversation.addMessage(
        conversation.createTextMessage(
          getMessageByKey(MessageKey.ID_LOW_CONFIDENCE_COMPLETE, { wineName })
        )
      );

      conversation.addMessage(
        conversation.createChipsMessage(getChips(ChipKey.REIDENTIFY, ChipKey.CONTINUE_AS_IS))
      );

      conversation.setPhase('confirming');
    }
    return;
  }

  // Missing fields - prompt for next one
  let promptMessage: string;

  if (quality.missingWineName && quality.hasGrapes && quality.primaryGrape) {
    promptMessage = result.producer
      ? getMessageByKey(MessageKey.ID_INCOMPLETE_GRAPES_WITH_PRODUCER, { producer: result.producer, grape: quality.primaryGrape })
      : getMessageByKey(MessageKey.ID_INCOMPLETE_GRAPES_NO_PRODUCER, { grape: quality.primaryGrape });
  } else if (quality.missingWineName && quality.hasProducer) {
    promptMessage = getMessageByKey(MessageKey.ID_MISSING_WINE_NAME, { producer: result.producer });
  } else if (quality.missingProducer && !quality.missingWineName) {
    promptMessage = getMessageByKey(MessageKey.ID_MISSING_PRODUCER, { wineName: result.wineName });
  } else if (quality.missingVintage && !quality.missingWineName && !quality.missingProducer) {
    promptMessage = getMessageByKey(MessageKey.ID_MISSING_VINTAGE, { wineName });
  } else {
    promptMessage = getMessageByKey(MessageKey.ID_INCOMPLETE);
  }

  conversation.addMessage(
    conversation.createTextMessage(promptMessage)
  );

  conversation.addMessage(
    conversation.createChipsMessage(generateIncompleteChips(quality))
  );

  conversation.setPhase('awaiting_input');
}

/**
 * Apply locked field values to a result, overriding LLM values where they differ.
 */
function applyLockedFieldsClient(
  result: WineIdentificationResult,
  lockedFields: Record<string, string | number>
): void {
  for (const [field, lockedValue] of Object.entries(lockedFields)) {
    if (field in result) {
      const llmValue = (result as Record<string, unknown>)[field];
      if (typeof llmValue === 'string' && typeof lockedValue === 'string') {
        const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalize(llmValue) === normalize(String(lockedValue))) {
          continue;
        }
      }
      (result as Record<string, unknown>)[field] = lockedValue;
    }
  }
}

/**
 * Show field correction chips for the "Not Correct" flow.
 */
function showFieldCorrectionChips(result: WineIdentificationResult | null): void {
  if (!result) return;
  const lockedFields = identification.getLockedFields();
  const { fieldChips, actionChips } = generateNotCorrectChips(result, lockedFields);

  const promptText = getMessageByKey(MessageKey.ID_NOT_CORRECT_PROMPT);

  // Use addMessages (batch) so field chips and action chips are added together
  // without disabling each other (addMessage disables all existing chips on each call)
  const messages: Parameters<typeof conversation.addMessages>[0] = [
    conversation.createTextMessage(promptText),
  ];
  if (fieldChips.length > 0) {
    messages.push(conversation.createChipsMessage(fieldChips, { groupLabel: 'Fields' }));
  }
  messages.push(conversation.createChipsMessage(actionChips, { groupLabel: 'Actions' }));
  conversation.addMessages(messages);
}

/**
 * Handle user tapping a field chip to correct it.
 */
function handleCorrectField(messageId: string, payload: { field: string }): void {
  conversation.disableMessage(messageId);
  identification.setAwaitingFieldCorrection(payload.field);

  const fieldLabels: Record<string, string> = {
    producer: 'producer',
    wineName: 'wine name',
    vintage: 'vintage',
    region: 'region',
    country: 'country',
    type: 'type',
  };
  const label = fieldLabels[payload.field] || 'value';
  conversation.addMessage(
    conversation.createTextMessage(getMessageByKey(MessageKey.ID_FIELD_CORRECTION_PROMPT, { text: label }))
  );
}

/**
 * Handle confirming field corrections and re-identifying.
 */
async function handleConfirmCorrections(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  const result = identification.getResult();
  const lockedFields = identification.getLockedFields();
  if (!result || Object.keys(lockedFields).length === 0) return;

  identification.startIdentification('text');
  conversation.setPhase('identifying');
  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_THINKING));

  try {
    // Build search text from result fields; fall back to persisted original user text
    const parts = [result.producer, result.wineName, result.vintage].filter(Boolean);
    const augCtx = identification.getCurrentState().augmentationContext;
    const text = parts.length > 0
      ? parts.join(' ')
      : augCtx?.originalUserText || '';

    const abortController = createAbortController();

    const apiResult = await api.identifyTextStream(
      text,
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      },
      undefined,
      abortController.signal,
      getRequestId(),
      lockedFields
    );

    if (wasCancelled()) return;

    conversation.removeTypingMessage();

    const wineResult = convertParsedWineToResult(apiResult.parsed, apiResult.confidence);
    applyLockedFieldsClient(wineResult, lockedFields);
    identification.setResult(wineResult, apiResult.confidence);
    handleIdentificationResultFlow(wineResult, apiResult.confidence ?? 1);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    conversation.removeTypingMessage();
    identification.setResult(result, identification.getConfidence() ?? 80);
    const confidence = identification.getConfidence() ?? 80;
    handleIdentificationResultFlow(result, confidence);
  }
}

async function handleNotCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  const imageData = identification.getCurrentState().lastImageData;

  // Capture original user text before it expires from lastAction (runtime-only, 5min TTL)
  const lastAction = getLastAction();
  let originalUserText: string | undefined;
  if (lastAction?.type === 'submit_text' && typeof lastAction.payload === 'string') {
    originalUserText = lastAction.payload;
  } else if (result) {
    originalUserText = [result.producer, result.wineName, result.vintage].filter(Boolean).join(' ') || undefined;
  }

  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
    originalUserText,
    imageData: imageData?.data,
    imageMimeType: imageData?.mimeType,
    lockedFields: identification.getLockedFields(),
    rejectedResult: true,
  });

  showFieldCorrectionChips(result);

  conversation.setPhase('awaiting_input');
}

async function handleConfirmNewSearch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const pendingText = identification.getCurrentState().pendingNewSearch;
  if (pendingText) {
    identification.setPendingNewSearch(null);
    identification.clearLockedFields();
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

  const searchText = identification.consumePendingBriefSearch();

  if (searchText) {
    await executeTextIdentification(searchText);
  } else {
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(MessageKey.ID_SEARCH_UNCLEAR))
    );
    conversation.setPhase('awaiting_input');
  }
}

function handleAddMoreDetail(messageId: string): void {
  conversation.disableMessage(messageId);

  // WIN-270: Store the pending brief search as augmentation context for concatenation
  const briefSearch = identification.getCurrentState().pendingBriefSearch;
  if (briefSearch) {
    identification.setAugmentationContext({
      briefInputPrefix: briefSearch,
    });
    identification.setPendingBriefSearch(null);
  }

  conversation.setPhase('awaiting_input');
}

// ===========================================
// Field Completion Handlers
// ===========================================

function handleUseProducerName(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result && result.producer) {
    const updatedResult = { ...result, wineName: result.producer };
    // Use stored confidence (authoritative) rather than result object property
    const confidence = identification.getConfidence() ?? result.confidence ?? 1;
    identification.setResult(updatedResult, confidence);
    handleMissingFieldProvided(updatedResult, confidence);
  }
}

function handleUseGrapeAsName(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result && result.grapes?.length) {
    const updatedResult = { ...result, wineName: result.grapes[0] };
    // Use stored confidence (authoritative) rather than result object property
    const confidence = identification.getConfidence() ?? result.confidence ?? 1;
    identification.setResult(updatedResult, confidence);
    handleMissingFieldProvided(updatedResult, confidence);
  }
}

function handleNvVintage(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (result) {
    const updatedResult = { ...result, vintage: 'NV' as const };
    // Use stored confidence (authoritative) rather than result object property
    const confidence = identification.getConfidence() ?? result.confidence ?? 1;
    identification.setResult(updatedResult, confidence);
    handleMissingFieldProvided(updatedResult, confidence);
  }
}

function handleAddMissingDetails(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  // Use stored confidence (authoritative) rather than result object property
  const storedConfidence = identification.getConfidence() ?? result?.confidence ?? 1;
  const quality = result ? analyzeResultQuality(result, storedConfidence) : null;

  let prompt: string;
  if (quality?.missingProducer && !quality.missingWineName) {
    prompt = getMessageByKey(MessageKey.ID_PROMPT_PRODUCER);
  } else if (quality?.missingVintage && !quality.missingWineName && !quality.missingProducer) {
    prompt = getMessageByKey(MessageKey.ID_PROMPT_VINTAGE);
  } else if (quality?.missingWineName) {
    prompt = getMessageByKey(MessageKey.ID_PROMPT_WINE_NAME);
  } else {
    prompt = getMessageByKey(MessageKey.ID_PROMPT_DETAILS);
  }

  conversation.addMessage(
    conversation.createTextMessage(prompt)
  );

  conversation.setPhase('awaiting_input');
}

function handleProvideMore(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  const imageData = identification.getCurrentState().lastImageData;

  // Capture original user text before it expires from lastAction (runtime-only, 5min TTL)
  const lastAction = getLastAction();
  let originalUserText: string | undefined;
  if (lastAction?.type === 'submit_text' && typeof lastAction.payload === 'string') {
    originalUserText = lastAction.payload;
  } else if (result) {
    originalUserText = [result.producer, result.wineName, result.vintage].filter(Boolean).join(' ') || undefined;
  }

  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
    originalUserText,
    imageData: imageData?.data,
    imageMimeType: imageData?.mimeType,
  });

  conversation.addMessage(
    conversation.createTextMessage(
      getMessageByKey(MessageKey.ID_PROVIDE_MORE_CONTEXT)
    )
  );

  conversation.setPhase('awaiting_input');
}

function handleContinueAsIs(messageId: string): void {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
    );
    return;
  }

  conversation.addMessage(
    conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_CORRECT))
  );

  conversation.addMessage(
    conversation.createChipsMessage(generateActionChips(false))
  );

  conversation.setPhase('confirming');
}

// ===========================================
// Escalation Handler
// ===========================================

async function handleTryOpus(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  identification.startEscalation(3);
  conversation.setPhase('identifying');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_ESCALATING));

  try {
    const currentResult = identification.getResult();
    const imageData = identification.getCurrentState().lastImageData;
    const augContext = identification.getAugmentationContext();
    const lastAction = getLastAction();

    const priorResult = {
      intent: 'add' as const,
      parsed: (currentResult ?? {}) as AgentParsedWine,
      confidence: currentResult?.confidence ?? 0,
      action: 'suggest' as const,
      candidates: [],
    };

    const lockedFields = identification.getLockedFields();

    // Build escalation context for the LLM prompt
    const escalationContext = {
      reason: augContext?.rejectedResult ? 'user_rejected' as const : undefined,
      originalUserText: augContext?.originalUserText,
    };

    // Determine input text and type
    let inputText: string | undefined;
    let inputType: 'text' | 'image' = 'text';

    if (imageData?.data) {
      inputText = imageData.data;
      inputType = 'image';
    } else if (lastAction?.type === 'submit_text' && lastAction.payload) {
      inputText = lastAction.payload as string;
    } else if (augContext?.originalUserText) {
      inputText = augContext.originalUserText;
    } else if (augContext?.originalInput) {
      // Backward compat: reconstruct clean text from JSON result
      try {
        const parsed = JSON.parse(augContext.originalInput) as WineIdentificationResult;
        inputText = [parsed.producer, parsed.wineName, parsed.vintage].filter(Boolean).join(' ');
      } catch { /* fall through */ }
    }

    if (!inputText) {
      throw new Error('No input available for Opus identification');
    }

    const result = await api.identifyWithOpus(
      inputText,
      inputType,
      priorResult,
      inputType === 'image' ? imageData?.mimeType : undefined,
      undefined,
      lockedFields,
      escalationContext
    );

    conversation.removeTypingMessage();
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
    applyLockedFieldsClient(wineResult, lockedFields);
    identification.setResult(wineResult, result.confidence);
    identification.completeEscalation();

    const wineName = [wineResult.producer, wineResult.wineName]
      .filter(Boolean)
      .join(' ');

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

    let foundMessage: string;
    if (wineName) {
      const opusConf = (result.confidence ?? 100) > 1 ? (result.confidence ?? 100) / 100 : (result.confidence ?? 1);
      const messageKey = opusConf < 0.7 ? MessageKey.ID_LOW_CONFIDENCE : MessageKey.ID_FOUND;
      foundMessage = getMessageByKey(messageKey, { wineName });
    } else if (wineResult.grapes?.length) {
      foundMessage = getMessageByKey(MessageKey.ID_GRAPE_ONLY, { grape: wineResult.grapes[0] });
    } else {
      foundMessage = getMessageByKey(MessageKey.ID_NOT_FOUND);
    }
    conversation.addMessage(
      conversation.createTextMessage(foundMessage)
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateConfirmationChips())
    );

    conversation.setPhase('confirming');

  } catch (error) {
    conversation.removeTypingMessage();
    identification.completeEscalation();
    handleIdentificationError(error);
  }
}

// ===========================================
// Verify Handler (grounded web search)
// ===========================================

async function handleVerify(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  identification.startEscalation(2);
  conversation.setPhase('identifying');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_VERIFYING));

  try {
    const currentResult = identification.getResult();
    const imageData = identification.getCurrentState().lastImageData;

    if (!imageData?.data) {
      throw new Error('No image data available for verification');
    }

    const lockedFields = identification.getLockedFields();

    const priorResult = {
      intent: 'add' as const,
      parsed: (currentResult ?? {}) as AgentParsedWine,
      confidence: currentResult?.confidence ?? 0,
      action: 'suggest' as const,
      candidates: [],
    };

    const result = await api.verifyImage(
      imageData.data,
      imageData.mimeType,
      priorResult,
      lockedFields
    );

    conversation.removeTypingMessage();
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
    applyLockedFieldsClient(wineResult, lockedFields);
    identification.setResult(wineResult, result.confidence);
    identification.completeEscalation();

    const wineName = [wineResult.producer, wineResult.wineName]
      .filter(Boolean)
      .join(' ');

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

    let foundMessage: string;
    if (wineName) {
      const verifyConf = (result.confidence ?? 100) > 1 ? (result.confidence ?? 100) / 100 : (result.confidence ?? 1);
      const messageKey = verifyConf < 0.7 ? MessageKey.ID_LOW_CONFIDENCE : MessageKey.ID_FOUND;
      foundMessage = getMessageByKey(messageKey, { wineName });
    } else if (wineResult.grapes?.length) {
      foundMessage = getMessageByKey(MessageKey.ID_GRAPE_ONLY, { grape: wineResult.grapes[0] });
    } else {
      foundMessage = getMessageByKey(MessageKey.ID_NOT_FOUND);
    }
    conversation.addMessage(
      conversation.createTextMessage(foundMessage)
    );

    // After verification, show standard confirmation (no Verify chip — already verified)
    conversation.addMessage(
      conversation.createChipsMessage(generateConfirmationChips())
    );

    conversation.setPhase('confirming');

  } catch (error) {
    conversation.removeTypingMessage();
    identification.completeEscalation();
    handleIdentificationError(error);
  }
}

// ===========================================
// Reidentify Handler
// ===========================================

async function handleReidentify(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result) {
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
    );
    return;
  }

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
      conversation.createTextMessage(getMessageByKey(MessageKey.ID_INSUFFICIENT_INFO))
    );
    conversation.setPhase('awaiting_input');
    return;
  }

  identification.clearIdentification();

  // Typing indicator shown briefly before re-identification starts
  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_REIDENTIFYING));

  await handleTextSubmit(searchQuery);
}

// ===========================================
// Type Guard & Router
// ===========================================

/**
 * Check if an action type is an identification action.
 */
export function isIdentificationAction(type: string): type is IdentificationActionType {
  return [
    'submit_text',
    'submit_image',
    'try_opus',
    'reidentify',
    'correct',
    'not_correct',
    'confirm_brief_search',
    'add_more_detail',
    'confirm_new_search',
    'continue_current',
    'use_producer_name',
    'use_grape_as_name',
    'nv_vintage',
    'add_missing_details',
    'provide_more',
    'continue_as_is',
    'see_result',
    'identify',
    'correct_field',
    'confirm_corrections',
    'verify',
  ].includes(type);
}

/**
 * Handle an identification action.
 */
export async function handleIdentificationAction(action: AgentAction): Promise<void> {
  switch (action.type) {
    case 'submit_text':
      await handleTextSubmit(action.payload as string);
      break;

    case 'submit_image':
      const imagePayload = action.payload as { data: string; mimeType: string };
      await handleImageSubmit(imagePayload.data, imagePayload.mimeType);
      break;

    case 'try_opus':
      await handleTryOpus(action.messageId ?? '');
      break;

    case 'verify':
      await handleVerify(action.messageId ?? '');
      break;

    case 'reidentify':
      await handleReidentify(action.messageId ?? '');
      break;

    case 'correct':
      await handleCorrect(action.messageId ?? '');
      break;

    case 'not_correct':
      await handleNotCorrect(action.messageId ?? '');
      break;

    case 'confirm_brief_search':
      await handleConfirmBriefSearch(action.messageId ?? '');
      break;

    case 'add_more_detail':
      handleAddMoreDetail(action.messageId ?? '');
      break;

    case 'confirm_new_search':
      await handleConfirmNewSearch(action.messageId ?? '');
      break;

    case 'continue_current':
      handleContinueCurrent(action.messageId ?? '');
      break;

    case 'use_producer_name':
      handleUseProducerName(action.messageId ?? '');
      break;

    case 'use_grape_as_name':
      handleUseGrapeAsName(action.messageId ?? '');
      break;

    case 'nv_vintage':
      handleNvVintage(action.messageId ?? '');
      break;

    case 'add_missing_details':
      handleAddMissingDetails(action.messageId ?? '');
      break;

    case 'provide_more':
      handleProvideMore(action.messageId ?? '');
      break;

    case 'continue_as_is':
      handleContinueAsIs(action.messageId ?? '');
      break;

    case 'see_result':
      // Show result with confirmation
      conversation.disableMessage(action.messageId ?? '');
      const result = identification.getResult();
      if (result) {
        conversation.addMessage({
          category: 'wine_result',
          role: 'agent',
          data: { category: 'wine_result', result },
        });
        conversation.addMessage(
          conversation.createChipsMessage(generateConfirmationChips())
        );
        conversation.setPhase('confirming');
      }
      break;

    case 'identify':
      conversation.disableMessage(action.messageId ?? '');
      conversation.setPhase('awaiting_input');
      break;

    case 'correct_field':
      handleCorrectField(action.messageId ?? '', action.payload as { field: string });
      break;

    case 'confirm_corrections':
      await handleConfirmCorrections(action.messageId ?? '');
      break;
  }
}
