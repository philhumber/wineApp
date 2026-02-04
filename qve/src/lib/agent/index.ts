/**
 * Agent Configuration Layer
 * Centralized configuration for the Wine Assistant
 *
 * This module exports types, message templates, loading states, and action configurations
 * used by the agent UI components.
 */

export * from './types';
export * from './messages';
export * from './loadingStates';

// Action handler
export { handleAgentAction } from './handleAgentAction';
