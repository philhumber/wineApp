/**
 * Message Registry Loader
 *
 * Loads personality-specific message registries.
 * Provides fallback to SOMMELIER if personality not found.
 */

import { Personality, type PersonalityMessages } from '../personalities';
import { sommelierMessages } from './sommelier';

// Future personality imports:
// import { casualMessages } from './casual';
// import { conciseMessages } from './concise';
// import { enthusiastMessages } from './enthusiast';

/**
 * Registry mapping personality to messages.
 * Empty objects for unimplemented personalities will fallback to SOMMELIER.
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
  return messageRegistries[personality] || messageRegistries[Personality.SOMMELIER];
}

/**
 * Check if a personality has messages implemented.
 * @param personality - The personality to check
 */
export function hasPersonalityMessages(personality: Personality): boolean {
  const messages = messageRegistries[personality];
  return messages && Object.keys(messages).length > 0;
}
