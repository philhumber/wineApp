/**
 * Middleware Module
 *
 * Provides composable middleware for action handling.
 * Middleware wraps handlers to add cross-cutting concerns like
 * error handling, retry tracking, and validation.
 *
 * @example
 * import {
 *   compose,
 *   withErrorHandling,
 *   withRetryTracking,
 *   withValidation
 * } from '$lib/agent/middleware';
 *
 * const pipeline = compose(
 *   withErrorHandling,
 *   withRetryTracking,
 *   withValidation
 * );
 *
 * const wrappedHandler = pipeline(myHandler);
 */

// Types
export type {
  ActionHandler,
  ActionResult,
  Middleware,
  MiddlewareContext,
  ContextAwareHandler,
  ContextAwareMiddleware,
} from './types';

// Composition utilities
export {
  compose,
  applyMiddleware,
  createPipeline,
} from './compose';

// Error handling
export {
  withErrorHandling,
  createErrorHandler,
  extractErrorInfo,
  formatErrorMessage,
  showErrorInConversation,
} from './errorHandler';

// Retry tracking
export {
  withRetryTracking,
  createRetryTracker,
  getLastAction,
  setLastAction,
  clearLastAction,
  canRetry,
  getRetryInfo,
  didLastActionSucceed,
  markLastActionSucceeded,
  lastAction,
} from './retryTracker';

// Validation
export {
  withValidation,
  createValidator,
  validateAction,
  defaultPrerequisites,
} from './validator';
export type {
  ActionPrerequisites,
  ValidationResult,
  ValidatorOptions,
} from './validator';
