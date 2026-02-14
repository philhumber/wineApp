/**
 * Error Handler Middleware
 *
 * Provides unified error handling for all action handlers.
 * Extracts error information, displays user-friendly messages,
 * and offers retry options when appropriate.
 */

import type { Middleware, ActionHandler } from './types';
import type { AgentErrorInfo } from '../types';
import type { AgentErrorType } from '$lib/api/types';
import { AgentError } from '$lib/api/types';
import { getMessageByKey } from '../messages';
import { MessageKey } from '../messageKeys';
import { ChipKey, getChips } from '../services/chipRegistry';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';

/**
 * Extract structured error information from any error type.
 */
export function extractErrorInfo(error: unknown): AgentErrorInfo {
  if (AgentError.isAgentError(error)) {
    return {
      type: error.type as AgentErrorType,
      userMessage: error.userMessage,
      retryable: error.retryable,
      supportRef: error.supportRef ?? undefined,
    };
  }

  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return {
        type: 'timeout',
        userMessage: getMessageByKey(MessageKey.ERROR_TIMEOUT),
        retryable: true,
      };
    }

    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return {
        type: 'rate_limit',
        userMessage: getMessageByKey(MessageKey.ERROR_RATE_LIMIT),
        retryable: true,
      };
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return {
        type: 'server_error',
        userMessage: getMessageByKey(MessageKey.ERROR_NETWORK),
        retryable: true,
      };
    }

    return {
      type: 'server_error',
      userMessage: error.message || getMessageByKey(MessageKey.ERROR_GENERIC),
      retryable: true,
    };
  }

  return {
    type: 'unknown',
    userMessage: getMessageByKey(MessageKey.ERROR_GENERIC),
    retryable: true,
  };
}

/**
 * Format error message with optional support reference.
 */
export function formatErrorMessage(errorInfo: AgentErrorInfo): string {
  if (errorInfo.supportRef) {
    return `${errorInfo.userMessage}\n\nReference: ${errorInfo.supportRef}`;
  }
  return errorInfo.userMessage;
}

/**
 * Add error message to conversation with retry chips if applicable.
 */
export function showErrorInConversation(
  errorInfo: AgentErrorInfo,
  options: {
    setIdentificationError?: boolean;
    showRetryChips?: boolean;
  } = {}
): void {
  const { setIdentificationError = false, showRetryChips = true } = options;

  // Set error in identification store if requested
  if (setIdentificationError) {
    identification.setError(errorInfo);
  }

  // Add error message
  conversation.addMessage({
    category: 'error',
    role: 'agent',
    data: {
      category: 'error',
      error: errorInfo,
      retryable: errorInfo.retryable,
    },
  });

  // Add retry chips if error is retryable and chips requested
  if (showRetryChips && errorInfo.retryable) {
    conversation.addMessage(
      conversation.createChipsMessage(getChips(ChipKey.RETRY, ChipKey.START_OVER))
    );
  }
}

/**
 * Error handling middleware.
 *
 * Wraps handlers to catch errors and display user-friendly messages.
 * Sets the conversation phase to 'error' on failure.
 *
 * @example
 * const handler = withErrorHandling(async (action) => {
 *   // This error will be caught and displayed nicely
 *   throw new Error('Something went wrong');
 * });
 */
export const withErrorHandling: Middleware = (handler: ActionHandler) => {
  return async (action) => {
    try {
      await handler(action);
    } catch (error) {
      console.error(`[AgentAction] Error handling ${action.type}:`, error);

      const errorInfo = extractErrorInfo(error);

      // Show error in conversation
      showErrorInConversation(errorInfo, {
        setIdentificationError: true,
        showRetryChips: true,
      });

      // Set phase to error
      conversation.setPhase('error');
    }
  };
};

/**
 * Create a custom error handling middleware with specific options.
 *
 * @example
 * const silentErrorHandler = createErrorHandler({
 *   showRetryChips: false,
 *   onError: (error, action) => analytics.track('error', { action: action.type })
 * });
 */
export function createErrorHandler(options: {
  showRetryChips?: boolean;
  setIdentificationError?: boolean;
  setPhase?: boolean;
  onError?: (error: unknown, action: unknown) => void;
}): Middleware {
  const {
    showRetryChips = true,
    setIdentificationError = true,
    setPhase = true,
    onError,
  } = options;

  return (handler: ActionHandler) => {
    return async (action) => {
      try {
        await handler(action);
      } catch (error) {
        console.error(`[AgentAction] Error handling ${action.type}:`, error);

        const errorInfo = extractErrorInfo(error);

        // Call custom error handler if provided
        onError?.(error, action);

        // Show error in conversation
        showErrorInConversation(errorInfo, {
          setIdentificationError,
          showRetryChips,
        });

        // Set phase to error if requested
        if (setPhase) {
          conversation.setPhase('error');
        }
      }
    };
  };
}
