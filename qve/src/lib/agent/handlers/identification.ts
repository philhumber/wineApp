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

import type { AgentAction, WineIdentificationResult, AgentErrorInfo } from '../types';
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
  generateIncompleteChips,
  generateActionChips,
  generateErrorChips,
  detectCommand,
  detectChipResponse,
  detectFieldInput,
  detectDirectValue,
  checkBriefInput,
} from '../services';
import { setLastAction, getLastAction } from '../middleware/retryTracker';
import {
  handleStartOver,
  handleCancel,
  handleGoBack,
  handleRetry,
} from './conversation';

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
  | 'identify';

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
  confidence: number
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
    const messageKey = confidence < 0.7 ? MessageKey.ID_LOW_CONFIDENCE : MessageKey.ID_FOUND;
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(messageKey, { wineName }))
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateConfirmationChips())
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
      { id: 'try_again', label: 'Try Again', action: 'provide_more' },
      { id: 'start_over', label: 'Start Over', action: 'start_over' },
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
        conversation.createChipsMessage([
          { id: 'reidentify', label: 'Try to Match', action: 'reidentify', variant: 'primary' },
          { id: 'continue_as_is', label: 'Add Manually', action: 'continue_as_is' },
        ])
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
 */
async function executeTextIdentification(
  text: string,
  options: { skipUserMessage?: boolean; skipLastActionUpdate?: boolean } = {}
): Promise<void> {
  // Add user message
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
    setLastAction({ type: 'submit_text', payload: text });
  }

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('text');

  // Typing indicator participates in message queue with scroll behavior
  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_THINKING));

  try {
    const result = await api.identifyTextStream(
      text,
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      }
    );

    conversation.removeTypingMessage();
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
    identification.setResult(wineResult, result.confidence);
    handleIdentificationResultFlow(wineResult, result.confidence ?? 1);

  } catch (error) {
    conversation.removeTypingMessage();
    handleIdentificationError(error);
  }
}

/**
 * Execute image-based identification API call.
 */
async function executeImageIdentification(
  data: string,
  mimeType: string,
  supplementaryText?: string
): Promise<void> {
  conversation.setPhase('identifying');
  identification.startIdentification('image');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ID_ANALYZING));

  try {
    const result = await api.identifyImageStream(
      data,
      mimeType,
      supplementaryText,
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      }
    );

    conversation.removeTypingMessage();
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
    identification.setResult(wineResult, result.confidence);
    handleIdentificationResultFlow(wineResult, result.confidence ?? 1);

  } catch (error) {
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
  const existingResult = identification.getResult();
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
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_NEW_SEARCH))
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
      conversation.createChipsMessage([
        { id: 'search_anyway', label: 'Search Anyway', action: 'confirm_brief_search' },
        { id: 'add_more', label: "I'll Add More", action: 'add_more_detail' },
      ])
    );
    return;
  }

  // 6. Execute Identification
  const augContext = identification.getAugmentationContext();

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
        conversation.createChipsMessage([
          { id: 'reidentify', label: 'Try to Match', action: 'reidentify', variant: 'primary' },
          { id: 'continue_as_is', label: 'Add Manually', action: 'continue_as_is' },
        ])
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

async function handleNotCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  const imageData = identification.getCurrentState().lastImageData;

  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
    imageData: imageData?.data,
    imageMimeType: imageData?.mimeType,
  });

  conversation.addMessage(
    conversation.createTextMessage(getMessageByKey(MessageKey.CONFIRM_INCORRECT))
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'provide_more', label: 'Add Details', action: 'provide_more' },
      { id: 'try_opus', label: 'Try Harder', action: 'try_opus' },
      { id: 'start_fresh', label: 'Start Over', action: 'start_fresh' },
    ])
  );

  conversation.setPhase('awaiting_input');
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

  identification.setAugmentationContext({
    originalInput: result ? JSON.stringify(result) : undefined,
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

  conversation.setPhase('adding_wine');
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

    let result;

    if (imageData?.data) {
      result = await api.identifyWithOpus(
        imageData.data,
        'image',
        priorResult,
        imageData.mimeType
      );
    } else if (lastAction?.type === 'submit_text' && lastAction.payload) {
      result = await api.identifyWithOpus(
        lastAction.payload as string,
        'text',
        priorResult
      );
    } else if (augContext?.originalInput) {
      result = await api.identifyWithOpus(
        augContext.originalInput,
        'text',
        priorResult
      );
    } else {
      throw new Error('No input available for Opus identification');
    }

    conversation.removeTypingMessage();
    const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
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
      const messageKey = (result.confidence ?? 1) < 0.7 ? MessageKey.ID_LOW_CONFIDENCE : MessageKey.ID_FOUND;
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
  }
}
