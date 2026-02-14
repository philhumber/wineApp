/**
 * Agent Message Registry
 *
 * Single entry point for all agent messages with personality support.
 *
 * Lookup chain:
 *   1. Current personality (e.g. SOMMELIER) → messages/sommelier.ts
 *   2. Neutral fallback → messages/neutral.ts
 *   3. Error (dev: throw, prod: console.error)
 *
 * @see messageKeys.ts for MessageKey enum
 * @see personalities.ts for Personality types
 * @see messages/sommelier.ts for personality messages
 * @see messages/neutral.ts for neutral fallback messages
 */

import { MessageKey } from './messageKeys';
import {
  wn,
  escapeHtml,
  type MessageContext,
  type MessageVariant,
  type MessageTemplate,
} from './personalities';
import { getPersonalityMessages, neutralMessages } from './messages/index';
import { getPersonality } from '$lib/stores/agentSettings';

// Re-export wn and escapeHtml for existing imports
export { wn, escapeHtml };

// ===========================================
// Core Message Access
// ===========================================

/**
 * Pick a random item from an array or return value as-is.
 */
function randomizeVariant(value: MessageVariant): string | MessageTemplate {
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)];
  }
  return value as string | MessageTemplate;
}

/**
 * Resolve a MessageVariant to a string, handling arrays and template functions.
 */
function resolveVariant(
  variant: MessageVariant,
  key: MessageKey,
  context?: MessageContext
): string {
  const resolved = randomizeVariant(variant);

  if (typeof resolved === 'function') {
    if (!context) {
      const errorMsg = `[AgentMessages] Template function requires context: ${key}`;
      if (import.meta.env.DEV) {
        throw new Error(errorMsg);
      }
      console.error(errorMsg);
      return 'Message unavailable';
    }
    return (resolved as MessageTemplate)(context);
  }

  return resolved as string;
}

/**
 * Get a message by key with personality support.
 *
 * Lookup chain:
 *   1. Current personality messages
 *   2. Neutral fallback messages
 *   3. Error
 *
 * @param key - MessageKey enum value
 * @param context - Optional context for template functions
 * @returns Resolved message string
 *
 * @example
 * getMessageByKey(MessageKey.CONFIRM_CORRECT)
 * // → "Excellent. What would you like to do next?" (sommelier)
 *
 * @example
 * getMessageByKey(MessageKey.ID_FOUND, { wineName: 'Château Margaux' })
 * // → "Ah, Château Margaux. I do believe we have a match."
 */
export function getMessageByKey(key: MessageKey, context?: MessageContext): string {
  const personality = getPersonality();

  // 1. Try personality-specific messages
  const messages = getPersonalityMessages(personality);
  let variant = messages[key];

  // 2. Fallback to neutral
  if (variant === undefined) {
    variant = neutralMessages[key];
  }

  // 3. Error if still not found
  if (variant === undefined) {
    const errorMsg = `[AgentMessages] No message found for key: ${key}`;
    if (import.meta.env.DEV) {
      throw new Error(errorMsg);
    }
    console.error(errorMsg);
    return 'Message unavailable';
  }

  return resolveVariant(variant, key, context);
}

/**
 * Get a message array by key (for cycling/sequential display).
 *
 * Unlike getMessageByKey (which picks a random entry from arrays),
 * this returns the full array for components that cycle through messages
 * sequentially (e.g., loading states).
 *
 * Falls back to neutral if the personality doesn't define the key.
 * Non-array variants are wrapped in a single-element array.
 */
export function getMessageArrayByKey(key: MessageKey): string[] {
  const personality = getPersonality();
  const messages = getPersonalityMessages(personality);
  let variant = messages[key];

  if (variant === undefined) {
    variant = neutralMessages[key];
  }

  if (variant === undefined) {
    return [];
  }

  if (Array.isArray(variant)) {
    return [...variant] as string[];
  }

  if (typeof variant === 'string') {
    return [variant];
  }

  // Template function — call with empty context
  if (typeof variant === 'function') {
    return [(variant as MessageTemplate)({})];
  }

  return [];
}

// ===========================================
// Time-based Helpers
// ===========================================

/**
 * Get a greeting message based on time of day.
 *
 * Personality-aware: returns Quentin's greeting when SOMMELIER
 * is active, neutral greeting otherwise.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (3 < hour && hour < 12) {
    return getMessageByKey(MessageKey.GREETING_MORNING);
  } else if (11 < hour && hour < 17) {
    return getMessageByKey(MessageKey.GREETING_AFTERNOON);
  } else {
    return getMessageByKey(MessageKey.GREETING_EVENING);
  }
}

/**
 * Format a message with placeholder values.
 * Values are HTML-escaped to prevent XSS when the result is used in {@html} contexts.
 * @param template - Message template with {placeholder} syntax
 * @param values - Object with placeholder values
 */
export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/{(\w+)}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? escapeHtml(String(value)) : `{${key}}`;
  });
}

// ===========================================
// Helper Functions
// ===========================================

import type { WineIdentificationResult } from './types';

/**
 * Build display name from wine result object.
 * Centralizes name construction logic.
 */
export function buildWineName(result: WineIdentificationResult | null | undefined): string {
  if (!result) return 'this wine';
  return [result.producer, result.wineName].filter(Boolean).join(' ') || 'this wine';
}

/**
 * Get entity matching message with context.
 * Reduces handler boilerplate for entity flows.
 */
export function getEntityMessage(
  key: MessageKey,
  entityType: string,
  additionalContext?: Partial<MessageContext>
): string {
  return getMessageByKey(key, {
    entityType,
    ...additionalContext,
  });
}

/**
 * Pluralize entity type for display.
 * @example pluralizeEntity('region', 3) → 'regions'
 */
export function pluralizeEntity(entityType: string, count: number): string {
  return count === 1 ? entityType : `${entityType}s`;
}
