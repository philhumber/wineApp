/**
 * Validation Middleware
 *
 * Pre-validates actions before they're executed to ensure
 * the system is in a valid state for the action.
 */

import type { Middleware, ActionHandler } from './types';
import type { AgentPhase, AgentAction } from '../types';
import { getCurrentPhase } from '$lib/stores/agentConversation';
import { getResult } from '$lib/stores/agentIdentification';
import { getCurrentFlow } from '$lib/stores/agentAddWine';

// ===========================================
// Types
// ===========================================

interface ActionPrerequisites {
  /** Phases where this action is valid */
  requiresPhase?: AgentPhase[];
  /** Whether identification result must exist */
  requiresIdentification?: boolean;
  /** Whether add wine flow must be active */
  requiresAddWineFlow?: boolean;
  /** Custom validation function */
  validate?: (action: AgentAction) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

type ValidationMode = 'strict' | 'warn' | 'silent';

interface ValidatorOptions {
  /** How to handle validation failures. Default: 'warn' */
  mode?: ValidationMode;
  /** Additional prerequisites to merge with defaults */
  additionalPrerequisites?: Record<string, ActionPrerequisites>;
}

// ===========================================
// Prerequisites Configuration
// ===========================================

/**
 * Default prerequisites for each action type.
 * These define what state must exist for an action to be valid.
 */
const defaultPrerequisites: Record<string, ActionPrerequisites> = {
  // Confirmation actions require identification result
  // Note: These all happen during the 'confirming' phase in the simplified state machine
  correct: {
    requiresIdentification: true,
    requiresPhase: ['confirming'],
  },
  not_correct: {
    requiresIdentification: true,
    requiresPhase: ['confirming'],
  },
  confirm_direction: {
    requiresIdentification: true,
  },
  wrong_direction: {
    requiresIdentification: true,
  },

  // Add wine actions require identification
  // These can be triggered from the 'confirming' phase
  add_to_cellar: {
    requiresIdentification: true,
    requiresPhase: ['confirming'],
  },
  add_bottle_existing: {
    requiresIdentification: true,
    requiresAddWineFlow: true,
  },
  create_new_wine: {
    requiresIdentification: true,
    requiresAddWineFlow: true,
  },

  // Form submissions require add wine flow
  submit_bottle: {
    requiresAddWineFlow: true,
    requiresPhase: ['adding_wine'],
  },
  bottle_next: {
    requiresAddWineFlow: true,
  },

  // Entity matching requires add wine flow
  select_match: {
    requiresAddWineFlow: true,
  },
  add_new: {
    requiresAddWineFlow: true,
  },

  // Enrichment requires identification
  enrich_now: {
    requiresIdentification: true,
  },
  remember: {
    requiresIdentification: true,
  },
  recommend: {
    requiresIdentification: true,
  },

  // Field correction actions require identification
  correct_field: {
    requiresIdentification: true,
    requiresPhase: ['confirming', 'awaiting_input'],
  },
  confirm_corrections: {
    requiresIdentification: true,
    requiresPhase: ['confirming', 'awaiting_input'],
  },

  // Opus escalation requires identification
  // 'awaiting_input' needed: handleNotCorrect transitions to awaiting_input before showing Try Harder chip
  try_opus: {
    requiresIdentification: true,
    requiresPhase: ['confirming', 'awaiting_input'],
  },

  // Retry requires being in error state or having recent action
  retry: {
    // Retry validation is handled by retry tracker, not phase
  },
};

// ===========================================
// Validation Logic
// ===========================================

/**
 * Validate an action against its prerequisites.
 */
export function validateAction(
  action: AgentAction,
  prerequisites: Record<string, ActionPrerequisites> = defaultPrerequisites
): ValidationResult {
  const prereqs = prerequisites[action.type];

  // No prerequisites defined means action is always valid
  if (!prereqs) {
    return { valid: true };
  }

  const currentPhase = getCurrentPhase();

  // Check phase requirement
  if (prereqs.requiresPhase && !prereqs.requiresPhase.includes(currentPhase)) {
    return {
      valid: false,
      reason: `Action '${action.type}' requires phase [${prereqs.requiresPhase.join(', ')}], current: '${currentPhase}'`,
    };
  }

  // Check identification requirement
  if (prereqs.requiresIdentification && !getResult()) {
    return {
      valid: false,
      reason: `Action '${action.type}' requires identification result`,
    };
  }

  // Check add wine flow requirement
  if (prereqs.requiresAddWineFlow && !getCurrentFlow()) {
    return {
      valid: false,
      reason: `Action '${action.type}' requires active add wine flow`,
    };
  }

  // Run custom validation if provided
  if (prereqs.validate) {
    return prereqs.validate(action);
  }

  return { valid: true };
}

// ===========================================
// Middleware
// ===========================================

/**
 * Validation middleware.
 *
 * Validates actions before execution to ensure the system state
 * supports the action. Invalid actions are logged and skipped.
 *
 * @example
 * const handler = withValidation(async (action) => {
 *   // This won't run if validation fails
 *   await processAction(action);
 * });
 */
export const withValidation: Middleware = (handler: ActionHandler) => {
  return async (action) => {
    const result = validateAction(action);

    if (!result.valid) {
      console.warn(`[AgentAction] Validation failed for ${action.type}: ${result.reason}`);
      return; // Skip action
    }

    await handler(action);
  };
};

/**
 * Create a validation middleware with custom options.
 *
 * @example
 * // Strict mode throws instead of skipping
 * const strictValidator = createValidator({ mode: 'strict' });
 *
 * // Silent mode skips without logging
 * const silentValidator = createValidator({ mode: 'silent' });
 *
 * // Add custom prerequisites
 * const customValidator = createValidator({
 *   additionalPrerequisites: {
 *     custom_action: { requiresPhase: ['custom_phase'] }
 *   }
 * });
 */
export function createValidator(options: ValidatorOptions = {}): Middleware {
  const {
    mode = 'warn',
    additionalPrerequisites = {},
  } = options;

  const mergedPrerequisites = {
    ...defaultPrerequisites,
    ...additionalPrerequisites,
  };

  return (handler: ActionHandler) => {
    return async (action) => {
      const result = validateAction(action, mergedPrerequisites);

      if (!result.valid) {
        switch (mode) {
          case 'strict':
            throw new Error(`Validation failed: ${result.reason}`);
          case 'warn':
            console.warn(`[AgentAction] Validation failed for ${action.type}: ${result.reason}`);
            return;
          case 'silent':
            return;
        }
      }

      await handler(action);
    };
  };
}

// ===========================================
// Exports for Testing
// ===========================================

export { defaultPrerequisites };
export type { ActionPrerequisites, ValidationResult, ValidatorOptions };
