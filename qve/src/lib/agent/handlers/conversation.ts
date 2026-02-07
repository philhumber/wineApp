/**
 * Conversation Handlers
 *
 * Handles navigation and session control actions:
 * - start_over: Reset conversation and start fresh
 * - go_back: Return to previous phase
 * - cancel: Close the panel
 * - cancel_request: Abort in-flight LLM request (WIN-187)
 * - retry/try_again: Re-execute the last action
 */

import type { AgentAction } from '../types';
import { getMessageByKey } from '../messages';
import { MessageKey } from '../messageKeys';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { agent, abortCurrentRequest } from '$lib/stores/agent';
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
  | 'cancel_request'
  | 'retry'
  | 'try_again'
  | 'new_input'
  | 'start_fresh'
  | 'start_over_error';

// ===========================================
// Handlers
// ===========================================

/**
 * Handle start_over action.
 * Resets all agent state and starts a new session.
 * Keeps chat history with a divider, adds a fresh greeting.
 */
export function handleStartOver(): void {
  console.log('[Conversation] start_over');

  // Clear all stores
  identification.resetIdentification();
  enrichment.resetEnrichment();
  addWine.resetAddWine();
  clearLastAction();

  // Reset conversation with divider (preserves history, adds divider + greeting)
  conversation.resetConversation();
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
        conversation.createTextMessage(getMessageByKey(MessageKey.CONV_AWAITING_INPUT))
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
        conversation.createTextMessage(getMessageByKey(MessageKey.CONV_ACTION_PROMPT))
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
 * Handle cancel_request action (WIN-187).
 * Aborts in-flight LLM request and shows friendly message with chips.
 */
export function handleCancelRequest(): void {
  console.log('[Conversation] cancel_request');

  // WIN-187: Abort any in-flight HTTP request
  abortCurrentRequest();

  // Clear identification loading state
  identification.clearIdentifying();

  // Clear enrichment loading state
  enrichment.clearEnriching();

  // Remove typing message
  conversation.removeTypingMessage();

  // Reset to awaiting input phase
  conversation.setPhase('awaiting_input');

  // Add friendly cancellation message with action chips
  conversation.addMessage(
    conversation.createTextMessage("No problem, I've stopped. What would you like to do?")
  );

  conversation.addMessage(
    conversation.createChipsMessage([
      { id: 'try_again', label: 'Try Again', action: 'try_again' },
      { id: 'start_over', label: 'Start Over', action: 'start_over' },
    ])
  );
}

/**
 * Handle new_input action.
 * Clears identification and awaits fresh input.
 */
export function handleNewInput(messageId?: string): void {
  console.log('[Conversation] new_input');

  if (messageId) {
    conversation.disableMessage(messageId);
  }

  identification.clearIdentification();
  conversation.setPhase('awaiting_input');
}

/**
 * Handle start_fresh action.
 * Alias for start_over.
 */
export function handleStartFresh(messageId?: string): void {
  console.log('[Conversation] start_fresh');

  if (messageId) {
    conversation.disableMessage(messageId);
  }

  handleStartOver();
}

/**
 * Handle start_over_error action.
 * Error recovery variant - clears state and starts fresh.
 */
export function handleStartOverError(messageId?: string): void {
  console.log('[Conversation] start_over_error');

  if (messageId) {
    conversation.disableMessage(messageId);
  }

  handleStartOver();
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
      conversation.createTextMessage(getMessageByKey(MessageKey.CONV_NOTHING_TO_RETRY))
    );
    conversation.setPhase('awaiting_input');
    return null;
  }

  // Clear error state if present
  identification.clearError();
  // Don't set phase here - let the re-dispatched action handler manage its own phase
  // This prevents invalid phase transitions like identifying → identifying

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
  return [
    'start_over',
    'go_back',
    'cancel',
    'cancel_request',
    'retry',
    'try_again',
    'new_input',
    'start_fresh',
    'start_over_error',
  ].includes(type);
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

    case 'cancel_request':
      handleCancelRequest();
      return null;

    case 'retry':
    case 'try_again':
      return handleRetry();

    case 'new_input':
      handleNewInput(action.messageId);
      return null;

    case 'start_fresh':
      handleStartFresh(action.messageId);
      return null;

    case 'start_over_error':
      handleStartOverError(action.messageId);
      return null;

    default:
      return null;
  }
}
