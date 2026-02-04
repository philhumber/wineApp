/**
 * Agent Action Handler
 *
 * Central action router that dispatches all agent actions to appropriate stores.
 * Implements the Command Pattern for clean separation of concerns.
 *
 * Part of the Phase 4 store refactoring.
 */

import type { AgentAction, EntityType } from './types';
import { getMessage } from './messages';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';

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
        handleBottleNext(action.messageId);
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
      // Generic Chip Tap (fallback)
      // ─────────────────────────────────────────────
      case 'chip_tap':
        await handleGenericChipTap(action.payload);
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
  // Add user message
  conversation.addMessage(
    conversation.createTextMessage(text, { role: 'user' })
  );

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('text');

  // Add "thinking" message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.thinking'))
  );

  // TODO: Call API and handle response
  // This will be wired up when integrating with existing API calls
}

async function handleImageSubmit(data: string, mimeType: string): Promise<void> {
  // Store image data
  identification.setLastImageData(data, mimeType);

  // Add user image message
  conversation.addMessage({
    category: 'image',
    role: 'user',
    data: { category: 'image', src: data, mimeType },
  });

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('image');

  // Add "thinking" message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.thinking'))
  );

  // TODO: Call API and handle response
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
  // TODO: Re-execute last action
  // Need to track lastAction in a store
}

// ===========================================
// Confirmation Handlers
// ===========================================

async function handleCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Add confirmation message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('confirm.correct'))
  );

  // Add action chips
  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'add', label: getMessage('chips.addToCellar'), action: 'add_to_cellar', variant: 'primary' },
      { id: 'learn', label: getMessage('chips.learnMore'), action: 'learn' },
      { id: 'remember', label: getMessage('chips.remember'), action: 'remember' },
    ])
  );

  conversation.setPhase('confirming');
}

async function handleNotCorrect(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Set augmentation context
  const result = identification.getResult();
  if (result) {
    identification.setAugmentationContext({
      originalInput: JSON.stringify(result),
    });
  }

  // Add incorrect message
  conversation.addMessage(
    conversation.createTextMessage(getMessage('confirm.incorrect'))
  );

  conversation.setPhase('confirming');
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
  // TODO: Proceed with brief search
}

function handleAddMoreDetail(messageId: string): void {
  conversation.disableMessage(messageId);
  conversation.setPhase('awaiting_input');
}

async function handleConfirmCacheMatch(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Confirm cache match
}

async function handleForceRefresh(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Force refresh (bypass cache)
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
  identification.startEscalation(2);

  conversation.addMessage(
    conversation.createTextMessage(getMessage('identification.escalating'))
  );

  // TODO: Call Opus escalation API
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
  conversation.setPhase('awaiting_input');
}

async function handleUseProducerName(messageId: string, name?: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Use producer name as wine name
}

async function handleUseGrapeAsName(messageId: string, name?: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Use grape as wine name
}

async function handleNvVintage(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Set vintage as NV
}

function handleProvideMore(messageId: string): void {
  conversation.disableMessage(messageId);
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

  // TODO: Check for duplicates first
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

  // Start enrichment
  enrichment.startEnrichment({
    producer: result.producer,
    wineName: result.wineName,
    vintage: result.vintage,
    region: result.region,
    country: result.country,
  });

  conversation.setPhase('enriching');

  conversation.addMessage(
    conversation.createTextMessage(getMessage('enrichment.loading'))
  );

  // TODO: Call enrichment API
}

async function handleRemember(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Implement "remember" functionality
  conversation.addMessage(
    conversation.createTextMessage("I'll remember this wine for you!")
  );
}

async function handleRecommend(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Implement recommendation flow
}

async function handleEnrichNow(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(true);
  // TODO: Continue with enrichment before adding
}

async function handleAddQuickly(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(false);
  // TODO: Skip enrichment and add directly
}

// ===========================================
// Entity Matching Handlers
// ===========================================

function handleSelectMatch(entityType: EntityType, matchId: number, messageId: string): void {
  conversation.disableMessage(messageId);
  addWine.selectMatchById(entityType, matchId);
  // TODO: Move to next entity or bottle form
}

async function handleAddNew(entityType: EntityType, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Create new entity
}

async function handleClarify(entityType: EntityType, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Ask LLM to clarify entity
}

async function handleAddBottleExisting(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Add bottle to existing wine
  conversation.setPhase('adding_wine', 'bottle_details');
}

function handleCreateNewWine(messageId: string): void {
  conversation.disableMessage(messageId);
  addWine.clearExistingWine();
  // TODO: Continue with entity matching flow
}

// ===========================================
// Form Handlers
// ===========================================

async function handleBottleSubmit(data: import('./types').BottleFormData): Promise<void> {
  addWine.updateBottleFormData(data);
  // TODO: Submit bottle
}

async function handleManualEntrySubmit(data: import('./types').ManualEntryData): Promise<void> {
  // TODO: Handle manual entry submission
}

async function handleManualEntryComplete(data: import('./types').ManualEntryData, messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Complete manual entry flow
}

function handleBottleNext(messageId: string): void {
  conversation.disableMessage(messageId);
  addWine.setBottleFormStep(2);
}

async function handleBottleSubmitFinal(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Submit bottle and complete flow
}

async function handleRetryAdd(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  // TODO: Retry add operation
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
  handleStartOver,
  handleCorrect,
  handleNotCorrect,
};
