/**
 * Enrichment Handlers
 *
 * Handles all enrichment-related actions:
 * - learn: Start enrichment flow (Learn More)
 * - enrich_now: Enrich during add flow
 * - add_quickly: Skip enrichment
 * - remember: Remember for later
 * - recommend: Get recommendations
 * - confirm_cache_match: Use cached enrichment data
 * - force_refresh: Refresh enrichment data
 *
 * Sprint 2 extraction from handleAgentAction.ts monolith.
 */

import type { AgentAction, EnrichmentData, AgentErrorInfo } from '../types';
import type { AgentEnrichmentData } from '$lib/api/types';
import { tick } from 'svelte';
import { getMessageByKey, wn } from '../messages';
import { MessageKey } from '../messageKeys';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import { api } from '$lib/api';
import { AgentError } from '$lib/api/types';
import {
  generatePostEnrichmentChips,
  generateEnrichmentErrorChips,
  generateCacheMatchChips,
} from '../services';
import { createAbortController, wasCancelled, lockScroll, unlockScroll, getRequestId } from '../requestLifecycle';

// ===========================================
// Action Types
// ===========================================

type EnrichmentActionType =
  | 'learn'
  | 'remember'
  | 'recommend'
  | 'confirm_cache_match'
  | 'force_refresh';
// Note: 'enrich_now' and 'add_quickly' are handled by addWine.ts (Sprint 3)

// ===========================================
// Type Mapping Helpers
// ===========================================

/**
 * Map AgentEnrichmentData from API to local EnrichmentData type.
 */
function mapAgentEnrichmentToLocal(data: AgentEnrichmentData | null): EnrichmentData {
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
      percentage: g.percentage != null ? String(g.percentage) : undefined,
    })),
    styleProfile: {
      ...(data.body ? { body: data.body } : {}),
      ...(data.tannin ? { tannin: data.tannin } : {}),
      ...(data.acidity ? { acidity: data.acidity } : {}),
      ...(data.sweetness ? { sweetness: data.sweetness } : {}),
    },
    tastingNotes: data.tastingNotes ? {
      palate: [data.tastingNotes],
    } : undefined,
    criticScores: data.criticScores?.map(c => ({
      critic: c.critic,
      score: c.score,
      vintage: c.year,
    })),
    drinkWindow,
    foodPairings: data.pairingNotes ? data.pairingNotes.split(', ') : undefined,
  };
}

// ===========================================
// Empty enrichment template for skeleton state
// ===========================================

const emptyAgentEnrichment: AgentEnrichmentData = {
  grapeVarieties: null,
  appellation: null,
  alcoholContent: null,
  drinkWindow: null,
  productionMethod: null,
  criticScores: null,
  averagePrice: null,
  priceSource: null,
  body: null,
  tannin: null,
  acidity: null,
  sweetness: null,
  overview: null,
  tastingNotes: null,
  pairingNotes: null,
  confidence: 0,
  sources: [],
};

// ===========================================
// Error Handling
// ===========================================

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

  enrichment.setEnrichmentError(errorInfo);

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
    conversation.createChipsMessage(generateEnrichmentErrorChips(errorInfo.retryable ?? false))
  );

  conversation.setPhase('error');
}

// ===========================================
// Cache Confirmation
// ===========================================

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

  const searchedFor = enrichmentResult.searchedFor;
  const searchedForName = searchedFor
    ? [searchedFor.producer, searchedFor.wineName, searchedFor.vintage].filter(Boolean).join(' ')
    : undefined;

  // Unlock scroll so cache confirmation messages scroll into view
  unlockScroll();

  conversation.addMessage(
    conversation.createTextMessage(
      getMessageByKey(MessageKey.ENRICH_CACHE_CONFIRM, { wineName: matchedName, searchedForName })
    )
  );

  conversation.addMessage(
    conversation.createChipsMessage(generateCacheMatchChips())
  );

  conversation.setPhase('confirming');
}

// ===========================================
// Core Enrichment Function
// ===========================================

/**
 * Execute the enrichment API call with streaming.
 * WIN-187: Uses AbortController for cancellation support.
 *
 * UX timing: The typing/thinking message stays visible for CARD_DELAY_MS before
 * the enrichment card appears. This gives the user time to read the thinking text.
 * For cache hits (fast response), the card appears immediately when data arrives.
 */
const CARD_DELAY_MS = 7000;

async function executeEnrichment(
  producer: string,
  wineName: string,
  vintage: string | null,
  wineType: string | null,
  region: string | null,
  confirmMatch: boolean,
  forceRefresh: boolean
): Promise<void> {
  // WIN-187: Create abort controller for this request
  const abortController = createAbortController();

  // Card creation is deferred — typing message stays visible for CARD_DELAY_MS
  let msgId: string | null = null;
  let cardCreated = false;
  let cardDelayTimer: ReturnType<typeof setTimeout> | null = null;

  // Mutable state buffered before card exists
  const partialData: Partial<AgentEnrichmentData> = {};
  const currentStreamingTexts: string[] = [];
  let lastUpdateTime = 0;
  const THROTTLE_MS = 100;

  /** Create the enrichment card, flush buffered data, scroll to it. */
  function createCard(): void {
    if (cardCreated) return;
    cardCreated = true;
    if (cardDelayTimer !== null) {
      clearTimeout(cardDelayTimer);
      cardDelayTimer = null;
    }

    // Remove thinking message — user shouldn't see both at once
    conversation.removeTypingMessage();

    const hasBufferedData = Object.keys(partialData).length > 0;
    const msg = conversation.addMessage({
      category: 'enrichment',
      role: 'agent',
      data: {
        category: 'enrichment',
        data: hasBufferedData ? { ...emptyAgentEnrichment, ...partialData } : null,
        streamingTextFields: [...currentStreamingTexts],
      },
    });
    msgId = msg.id;

    // Scroll to the new enrichment card
    tick().then(() => {
      const container = document.querySelector('.agent-chat-container');
      const card = container?.querySelector('[data-enrichment-card]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /** Update the card if it exists. */
  function updateCard(): void {
    if (!cardCreated || !msgId) return;
    conversation.updateMessage(msgId, {
      data: {
        category: 'enrichment',
        data: { ...emptyAgentEnrichment, ...partialData },
        streamingTextFields: [...currentStreamingTexts],
      },
    });
  }

  // Start the delay timer — card appears after CARD_DELAY_MS
  cardDelayTimer = setTimeout(createCard, CARD_DELAY_MS);

  try {
    const enrichmentResult = await api.enrichWineStream(
      producer,
      wineName,
      vintage,
      wineType,
      region,
      confirmMatch,
      forceRefresh,
      // onField: structured field arrived (complete value)
      (field: string, value: unknown) => {
        (partialData as Record<string, unknown>)[field] = value;
        const idx = currentStreamingTexts.indexOf(field);
        if (idx !== -1) currentStreamingTexts.splice(idx, 1);
        updateCard();
      },
      // onTextDelta: progressive text chunk (throttled)
      (field: string, text: string) => {
        (partialData as Record<string, unknown>)[field] = text;
        if (!currentStreamingTexts.includes(field)) currentStreamingTexts.push(field);
        if (!cardCreated) return; // Still buffering — card not visible yet
        const now = Date.now();
        if (now - lastUpdateTime >= THROTTLE_MS) {
          lastUpdateTime = now;
          updateCard();
        }
      },
      undefined, // onEvent
      abortController.signal,
      getRequestId()
    );

    // Clean up timer
    if (cardDelayTimer !== null) {
      clearTimeout(cardDelayTimer);
      cardDelayTimer = null;
    }

    // WIN-187: Skip processing if cancelled during the await
    if (wasCancelled()) {
      if (cardCreated && msgId) conversation.removeMessage(msgId);
      conversation.removeTypingMessage();
      return;
    }

    // Handle pending confirmation (cache match that needs user approval)
    if (enrichmentResult.pendingConfirmation && enrichmentResult.matchedTo) {
      if (cardCreated && msgId) conversation.removeMessage(msgId);
      conversation.removeTypingMessage();
      handleCacheConfirmationRequired(enrichmentResult);
      return;
    }

    // Create card now if it wasn't created yet (cache hit — fast response)
    if (!cardCreated) {
      createCard();
    } else {
      conversation.removeTypingMessage();
    }

    // Finalize with complete data
    conversation.updateMessage(msgId!, {
      data: { category: 'enrichment', data: enrichmentResult.data, streamingTextFields: [] }
    });

    // Store for add wine flow
    enrichment.setEnrichmentData(mapAgentEnrichmentToLocal(enrichmentResult.data), enrichmentResult.source);

    // Build wine name for display
    const displayName = [producer, wineName].filter(Boolean).join(' ');

    // Add completion message
    conversation.addMessage(
      conversation.createTextMessage(
        getMessageByKey(MessageKey.ENRICH_FOUND_DETAILS, { wineName: displayName })
      )
    );

    // Add action chips
    conversation.addMessage(
      conversation.createChipsMessage(generatePostEnrichmentChips())
    );

    conversation.setPhase('confirming');

  } catch (error) {
    // Clean up timer
    if (cardDelayTimer !== null) {
      clearTimeout(cardDelayTimer);
      cardDelayTimer = null;
    }
    // WIN-187: Don't show error for intentional cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (cardCreated && msgId) conversation.removeMessage(msgId);
      conversation.removeTypingMessage();
      return;
    }
    if (cardCreated && msgId) conversation.removeMessage(msgId);
    conversation.removeTypingMessage();
    handleEnrichmentError(error);
  }
}

// ===========================================
// Handlers
// ===========================================

/**
 * Handle "Learn More" action - start enrichment flow.
 */
async function handleLearnMore(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  if (!result || !result.producer || !result.wineName) {
    conversation.addMessage(
      conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
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
  enrichment.setLastRequest({
    producer: result.producer,
    wineName: result.wineName,
    vintage: result.vintage !== undefined ? String(result.vintage) : null,
    type: result.type || null,
    region: result.region || null,
  });

  conversation.setPhase('enriching');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ENRICH_LOADING));

  // Lock scroll after typing message - prevents scroll chaos during streaming
  // Will be unlocked when user takes any action (chip tap, start over, etc)
  lockScroll();

  await executeEnrichment(
    result.producer,
    result.wineName,
    result.vintage !== undefined ? String(result.vintage) : null,
    result.type || null,
    result.region || null,
    false,
    false
  );
}

/**
 * Handle "Remember" action - save wine for later.
 */
async function handleRemember(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  const result = identification.getResult();
  const wineName = result
    ? [result.producer, result.wineName].filter(Boolean).join(' ') || 'the wine'
    : 'the wine';

  // For now, just acknowledge - this could save to a "remembered wines" list in the future
  conversation.addMessage(
    conversation.createTextMessage(
      getMessageByKey(MessageKey.ENRICH_REMEMBER_SOON, { wineName })
    )
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'identify_another', label: 'Identify Another', action: 'start_over' },
    ])
  );

  conversation.setPhase('complete');
}

/**
 * Handle "Recommend" action - get wine recommendations.
 */
async function handleRecommend(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Implement recommendation flow
  conversation.addMessage(
    conversation.createTextMessage(getMessageByKey(MessageKey.ENRICH_RECOMMEND_SOON))
  );
}

/**
 * Handle cache match confirmation.
 */
async function handleConfirmCacheMatch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get the last enrichment request params
  let lastRequest = enrichment.getLastRequest();
  if (!lastRequest) {
    const result = identification.getResult();
    if (!result || !result.producer || !result.wineName) {
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
      );
      return;
    }

    lastRequest = {
      producer: result.producer,
      wineName: result.wineName,
      vintage: result.vintage !== undefined ? String(result.vintage) : null,
      type: result.type || null,
      region: result.region || null,
    };
    enrichment.setLastRequest(lastRequest);
  }

  // Restart enrichment with confirmMatch = true
  enrichment.startEnrichment({
    producer: lastRequest.producer,
    wineName: lastRequest.wineName,
    vintage: lastRequest.vintage ?? undefined,
    region: lastRequest.region ?? undefined,
  });

  conversation.setPhase('enriching');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ENRICH_USING_CACHE));

  // Lock scroll during streaming (same pattern as handleLearnMore)
  lockScroll();

  await executeEnrichment(
    lastRequest.producer,
    lastRequest.wineName,
    lastRequest.vintage,
    lastRequest.type,
    lastRequest.region,
    true,  // confirmMatch
    false  // forceRefresh
  );
}

/**
 * Handle force refresh - skip cache and search online.
 */
async function handleForceRefresh(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Get the last enrichment request params
  let lastRequest = enrichment.getLastRequest();
  if (!lastRequest) {
    const result = identification.getResult();
    if (!result || !result.producer || !result.wineName) {
      conversation.addMessage(
        conversation.createTextMessage(getMessageByKey(MessageKey.ERROR_NO_RESULT))
      );
      return;
    }

    lastRequest = {
      producer: result.producer,
      wineName: result.wineName,
      vintage: result.vintage !== undefined ? String(result.vintage) : null,
      type: result.type || null,
      region: result.region || null,
    };
    enrichment.setLastRequest(lastRequest);
  }

  // Restart enrichment with forceRefresh = true
  enrichment.startEnrichment({
    producer: lastRequest.producer,
    wineName: lastRequest.wineName,
    vintage: lastRequest.vintage ?? undefined,
    region: lastRequest.region ?? undefined,
  });

  conversation.setPhase('enriching');

  conversation.addTypingMessage(getMessageByKey(MessageKey.ENRICH_REFRESHING));

  // Lock scroll during streaming (same pattern as handleLearnMore)
  lockScroll();

  await executeEnrichment(
    lastRequest.producer,
    lastRequest.wineName,
    lastRequest.vintage,
    lastRequest.type,
    lastRequest.region,
    false, // confirmMatch
    true   // forceRefresh
  );
}

// ===========================================
// Type Guard & Router
// ===========================================

/**
 * Check if an action type is an enrichment action.
 */
export function isEnrichmentAction(type: string): type is EnrichmentActionType {
  return [
    'learn',
    'remember',
    'recommend',
    'confirm_cache_match',
    'force_refresh',
    // Note: 'enrich_now' and 'add_quickly' are handled by addWine.ts
  ].includes(type);
}

/**
 * Handle an enrichment action.
 */
export async function handleEnrichmentAction(action: AgentAction): Promise<void> {
  switch (action.type) {
    case 'learn':
      await handleLearnMore(action.messageId ?? '');
      break;

    case 'remember':
      await handleRemember(action.messageId ?? '');
      break;

    case 'recommend':
      await handleRecommend(action.messageId ?? '');
      break;

    case 'confirm_cache_match':
      await handleConfirmCacheMatch(action.messageId ?? '');
      break;

    case 'force_refresh':
      await handleForceRefresh(action.messageId ?? '');
      break;

    // Note: 'enrich_now' and 'add_quickly' are now handled by addWine.ts
  }
}
