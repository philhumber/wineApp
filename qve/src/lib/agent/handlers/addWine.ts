/**
 * Add Wine Handlers
 *
 * Handles all add-wine-related actions:
 * - add_to_cellar: Start add wine flow with duplicate check
 * - add_bottle_existing: Add bottle to existing wine (duplicate flow)
 * - create_new_wine: Create new wine despite duplicate
 * - select_match: User selected entity from matches
 * - add_new: User creating new entity
 * - clarify: LLM clarification for entity selection
 * - enrich_now: Enrich during add flow then submit
 * - add_quickly: Skip enrichment and submit
 *
 * Sprint 3 extraction from handleAgentAction.ts monolith.
 */

import type { AgentAction, EntityType, AgentErrorInfo, WineIdentificationResult, BottleFormData } from '../types';
import type { AddWineFlowState } from '$lib/stores/agentAddWine';
import type { AddWinePayload } from '$lib/api/types';
import { AgentError } from '$lib/api/types';
import { getMessage, messageTemplates, wn } from '../messages';
import * as conversation from '$lib/stores/agentConversation';
import { addMessageWithDelay } from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as addWine from '$lib/stores/agentAddWine';
import { api } from '$lib/api';
import {
  generateDuplicateWineChips,
  generateEnrichmentChoiceChips,
  generateAddRetryChips,
  generateAddCompleteChips,
} from '../services/chipGenerator';

// ===========================================
// Error Handling
// ===========================================

/**
 * Handle add wine errors with user-friendly messages.
 * Follows the same pattern as identification and enrichment handlers.
 */
function handleAddWineError(error: unknown, context: 'submit' | 'bottle'): AgentErrorInfo {
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
      type: 'server_error',
      userMessage: getMessage('errors.generic'),
      retryable: true,
    };
  }

  return errorInfo;
}

// ===========================================
// Action Types
// ===========================================

type AddWineActionType =
  | 'add_to_cellar'
  | 'add_bottle_existing'
  | 'create_new_wine'
  | 'select_match'
  | 'add_new'
  | 'clarify'
  | 'enrich_now'
  | 'add_quickly';

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

// ===========================================
// Payload Building & Submission
// ===========================================

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
      conversation.createChipsMessage(generateAddCompleteChips())
    );
  } catch (error) {
    const errorInfo = handleAddWineError(error, 'submit');
    addWine.setSubmissionError(errorInfo);

    conversation.addMessage(
      conversation.createTextMessage(errorInfo.userMessage || getMessage('addFlow.addFailed'))
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateAddRetryChips())
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
      conversation.createChipsMessage(generateAddCompleteChips())
    );
  } catch (error) {
    const errorInfo = handleAddWineError(error, 'bottle');
    addWine.setSubmissionError(errorInfo);

    conversation.addMessage(
      conversation.createTextMessage(errorInfo.userMessage || 'Something went wrong adding the bottle.')
    );

    conversation.addMessage(
      conversation.createChipsMessage(generateAddRetryChips())
    );
  }
}

// ===========================================
// Action Handlers
// ===========================================

/**
 * Handle add_to_cellar action.
 * Starts the add wine flow with duplicate checking.
 */
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
        conversation.createChipsMessage(generateDuplicateWineChips())
      );
      return;
    }
  } catch (error) {
    console.warn('Duplicate check failed, continuing with add flow:', error);
  }

  // No duplicate - start entity matching
  await startEntityMatching();
}

/**
 * Handle add_bottle_existing action.
 * Skips entity matching and goes straight to bottle form.
 */
async function handleAddBottleExisting(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);

  // Skip entity matching, go straight to bottle form
  await showBottleForm();
}

/**
 * Handle create_new_wine action.
 * Clears existing wine and starts entity matching.
 */
async function handleCreateNewWine(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.clearExistingWine();

  await addMessageWithDelay(
    conversation.createTextMessage("I'll create this as a new wine entry.")
  );

  // Continue with entity matching flow
  await startEntityMatching();
}

/**
 * Handle select_match action.
 * User selected an entity from the match list.
 */
async function handleSelectMatch(entityType: EntityType, matchId: number, messageId: string): Promise<void> {
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
  await advanceEntityMatching(entityType);
}

/**
 * Handle add_new action.
 * User chose to create a new entity.
 */
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

/**
 * Handle clarify action.
 * Request LLM clarification for entity selection.
 */
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

/**
 * Handle enrich_now action.
 * Enrich during add flow, then submit.
 */
async function handleEnrichNow(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(true);

  // For now, submit and enrich in background (future: enrich first)
  // The enrichment will happen after the wine is added
  await submitWine();
}

/**
 * Handle add_quickly action.
 * Skip enrichment and submit directly.
 */
async function handleAddQuickly(messageId: string): Promise<void> {
  conversation.disableMessage(messageId);
  addWine.setEnrichNow(false);

  // Skip enrichment and add directly
  await submitWine();
}

// ===========================================
// Type Guard & Router
// ===========================================

/**
 * Check if an action type is an add wine action.
 */
export function isAddWineAction(type: string): type is AddWineActionType {
  return [
    'add_to_cellar',
    'add_bottle_existing',
    'create_new_wine',
    'select_match',
    'add_new',
    'clarify',
    'enrich_now',
    'add_quickly',
  ].includes(type);
}

/**
 * Handle an add wine action.
 */
export async function handleAddWineAction(action: AgentAction): Promise<void> {
  switch (action.type) {
    case 'add_to_cellar':
      await handleAddToCellar(action.messageId ?? '');
      break;

    case 'add_bottle_existing':
      await handleAddBottleExisting(action.messageId ?? '');
      break;

    case 'create_new_wine':
      await handleCreateNewWine(action.messageId ?? '');
      break;

    case 'select_match':
      const selectPayload = action.payload as { entityType: EntityType; matchId: number };
      await handleSelectMatch(selectPayload.entityType, selectPayload.matchId, action.messageId ?? '');
      break;

    case 'add_new':
      const addNewPayload = action.payload as { entityType: EntityType };
      await handleAddNew(addNewPayload.entityType, action.messageId ?? '');
      break;

    case 'clarify':
      const clarifyPayload = action.payload as { entityType: EntityType };
      await handleClarify(clarifyPayload.entityType, action.messageId ?? '');
      break;

    case 'enrich_now':
      await handleEnrichNow(action.messageId ?? '');
      break;

    case 'add_quickly':
      await handleAddQuickly(action.messageId ?? '');
      break;
  }
}
