/**
 * Agent Action Router
 *
 * Central router that:
 * 1. Normalizes action aliases
 * 2. Applies middleware chain (error handling, retry tracking, validation)
 * 3. Dispatches actions to appropriate handler modules
 *
 * Sprint 6: Final migration - legacy handler removed.
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
  isIdentificationAction,
  handleIdentificationAction,
  isEnrichmentAction,
  handleEnrichmentAction,
  isAddWineAction,
  handleAddWineAction,
  isFormAction,
  handleFormAction,
  isCameraAction,
  handleCameraAction,
  getHandlerCategory,
} from './handlers';
import { unlockScroll } from '$lib/stores/agent';

// ===========================================
// Action Aliases
// ===========================================

/**
 * Action aliases for backwards compatibility and UI convenience.
 * Maps old/convenience names to canonical action types.
 */
const ACTION_ALIASES: Record<string, string> = {
  // Add Wine aliases
  add: 'add_to_cellar',

  // Enrichment aliases
  remember_wine: 'remember',
};

/**
 * Normalize action by resolving aliases.
 */
function normalizeAction(action: AgentAction): AgentAction {
  const normalizedType = ACTION_ALIASES[action.type] || action.type;

  if (normalizedType !== action.type) {
    console.log(`[Router] Alias resolved: ${action.type} → ${normalizedType}`);
    return { ...action, type: normalizedType } as AgentAction;
  }

  return action;
}

// ===========================================
// Handler Registry
// ===========================================

/**
 * Check if an action type has a dedicated handler.
 */
function hasHandler(actionType: string): boolean {
  return (
    isConversationAction(actionType) ||
    isIdentificationAction(actionType) ||
    isEnrichmentAction(actionType) ||
    isAddWineAction(actionType) ||
    isFormAction(actionType) ||
    isCameraAction(actionType)
  );
}

// ===========================================
// Core Router Logic
// ===========================================

/**
 * Route an action to the appropriate handler.
 * Handles re-dispatch for retry actions.
 */
async function routeAction(action: AgentAction): Promise<void> {
  // Normalize aliases first
  action = normalizeAction(action);

  console.log('[Router] Routing action:', action.type);

  // Safety net: Handle generic chip_tap (unwrap and re-route)
  if (action.type === 'chip_tap') {
    const payload = action.payload as {
      action: string;
      messageId: string;
      data?: unknown;
    };
    console.warn('[Router] Generic chip_tap used - should be specific action', payload);

    const unwrapped: AgentAction = {
      type: payload.action,
      messageId: payload.messageId,
      payload: payload.data,
    } as AgentAction;

    await routeAction(unwrapped);
    return;
  }

  // Check for conversation actions (start_over, go_back, cancel, retry, etc.)
  if (isConversationAction(action.type)) {
    const retryAction = await handleConversationAction(action);

    // If retry returned an action, re-dispatch it
    if (retryAction) {
      console.log('[Router] Re-dispatching retry action:', retryAction.type);
      await routeAction(retryAction);
    }
    return;
  }

  // Check for identification actions
  if (isIdentificationAction(action.type)) {
    console.log('[Router] Handling identification action:', action.type);
    await handleIdentificationAction(action);
    return;
  }

  // Check for enrichment actions
  if (isEnrichmentAction(action.type)) {
    console.log('[Router] Handling enrichment action:', action.type);
    await handleEnrichmentAction(action);
    return;
  }

  // Check for add wine actions
  if (isAddWineAction(action.type)) {
    console.log('[Router] Handling add wine action:', action.type);
    await handleAddWineAction(action);
    return;
  }

  // Check for form actions
  if (isFormAction(action.type)) {
    console.log('[Router] Handling form action:', action.type);
    await handleFormAction(action);
    return;
  }

  // Check for camera actions
  if (isCameraAction(action.type)) {
    console.log('[Router] Handling camera action:', action.type);
    handleCameraAction(action);
    return;
  }

  // No handler found - log error
  console.error('[Router] No handler found for action:', action.type);

  if (import.meta.env.DEV) {
    throw new Error(`No handler for action: ${action.type}`);
  }
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
 * - Alias normalization
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
  // Clear scroll lock on any user action (chip tap, start over, etc)
  unlockScroll();
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
 * Export for use in index.ts barrel
 * Backwards-compatible alias for handleAgentAction
 */
export { dispatchAction as handleAgentAction };

/**
 * Export the raw route function for testing.
 * @internal
 */
export { routeAction as _routeAction };

/**
 * Export hasHandler for testing.
 * @internal
 */
export { hasHandler as _hasHandler };
