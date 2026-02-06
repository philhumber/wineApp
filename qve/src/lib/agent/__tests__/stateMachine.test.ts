import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	PHASE_TRANSITIONS,
	ADD_WINE_STEP_TRANSITIONS,
	validateTransition,
	assertValidTransition,
	canTransitionTo,
	getValidTransitions,
	canTransitionStep,
	getValidStepTransitions,
} from '../stateMachine';
import type { AgentPhase, AddWineStep } from '../types';

// ===========================================
// Phase Transitions Tests
// ===========================================

describe('stateMachine', () => {
	describe('PHASE_TRANSITIONS', () => {
		it('should define transitions for all phases', () => {
			const expectedPhases: AgentPhase[] = [
				'greeting',
				'awaiting_input',
				'identifying',
				'confirming',
				'adding_wine',
				'enriching',
				'error',
				'complete',
			];

			expectedPhases.forEach((phase) => {
				expect(PHASE_TRANSITIONS[phase]).toBeDefined();
				expect(Array.isArray(PHASE_TRANSITIONS[phase])).toBe(true);
			});
		});

		describe('greeting phase', () => {
			it('should allow transition to awaiting_input, identifying, error', () => {
				expect(PHASE_TRANSITIONS.greeting).toContain('awaiting_input');
				expect(PHASE_TRANSITIONS.greeting).toContain('identifying');
				expect(PHASE_TRANSITIONS.greeting).toContain('error');
			});
		});

		describe('awaiting_input phase', () => {
			it('should allow self-transition for prompting next missing field', () => {
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('awaiting_input');
			});

			it('should allow transition to identifying, enriching, adding_wine, confirming, error', () => {
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('identifying');
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('enriching');
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('adding_wine');
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('confirming');
				expect(PHASE_TRANSITIONS.awaiting_input).toContain('error');
			});
		});

		describe('identifying phase', () => {
			it('should allow transition to confirming, awaiting_input, error', () => {
				expect(PHASE_TRANSITIONS.identifying).toContain('confirming');
				expect(PHASE_TRANSITIONS.identifying).toContain('awaiting_input');
				expect(PHASE_TRANSITIONS.identifying).toContain('error');
			});
		});

		describe('confirming phase', () => {
			it('should allow self-transition', () => {
				expect(PHASE_TRANSITIONS.confirming).toContain('confirming');
			});

			it('should allow transition to awaiting_input, identifying, adding_wine, enriching, complete, error', () => {
				expect(PHASE_TRANSITIONS.confirming).toContain('awaiting_input');
				expect(PHASE_TRANSITIONS.confirming).toContain('identifying');
				expect(PHASE_TRANSITIONS.confirming).toContain('adding_wine');
				expect(PHASE_TRANSITIONS.confirming).toContain('enriching');
				expect(PHASE_TRANSITIONS.confirming).toContain('complete');
				expect(PHASE_TRANSITIONS.confirming).toContain('error');
			});
		});

		describe('adding_wine phase', () => {
			it('should allow self-transition for substep changes', () => {
				expect(PHASE_TRANSITIONS.adding_wine).toContain('adding_wine');
			});

			it('should allow transition to confirming, complete, error', () => {
				expect(PHASE_TRANSITIONS.adding_wine).toContain('confirming');
				expect(PHASE_TRANSITIONS.adding_wine).toContain('complete');
				expect(PHASE_TRANSITIONS.adding_wine).toContain('error');
			});
		});

		describe('enriching phase', () => {
			it('should allow transition to confirming, adding_wine, error', () => {
				expect(PHASE_TRANSITIONS.enriching).toContain('confirming');
				expect(PHASE_TRANSITIONS.enriching).toContain('adding_wine');
				expect(PHASE_TRANSITIONS.enriching).toContain('error');
			});
		});

		describe('error phase', () => {
			it('should allow transition to awaiting_input, identifying, enriching, adding_wine, greeting', () => {
				expect(PHASE_TRANSITIONS.error).toContain('awaiting_input');
				expect(PHASE_TRANSITIONS.error).toContain('identifying');
				expect(PHASE_TRANSITIONS.error).toContain('enriching');
				expect(PHASE_TRANSITIONS.error).toContain('adding_wine');
				expect(PHASE_TRANSITIONS.error).toContain('greeting');
			});
		});

		describe('complete phase', () => {
			it('should allow transition to greeting, awaiting_input', () => {
				expect(PHASE_TRANSITIONS.complete).toContain('greeting');
				expect(PHASE_TRANSITIONS.complete).toContain('awaiting_input');
			});
		});
	});

	// ===========================================
	// validateTransition Tests
	// ===========================================

	describe('validateTransition', () => {
		it('should return valid for allowed transitions', () => {
			const result = validateTransition('greeting', 'awaiting_input');
			expect(result.valid).toBe(true);
			expect(result.reason).toBeUndefined();
		});

		it('should return invalid for disallowed transitions', () => {
			const result = validateTransition('greeting', 'complete');
			expect(result.valid).toBe(false);
			expect(result.reason).toContain('Cannot transition');
			expect(result.reason).toContain('greeting');
			expect(result.reason).toContain('complete');
		});

		it('should allow awaiting_input self-transition', () => {
			const result = validateTransition('awaiting_input', 'awaiting_input');
			expect(result.valid).toBe(true);
		});

		it('should allow confirming self-transition', () => {
			const result = validateTransition('confirming', 'confirming');
			expect(result.valid).toBe(true);
		});

		it('should return invalid for unknown source phase', () => {
			const result = validateTransition('unknown_phase' as AgentPhase, 'awaiting_input');
			expect(result.valid).toBe(false);
			expect(result.reason).toContain('Unknown source phase');
		});

		describe('substep transitions within adding_wine', () => {
			it('should validate substep transitions when staying in adding_wine', () => {
				const result = validateTransition(
					'adding_wine',
					'adding_wine',
					'entity_matching',
					'confirm'
				);
				expect(result.valid).toBe(true);
			});

			it('should reject invalid substep transitions', () => {
				const result = validateTransition(
					'adding_wine',
					'adding_wine',
					'complete', // Can't go directly to complete from confirm
					'confirm'
				);
				expect(result.valid).toBe(false);
				expect(result.reason).toContain('adding_wine:confirm');
				expect(result.reason).toContain('adding_wine:complete');
			});
		});
	});

	// ===========================================
	// assertValidTransition Tests
	// ===========================================

	describe('assertValidTransition', () => {
		const originalEnv = import.meta.env.DEV;

		afterEach(() => {
			// Restore original environment
			vi.unstubAllEnvs();
		});

		it('should throw in DEV mode for invalid transitions', () => {
			vi.stubEnv('DEV', true);

			expect(() => {
				assertValidTransition('greeting', 'complete', null, null, 'test context');
			}).toThrow('[StateMachine] Invalid phase transition');
		});

		it('should not throw for valid transitions', () => {
			vi.stubEnv('DEV', true);

			expect(() => {
				assertValidTransition('greeting', 'awaiting_input');
			}).not.toThrow();
		});

		it('should not throw for awaiting_input self-transition', () => {
			vi.stubEnv('DEV', true);

			expect(() => {
				assertValidTransition('awaiting_input', 'awaiting_input');
			}).not.toThrow();
		});

		it('should include context in error message when provided', () => {
			vi.stubEnv('DEV', true);

			expect(() => {
				assertValidTransition('greeting', 'complete', null, null, 'handleUseGrapeAsName');
			}).toThrow('handleUseGrapeAsName');
		});
	});

	// ===========================================
	// canTransitionTo Tests
	// ===========================================

	describe('canTransitionTo', () => {
		it('should return true for valid transitions', () => {
			expect(canTransitionTo('greeting', 'awaiting_input')).toBe(true);
			expect(canTransitionTo('identifying', 'confirming')).toBe(true);
			expect(canTransitionTo('confirming', 'adding_wine')).toBe(true);
		});

		it('should return false for invalid transitions', () => {
			expect(canTransitionTo('greeting', 'complete')).toBe(false);
			expect(canTransitionTo('identifying', 'adding_wine')).toBe(false);
		});

		it('should return true for awaiting_input self-transition', () => {
			expect(canTransitionTo('awaiting_input', 'awaiting_input')).toBe(true);
		});

		it('should return true for confirming self-transition', () => {
			expect(canTransitionTo('confirming', 'confirming')).toBe(true);
		});

		it('should return false for unknown phases', () => {
			expect(canTransitionTo('unknown' as AgentPhase, 'awaiting_input')).toBe(false);
		});
	});

	// ===========================================
	// getValidTransitions Tests
	// ===========================================

	describe('getValidTransitions', () => {
		it('should return all valid transitions for a phase', () => {
			const transitions = getValidTransitions('greeting');
			expect(transitions).toContain('awaiting_input');
			expect(transitions).toContain('identifying');
			expect(transitions).toContain('error');
		});

		it('should include self-transition for awaiting_input', () => {
			const transitions = getValidTransitions('awaiting_input');
			expect(transitions).toContain('awaiting_input');
		});

		it('should return empty array for unknown phase', () => {
			const transitions = getValidTransitions('unknown' as AgentPhase);
			expect(transitions).toEqual([]);
		});
	});

	// ===========================================
	// AddWineStep Transitions Tests
	// ===========================================

	describe('ADD_WINE_STEP_TRANSITIONS', () => {
		it('should define transitions for all steps', () => {
			const expectedSteps: AddWineStep[] = [
				'confirm',
				'entity_matching',
				'bottle_details',
				'enrichment',
				'complete',
			];

			expectedSteps.forEach((step) => {
				expect(ADD_WINE_STEP_TRANSITIONS[step]).toBeDefined();
				expect(Array.isArray(ADD_WINE_STEP_TRANSITIONS[step])).toBe(true);
			});
		});

		it('should allow confirm to transition to entity_matching or bottle_details', () => {
			expect(ADD_WINE_STEP_TRANSITIONS.confirm).toContain('entity_matching');
			expect(ADD_WINE_STEP_TRANSITIONS.confirm).toContain('bottle_details');
		});

		it('should allow entity_matching self-transition', () => {
			expect(ADD_WINE_STEP_TRANSITIONS.entity_matching).toContain('entity_matching');
		});

		it('should have no transitions from complete step', () => {
			expect(ADD_WINE_STEP_TRANSITIONS.complete).toEqual([]);
		});
	});

	describe('canTransitionStep', () => {
		it('should return true for valid step transitions', () => {
			expect(canTransitionStep('confirm', 'entity_matching')).toBe(true);
			expect(canTransitionStep('entity_matching', 'bottle_details')).toBe(true);
		});

		it('should return false for invalid step transitions', () => {
			expect(canTransitionStep('confirm', 'complete')).toBe(false);
			expect(canTransitionStep('bottle_details', 'entity_matching')).toBe(false);
		});

		it('should return true for entity_matching self-transition', () => {
			expect(canTransitionStep('entity_matching', 'entity_matching')).toBe(true);
		});
	});

	describe('getValidStepTransitions', () => {
		it('should return all valid transitions for a step', () => {
			const transitions = getValidStepTransitions('confirm');
			expect(transitions).toContain('entity_matching');
			expect(transitions).toContain('bottle_details');
		});

		it('should return empty array for complete step', () => {
			const transitions = getValidStepTransitions('complete');
			expect(transitions).toEqual([]);
		});

		it('should return empty array for unknown step', () => {
			const transitions = getValidStepTransitions('unknown' as AddWineStep);
			expect(transitions).toEqual([]);
		});
	});

	// ===========================================
	// Real-world Scenario Tests
	// ===========================================

	describe('real-world scenarios', () => {
		it('should support grape-only identification flow with Use Grape Name chip', () => {
			// 1. User submits text -> identifying
			expect(canTransitionTo('awaiting_input', 'identifying')).toBe(true);

			// 2. Grape-only result -> awaiting_input (prompting for more info)
			expect(canTransitionTo('identifying', 'awaiting_input')).toBe(true);

			// 3. User taps "Use Grape Name" -> still awaiting_input (need producer now)
			expect(canTransitionTo('awaiting_input', 'awaiting_input')).toBe(true);

			// 4. User provides producer -> confirming (all fields complete)
			expect(canTransitionTo('awaiting_input', 'confirming')).toBe(true);
		});

		it('should support full identification to add wine flow', () => {
			// greeting -> awaiting_input
			expect(canTransitionTo('greeting', 'awaiting_input')).toBe(true);

			// awaiting_input -> identifying
			expect(canTransitionTo('awaiting_input', 'identifying')).toBe(true);

			// identifying -> confirming
			expect(canTransitionTo('identifying', 'confirming')).toBe(true);

			// confirming -> adding_wine
			expect(canTransitionTo('confirming', 'adding_wine')).toBe(true);

			// adding_wine -> complete
			expect(canTransitionTo('adding_wine', 'complete')).toBe(true);
		});

		it('should support error recovery flow', () => {
			// error -> awaiting_input (retry)
			expect(canTransitionTo('error', 'awaiting_input')).toBe(true);

			// error -> identifying (retry identification)
			expect(canTransitionTo('error', 'identifying')).toBe(true);

			// error -> greeting (start over)
			expect(canTransitionTo('error', 'greeting')).toBe(true);
		});
	});
});
