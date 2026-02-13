/**
 * Chip Registry
 *
 * Centralized registry for all agent action chips.
 * Provides type-safe chip definitions with labels from the message registry.
 *
 * @example
 * import { ChipKey, getChip, getChips } from '$lib/agent/services/chipRegistry';
 *
 * // Single chip
 * const chip = getChip(ChipKey.ADD_TO_CELLAR);
 *
 * // Multiple chips
 * const chips = getChips(ChipKey.CORRECT, ChipKey.NOT_CORRECT);
 *
 * // Chip with custom label
 * const chip = getChipWithLabel(ChipKey.USE_PRODUCER_NAME, 'Use Château Margaux');
 */

import type { AgentChip } from '../types';
import { MessageKey } from '../messageKeys';
import { getMessageByKey } from '../messages';

// ===========================================
// Chip Key Enum
// ===========================================

/**
 * Centralized chip identifiers.
 * Every unique chip action in the system.
 */
export enum ChipKey {
  // Confirmation
  CORRECT = 'correct',
  NOT_CORRECT = 'not_correct',

  // Identification Actions
  TRY_OPUS = 'try_opus',
  REIDENTIFY = 'reidentify',
  CONTINUE_AS_IS = 'continue_as_is',
  PROVIDE_MORE = 'provide_more',
  ADD_MISSING_DETAILS = 'add_missing_details',
  START_FRESH = 'start_fresh',

  // Field Completion
  USE_PRODUCER_NAME = 'use_producer_name',
  USE_GRAPE_AS_NAME = 'use_grape_as_name',
  NV_VINTAGE = 'nv_vintage',
  SPECIFY_VINTAGE = 'specify_vintage',
  SPECIFY_PRODUCER = 'specify_producer',

  // Brief/New Search Confirmation
  CONFIRM_BRIEF_SEARCH = 'confirm_brief_search',
  ADD_MORE_DETAIL = 'add_more_detail',
  CONFIRM_NEW_SEARCH = 'confirm_new_search',
  CONTINUE_CURRENT = 'continue_current',

  // Wine Actions
  ADD_TO_CELLAR = 'add_to_cellar',
  LEARN_MORE = 'learn',
  REMEMBER = 'remember',

  // Enrichment
  ENRICH_NOW = 'enrich_now',
  ADD_QUICKLY = 'add_quickly',
  CONFIRM_CACHE_MATCH = 'confirm_cache_match',
  FORCE_REFRESH = 'force_refresh',

  // Add Wine Flow
  ADD_BOTTLE_EXISTING = 'add_bottle_existing',
  CREATE_NEW_WINE = 'create_new_wine',
  RETRY_ADD = 'retry_add',

  // Navigation
  START_OVER = 'start_over',
  RETRY = 'retry',

  // Camera
  TAKE_PHOTO = 'take_photo',
  CHOOSE_PHOTO = 'choose_photo',

  // Completion
  IDENTIFY_ANOTHER = 'identify_another',

  // Error recovery
  ADD_WITHOUT_DETAILS = 'add_without_details',

  // Search
  SEARCH_AGAIN = 'search_again',
  USE_THIS_RESULT = 'use_this_result',

  // Verification
  VERIFY = 'verify',

  // Field Correction
  CORRECT_FIELD = 'correct_field',
  CONFIRM_CORRECTIONS = 'confirm_corrections',
}

// ===========================================
// Chip Definition Registry
// ===========================================

interface ChipDefinition {
  /** Unique identifier for the chip */
  id: string;
  /** Action dispatched when chip is tapped */
  action: string;
  /** MessageKey for the label lookup */
  messageKey: MessageKey;
  /** Visual variant (primary = emphasized) */
  variant?: 'primary' | 'secondary' | 'danger';
}

const CHIP_DEFINITIONS: Record<ChipKey, ChipDefinition> = {
  // Confirmation
  [ChipKey.CORRECT]: {
    id: 'correct',
    action: 'correct',
    messageKey: MessageKey.CHIP_CORRECT,
    variant: 'primary',
  },
  [ChipKey.NOT_CORRECT]: {
    id: 'not_correct',
    action: 'not_correct',
    messageKey: MessageKey.CHIP_NOT_CORRECT,
  },

  // Identification Actions
  [ChipKey.TRY_OPUS]: {
    id: 'try_opus',
    action: 'try_opus',
    messageKey: MessageKey.CHIP_TRY_HARDER,
    variant: 'primary',
  },
  [ChipKey.REIDENTIFY]: {
    id: 'reidentify',
    action: 'reidentify',
    messageKey: MessageKey.CHIP_REIDENTIFY,
    variant: 'primary',
  },
  [ChipKey.CONTINUE_AS_IS]: {
    id: 'continue_as_is',
    action: 'continue_as_is',
    messageKey: MessageKey.CHIP_CONTINUE_AS_IS,
  },
  [ChipKey.PROVIDE_MORE]: {
    id: 'provide_more',
    action: 'provide_more',
    messageKey: MessageKey.CHIP_ADD_DETAILS,
  },
  [ChipKey.ADD_MISSING_DETAILS]: {
    id: 'add_details',
    action: 'add_missing_details',
    messageKey: MessageKey.CHIP_ADD_DETAILS,
  },
  [ChipKey.START_FRESH]: {
    id: 'start_fresh',
    action: 'start_fresh',
    messageKey: MessageKey.CHIP_START_FRESH,
  },

  // Field Completion
  [ChipKey.USE_PRODUCER_NAME]: {
    id: 'use_producer',
    action: 'use_producer_name',
    messageKey: MessageKey.CHIP_USE_PRODUCER_NAME,
  },
  [ChipKey.USE_GRAPE_AS_NAME]: {
    id: 'use_grape',
    action: 'use_grape_as_name',
    messageKey: MessageKey.CHIP_USE_GRAPE_NAME,
  },
  [ChipKey.NV_VINTAGE]: {
    id: 'nv',
    action: 'nv_vintage',
    messageKey: MessageKey.CHIP_NON_VINTAGE,
  },
  [ChipKey.SPECIFY_VINTAGE]: {
    id: 'specify_vintage',
    action: 'add_missing_details',
    messageKey: MessageKey.CHIP_SPECIFY_VINTAGE,
  },
  [ChipKey.SPECIFY_PRODUCER]: {
    id: 'specify_producer',
    action: 'add_missing_details',
    messageKey: MessageKey.CHIP_ADD_DETAILS,
  },

  // Brief/New Search Confirmation
  [ChipKey.CONFIRM_BRIEF_SEARCH]: {
    id: 'search_anyway',
    action: 'confirm_brief_search',
    messageKey: MessageKey.CHIP_SEARCH_ANYWAY,
    variant: 'primary',
  },
  [ChipKey.ADD_MORE_DETAIL]: {
    id: 'add_more',
    action: 'add_more_detail',
    messageKey: MessageKey.CHIP_ADD_MORE,
  },
  [ChipKey.CONFIRM_NEW_SEARCH]: {
    id: 'confirm_new',
    action: 'confirm_new_search',
    messageKey: MessageKey.CHIP_SEARCH_NEW,
    variant: 'primary',
  },
  [ChipKey.CONTINUE_CURRENT]: {
    id: 'keep_current',
    action: 'continue_current',
    messageKey: MessageKey.CHIP_KEEP_CURRENT,
  },

  // Wine Actions
  [ChipKey.ADD_TO_CELLAR]: {
    id: 'add',
    action: 'add_to_cellar',
    messageKey: MessageKey.CHIP_ADD_TO_CELLAR,
    variant: 'primary',
  },
  [ChipKey.LEARN_MORE]: {
    id: 'learn',
    action: 'learn',
    messageKey: MessageKey.CHIP_LEARN_MORE,
  },
  [ChipKey.REMEMBER]: {
    id: 'remember',
    action: 'remember',
    messageKey: MessageKey.CHIP_REMEMBER,
  },

  // Enrichment
  [ChipKey.ENRICH_NOW]: {
    id: 'enrich',
    action: 'enrich_now',
    messageKey: MessageKey.CHIP_ENRICH_NOW,
    variant: 'primary',
  },
  [ChipKey.ADD_QUICKLY]: {
    id: 'quick',
    action: 'add_quickly',
    messageKey: MessageKey.CHIP_ADD_QUICKLY,
  },
  [ChipKey.CONFIRM_CACHE_MATCH]: {
    id: 'confirm_cache',
    action: 'confirm_cache_match',
    messageKey: MessageKey.CHIP_USE_CACHED,
    variant: 'primary',
  },
  [ChipKey.FORCE_REFRESH]: {
    id: 'force_refresh',
    action: 'force_refresh',
    messageKey: MessageKey.CHIP_SEARCH_ONLINE,
  },

  // Add Wine Flow
  [ChipKey.ADD_BOTTLE_EXISTING]: {
    id: 'add_bottle',
    action: 'add_bottle_existing',
    messageKey: MessageKey.CHIP_ADD_BOTTLE,
    variant: 'primary',
  },
  [ChipKey.CREATE_NEW_WINE]: {
    id: 'create_new',
    action: 'create_new_wine',
    messageKey: MessageKey.CHIP_CREATE_NEW,
  },
  [ChipKey.RETRY_ADD]: {
    id: 'retry_add',
    action: 'retry_add',
    messageKey: MessageKey.CHIP_TRY_AGAIN,
  },

  // Navigation
  [ChipKey.START_OVER]: {
    id: 'start_over',
    action: 'start_over',
    messageKey: MessageKey.CHIP_START_OVER,
  },
  [ChipKey.RETRY]: {
    id: 'retry',
    action: 'retry',
    messageKey: MessageKey.CHIP_TRY_AGAIN,
    variant: 'primary',
  },

  // Camera
  [ChipKey.TAKE_PHOTO]: {
    id: 'take_photo',
    action: 'take_photo',
    messageKey: MessageKey.CHIP_TAKE_PHOTO,
  },
  [ChipKey.CHOOSE_PHOTO]: {
    id: 'choose_photo',
    action: 'choose_photo',
    messageKey: MessageKey.CHIP_CHOOSE_PHOTO,
  },

  // Completion
  [ChipKey.IDENTIFY_ANOTHER]: {
    id: 'identify_another',
    action: 'start_over',
    messageKey: MessageKey.CHIP_IDENTIFY_ANOTHER,
  },

  // Error recovery
  [ChipKey.ADD_WITHOUT_DETAILS]: {
    id: 'add_anyway',
    action: 'add_to_cellar',
    messageKey: MessageKey.CHIP_ADD_WITHOUT_DETAILS,
  },

  // Search
  [ChipKey.SEARCH_AGAIN]: {
    id: 'search_again',
    action: 'provide_more',
    messageKey: MessageKey.CHIP_SEARCH_AGAIN,
  },
  [ChipKey.USE_THIS_RESULT]: {
    id: 'use_anyway',
    action: 'continue_as_is',
    messageKey: MessageKey.CHIP_USE_THIS_RESULT,
  },

  // Verification
  [ChipKey.VERIFY]: {
    id: 'verify',
    action: 'verify',
    messageKey: MessageKey.CHIP_VERIFY,
  },

  // Field Correction
  [ChipKey.CORRECT_FIELD]: {
    id: 'correct_field',
    action: 'correct_field',
    messageKey: MessageKey.CHIP_CORRECT_FIELD,
  },
  [ChipKey.CONFIRM_CORRECTIONS]: {
    id: 'confirm_corrections',
    action: 'confirm_corrections',
    messageKey: MessageKey.CHIP_CONFIRM_CORRECTIONS,
    variant: 'primary',
  },
};

// ===========================================
// Registry Access Functions
// ===========================================

/**
 * Get a single chip by key.
 * @param key - ChipKey enum value
 * @param payload - Optional payload to attach
 * @returns AgentChip with resolved label
 */
export function getChip(key: ChipKey, payload?: unknown): AgentChip {
  const def = CHIP_DEFINITIONS[key];

  return {
    id: def.id,
    label: getMessageByKey(def.messageKey),
    action: def.action,
    ...(def.variant && { variant: def.variant }),
    ...(payload !== undefined && { payload }),
  };
}

/**
 * Get multiple chips by keys.
 * @param keys - Array of ChipKey enum values
 * @returns Array of AgentChips
 */
export function getChips(...keys: ChipKey[]): AgentChip[] {
  return keys.map((key) => getChip(key));
}

/**
 * Get a chip with a custom label (overrides registry).
 * Useful for dynamic labels like "Use Margaux as name".
 * @param key - ChipKey enum value
 * @param customLabel - Custom label text
 * @param payload - Optional payload to attach
 * @returns AgentChip with custom label
 */
export function getChipWithLabel(
  key: ChipKey,
  customLabel: string,
  payload?: unknown
): AgentChip {
  const def = CHIP_DEFINITIONS[key];

  return {
    id: def.id,
    label: customLabel,
    action: def.action,
    ...(def.variant && { variant: def.variant }),
    ...(payload !== undefined && { payload }),
  };
}

/**
 * Get a chip with variant override.
 * Useful when context changes chip priority (e.g., primary vs secondary).
 * @param key - ChipKey enum value
 * @param variant - Variant to use
 * @param payload - Optional payload to attach
 */
export function getChipWithVariant(
  key: ChipKey,
  variant: 'primary' | 'secondary' | 'danger',
  payload?: unknown
): AgentChip {
  const def = CHIP_DEFINITIONS[key];

  return {
    id: def.id,
    label: getMessageByKey(def.messageKey),
    action: def.action,
    variant,
    ...(payload !== undefined && { payload }),
  };
}

/**
 * Get a chip definition without resolving the label.
 * Useful for inspecting chip metadata.
 * @param key - ChipKey enum value
 */
export function getChipDefinition(key: ChipKey): ChipDefinition {
  return CHIP_DEFINITIONS[key];
}
