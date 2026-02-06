/**
 * Message Registry Loader
 *
 * Loads personality-specific message registries.
 * Falls back to neutral messages if a key is missing for a personality.
 */

import { Personality, type PersonalityMessages } from '../personalities';
import { sommelierMessages } from './sommelier';
import { neutralMessages } from './neutral';

// Future personality imports:
// import { casualMessages } from './casual';
// import { conciseMessages } from './concise';
// import { enthusiastMessages } from './enthusiast';

// Re-export for direct fallback access in messages.ts
export { neutralMessages };

/**
 * Registry mapping personality to messages.
 * Empty objects for unimplemented personalities will fallback to neutral.
 */
const messageRegistries: Record<Personality, PersonalityMessages> = {
  [Personality.SOMMELIER]: sommelierMessages,
  [Personality.CASUAL]: {}, // To be implemented
  [Personality.CONCISE]: {}, // To be implemented
  [Personality.ENTHUSIAST]: {}, // To be implemented
};

/**
 * Get messages for a personality.
 * @param personality - The personality to get messages for
 * @returns Messages for that personality (may be empty if not implemented)
 */
export function getPersonalityMessages(personality: Personality): PersonalityMessages {
  return messageRegistries[personality] || {};
}

/**
 * Check if a personality has messages implemented.
 * @param personality - The personality to check
 */
export function hasPersonalityMessages(personality: Personality): boolean {
  const messages = messageRegistries[personality];
  return messages && Object.keys(messages).length > 0;
}
