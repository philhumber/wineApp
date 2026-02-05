/**
 * Conversation Handlers
 *
 * Handles navigation and session control actions:
 * - start_over: Reset conversation and start fresh
 * - go_back: Return to previous phase
 * - cancel: Close the panel
 * - retry/try_again: Re-execute the last action
 */

import type { AgentAction } from '../types';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { agent } from '$lib/stores/agent';
import {
  getLastAction,
  clearLastAction,
} from '../middleware/retryTracker';

// ===========================================
// Handler Type
// ===========================================

type ConversationActionType =
  | 'start_over'
  | 'go_back'
  | 'cancel'
  | 'retry'
  | 'try_again';

// ===========================================
// Handlers
// ===========================================

/**
 * Handle start_over action.
 * Resets all agent state and starts a new session.
 */
export function handleStartOver(): void {
  console.log('[Conversation] start_over');

  // Clear all stores
  identification.resetIdentification();
  enrichment.resetEnrichment();
  addWine.resetAddWine();
  clearLastAction();

  // Reset conversation with divider
  conversation.resetConversation();

  // Phase will be set by startSession
  conversation.startSession();
}

/**
 * Handle go_back action.
 * Returns to the previous phase in the conversation.
 */
export function handleGoBack(): void {
  console.log('[Conversation] go_back');

  const currentPhase = conversation.getCurrentPhase();

  // Determine where to go back to based on current phase
  switch (currentPhase) {
    case 'confirming':
      // Go back to awaiting input
      conversation.setPhase('awaiting_input');
      conversation.addMessage(
        conversation.createTextMessage('Let me know what wine you\'d like to identify.')
      );
      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'take_photo', label: 'Take Photo', action: 'take_photo' },
          { id: 'choose_photo', label: 'Choose Photo', action: 'choose_photo' },
        ])
      );
      break;

    case 'adding_wine':
      // Go back to action selection
      conversation.setPhase('confirming');
      conversation.addMessage(
        conversation.createTextMessage('What would you like to do with this wine?')
      );
      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'add', label: 'Add to Cellar', action: 'add_to_cellar' },
          { id: 'learn', label: 'Learn More', action: 'enrich_now' },
          { id: 'remember', label: 'Remember Later', action: 'remember' },
        ])
      );
      break;

    case 'enriching':
      // Go back to action selection
      conversation.setPhase('confirming');
      break;

    case 'error':
      // Go back to awaiting input
      conversation.setPhase('awaiting_input');
      break;

    default:
      // For greeting or other phases, go to awaiting input
      conversation.setPhase('awaiting_input');
      break;
  }
}

/**
 * Handle cancel action.
 * Closes the agent panel.
 */
export function handleCancel(): void {
  console.log('[Conversation] cancel');
  agent.closePanel();
}

/**
 * Handle retry/try_again action.
 * Re-executes the last tracked action.
 *
 * @returns The action to retry, or null if no action available
 */
export function handleRetry(): AgentAction | null {
  console.log('[Conversation] retry');

  const lastAction = getLastAction();

  if (!lastAction) {
    // No action to retry - show message
    conversation.addMessage(
      conversation.createTextMessage('Nothing to retry. What would you like to identify?')
    );
    conversation.setPhase('awaiting_input');
    return null;
  }

  // Clear error state if present
  identification.clearError();
  conversation.setPhase('identifying');

  // Return the action to be re-dispatched by the router
  return lastAction;
}

// ===========================================
// Action Router
// ===========================================

/**
 * Check if an action type is a conversation action.
 */
export function isConversationAction(type: string): type is ConversationActionType {
  return ['start_over', 'go_back', 'cancel', 'retry', 'try_again'].includes(type);
}

/**
 * Handle a conversation action.
 * Returns the action to retry (if any) for retry/try_again.
 */
export async function handleConversationAction(
  action: AgentAction
): Promise<AgentAction | null> {
  switch (action.type) {
    case 'start_over':
      handleStartOver();
      return null;

    case 'go_back':
      handleGoBack();
      return null;

    case 'cancel':
      handleCancel();
      return null;

    case 'retry':
    case 'try_again':
      return handleRetry();

    default:
      return null;
  }
}
