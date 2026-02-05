import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentPhase } from '../types';
import {
	handleStartOver,
	handleGoBack,
	handleCancel,
	handleRetry,
	isConversationAction,
	handleConversationAction,
} from '../handlers/conversation';
import {
	setLastAction,
	clearLastAction,
	getLastAction,
} from '../middleware/retryTracker';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { agent } from '$lib/stores/agent';

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

vi.mock('$lib/stores/agentIdentification', () => ({
	resetIdentification: vi.fn(),
	clearError: vi.fn(),
}));

vi.mock('$lib/stores/agentEnrichment', () => ({
	resetEnrichment: vi.fn(),
}));

vi.mock('$lib/stores/agentAddWine', () => ({
	resetAddWine: vi.fn(),
}));

vi.mock('$lib/stores/agent', () => ({
	agent: {
		closePanel: vi.fn(),
	},
}));

// ===========================================
// Conversation Handlers Tests
// ===========================================

describe('conversation handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearLastAction();
	});

	describe('isConversationAction', () => {
		it('should return true for conversation action types', () => {
			expect(isConversationAction('start_over')).toBe(true);
			expect(isConversationAction('go_back')).toBe(true);
			expect(isConversationAction('cancel')).toBe(true);
			expect(isConversationAction('retry')).toBe(true);
			expect(isConversationAction('try_again')).toBe(true);
		});

		it('should return false for non-conversation action types', () => {
			expect(isConversationAction('submit_text')).toBe(false);
			expect(isConversationAction('add_to_cellar')).toBe(false);
			expect(isConversationAction('correct')).toBe(false);
		});
	});

	describe('handleStartOver', () => {
		it('should reset all stores', () => {
			handleStartOver();

			expect(identification.resetIdentification).toHaveBeenCalled();
			expect(enrichment.resetEnrichment).toHaveBeenCalled();
			expect(addWine.resetAddWine).toHaveBeenCalled();
		});

		it('should reset conversation', () => {
			handleStartOver();

			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should start new session', () => {
			handleStartOver();

			expect(conversation.startSession).toHaveBeenCalled();
		});

		it('should clear last action', () => {
			setLastAction({ type: 'submit_text', payload: 'test' });
			handleStartOver();

			expect(getLastAction()).toBeNull();
		});
	});

	describe('handleGoBack', () => {
		it('should go back from confirming to awaiting_input', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');

			handleGoBack();

			expect(conversation.setPhase).toHaveBeenCalledWith('awaiting_input');
		});

		it('should go back from adding_wine to confirming', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('adding_wine');

			handleGoBack();

			expect(conversation.setPhase).toHaveBeenCalledWith('confirming');
		});

		it('should go back from enriching to confirming', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('enriching');

			handleGoBack();

			expect(conversation.setPhase).toHaveBeenCalledWith('confirming');
		});

		it('should go back from error to awaiting_input', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('error');

			handleGoBack();

			expect(conversation.setPhase).toHaveBeenCalledWith('awaiting_input');
		});

		it('should default to awaiting_input for unknown phases', () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');

			handleGoBack();

			expect(conversation.setPhase).toHaveBeenCalledWith('awaiting_input');
		});
	});

	describe('handleCancel', () => {
		it('should close the agent panel', () => {
			handleCancel();

			expect(agent.closePanel).toHaveBeenCalled();
		});
	});

	describe('handleRetry', () => {
		it('should return null when no last action exists', () => {
			const result = handleRetry();

			expect(result).toBeNull();
			expect(conversation.addMessage).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('awaiting_input');
		});

		it('should return the last action when it exists', () => {
			const action = { type: 'submit_text' as const, payload: 'test wine' };
			setLastAction(action);

			const result = handleRetry();

			expect(result).toEqual(action);
			expect(identification.clearError).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('identifying');
		});
	});

	describe('handleConversationAction', () => {
		it('should handle start_over action', async () => {
			const result = await handleConversationAction({ type: 'start_over' });

			expect(result).toBeNull();
			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should handle go_back action', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');

			const result = await handleConversationAction({ type: 'go_back' });

			expect(result).toBeNull();
			expect(conversation.setPhase).toHaveBeenCalled();
		});

		it('should handle cancel action', async () => {
			const result = await handleConversationAction({ type: 'cancel' });

			expect(result).toBeNull();
			expect(agent.closePanel).toHaveBeenCalled();
		});

		it('should handle retry action and return action to retry', async () => {
			const lastAction = { type: 'submit_text' as const, payload: 'test' };
			setLastAction(lastAction);

			const result = await handleConversationAction({ type: 'retry' });

			expect(result).toEqual(lastAction);
		});

		it('should handle try_again action same as retry', async () => {
			const lastAction = { type: 'submit_text' as const, payload: 'test' };
			setLastAction(lastAction);

			const result = await handleConversationAction({ type: 'try_again' });

			expect(result).toEqual(lastAction);
		});

		it('should return null for non-conversation actions', async () => {
			// This should never happen due to type checking, but test the fallback
			const result = await handleConversationAction({ type: 'submit_text', payload: 'test' } as any);

			expect(result).toBeNull();
		});
	});
});
