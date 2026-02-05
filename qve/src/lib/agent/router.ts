/**
 * Agent Action Router
 *
 * Central router that:
 * 1. Applies middleware chain (error handling, retry tracking, validation)
 * 2. Dispatches actions to appropriate handler modules
 * 3. Delegates to legacy handler for actions not yet migrated
 *
 * This enables gradual migration from the monolithic handleAgentAction.ts
 * to modular handlers while maintaining backwards compatibility.
 *
 * @example
 * import { dispatchAction } from '$lib/agent/router';
 *
 * // Actions are automatically wrapped with middleware
 * await dispatchAction({ type: 'start_over' });
 */

import type { AgentAction } from './types';
import type { ActionHandler } from './middleware/types';
import {
  compose,
  withErrorHandling,
  withRetryTracking,
  withValidation,
} from './middleware';
import {
  isConversationAction,
  handleConversationAction,
} from './handlers';

// Import legacy handler for gradual migration
import { handleAgentAction as legacyHandler } from './handleAgentAction';

// ===========================================
// Handler Registry
// ===========================================

/**
 * Registry of action handlers by category.
 * Each handler returns:
 * - null if the action was fully handled
 * - An AgentAction if it should be re-dispatched (e.g., retry)
 */
type CategoryHandler = (action: AgentAction) => Promise<AgentAction | null>;

const handlerRegistry: Map<string, CategoryHandler> = new Map([
  // Conversation actions are handled by the conversation module
  // Other categories will be added as they are extracted from the monolith
]);

/**
 * Check if an action type has a dedicated handler.
 */
function hasHandler(actionType: string): boolean {
  return isConversationAction(actionType);
  // Future: || isIdentificationAction(actionType)
  //         || isConfirmationAction(actionType)
  //         || etc.
}

// ===========================================
// Core Router Logic
// ===========================================

/**
 * Route an action to the appropriate handler.
 * Handles re-dispatch for retry actions.
 */
async function routeAction(action: AgentAction): Promise<void> {
  console.log('[Router] Routing action:', action.type);

  // Check for conversation actions (start_over, go_back, cancel, retry)
  if (isConversationAction(action.type)) {
    const retryAction = await handleConversationAction(action);

    // If retry returned an action, re-dispatch it
    if (retryAction) {
      console.log('[Router] Re-dispatching retry action:', retryAction.type);
      await routeAction(retryAction);
    }
    return;
  }

  // Future: Add more handler checks here as modules are extracted
  // if (isIdentificationAction(action.type)) {
  //   await handleIdentificationAction(action);
  //   return;
  // }

  // Fallback to legacy handler for actions not yet migrated
  console.log('[Router] Delegating to legacy handler:', action.type);
  await legacyHandler(action);
}

// ===========================================
// Middleware-Wrapped Router
// ===========================================

/**
 * Create the middleware chain.
 * Order matters: first middleware in the list is the outermost wrapper.
 *
 * Execution order for an action:
 * 1. withErrorHandling catches any errors
 * 2. withRetryTracking records the action for retry
 * 3. withValidation checks prerequisites
 * 4. routeAction dispatches to handlers
 */
const middlewareChain = compose(
  withErrorHandling,
  withRetryTracking,
  withValidation
);

/**
 * The fully wrapped router.
 */
const wrappedRouter: ActionHandler = middlewareChain(routeAction);

// ===========================================
// Public API
// ===========================================

/**
 * Dispatch an action through the middleware chain and router.
 *
 * This is the main entry point for handling agent actions.
 * All actions pass through:
 * - Error handling (catches and displays errors)
 * - Retry tracking (stores action for potential retry)
 * - Validation (checks prerequisites)
 *
 * @example
 * // Dispatch a simple action
 * await dispatchAction({ type: 'start_over' });
 *
 * // Dispatch with payload
 * await dispatchAction({ type: 'submit_text', payload: 'Chateau Margaux 2015' });
 */
export async function dispatchAction(action: AgentAction): Promise<void> {
  await wrappedRouter(action);
}

/**
 * Create a custom router with different middleware.
 * Useful for testing or specialized handling.
 *
 * @example
 * const testRouter = createRouter(
 *   withErrorHandling,
 *   withValidation
 *   // No retry tracking for tests
 * );
 */
export function createRouter(...middleware: Parameters<typeof compose>): ActionHandler {
  const chain = compose(...middleware);
  return chain(routeAction);
}

/**
 * Export the raw route function for testing.
 * @internal
 */
export { routeAction as _routeAction };
