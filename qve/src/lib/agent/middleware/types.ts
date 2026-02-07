/**
 * Middleware Types
 *
 * Defines the core types for the middleware system used in action handling.
 * Middleware allows composable, reusable cross-cutting concerns like
 * error handling, retry tracking, and validation.
 */

import type { AgentAction } from '../types';

/**
 * Result of an action handler execution.
 * Handlers can return void (success) or throw errors.
 */
export type ActionResult = void;

/**
 * Core action handler function type.
 * Takes an action and returns a promise that resolves on success.
 */
export type ActionHandler<T extends AgentAction = AgentAction> = (
  action: T
) => Promise<ActionResult>;

/**
 * Middleware function type.
 * Takes a handler and returns a wrapped handler with additional behavior.
 *
 * @example
 * const withLogging: Middleware = (handler) => async (action) => {
 *   console.log('Before:', action.type);
 *   await handler(action);
 *   console.log('After:', action.type);
 * };
 */
export type Middleware = (handler: ActionHandler) => ActionHandler;

/**
 * Middleware context passed through the chain.
 * Can be extended to carry additional state between middleware.
 */
export interface MiddlewareContext {
  /** The original action being processed */
  action: AgentAction;
  /** Timestamp when processing started */
  startTime: number;
  /** Whether the action has been handled */
  handled: boolean;
  /** Any metadata to pass through the chain */
  metadata: Record<string, unknown>;
}

/**
 * Extended action handler that receives context.
 * Used for middleware that needs to share state.
 */
export type ContextAwareHandler = (
  action: AgentAction,
  context: MiddlewareContext
) => Promise<ActionResult>;

/**
 * Context-aware middleware type.
 */
export type ContextAwareMiddleware = (
  handler: ContextAwareHandler
) => ContextAwareHandler;
