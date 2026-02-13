/**
 * Agent Services - Barrel Exports
 *
 * Central export point for all pure function services used by agent handlers.
 * These services encapsulate business logic without side effects.
 */

// Result Analysis
export {
  analyzeResultQuality,
  analyzeMissingFields,
  recommendNextAction,
  canProceedToAddWine,
  isOnlyGrapeVariety,
  getMissingFieldsDescription,
  buildWineDisplayName,
  hasSubstantiveResult,
  type ResultQuality,
  type MissingFieldAnalysis,
  type NextActionRecommendation,
} from './resultAnalyzer';

// Chip Generation
export {
  generateConfirmationChips,
  generateImageConfirmationChips,
  generateCorrectionConfirmationChips,
  generateIncompleteChips,
  generateEscalationChips,
  generateBriefSearchChips,
  generateNewSearchConfirmationChips,
  generateActionChips,
  generateReidentifyChips,
  generatePostEnrichmentChips,
  generateCacheMatchChips,
  generateErrorChips,
  generateEnrichmentErrorChips,
  generateIdentificationChips,
  generateFieldCorrectionChips,
  generateNotCorrectChips,
} from './chipGenerator';

// Input Processing
export {
  // Re-exported from commandDetector
  detectCommand,
  detectChipResponse,
  isBriefInput,
  type CommandType,
  type CommandDetectionResult,
  type ChipResponseDetectionResult,
  type ChipResponseType,
  // New field detection
  detectFieldInput,
  detectDirectValue,
  checkBriefInput,
  type FieldType,
  type FieldInputResult,
  type DirectValueResult,
  type BriefInputResult,
} from './inputProcessor';

// Chip Registry (Sprint 4)
export {
  ChipKey,
  getChip,
  getChips,
  getChipWithLabel,
  getChipWithVariant,
  getChipDefinition,
} from './chipRegistry';
