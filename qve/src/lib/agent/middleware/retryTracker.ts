/**
 * Retry Tracker Middleware
 *
 * Tracks the last executed action to enable retry functionality.
 * Uses a Svelte store instead of module-level variables for better
 * testability and reactivity.
 */

import { writable, get } from 'svelte/store';
import type { Middleware, ActionHandler } from './types';
import type { AgentAction } from '../types';

// ===========================================
// Types
// ===========================================

interface LastActionState {
  /** The last retryable action */
  action: AgentAction | null;
  /** When the action was executed */
  timestamp: number;
  /** Whether the action succeeded */
  succeeded: boolean;
}

interface RetryTrackerOptions {
  /** How long to keep actions for retry (ms). Default: 5 minutes */
  expirationMs?: number;
  /** Action types that should be tracked. Default: all retryable actions */
  trackableActions?: Set<string>;
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Actions that make sense to retry.
 * These are typically actions that make API calls.
 */
const DEFAULT_RETRYABLE_ACTIONS = new Set([
  // Identification
  'submit_text',
  'submit_image',
  'try_opus',
  'reidentify',

  // Enrichment
  'learn',
  'enrich_now',
  'confirm_cache_match',
  'force_refresh',
  'remember',
  'recommend',

  // Add wine
  'add_to_cellar',
  'submit_bottle',
  'add_bottle_existing',

  // Forms
  'manual_entry_submit',
]);

// ===========================================
// Store
// ===========================================

const initialState: LastActionState = {
  action: null,
  timestamp: 0,
  succeeded: false,
};

const lastActionStore = writable<LastActionState>(initialState);

// ===========================================
// Store Accessors
// ===========================================

/**
 * Get the last action if it's still valid (not expired).
 */
export function getLastAction(expirationMs = DEFAULT_EXPIRATION_MS): AgentAction | null {
  const state = get(lastActionStore);

  if (!state.action) {
    return null;
  }

  // Check if action has expired
  if (Date.now() - state.timestamp > expirationMs) {
    return null;
  }

  return state.action;
}

/**
 * Check if the last action succeeded.
 */
export function didLastActionSucceed(): boolean {
  return get(lastActionStore).succeeded;
}

/**
 * Clear the tracked action.
 * Should be called on session reset.
 */
export function clearLastAction(): void {
  lastActionStore.set(initialState);
}

/**
 * Manually set the last action (useful for testing).
 */
export function setLastAction(action: AgentAction, succeeded = false): void {
  lastActionStore.set({
    action,
    timestamp: Date.now(),
    succeeded,
  });
}

/**
 * Mark the last action as succeeded.
 */
export function markLastActionSucceeded(): void {
  lastActionStore.update((state) => ({
    ...state,
    succeeded: true,
  }));
}

/**
 * Subscribe to last action changes (for reactivity).
 */
export const lastAction = {
  subscribe: lastActionStore.subscribe,
};

// ===========================================
// Middleware
// ===========================================

/**
 * Retry tracking middleware.
 *
 * Tracks retryable actions so they can be re-executed on retry.
 * The last action is stored with a timestamp and cleared after expiration.
 *
 * @example
 * const handler = withRetryTracking(async (action) => {
 *   await api.identifyText(action.payload.text);
 * });
 *
 * // Later, get the last action for retry
 * const lastAction = getLastAction();
 * if (lastAction) {
 *   await handleAgentAction(lastAction);
 * }
 */
export const withRetryTracking: Middleware = (handler: ActionHandler) => {
  return async (action) => {
    const isRetryable = DEFAULT_RETRYABLE_ACTIONS.has(action.type);

    // Track action before execution if retryable
    if (isRetryable) {
      lastActionStore.set({
        action,
        timestamp: Date.now(),
        succeeded: false,
      });
    }

    // Execute handler
    await handler(action);

    // Mark as succeeded if we get here (no exception)
    if (isRetryable) {
      markLastActionSucceeded();
    }
  };
};

/**
 * Create a retry tracking middleware with custom options.
 *
 * @example
 * const customTracker = createRetryTracker({
 *   expirationMs: 10 * 60 * 1000, // 10 minutes
 *   trackableActions: new Set(['submit_text', 'submit_image']),
 * });
 */
export function createRetryTracker(options: RetryTrackerOptions = {}): Middleware {
  const {
    trackableActions = DEFAULT_RETRYABLE_ACTIONS,
  } = options;

  return (handler: ActionHandler) => {
    return async (action) => {
      const isRetryable = trackableActions.has(action.type);

      if (isRetryable) {
        lastActionStore.set({
          action,
          timestamp: Date.now(),
          succeeded: false,
        });
      }

      await handler(action);

      if (isRetryable) {
        markLastActionSucceeded();
      }
    };
  };
}

// ===========================================
// Helpers for Retry Action
// ===========================================

/**
 * Check if there's a valid action to retry.
 */
export function canRetry(expirationMs = DEFAULT_EXPIRATION_MS): boolean {
  return getLastAction(expirationMs) !== null;
}

/**
 * Get retry info for display purposes.
 */
export function getRetryInfo(): {
  canRetry: boolean;
  actionType: string | null;
  ageMs: number | null;
} {
  const state = get(lastActionStore);

  if (!state.action) {
    return { canRetry: false, actionType: null, ageMs: null };
  }

  const ageMs = Date.now() - state.timestamp;
  const isExpired = ageMs > DEFAULT_EXPIRATION_MS;

  return {
    canRetry: !isExpired,
    actionType: state.action.type,
    ageMs,
  };
}
