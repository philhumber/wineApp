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
      percentage: g.percentage ?? undefined,
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

  conversation.addMessage(
    conversation.createTextMessage(
      getMessageByKey(MessageKey.ENRICH_CACHE_CONFIRM, { wineName: matchedName })
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
    const enrichmentResult = await api.enrichWineStream(
      producer,
      wineName,
      vintage,
      wineType,
      region,
      confirmMatch,
      forceRefresh,
      (field, value) => {
        enrichment.updateEnrichmentStreamingField(field, String(value), true);
      }
    );

    conversation.removeTypingMessage();

    // Handle pending confirmation (cache match that needs user approval)
    if (enrichmentResult.pendingConfirmation && enrichmentResult.matchedTo) {
      handleCacheConfirmationRequired(enrichmentResult);
      return;
    }

    // Map API data to local type
    const enrichmentData = mapAgentEnrichmentToLocal(enrichmentResult.data);

    // Store the enrichment data in the store
    enrichment.setEnrichmentData(enrichmentData, enrichmentResult.source);

    // Add enrichment result message
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
        getMessageByKey(MessageKey.ENRICH_FOUND_DETAILS, { wineName: displayName })
      )
    );

    // Add action chips
    conversation.addMessage(
      conversation.createChipsMessage(generatePostEnrichmentChips())
    );

    conversation.setPhase('confirming');

  } catch (error) {
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
