/**
 * Handlers Module
 *
 * Exports all action handlers organized by category.
 * Each handler module is responsible for a specific set of related actions.
 *
 * @example
 * import { handleConversationAction, isConversationAction } from '$lib/agent/handlers';
 *
 * if (isConversationAction(action.type)) {
 *   await handleConversationAction(action);
 * }
 */

// Conversation handlers (start_over, go_back, cancel, retry)
export {
  handleStartOver,
  handleGoBack,
  handleCancel,
  handleRetry,
  isConversationAction,
  handleConversationAction,
} from './conversation';

// Future handler modules will be exported here:
// export * from './identification';
// export * from './confirmation';
// export * from './entityMatching';
// export * from './enrichment';
// export * from './form';
// export * from './camera';
