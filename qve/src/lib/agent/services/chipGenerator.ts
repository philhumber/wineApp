/**
 * Chip Generator Service
 *
 * Generates context-appropriate action chips for:
 * - Identification results (confirmation, details, escalation)
 * - Enrichment flows (add, learn more, remember)
 * - Error states (retry, start over)
 *
 * Pure functions that return AgentChip arrays.
 * Uses the chip registry for centralized chip definitions.
 *
 * @see chipRegistry.ts for chip definitions
 */

import type { AgentChip } from '../types';
import type { ResultQuality, NextActionRecommendation } from './resultAnalyzer';
import { ChipKey, getChip, getChips, getChipWithVariant } from './chipRegistry';

// ===========================================
// Identification Chips
// ===========================================

/**
 * Generate chips for high-confidence identification results.
 * Shows simple yes/no confirmation.
 */
export function generateConfirmationChips(): AgentChip[] {
  return getChips(ChipKey.CORRECT, ChipKey.NOT_CORRECT);
}

/**
 * Generate chips for incomplete identification results.
 * Based on what's missing and what fallbacks are available.
 */
export function generateIncompleteChips(quality: ResultQuality): AgentChip[] {
  const chips: AgentChip[] = [];

  // Scenario: Missing producer only (has wine name and vintage)
  const onlyMissingProducer =
    quality.missingProducer && !quality.missingWineName && !quality.missingVintage;

  // Scenario: Missing vintage only (has producer and wine name)
  const onlyMissingVintage =
    quality.missingVintage && !quality.missingWineName && !quality.missingProducer;

  if (onlyMissingProducer) {
    // No producer: specify manually or search again
    return [getChip(ChipKey.SPECIFY_PRODUCER), getChip(ChipKey.SEARCH_AGAIN)];
  }

  if (onlyMissingVintage) {
    // No vintage: specify vintage or mark as NV
    return [getChip(ChipKey.SPECIFY_VINTAGE), getChip(ChipKey.NV_VINTAGE)];
  }

  // Scenario: Missing wine name
  if (quality.missingWineName) {
    // Offer producer name as fallback
    if (quality.hasProducer) {
      chips.push(getChip(ChipKey.USE_PRODUCER_NAME));
    }

    // Offer grape as fallback
    if (quality.hasGrapes && quality.primaryGrape) {
      chips.push(getChip(ChipKey.USE_GRAPE_AS_NAME));
    }

    chips.push(getChip(ChipKey.ADD_MISSING_DETAILS));
    chips.push(getChip(ChipKey.SEARCH_AGAIN));
    return chips;
  }

  // Generic incomplete (multiple fields missing or other edge cases)
  chips.push(getChip(ChipKey.ADD_MISSING_DETAILS));
  chips.push(getChip(ChipKey.SEARCH_AGAIN));

  // Offer escalation if low confidence
  if (quality.isLowConfidence && quality.canEscalate) {
    chips.push(getChip(ChipKey.TRY_OPUS));
  }

  return chips;
}

/**
 * Generate chips for low-confidence results.
 * Offers escalation to premium model.
 */
export function generateEscalationChips(quality: ResultQuality): AgentChip[] {
  const chips: AgentChip[] = [];

  if (quality.canEscalate) {
    chips.push(getChip(ChipKey.TRY_OPUS));
  }

  chips.push(getChip(ChipKey.USE_THIS_RESULT));
  chips.push(getChip(ChipKey.PROVIDE_MORE));

  return chips;
}

/**
 * Generate chips for brief input confirmation.
 * Asks if user wants to proceed with single-word search.
 */
export function generateBriefSearchChips(): AgentChip[] {
  return getChips(ChipKey.CONFIRM_BRIEF_SEARCH, ChipKey.ADD_MORE_DETAIL);
}

/**
 * Generate chips for new search confirmation.
 * Asks if user wants to abandon current result for new search.
 */
export function generateNewSearchConfirmationChips(): AgentChip[] {
  return getChips(ChipKey.CONFIRM_NEW_SEARCH, ChipKey.CONTINUE_CURRENT);
}

// ===========================================
// Action Selection Chips
// ===========================================

/**
 * Generate chips for action selection after identification.
 * Shows add to cellar, learn more, remember.
 */
export function generateActionChips(hasEnrichment: boolean): AgentChip[] {
  const chips: AgentChip[] = [getChip(ChipKey.ADD_TO_CELLAR)];

  // Only show "Learn More" if we don't have enrichment yet
  if (!hasEnrichment) {
    chips.push(getChip(ChipKey.LEARN_MORE));
  }

  chips.push(getChip(ChipKey.REMEMBER));

  return chips;
}

/**
 * Generate chips offering the user to re-identify after adding missing details.
 */
export function generateReidentifyChips(): AgentChip[] {
  return getChips(ChipKey.REIDENTIFY, ChipKey.CONTINUE_AS_IS);
}

// ===========================================
// Enrichment Chips
// ===========================================

/**
 * Generate chips after enrichment completes.
 */
export function generatePostEnrichmentChips(): AgentChip[] {
  return [
    getChip(ChipKey.ADD_TO_CELLAR),
    getChip(ChipKey.REMEMBER),
    getChipWithVariant(ChipKey.START_OVER, 'secondary'), // "New Search" as secondary
  ];
}

/**
 * Generate chips for cache match confirmation.
 */
export function generateCacheMatchChips(): AgentChip[] {
  return getChips(ChipKey.CONFIRM_CACHE_MATCH, ChipKey.FORCE_REFRESH);
}

// ===========================================
// Error Chips
// ===========================================

/**
 * Generate chips for error states.
 * Shows retry (if retryable) and start over.
 */
export function generateErrorChips(isRetryable: boolean): AgentChip[] {
  const chips: AgentChip[] = [];

  if (isRetryable) {
    chips.push(getChip(ChipKey.RETRY));
  }

  chips.push(getChip(ChipKey.START_OVER));

  return chips;
}

/**
 * Generate chips for enrichment error states.
 * Includes option to continue without enrichment.
 */
export function generateEnrichmentErrorChips(isRetryable: boolean): AgentChip[] {
  const chips: AgentChip[] = [];

  if (isRetryable) {
    // Retry learn action with primary variant
    chips.push(getChipWithVariant(ChipKey.LEARN_MORE, 'primary'));
  }

  chips.push(getChip(ChipKey.ADD_WITHOUT_DETAILS));
  chips.push(getChip(ChipKey.START_OVER));

  return chips;
}

// ===========================================
// Smart Chip Generation
// ===========================================

/**
 * Generate appropriate chips based on result quality and recommendations.
 * Main entry point for identification chip generation.
 */
export function generateIdentificationChips(
  quality: ResultQuality,
  recommendation: NextActionRecommendation
): AgentChip[] {
  // Complete high-confidence → simple confirmation
  if (recommendation.shouldShowConfirmation && !recommendation.shouldAskForDetails) {
    return generateConfirmationChips();
  }

  // Can escalate but no fallbacks → offer escalation
  if (recommendation.shouldOfferEscalation && !recommendation.shouldOfferFallbacks) {
    return generateEscalationChips(quality);
  }

  // Has fallback options (missing wine name with alternatives)
  if (recommendation.shouldOfferFallbacks) {
    return generateIncompleteChips(quality);
  }

  // Needs more details
  if (recommendation.shouldAskForDetails) {
    return generateIncompleteChips(quality);
  }

  // Default fallback
  return generateConfirmationChips();
}

// ===========================================
// Add Wine Flow Chips
// ===========================================

/**
 * Generate chips for duplicate wine detection.
 * Offers to add another bottle or create a new wine entry.
 */
export function generateDuplicateWineChips(): AgentChip[] {
  return getChips(ChipKey.ADD_BOTTLE_EXISTING, ChipKey.CREATE_NEW_WINE);
}

/**
 * Generate chips for enrichment choice after bottle form.
 * Offers to enrich or add quickly.
 */
export function generateEnrichmentChoiceChips(): AgentChip[] {
  return getChips(ChipKey.ENRICH_NOW, ChipKey.ADD_QUICKLY);
}

/**
 * Generate chips for add/retry after submission error.
 */
export function generateAddRetryChips(): AgentChip[] {
  return getChips(ChipKey.RETRY_ADD, ChipKey.START_OVER);
}

/**
 * Generate chips after successful wine addition.
 */
export function generateAddCompleteChips(): AgentChip[] {
  return [getChip(ChipKey.IDENTIFY_ANOTHER)];
}
