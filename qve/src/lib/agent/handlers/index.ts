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

// Identification handlers (submit_text, submit_image, correct, not_correct, etc.)
export {
  isIdentificationAction,
  handleIdentificationAction,
} from './identification';

// Enrichment handlers (learn, remember, recommend, cache confirmation)
export {
  isEnrichmentAction,
  handleEnrichmentAction,
} from './enrichment';

// Add Wine handlers (add_to_cellar, entity matching, submit)
export {
  isAddWineAction,
  handleAddWineAction,
} from './addWine';

// Form handlers (bottle form, manual entry)
export {
  isFormAction,
  handleFormAction,
} from './forms';

// Camera handlers (take_photo, choose_photo)
export {
  isCameraAction,
  handleCameraAction,
} from './camera';

// ===========================================
// Handler Categories (for documentation/debugging)
// ===========================================

/**
 * Complete mapping of action types to handler categories.
 * Used for routing, debugging, and documentation.
 */
export const HANDLER_CATEGORIES = {
  conversation: [
    'start_over',
    'go_back',
    'cancel',
    'retry',
    'try_again',
    'new_input',
    'start_fresh',
    'start_over_error',
  ],
  identification: [
    'submit_text',
    'submit_image',
    'try_opus',
    'reidentify',
    'correct',
    'not_correct',
    'confirm_brief_search',
    'add_more_detail',
    'confirm_new_search',
    'continue_current',
    'use_producer_name',
    'use_grape_as_name',
    'nv_vintage',
    'add_missing_details',
    'provide_more',
    'continue_as_is',
    'see_result',
    'identify',
  ],
  enrichment: [
    'learn',
    'remember',
    'recommend',
    'confirm_cache_match',
    'force_refresh',
  ],
  addWine: [
    'add_to_cellar',
    'add_bottle_existing',
    'create_new_wine',
    'select_match',
    'add_new',
    'clarify',
    'enrich_now',
    'add_quickly',
  ],
  forms: [
    'submit_bottle',
    'bottle_next',
    'bottle_submit',
    'manual_entry_submit',
    'manual_entry_complete',
    'retry_add',
  ],
  camera: ['take_photo', 'choose_photo'],
} as const;

/**
 * Get handler category for an action type.
 * Useful for logging and debugging.
 */
export function getHandlerCategory(
  actionType: string
): keyof typeof HANDLER_CATEGORIES | null {
  for (const [category, actions] of Object.entries(HANDLER_CATEGORIES)) {
    if ((actions as readonly string[]).includes(actionType)) {
      return category as keyof typeof HANDLER_CATEGORIES;
    }
  }
  return null;
}
