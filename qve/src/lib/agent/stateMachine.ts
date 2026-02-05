/**
 * Agent State Machine
 *
 * Validates phase transitions and enforces state invariants.
 *
 * Behavior:
 * - DEV mode: Throws on invalid transitions (catch bugs early)
 * - Production: Logs and allows (fail-safe, no crashes)
 *
 * @example
 * import { assertValidTransition, canTransitionTo } from '$lib/agent/stateMachine';
 *
 * // Validate before transition
 * assertValidTransition('greeting', 'awaiting_input');
 *
 * // Check if transition is valid (for UI logic)
 * if (canTransitionTo('confirming', 'adding_wine')) {
 *   // Show "Add to Cellar" button
 * }
 */

import type { AgentPhase, AddWineStep } from './types';

// ===========================================
// Phase Transitions
// ===========================================

/**
 * Valid phase transitions.
 * Each phase can only transition to phases in its array.
 */
export const PHASE_TRANSITIONS: Record<AgentPhase, AgentPhase[]> = {
  greeting: ['awaiting_input', 'identifying', 'error'],

  awaiting_input: [
    'identifying', // User submits text/image
    'enriching', // Re-enrichment after "Learn More"
    'adding_wine', // Manual entry or retry add
    'confirming', // User provides field input (augmentation)
    'error', // Validation errors
  ],

  identifying: [
    'confirming', // Result found
    'awaiting_input', // Needs more info, only grapes found
    'error', // API error, timeout
  ],

  confirming: [
    'confirming', // Self-transition: correct action updates chips but stays in confirming
    'awaiting_input', // Not correct, provide more, add missing details
    'identifying', // Reidentify, try opus
    'adding_wine', // Add to cellar
    'enriching', // Learn more
    'complete', // Remember (no-op terminal)
    'error', // API errors during add/enrich
  ],

  adding_wine: [
    'adding_wine', // Substep transitions (confirm → entity_matching → bottle_details → enrichment → complete)
    'confirming', // Cancel add flow, go back to action selection
    'complete', // Submission success
    'error', // Submission failed, entity matching failed
  ],

  enriching: [
    'confirming', // Enrichment complete, show results
    'adding_wine', // User chooses to add after enrichment
    'error', // Enrichment API error
  ],

  error: [
    'awaiting_input', // Retry after transient error
    'identifying', // Retry identification
    'enriching', // Retry enrichment
    'adding_wine', // Retry add wine
    'greeting', // Start over from error
  ],

  complete: [
    'greeting', // Start over
    'awaiting_input', // Identify another (reset conversation)
  ],
};

// ===========================================
// AddWineStep Transitions
// ===========================================

/**
 * Valid substep transitions within adding_wine phase.
 */
export const ADD_WINE_STEP_TRANSITIONS: Record<AddWineStep, AddWineStep[]> = {
  confirm: [
    'entity_matching', // Start matching flow
    'bottle_details', // Skip matching (duplicate wine, add bottle to existing)
  ],
  entity_matching: [
    'entity_matching', // Self-transition (region → producer → wine)
    'bottle_details', // Matching complete
  ],
  bottle_details: [
    'enrichment', // Bottle form submitted, ask about enrichment
    'complete', // Skip enrichment, go directly to submission
  ],
  enrichment: [
    'complete', // Enrichment done or skipped
  ],
  complete: [], // Terminal substep (transitions to 'complete' phase)
};

// ===========================================
// Validation Types
// ===========================================

/**
 * Result of a transition validation.
 */
export interface TransitionResult {
  /** Whether the transition is valid */
  valid: boolean;
  /** Reason for invalid transition */
  reason?: string;
}

// ===========================================
// Validation Functions
// ===========================================

/**
 * Validate a phase transition.
 *
 * @param from - Current phase
 * @param to - Target phase
 * @param toStep - Optional target substep (for adding_wine transitions)
 * @param currentStep - Optional current substep (for adding_wine transitions)
 * @returns Validation result with reason if invalid
 */
export function validateTransition(
  from: AgentPhase,
  to: AgentPhase,
  toStep?: AddWineStep | null,
  currentStep?: AddWineStep | null
): TransitionResult {
  // Check if transition is allowed by transition map
  const validNextPhases = PHASE_TRANSITIONS[from];

  if (!validNextPhases) {
    return {
      valid: false,
      reason: `Unknown source phase: ${from}`,
    };
  }

  if (!validNextPhases.includes(to)) {
    return {
      valid: false,
      reason: `Cannot transition from '${from}' to '${to}'. Valid transitions: ${validNextPhases.join(', ')}`,
    };
  }

  // Check substep transition if staying in adding_wine
  if (from === 'adding_wine' && to === 'adding_wine' && currentStep && toStep) {
    const validNextSteps = ADD_WINE_STEP_TRANSITIONS[currentStep];

    if (!validNextSteps.includes(toStep)) {
      return {
        valid: false,
        reason: `Cannot transition from adding_wine:${currentStep} to adding_wine:${toStep}. Valid steps: ${validNextSteps.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Assert that a transition is valid.
 *
 * - In DEV mode: Throws an error
 * - In production: Logs to console and allows
 *
 * @param from - Current phase
 * @param to - Target phase
 * @param toStep - Optional target substep
 * @param currentStep - Optional current substep
 * @param context - Optional context for debugging
 */
export function assertValidTransition(
  from: AgentPhase,
  to: AgentPhase,
  toStep?: AddWineStep | null,
  currentStep?: AddWineStep | null,
  context?: string
): void {
  const result = validateTransition(from, to, toStep, currentStep);

  if (!result.valid) {
    const stepInfo =
      from === 'adding_wine' || to === 'adding_wine'
        ? ` (${currentStep || 'null'} → ${toStep || 'null'})`
        : '';

    const errorMessage = [
      `[StateMachine] Invalid phase transition: ${from} → ${to}${stepInfo}`,
      result.reason && `Reason: ${result.reason}`,
      context && `Context: ${context}`,
    ]
      .filter(Boolean)
      .join(' | ');

    // Throw in DEV, log in production
    if (import.meta.env.DEV) {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage);
    }
  }
}

/**
 * Check if a transition from one phase to another is valid.
 * Useful for conditional UI logic.
 *
 * @param from - Current phase
 * @param to - Target phase
 * @returns true if transition is valid
 */
export function canTransitionTo(from: AgentPhase, to: AgentPhase): boolean {
  const validNextPhases = PHASE_TRANSITIONS[from];
  return validNextPhases?.includes(to) ?? false;
}

/**
 * Get all valid transitions from a phase.
 * Useful for debugging.
 *
 * @param phase - Current phase
 * @returns Array of valid target phases
 */
export function getValidTransitions(phase: AgentPhase): AgentPhase[] {
  return PHASE_TRANSITIONS[phase] || [];
}

/**
 * Check if a substep transition is valid within adding_wine.
 *
 * @param from - Current substep
 * @param to - Target substep
 * @returns true if transition is valid
 */
export function canTransitionStep(from: AddWineStep, to: AddWineStep): boolean {
  const validNextSteps = ADD_WINE_STEP_TRANSITIONS[from];
  return validNextSteps?.includes(to) ?? false;
}

/**
 * Get all valid substep transitions from a substep.
 *
 * @param step - Current substep
 * @returns Array of valid target substeps
 */
export function getValidStepTransitions(step: AddWineStep): AddWineStep[] {
  return ADD_WINE_STEP_TRANSITIONS[step] || [];
}
