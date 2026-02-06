import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { AgentAction, AgentPhase } from '../types';
import type { ActionHandler, Middleware } from '../middleware/types';
import {
	compose,
	applyMiddleware,
	createPipeline,
} from '../middleware/compose';
import {
	withErrorHandling,
	createErrorHandler,
	extractErrorInfo,
	formatErrorMessage,
} from '../middleware/errorHandler';
import {
	withRetryTracking,
	createRetryTracker,
	getLastAction,
	setLastAction,
	clearLastAction,
	canRetry,
	getRetryInfo,
	didLastActionSucceed,
	markLastActionSucceeded,
	lastAction,
} from '../middleware/retryTracker';
import {
	withValidation,
	createValidator,
	validateAction,
	defaultPrerequisites,
} from '../middleware/validator';
import { AgentError } from '$lib/api/types';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as addWine from '$lib/stores/agentAddWine';

// Mock the stores
vi.mock('$lib/stores/agentConversation', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentConversation')>(
		'$lib/stores/agentConversation'
	);
	return {
		...actual,
		addMessage: vi.fn(),
		createChipsMessage: vi.fn((chips) => ({
			id: 'test-id',
			category: 'chips' as const,
			role: 'agent' as const,
			timestamp: Date.now(),
			data: { category: 'chips' as const, chips },
		})),
		setPhase: vi.fn(),
		getCurrentPhase: vi.fn().mockReturnValue('awaiting_input' as AgentPhase),
	};
});

vi.mock('$lib/stores/agentIdentification', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentIdentification')>(
		'$lib/stores/agentIdentification'
	);
	return {
		...actual,
		setError: vi.fn(),
		getResult: vi.fn().mockReturnValue(null),
	};
});

vi.mock('$lib/stores/agentAddWine', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentAddWine')>(
		'$lib/stores/agentAddWine'
	);
	return {
		...actual,
		getCurrentFlow: vi.fn().mockReturnValue(null),
	};
});

// ===========================================
// Compose Tests
// ===========================================

describe('compose', () => {
	it('should return identity function for empty middleware array', () => {
		const composed = compose();
		const handler: ActionHandler = vi.fn();
		const wrappedHandler = composed(handler);

		expect(wrappedHandler).toBe(handler);
	});

	it('should return the middleware itself for single middleware', () => {
		const middleware: Middleware = (h) => async (a) => h(a);
		const composed = compose(middleware);

		expect(composed).toBe(middleware);
	});

	it('should compose middleware right-to-left', async () => {
		const order: string[] = [];

		const middleware1: Middleware = (handler) => async (action) => {
			order.push('m1-before');
			await handler(action);
			order.push('m1-after');
		};

		const middleware2: Middleware = (handler) => async (action) => {
			order.push('m2-before');
			await handler(action);
			order.push('m2-after');
		};

		const composed = compose(middleware1, middleware2);
		const baseHandler: ActionHandler = vi.fn(async () => {
			order.push('handler');
		});

		const wrapped = composed(baseHandler);
		await wrapped({ type: 'start_over' });

		// middleware1 wraps middleware2 wraps handler
		// So execution: m1-before -> m2-before -> handler -> m2-after -> m1-after
		expect(order).toEqual(['m1-before', 'm2-before', 'handler', 'm2-after', 'm1-after']);
	});
});

describe('applyMiddleware', () => {
	it('should apply middleware to handler', async () => {
		const calls: string[] = [];

		const middleware: Middleware = (handler) => async (action) => {
			calls.push('middleware');
			await handler(action);
		};

		const handler: ActionHandler = async () => {
			calls.push('handler');
		};

		const wrapped = applyMiddleware(handler, middleware);
		await wrapped({ type: 'start_over' });

		expect(calls).toEqual(['middleware', 'handler']);
	});
});

describe('createPipeline', () => {
	it('should build a composable pipeline', async () => {
		const calls: string[] = [];

		const m1: Middleware = (h) => async (a) => {
			calls.push('m1');
			await h(a);
		};
		const m2: Middleware = (h) => async (a) => {
			calls.push('m2');
			await h(a);
		};

		const pipeline = createPipeline().use(m1).use(m2);

		const handler: ActionHandler = async () => {
			calls.push('handler');
		};

		const wrapped = pipeline.apply(handler);
		await wrapped({ type: 'start_over' });

		// First added (m1) is outermost, so executes first
		expect(calls).toEqual(['m1', 'm2', 'handler']);
	});
});

// ===========================================
// Retry Tracker Tests
// ===========================================

describe('retryTracker', () => {
	beforeEach(() => {
		clearLastAction();
	});

	describe('store operations', () => {
		it('should start with no last action', () => {
			expect(getLastAction()).toBeNull();
		});

		it('should set and get last action', () => {
			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };
			setLastAction(action);

			expect(getLastAction()).toEqual(action);
		});

		it('should clear last action', () => {
			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };
			setLastAction(action);
			clearLastAction();

			expect(getLastAction()).toBeNull();
		});

		it('should track succeeded state', () => {
			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };
			setLastAction(action, false);

			expect(didLastActionSucceed()).toBe(false);

			markLastActionSucceeded();

			expect(didLastActionSucceed()).toBe(true);
		});

		it('should expire old actions', async () => {
			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };
			setLastAction(action);

			// Should return action with default expiration
			expect(getLastAction()).toEqual(action);

			// Wait a tiny bit so time has elapsed
			await new Promise((r) => setTimeout(r, 5));

			// Should return null with very short expiration (1ms - less than elapsed time)
			expect(getLastAction(1)).toBeNull();
		});
	});

	describe('canRetry', () => {
		it('should return false when no action exists', () => {
			expect(canRetry()).toBe(false);
		});

		it('should return true when action exists', () => {
			setLastAction({ type: 'submit_text', payload: 'test' });
			expect(canRetry()).toBe(true);
		});
	});

	describe('getRetryInfo', () => {
		it('should return empty info when no action exists', () => {
			const info = getRetryInfo();
			expect(info).toEqual({
				canRetry: false,
				actionType: null,
				ageMs: null,
			});
		});

		it('should return action info when action exists', () => {
			setLastAction({ type: 'submit_text', payload: 'test' });
			const info = getRetryInfo();

			expect(info.canRetry).toBe(true);
			expect(info.actionType).toBe('submit_text');
			expect(typeof info.ageMs).toBe('number');
		});
	});

	describe('withRetryTracking middleware', () => {
		it('should track retryable actions', async () => {
			const handler: ActionHandler = vi.fn();
			const wrapped = withRetryTracking(handler);

			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };
			await wrapped(action);

			expect(getLastAction()).toEqual(action);
			expect(didLastActionSucceed()).toBe(true);
		});

		it('should not track non-retryable actions', async () => {
			const handler: ActionHandler = vi.fn();
			const wrapped = withRetryTracking(handler);

			const action: AgentAction = { type: 'start_over' };
			await wrapped(action);

			expect(getLastAction()).toBeNull();
		});

		it('should mark action as failed on error', async () => {
			const handler: ActionHandler = vi.fn().mockRejectedValue(new Error('test error'));
			const wrapped = withRetryTracking(handler);

			const action: AgentAction = { type: 'submit_text', payload: 'test wine' };

			await expect(wrapped(action)).rejects.toThrow('test error');
			expect(getLastAction()).toEqual(action);
			expect(didLastActionSucceed()).toBe(false);
		});
	});

	describe('createRetryTracker', () => {
		it('should create custom tracker with specified actions', async () => {
			const customTracker = createRetryTracker({
				trackableActions: new Set(['custom_action']),
			});

			const handler: ActionHandler = vi.fn();
			const wrapped = customTracker(handler);

			// submit_text is not in custom set
			await wrapped({ type: 'submit_text', payload: 'test' });
			expect(getLastAction()).toBeNull();

			// This won't work because our action types are strict
			// But the middleware would track it if the type existed
		});
	});

	describe('store subscription', () => {
		it('should be subscribable', () => {
			let value: unknown;
			const unsubscribe = lastAction.subscribe((v) => {
				value = v;
			});

			setLastAction({ type: 'submit_text', payload: 'test' });

			expect(value).toBeDefined();
			unsubscribe();
		});
	});
});

// ===========================================
// Error Handler Tests
// ===========================================

describe('errorHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('extractErrorInfo', () => {
		it('should extract info from AgentError', () => {
			// AgentError constructor takes AgentErrorInfo directly, not AgentErrorResponse
			const agentError = new AgentError({
				type: 'timeout',
				userMessage: 'Request timed out',
				retryable: true,
				supportRef: 'ERR-12345678',
			});

			const info = extractErrorInfo(agentError);

			expect(info.type).toBe('timeout');
			expect(info.userMessage).toBe('Request timed out');
			expect(info.retryable).toBe(true);
			expect(info.supportRef).toBe('ERR-12345678');
		});

		it('should detect timeout errors from Error message', () => {
			const error = new Error('Operation timed out');
			const info = extractErrorInfo(error);

			expect(info.type).toBe('timeout');
			expect(info.retryable).toBe(true);
		});

		it('should detect rate limit errors from Error message', () => {
			const error = new Error('rate limit exceeded');
			const info = extractErrorInfo(error);

			expect(info.type).toBe('rate_limit');
			expect(info.retryable).toBe(true);
		});

		it('should detect network errors from Error message', () => {
			const error = new Error('network error occurred');
			const info = extractErrorInfo(error);

			expect(info.type).toBe('server_error');
			expect(info.retryable).toBe(true);
		});

		it('should handle unknown errors', () => {
			const info = extractErrorInfo('string error');

			expect(info.type).toBe('unknown');
			expect(info.retryable).toBe(true);
		});
	});

	describe('formatErrorMessage', () => {
		it('should format message without support reference', () => {
			const formatted = formatErrorMessage({
				type: 'timeout',
				userMessage: 'Request timed out',
				retryable: true,
			});

			expect(formatted).toBe('Request timed out');
		});

		it('should format message with support reference', () => {
			const formatted = formatErrorMessage({
				type: 'timeout',
				userMessage: 'Request timed out',
				retryable: true,
				supportRef: 'ERR-12345678',
			});

			expect(formatted).toContain('Request timed out');
			expect(formatted).toContain('ERR-12345678');
		});
	});

	describe('withErrorHandling middleware', () => {
		it('should pass through successful actions', async () => {
			const handler: ActionHandler = vi.fn();
			const wrapped = withErrorHandling(handler);

			await wrapped({ type: 'start_over' });

			expect(handler).toHaveBeenCalled();
			expect(conversation.setPhase).not.toHaveBeenCalledWith('error');
		});

		it('should catch errors and show in conversation', async () => {
			const handler: ActionHandler = vi.fn().mockRejectedValue(new Error('test error'));
			const wrapped = withErrorHandling(handler);

			await wrapped({ type: 'start_over' });

			expect(conversation.addMessage).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('error');
		});
	});

	describe('createErrorHandler', () => {
		it('should create handler with custom options', async () => {
			const onError = vi.fn();
			const customHandler = createErrorHandler({
				showRetryChips: false,
				setPhase: false,
				onError,
			});

			const handler: ActionHandler = vi.fn().mockRejectedValue(new Error('test'));
			const wrapped = customHandler(handler);

			await wrapped({ type: 'start_over' });

			expect(onError).toHaveBeenCalled();
		});
	});
});

// ===========================================
// Validator Tests
// ===========================================

describe('validator', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(conversation.getCurrentPhase).mockReturnValue('awaiting_input');
		vi.mocked(identification.getResult).mockReturnValue(null);
		vi.mocked(addWine.getCurrentFlow).mockReturnValue(null);
	});

	describe('validateAction', () => {
		it('should validate actions without prerequisites', () => {
			const result = validateAction({ type: 'start_over' });
			expect(result.valid).toBe(true);
		});

		it('should fail when phase requirement not met', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');

			const result = validateAction({ type: 'correct', messageId: 'test' });

			expect(result.valid).toBe(false);
			expect(result.reason).toContain('requires phase');
		});

		it('should fail when identification requirement not met', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue(null);

			const result = validateAction({ type: 'correct', messageId: 'test' });

			expect(result.valid).toBe(false);
			expect(result.reason).toContain('requires identification result');
		});

		it('should pass when all requirements met', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			const result = validateAction({ type: 'correct', messageId: 'test' });

			expect(result.valid).toBe(true);
		});
	});

	describe('withValidation middleware', () => {
		it('should allow valid actions through', async () => {
			const handler: ActionHandler = vi.fn();
			const wrapped = withValidation(handler);

			await wrapped({ type: 'start_over' });

			expect(handler).toHaveBeenCalled();
		});

		it('should skip invalid actions', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');

			const handler: ActionHandler = vi.fn();
			const wrapped = withValidation(handler);

			await wrapped({ type: 'correct', messageId: 'test' });

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe('createValidator', () => {
		it('should create validator with strict mode', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');

			const strictValidator = createValidator({ mode: 'strict' });
			const handler: ActionHandler = vi.fn();
			const wrapped = strictValidator(handler);

			await expect(wrapped({ type: 'correct', messageId: 'test' })).rejects.toThrow(
				'Validation failed'
			);
		});

		it('should create validator with silent mode', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');

			const silentValidator = createValidator({ mode: 'silent' });
			const handler: ActionHandler = vi.fn();
			const wrapped = silentValidator(handler);

			// Should not throw, should not call handler
			await wrapped({ type: 'correct', messageId: 'test' });
			expect(handler).not.toHaveBeenCalled();
		});

		it('should merge additional prerequisites', async () => {
			const customValidator = createValidator({
				additionalPrerequisites: {
					custom_action: { requiresPhase: ['greeting'] },
				},
			});

			// Note: Can't test this fully without custom action types
			expect(customValidator).toBeDefined();
		});
	});

	describe('defaultPrerequisites', () => {
		it('should have prerequisites for confirmation actions', () => {
			expect(defaultPrerequisites['correct']).toBeDefined();
			expect(defaultPrerequisites['correct'].requiresIdentification).toBe(true);
		});

		it('should have prerequisites for add wine actions', () => {
			expect(defaultPrerequisites['add_to_cellar']).toBeDefined();
			expect(defaultPrerequisites['add_to_cellar'].requiresIdentification).toBe(true);
		});

		it('should have prerequisites for enrichment actions', () => {
			expect(defaultPrerequisites['enrich_now']).toBeDefined();
			expect(defaultPrerequisites['enrich_now'].requiresIdentification).toBe(true);
		});
	});
});
