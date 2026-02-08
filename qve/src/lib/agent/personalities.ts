/**
 * Agent Personalities
 *
 * Defines the personality types and message variant types for the
 * agent message registry with multi-personality support.
 *
 * Currently implemented: SOMMELIER (default)
 * Planned: CASUAL (Nadi), CONCISE, ENTHUSIAST
 *
 * @see docs/SOMMELIER_PERSONALITIES.md
 */

import type { MessageKey } from './messageKeys';

// ===========================================
// Personality Enum
// ===========================================

/**
 * Available agent personalities.
 * Each personality has a distinct voice and tone.
 */
export enum Personality {
  /** Quentin Verre-Épais - Refined & witty (default) */
  SOMMELIER = 'sommelier',

  /** Nadia "Nadi" Rosato - Warm & approachable */
  CASUAL = 'casual',

  /** Concise professional - Minimal, efficient */
  CONCISE = 'concise',

  /** Enthusiastic expert - Excited, passionate */
  ENTHUSIAST = 'enthusiast',
}

// ===========================================
// Message Types
// ===========================================

/**
 * Context provided to template functions.
 * All properties are optional since not all messages need all data.
 */
export interface MessageContext {
  wineName?: string;
  producer?: string;
  vintage?: number | string;
  bottleCount?: number;
  confidence?: number;
  region?: string;
  grape?: string;
  message?: string;
  ref?: string;
  /** Entity type for entity matching flow (region, producer, wine) */
  entityType?: string;
  /** Search term for entity matching */
  searchTerm?: string;
  /** Generic text input (brief search, user query) */
  text?: string;
  /** Number of entity matches found */
  matchCount?: number;
  /** Pre-formatted display name */
  displayName?: string;
  [key: string]: unknown;
}

/**
 * Template function that receives context and returns a message string.
 */
export type MessageTemplate = (context: MessageContext) => string;

/**
 * A message variant can be:
 * - A static string
 * - An array of strings (random selection for variation)
 * - A template function (for dynamic content)
 */
export type MessageVariant = string | readonly string[] | MessageTemplate;

/**
 * Messages for a single personality.
 * Maps MessageKey to message variants.
 */
export type PersonalityMessages = Partial<Record<MessageKey, MessageVariant>>;

// ===========================================
// Personality Metadata
// ===========================================

export interface PersonalityMeta {
  /** Display name for UI */
  name: string;
  /** Short description */
  description: string;
  /** Icon name (for future UI) */
  icon: string;
}

export const personalityMeta: Record<Personality, PersonalityMeta> = {
  [Personality.SOMMELIER]: {
    name: 'Sommelier',
    description: 'Refined and knowledgeable, like a classic wine steward',
    icon: 'wine-glass',
  },
  [Personality.CASUAL]: {
    name: 'Friendly',
    description: 'Warm and approachable, like chatting with a friend',
    icon: 'smile',
  },
  [Personality.CONCISE]: {
    name: 'Concise',
    description: 'Efficient and to-the-point, minimal chatter',
    icon: 'zap',
  },
  [Personality.ENTHUSIAST]: {
    name: 'Enthusiast',
    description: 'Passionate and expressive, loves talking wine',
    icon: 'heart',
  },
};

// ===========================================
// Helper: HTML escaping and wine name styling
// ===========================================

/**
 * Escape HTML special characters to prevent XSS.
 * Must be applied to any user-supplied or LLM-sourced content
 * before interpolation into {@html} rendered templates.
 *
 * @param str - Untrusted string to escape
 * @returns Safe string with <, >, &, ", ' escaped
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Wrap a wine/producer name in a styled span for emphasis.
 * Escapes HTML in the name to prevent XSS from LLM-sourced content.
 * @param name - Wine or producer name to wrap
 */
export const wn = (name: string): string => `<span class="wine-name">${escapeHtml(name)}</span>`;
