/**
 * Agent Message Registry
 * Centralized configuration for all agent messages
 *
 * All agent "speech" is defined here for:
 * - Consistent tone and personality
 * - Easy i18n support in the future
 * - Single source of truth for message content
 *
 * Phase 2 Sprint 4 adds:
 * - Type-safe MessageKey enum access via getMessageByKey()
 * - Personality support (SOMMELIER default, others planned)
 *
 * @see messageKeys.ts for MessageKey enum
 * @see personalities.ts for Personality types
 * @see messages/sommelier.ts for sommelier messages
 */

import { MessageKey } from './messageKeys';
import {
  Personality,
  wn,
  type MessageContext,
  type MessageVariant,
  type MessageTemplate,
} from './personalities';
import { getPersonalityMessages } from './messages/index';
import { getPersonality } from '$lib/stores/agentSettings';

// Re-export wn for backwards compatibility with existing imports
export { wn };

// ===========================================
// Message Registry (NEW - Type-Safe Access)
// ===========================================

/**
 * Pick a random item from an array or return value as-is.
 * For the new MessageVariant type system.
 */
function randomizeVariant(value: MessageVariant): string | MessageTemplate {
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)];
  }
  return value as string | MessageTemplate;
}

/**
 * Get a message by key with personality support.
 *
 * Looks up the message for the current personality setting.
 * Falls back to SOMMELIER if the message isn't defined for the current personality.
 *
 * @param key - MessageKey enum value
 * @param context - Optional context for template functions
 * @returns Resolved message string
 *
 * @example
 * // Simple message
 * getMessageByKey(MessageKey.CONFIRM_CORRECT)
 * // → "Great! What would you like to do next?"
 *
 * @example
 * // Template message
 * getMessageByKey(MessageKey.ID_FOUND, { wineName: 'Château Margaux' })
 * // → "I found <span class=\"wine-name\">Château Margaux</span>. Is this correct?"
 */
export function getMessageByKey(key: MessageKey, context?: MessageContext): string {
  const personality = getPersonality();

  // Get personality-specific messages
  const messages = getPersonalityMessages(personality);
  let variant = messages[key];

  // Fallback to SOMMELIER if message not found for this personality
  if (variant === undefined && personality !== Personality.SOMMELIER) {
    const fallbackMessages = getPersonalityMessages(Personality.SOMMELIER);
    variant = fallbackMessages[key];
  }

  // Final fallback: throw in DEV, return user-friendly message in production
  if (variant === undefined) {
    const errorMsg = `[AgentMessages] No message found for key: ${key}`;
    if (import.meta.env.DEV) {
      throw new Error(errorMsg);
    }
    console.error(errorMsg);
    return 'Message unavailable';
  }

  // Handle array (random selection)
  const resolved = randomizeVariant(variant);

  // Handle template function
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

// ===========================================
// Legacy Message Registry (Backwards Compatible)
// ===========================================

/**
 * Pick a random item from an array or return string as-is.
 * For legacy agentMessages object (readonly string arrays).
 */
function randomizeLegacy(value: string | readonly string[]): string {
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)];
  }
  return value as string;
}

export const agentMessages = {
  greeting: {
    morning: [
      "Good morning! I'm your wine sommelier. What can I help you with today?",
      "Morning! Ready to add some wines to your collection?",
      "Good morning! What wine adventure shall we start today?",
      "Rise and shine! Let's find your next great bottle.",
      "Good morning! I'm here to help with your cellar.",
    ],
    afternoon: [
      "Good afternoon! Ready to explore some wines?",
      "Afternoon! What wine can I help you discover?",
      "Good afternoon! Looking to add to your collection?",
      "Hello there! What brings you to the cellar today?",
      "Good afternoon! Let's find something special.",
    ],
    evening: [
      "Good evening! Let's find the perfect wine for you.",
      "Evening! Time to explore some wines?",
      "Good evening! What can I help you uncork tonight?",
      "Good evening! Ready to discover something special?",
      "Evening! Let's find the perfect bottle for tonight.",
    ],
    default: "Hello! I'm your wine sommelier. How can I help you today?",
  },

  identification: {
    thinking: "Let me identify that wine...",
    analyzing: "Analyzing the label...",
    found: "I think I found what you're looking for. Is this correct?",
    notFound: "I couldn't identify that wine. Could you tell me more about it?",
    lowConfidence: "I'm not entirely sure, but this might be what you're looking for.",
    escalating: "Let me take a closer look at this...",
    multipleMatches: "I found a few possibilities. Which one looks right?",
    needMoreInfo: "I need a bit more information to identify this wine.",
    missingWineName: "I found the producer but couldn't identify the specific wine. Would you like to add details or use a suggestion?",
    missingVintage: "I couldn't determine the vintage. Is this a non-vintage wine, or would you like to specify?",
    missingProducer: "I identified the wine but couldn't determine the producer. Who makes this wine?",
    incomplete: "This result is missing some details. How would you like to proceed?",
    suggestReidentify: "Thanks for filling in the gaps! I can try to identify this wine again with the complete information - I might find a better match. Or you can continue with your manually entered details.",
  },

  confirm: {
    correct: "Great! What would you like to do next?",
    incorrect: "No problem. What did I get wrong?",
    newSearch: "Did you want to search for something new instead?",
    keepCurrent: "Alright, let's continue with the current wine.",
  },

  addFlow: {
    start: "Let's add this to your cellar.",
    regionPrompt: "Which region is this wine from?",
    producerPrompt: "Who makes this wine?",
    winePrompt: "Which wine is this?",
    duplicateFound: "I found this wine already in your cellar.",
    bottlePrompt: "Tell me about this bottle.",
    enrichmentPrompt: "Would you like me to gather more details about this wine?",
    addComplete: "Added to your cellar!",
    addFailed: "I couldn't add this wine to your cellar. Please try again.",
  },

  enrichment: {
    loading: "Gathering details about this wine...",
    complete: "Here's what I found.",
    noData: "I couldn't find additional details for this wine.",
    cached: "I have some details saved for this wine.",
  },

  errors: {
    timeout: "Our sommelier is taking longer than expected. Please try again.",
    rateLimit: "Our sommelier is quite busy at the moment. Please wait a moment.",
    limitExceeded: "We've reached our tasting limit for today. Please try again tomorrow.",
    generic: "Something went wrong. Please try again.",
    imageUnclear: "That image is a bit unclear. Could you try a clearer photo?",
    network: "Connection issue. Please check your network and try again.",
    noResult: "I don't have a wine to work with. Please identify a wine first.",
  },

  chips: {
    addToCellar: "Add to Cellar",
    learnMore: "Learn More",
    remember: "Remember",
    correct: "Correct",
    notCorrect: "Not Correct",
    tryAgain: "Try Again",
    startOver: "Start Over",
    cancel: "Cancel",
    yes: "Yes",
    no: "No",
    addDetails: "Add Details",
    tryHarder: "Try Harder",
    startFresh: "Start Fresh",
    provideMore: "Provide More",
    useProducerName: "Use Producer Name",
    useGrapeName: "Use Grape Name",
    nonVintage: "Non-Vintage",
    specifyVintage: "Specify Vintage",
    looksGood: "Looks Good",
    reidentify: "Re-identify",
    continueAsIs: "Continue As-Is",
  },
} as const;

// ===========================================
// Type-Safe Message Access
// ===========================================

// Type for legacy getMessage path validation (kept for reference)
type _MessagePath = {
  greeting: keyof typeof agentMessages.greeting;
  identification: keyof typeof agentMessages.identification;
  confirm: keyof typeof agentMessages.confirm;
  addFlow: keyof typeof agentMessages.addFlow;
  enrichment: keyof typeof agentMessages.enrichment;
  errors: keyof typeof agentMessages.errors;
  chips: keyof typeof agentMessages.chips;
};

type MessageCategory = keyof typeof agentMessages;

/**
 * Get a message from the registry.
 * @param path - Dot-separated path like 'greeting.morning' or 'errors.timeout'
 */
export function getMessage(path: string): string {
  const [category, key] = path.split('.') as [MessageCategory, string];

  if (!category || !key) {
    console.warn(`[AgentMessages] Invalid path: ${path}`);
    return path;
  }

  const categoryMessages = agentMessages[category];
  if (!categoryMessages) {
    console.warn(`[AgentMessages] Unknown category: ${category}`);
    return path;
  }

  const message = (categoryMessages as Record<string, string>)[key];
  if (!message) {
    console.warn(`[AgentMessages] Unknown message: ${path}`);
    return path;
  }

  return message;
}

/**
 * Get a greeting message based on time of day.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (3 < hour && hour < 12) {
    return randomizeLegacy(agentMessages.greeting.morning);
  } else if (11 < hour && hour < 17) {
    return randomizeLegacy(agentMessages.greeting.afternoon);
  } else {
    return randomizeLegacy(agentMessages.greeting.evening);
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
