import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentPhase } from '../types';
import { dispatchAction, createRouter, _routeAction } from '../router';
import { clearLastAction } from '../middleware/retryTracker';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { agent } from '$lib/stores/agent';
import { handleAgentAction as legacyHandler } from '../handleAgentAction';

// Mock all stores
vi.mock('$lib/stores/agentConversation', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentConversation')>(
		'$lib/stores/agentConversation'
	);
	return {
		...actual,
		addMessage: vi.fn(),
		createTextMessage: vi.fn((content) => ({
			id: 'test-id',
			category: 'text' as const,
			role: 'agent' as const,
			timestamp: Date.now(),
			data: { category: 'text' as const, content },
		})),
		createChipsMessage: vi.fn((chips) => ({
			id: 'test-id',
			category: 'chips' as const,
			role: 'agent' as const,
			timestamp: Date.now(),
			data: { category: 'chips' as const, chips },
		})),
		setPhase: vi.fn(),
		getCurrentPhase: vi.fn().mockReturnValue('awaiting_input' as AgentPhase),
		resetConversation: vi.fn(),
		startSession: vi.fn(),
		fullReset: vi.fn(),
	};
});

vi.mock('$lib/stores/agentIdentification', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentIdentification')>(
		'$lib/stores/agentIdentification'
	);
	return {
		...actual,
		resetIdentification: vi.fn(),
		clearError: vi.fn(),
		setError: vi.fn(),
		getResult: vi.fn().mockReturnValue(null),
	};
});

vi.mock('$lib/stores/agentEnrichment', () => ({
	resetEnrichment: vi.fn(),
}));

vi.mock('$lib/stores/agentAddWine', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentAddWine')>(
		'$lib/stores/agentAddWine'
	);
	return {
		...actual,
		resetAddWine: vi.fn(),
		getCurrentFlow: vi.fn().mockReturnValue(null),
	};
});

vi.mock('$lib/stores/agent', () => ({
	agent: {
		closePanel: vi.fn(),
	},
}));

// Mock the legacy handler
vi.mock('../handleAgentAction', () => ({
	handleAgentAction: vi.fn(),
}));

// ===========================================
// Router Tests
// ===========================================

describe('router', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearLastAction();
	});

	describe('dispatchAction', () => {
		it('should route start_over to conversation handler', async () => {
			await dispatchAction({ type: 'start_over' });

			expect(conversation.resetConversation).toHaveBeenCalled();
			expect(conversation.startSession).toHaveBeenCalled();
			// Should NOT delegate to legacy handler
			expect(legacyHandler).not.toHaveBeenCalled();
		});

		it('should route go_back to conversation handler', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');

			await dispatchAction({ type: 'go_back' });

			expect(conversation.setPhase).toHaveBeenCalled();
			expect(legacyHandler).not.toHaveBeenCalled();
		});

		it('should route cancel to conversation handler', async () => {
			await dispatchAction({ type: 'cancel' });

			expect(agent.closePanel).toHaveBeenCalled();
			expect(legacyHandler).not.toHaveBeenCalled();
		});

		it('should route retry to conversation handler', async () => {
			await dispatchAction({ type: 'retry' });

			// Should show "nothing to retry" message since no last action
			expect(conversation.addMessage).toHaveBeenCalled();
			expect(legacyHandler).not.toHaveBeenCalled();
		});

		it('should route try_again to conversation handler', async () => {
			await dispatchAction({ type: 'try_again' });

			expect(conversation.addMessage).toHaveBeenCalled();
			expect(legacyHandler).not.toHaveBeenCalled();
		});

		it('should delegate non-conversation actions to legacy handler', async () => {
			await dispatchAction({ type: 'submit_text', payload: 'test wine' });

			expect(legacyHandler).toHaveBeenCalledWith({
				type: 'submit_text',
				payload: 'test wine',
			});
		});

		it('should delegate add_to_cellar to legacy handler', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'add_to_cellar', messageId: 'test' });

			expect(legacyHandler).toHaveBeenCalledWith({
				type: 'add_to_cellar',
				messageId: 'test',
			});
		});

		it('should delegate enrich_now to legacy handler', async () => {
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'enrich_now', messageId: 'test' });

			expect(legacyHandler).toHaveBeenCalledWith({
				type: 'enrich_now',
				messageId: 'test',
			});
		});
	});

	describe('createRouter', () => {
		it('should create a custom router with specified middleware', async () => {
			const calls: string[] = [];

			const customMiddleware = (handler: any) => async (action: any) => {
				calls.push('custom');
				await handler(action);
			};

			const customRouter = createRouter(customMiddleware);
			await customRouter({ type: 'start_over' });

			expect(calls).toContain('custom');
		});
	});

	describe('_routeAction (internal)', () => {
		it('should handle conversation actions directly', async () => {
			await _routeAction({ type: 'start_over' });

			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should fall back to legacy handler for unknown actions', async () => {
			await _routeAction({ type: 'submit_text', payload: 'test' });

			expect(legacyHandler).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should catch errors from legacy handler and show in conversation', async () => {
			vi.mocked(legacyHandler).mockRejectedValueOnce(new Error('Test error'));

			await dispatchAction({ type: 'submit_text', payload: 'test' });

			// Error middleware should catch and display
			expect(conversation.addMessage).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('error');
		});
	});

	describe('validation', () => {
		it('should skip invalid actions', async () => {
			// correct action requires identification result and result_confirm phase
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');
			vi.mocked(identification.getResult).mockReturnValue(null);

			await dispatchAction({ type: 'correct', messageId: 'test' });

			// Should not call legacy handler because validation fails
			expect(legacyHandler).not.toHaveBeenCalled();
		});
	});
});
