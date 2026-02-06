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
  type MessageContext,
  type MessageVariant,
  type MessageTemplate,
} from './personalities';
import { getPersonalityMessages, neutralMessages } from './messages/index';
import { getPersonality } from '$lib/stores/agentSettings';

// Re-export wn for existing imports
export { wn };

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

// ===========================================
// Legacy Bridges (delegates to personality system)
// ===========================================

/**
 * Get a message by dot-path (e.g. 'errors.generic').
 *
 * Bridge: paths like 'errors.generic' match MessageKey values
 * directly, so this delegates to getMessageByKey().
 *
 * @deprecated Use getMessageByKey(MessageKey.X) for new code.
 */
export function getMessage(path: string): string {
  return getMessageByKey(path as MessageKey);
}

/**
 * Get a greeting message based on time of day.
 *
 * Now personality-aware: returns Quentin's greeting when SOMMELIER
 * is active, neutral greeting otherwise.
 *
 * @deprecated Use getMessageByKey(MessageKey.GREETING_*) for new code.
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
 * @param template - Message template with {placeholder} syntax
 * @param values - Object with placeholder values
 */
export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/{(\w+)}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

// ===========================================
// Message Templates with Variables
// ===========================================

/**
 * Parameterized message templates used by handlers.
 *
 * These contain branching logic (e.g. confidence thresholds)
 * that doesn't fit the simple MessageKey model. Handlers will
 * migrate to getMessageByKey() over time.
 *
 * @deprecated Migrate to getMessageByKey() with MessageContext.
 */
export const messageTemplates = {
  identification: {
    found: (wineName: string) => `I found ${wn(wineName)}. Is this correct?`,
    foundWithConfidence: (wineName: string, confidence: number) =>
      confidence < 0.7
        ? `I think this might be ${wn(wineName)}, but I'm not entirely sure. Is this correct?`
        : `I found ${wn(wineName)}. Is this correct?`,
    incompleteWithProducer: (producer: string) =>
      `I identified ${wn(producer)} as the producer, but I couldn't determine the specific wine name. Would you like to:`,
    incompleteWithGrapes: (producer: string | undefined, grape: string) =>
      producer
        ? `I found ${wn(producer)} and detected ${wn(grape)} as the grape variety. Should I use this as the wine name?`
        : `I detected ${wn(grape)} as the grape variety but couldn't identify the producer. Should I use the grape as the wine name?`,
    missingVintagePrompt: (wineName: string) =>
      `I couldn't find a vintage for ${wn(wineName)}. Is this a non-vintage wine?`,
    missingProducerPrompt: (wineName: string) =>
      `I identified ${wn(wineName)} but couldn't determine the producer. Who makes this wine?`,
    lowConfidencePrompt: (wineName: string, confidence: number) =>
      `I'm only ${Math.round(confidence * 100)}% confident about ${wn(wineName)}. Would you like me to try harder, or would you like to add details?`,
  },

  addFlow: {
    duplicateFound: (wineName: string, bottleCount: number) =>
      `I found ${wn(wineName)} already in your cellar with ${bottleCount} bottle${bottleCount !== 1 ? 's' : ''}.`,
    addComplete: (wineName: string) => `Added ${wn(wineName)} to your cellar!`,
  },

  errors: {
    withReference: (message: string, ref: string) => `${message}\n\nReference: ${ref}`,
  },
} as const;
