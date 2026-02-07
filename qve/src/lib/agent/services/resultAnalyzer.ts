/**
 * Result Analyzer Service
 *
 * Analyzes identification results to determine:
 * - Quality/completeness
 * - Missing fields
 * - Confidence level
 * - Next action recommendations
 *
 * Pure functions - no side effects, fully testable.
 */

import type { WineIdentificationResult } from '../types';

// ===========================================
// Types
// ===========================================

export interface ResultQuality {
  /** Result has all required fields with good confidence */
  isComplete: boolean;
  /** Result has all required fields (producer, wine name, vintage) regardless of confidence */
  hasAllFields: boolean;
  /** Confidence below threshold (70%) */
  isLowConfidence: boolean;
  /** Can escalate to premium model (confidence < 60%) */
  canEscalate: boolean;
  /** Missing critical fields or very low confidence */
  needsMoreInfo: boolean;

  // Missing field flags
  missingProducer: boolean;
  missingWineName: boolean;
  missingVintage: boolean;

  // Available data flags
  hasProducer: boolean;
  hasWineName: boolean;
  hasVintage: boolean;
  hasGrapes: boolean;
  hasRegion: boolean;
  hasCountry: boolean;

  // Derived values
  primaryGrape: string | undefined;
  confidence: number;
  /** 0-1 score based on field completeness */
  completenessScore: number;
}

export interface MissingFieldAnalysis {
  fields: Array<'producer' | 'wineName' | 'vintage'>;
  canUseProducerAsName: boolean;
  canUseGrapeAsName: boolean;
  primaryGrape: string | undefined;
}

export interface NextActionRecommendation {
  shouldShowConfirmation: boolean;
  shouldAskForDetails: boolean;
  shouldOfferEscalation: boolean;
  shouldOfferFallbacks: boolean;
  fallbackOptions: Array<'use_producer' | 'use_grape' | 'nv_vintage'>;
}

// ===========================================
// Constants
// ===========================================

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

// ===========================================
// Core Analysis Functions
// ===========================================

/**
 * Analyze the quality and completeness of an identification result.
 *
 * @example
 * const quality = analyzeResultQuality(result, 0.85);
 * if (quality.isComplete) {
 *   // Show confirmation chips
 * } else if (quality.needsMoreInfo) {
 *   // Show details request
 * }
 */
export function analyzeResultQuality(
  result: WineIdentificationResult,
  confidence: number
): ResultQuality {
  // Normalize confidence: API returns percentage (0-100), we use decimal (0-1)
  const normalizedConfidence = confidence > 1 ? confidence / 100 : confidence;

  const hasProducer = !!result.producer;
  const hasWineName = !!result.wineName;
  const hasVintage = result.vintage !== undefined && result.vintage !== null;
  const hasGrapes = !!(result.grapes && result.grapes.length > 0);
  const hasRegion = !!result.region;
  const hasCountry = !!result.country;

  const primaryGrape = hasGrapes ? result.grapes![0] : undefined;

  // Confidence thresholds (using normalized 0-1 scale)
  const isLowConfidence = normalizedConfidence < LOW_CONFIDENCE_THRESHOLD;
  const canEscalate = normalizedConfidence < ESCALATION_CONFIDENCE_THRESHOLD;

  // Missing field detection
  const missingProducer = !hasProducer;
  const missingWineName = !hasWineName;
  const missingVintage = !hasVintage;

  // Completeness score (0-1)
  let completenessScore = 0;
  if (hasProducer) completenessScore += 0.4;
  if (hasWineName) completenessScore += 0.4;
  if (hasVintage) completenessScore += 0.2;

  // Has all required fields (regardless of confidence)
  const hasAllFields = hasProducer && hasWineName && hasVintage;

  // Complete if we have all fields with good confidence
  const isComplete = hasAllFields && !isLowConfidence;

  // Needs more info if missing critical fields or very low confidence
  const needsMoreInfo =
    (missingProducer && missingWineName) || // Nothing substantive
    (isLowConfidence && !hasProducer && !hasWineName); // Low confidence with nothing

  return {
    isComplete,
    hasAllFields,
    isLowConfidence,
    canEscalate,
    needsMoreInfo,
    missingProducer,
    missingWineName,
    missingVintage,
    hasProducer,
    hasWineName,
    hasVintage,
    hasGrapes,
    hasRegion,
    hasCountry,
    primaryGrape,
    confidence: normalizedConfidence, // Return normalized (0-1) confidence
    completenessScore,
  };
}

/**
 * Get detailed analysis of missing fields and potential fallbacks.
 */
export function analyzeMissingFields(
  result: WineIdentificationResult
): MissingFieldAnalysis {
  const quality = analyzeResultQuality(result, result.confidence ?? 1);

  const fields: Array<'producer' | 'wineName' | 'vintage'> = [];
  if (quality.missingProducer) fields.push('producer');
  if (quality.missingWineName) fields.push('wineName');
  if (quality.missingVintage) fields.push('vintage');

  // Can use producer name as wine name if we have producer but no wine name
  const canUseProducerAsName = quality.hasProducer && quality.missingWineName;

  // Can use grape as wine name if we have grapes but no wine name
  const canUseGrapeAsName = quality.hasGrapes && quality.missingWineName;

  return {
    fields,
    canUseProducerAsName,
    canUseGrapeAsName,
    primaryGrape: quality.primaryGrape,
  };
}

/**
 * Recommend next action based on result quality.
 */
export function recommendNextAction(quality: ResultQuality): NextActionRecommendation {
  const { isComplete, needsMoreInfo, canEscalate, missingWineName, hasProducer, hasGrapes } =
    quality;

  // Complete high-confidence result → show confirmation
  if (isComplete) {
    return {
      shouldShowConfirmation: true,
      shouldAskForDetails: false,
      shouldOfferEscalation: false,
      shouldOfferFallbacks: false,
      fallbackOptions: [],
    };
  }

  // Very incomplete or low confidence → ask for more details
  if (needsMoreInfo) {
    return {
      shouldShowConfirmation: false,
      shouldAskForDetails: true,
      shouldOfferEscalation: canEscalate,
      shouldOfferFallbacks: false,
      fallbackOptions: [],
    };
  }

  // Missing wine name → offer fallbacks
  if (missingWineName) {
    const fallbackOptions: Array<'use_producer' | 'use_grape' | 'nv_vintage'> = [];
    if (hasProducer) fallbackOptions.push('use_producer');
    if (hasGrapes) fallbackOptions.push('use_grape');

    return {
      shouldShowConfirmation: false,
      shouldAskForDetails: true,
      shouldOfferEscalation: canEscalate,
      shouldOfferFallbacks: true,
      fallbackOptions,
    };
  }

  // Incomplete but has some data → show what we have with options
  return {
    shouldShowConfirmation: true,
    shouldAskForDetails: true,
    shouldOfferEscalation: canEscalate,
    shouldOfferFallbacks: false,
    fallbackOptions: [],
  };
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Check if result has enough data to proceed to add wine flow.
 * Requires at least producer and wine name.
 */
export function canProceedToAddWine(result: WineIdentificationResult): boolean {
  const quality = analyzeResultQuality(result, result.confidence ?? 1);
  return quality.hasProducer && quality.hasWineName;
}

/**
 * Check if result is only grape variety (no wine or producer).
 */
export function isOnlyGrapeVariety(result: WineIdentificationResult): boolean {
  const quality = analyzeResultQuality(result, result.confidence ?? 1);
  return quality.hasGrapes && !quality.hasProducer && !quality.hasWineName;
}

/**
 * Get a human-readable description of what's missing.
 */
export function getMissingFieldsDescription(result: WineIdentificationResult): string {
  const analysis = analyzeMissingFields(result);

  if (analysis.fields.length === 0) {
    return '';
  }

  const fieldNames = analysis.fields.map((f) => {
    switch (f) {
      case 'producer':
        return 'producer';
      case 'wineName':
        return 'wine name';
      case 'vintage':
        return 'vintage';
    }
  });

  if (fieldNames.length === 1) {
    return `the ${fieldNames[0]}`;
  }

  if (fieldNames.length === 2) {
    return `${fieldNames[0]} and ${fieldNames[1]}`;
  }

  return fieldNames.slice(0, -1).join(', ') + ', and ' + fieldNames[fieldNames.length - 1];
}

/**
 * Build a display name from a wine result.
 */
export function buildWineDisplayName(result: WineIdentificationResult): string {
  return [result.producer, result.wineName].filter(Boolean).join(' ');
}

/**
 * Check if result has substantive identification (not just grape).
 */
export function hasSubstantiveResult(result: WineIdentificationResult): boolean {
  return !!(result.producer || result.wineName);
}
