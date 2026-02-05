/**
 * Input Processor Service
 *
 * Centralizes all text input processing:
 * - Re-exports command/chip detection from utils
 * - Adds field input detection for direct field updates
 * - Enhanced brief input detection with context awareness
 *
 * Pure functions - no side effects, fully testable.
 */

import type { WineIdentificationResult } from '../types';

// Re-export from existing utils for backwards compatibility
export {
  detectCommand,
  detectChipResponse,
  isBriefInput,
  type CommandType,
  type CommandDetectionResult,
  type ChipResponseDetectionResult,
  type ChipResponseType,
} from '$lib/utils/commandDetector';

// ===========================================
// Field Input Detection
// ===========================================

export type FieldType = 'region' | 'country' | 'producer' | 'vintage' | 'grape';

export interface FieldInputResult {
  /** Whether a field pattern was detected */
  detected: boolean;
  /** The type of field that was detected */
  fieldType?: FieldType;
  /** The raw value extracted from input */
  fieldValue?: string;
  /** Updated result with the field applied */
  updatedResult?: WineIdentificationResult;
}

/**
 * Field patterns that can be explicitly specified by the user.
 * Matches patterns like:
 * - "region is Western Cape"
 * - "producer: Château Margaux"
 * - "vintage = 2018"
 */
const FIELD_PATTERN =
  /^(region|country|producer|winery|vintage|year|grape|variety)\s*(?:is|:|=)\s*(.+)$/i;

/**
 * Detect if input is a direct field specification (e.g., "region: Western Cape").
 *
 * @param text - The user's input text
 * @param existingResult - The current identification result (if any)
 * @returns Detection result with updated result if pattern matched
 *
 * @example
 * const result = detectFieldInput('region is Stellenbosch', currentResult);
 * if (result.detected) {
 *   console.log(result.fieldType); // 'region'
 *   console.log(result.fieldValue); // 'Stellenbosch'
 *   console.log(result.updatedResult); // { ...currentResult, region: 'Stellenbosch' }
 * }
 */
export function detectFieldInput(
  text: string,
  existingResult: WineIdentificationResult | null
): FieldInputResult {
  if (!existingResult) {
    return { detected: false };
  }

  const match = text.trim().match(FIELD_PATTERN);

  if (!match) {
    return { detected: false };
  }

  const rawFieldType = match[1].toLowerCase();
  const fieldValue = match[2].trim();

  const updatedResult: WineIdentificationResult = { ...existingResult };
  let detected = false;
  let fieldType: FieldType | undefined;

  switch (rawFieldType) {
    case 'region':
      updatedResult.region = fieldValue;
      detected = true;
      fieldType = 'region';
      break;

    case 'country':
      updatedResult.country = fieldValue;
      detected = true;
      fieldType = 'country';
      break;

    case 'producer':
    case 'winery':
      updatedResult.producer = fieldValue;
      detected = true;
      fieldType = 'producer';
      break;

    case 'vintage':
    case 'year': {
      const yearMatch = fieldValue.match(/^(\d{4})$/);
      const isNV =
        fieldValue.toUpperCase() === 'NV' || fieldValue.toUpperCase() === 'N/V';
      if (yearMatch || isNV) {
        updatedResult.vintage = isNV ? 'NV' : yearMatch![1];
        detected = true;
        fieldType = 'vintage';
      }
      break;
    }

    case 'grape':
    case 'variety':
      updatedResult.grapes = [fieldValue];
      detected = true;
      fieldType = 'grape';
      break;
  }

  if (!detected) {
    return { detected: false };
  }

  return {
    detected: true,
    fieldType,
    fieldValue,
    updatedResult,
  };
}

// ===========================================
// Direct Value Detection
// ===========================================

export interface DirectValueResult {
  /** Whether the input looks like a direct value for a missing field */
  detected: boolean;
  /** The type of field this value applies to */
  fieldType?: 'producer' | 'wineName' | 'vintage';
  /** The processed value */
  value?: string;
  /** Updated result with the value applied */
  updatedResult?: WineIdentificationResult;
}

/**
 * Detect if input is a direct value for a missing field.
 * Used when user is expected to provide a specific field value.
 *
 * @param text - The user's input text
 * @param existingResult - The current identification result
 * @param awaitingField - Which field we're expecting (if any)
 *
 * @example
 * // User typed "2018" when awaiting vintage
 * const result = detectDirectValue('2018', currentResult, 'vintage');
 * if (result.detected) {
 *   console.log(result.value); // '2018'
 * }
 */
export function detectDirectValue(
  text: string,
  existingResult: WineIdentificationResult,
  awaitingField: 'producer' | 'wineName' | 'vintage' | null
): DirectValueResult {
  const trimmed = text.trim();

  // No existing result means nothing to update
  if (!existingResult) {
    return { detected: false };
  }

  // Check for vintage input (year or NV)
  if (awaitingField === 'vintage' || !existingResult.vintage) {
    const upperTrimmed = trimmed.toUpperCase();
    const yearMatch = trimmed.match(/^(\d{4})$/);
    const isNV =
      upperTrimmed === 'NV' ||
      upperTrimmed === 'N/V' ||
      upperTrimmed === 'NON-VINTAGE' ||
      upperTrimmed === 'NONVINTAGE';

    if (yearMatch || isNV) {
      const vintage = isNV ? 'NV' : yearMatch![1];
      return {
        detected: true,
        fieldType: 'vintage',
        value: vintage,
        updatedResult: { ...existingResult, vintage },
      };
    }
  }

  // If explicitly awaiting a specific field, treat any input as that field's value
  if (awaitingField === 'producer') {
    return {
      detected: true,
      fieldType: 'producer',
      value: trimmed,
      updatedResult: { ...existingResult, producer: trimmed },
    };
  }

  if (awaitingField === 'wineName') {
    return {
      detected: true,
      fieldType: 'wineName',
      value: trimmed,
      updatedResult: { ...existingResult, wineName: trimmed },
    };
  }

  // Heuristic: if only missing producer and user provides short text, assume it's producer
  if (!existingResult.producer && existingResult.wineName) {
    // Assume it's a producer name if it's reasonably short
    if (trimmed.split(/\s+/).length <= 5) {
      return {
        detected: true,
        fieldType: 'producer',
        value: trimmed,
        updatedResult: { ...existingResult, producer: trimmed },
      };
    }
  }

  // Heuristic: if only missing wine name and user provides short text, assume it's wine name
  if (!existingResult.wineName && existingResult.producer) {
    if (trimmed.split(/\s+/).length <= 5) {
      return {
        detected: true,
        fieldType: 'wineName',
        value: trimmed,
        updatedResult: { ...existingResult, wineName: trimmed },
      };
    }
  }

  return { detected: false };
}

// ===========================================
// Enhanced Brief Input Check
// ===========================================

export interface BriefInputResult {
  /** Whether the input is brief (single word) */
  isBrief: boolean;
  /** Number of words in input */
  wordCount: number;
  /** Whether a confirmation prompt should be shown */
  shouldConfirm: boolean;
}

/**
 * Enhanced brief input check with context awareness.
 *
 * @param text - The user's input text
 * @param hasAugmentationContext - Whether we're in augmentation mode
 * @returns Analysis of whether input is too brief
 *
 * @example
 * const result = checkBriefInput('Margaux', false);
 * if (result.shouldConfirm) {
 *   // Show "Just 'Margaux'?" confirmation
 * }
 */
export function checkBriefInput(
  text: string,
  hasAugmentationContext: boolean
): BriefInputResult {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Multi-word input is never brief
  if (wordCount >= 2) {
    return { isBrief: false, wordCount, shouldConfirm: false };
  }

  // In augmentation phase, single words are fine (user adding details)
  if (hasAugmentationContext) {
    return { isBrief: false, wordCount, shouldConfirm: false };
  }

  // Single word without context → brief, should confirm
  return { isBrief: true, wordCount, shouldConfirm: true };
}
