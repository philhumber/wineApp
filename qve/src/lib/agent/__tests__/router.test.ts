import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentPhase } from '../types';
import { dispatchAction, createRouter, _routeAction } from '../router';
import { clearLastAction } from '../middleware/retryTracker';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { closePanel } from '$lib/stores/agentPanel';
import * as handlers from '../handlers';

// Mock all stores
vi.mock('$lib/stores/agentConversation', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/agentConversation')>(
		'$lib/stores/agentConversation'
	);
	return {
		...actual,
		addMessage: vi.fn(),
		disableMessage: vi.fn(),
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
		clearIdentification: vi.fn(),
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

vi.mock('$lib/stores/agentPanel', () => ({
	closePanel: vi.fn(),
	openPanel: vi.fn(),
	togglePanel: vi.fn(),
	agentPanelOpen: { subscribe: vi.fn() },
}));

// Mock the handlers module
vi.mock('../handlers', async () => {
	const actual = await vi.importActual<typeof import('../handlers')>('../handlers');
	return {
		...actual,
		handleIdentificationAction: vi.fn(),
		handleEnrichmentAction: vi.fn(),
		handleAddWineAction: vi.fn(),
		handleFormAction: vi.fn(),
		handleCameraAction: vi.fn(),
	};
});

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

			// start_over calls resetConversation() (preserves history with divider + greeting)
			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should route go_back to conversation handler', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');

			await dispatchAction({ type: 'go_back' });

			expect(conversation.setPhase).toHaveBeenCalled();
		});

		it('should route cancel to conversation handler', async () => {
			await dispatchAction({ type: 'cancel' });

			expect(closePanel).toHaveBeenCalled();
		});

		it('should route retry to conversation handler', async () => {
			await dispatchAction({ type: 'retry' });

			// Should show "nothing to retry" message since no last action
			expect(conversation.addMessage).toHaveBeenCalled();
		});

		it('should route try_again to conversation handler', async () => {
			await dispatchAction({ type: 'try_again' });

			expect(conversation.addMessage).toHaveBeenCalled();
		});

		it('should route submit_text to identification handler', async () => {
			await dispatchAction({ type: 'submit_text', payload: 'test wine' });

			expect(handlers.handleIdentificationAction).toHaveBeenCalledWith({
				type: 'submit_text',
				payload: 'test wine',
			});
		});

		it('should route add_to_cellar to addWine handler', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'add_to_cellar', messageId: 'test' });

			expect(handlers.handleAddWineAction).toHaveBeenCalledWith({
				type: 'add_to_cellar',
				messageId: 'test',
			});
		});

		it('should route enrich_now to addWine handler', async () => {
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'enrich_now', messageId: 'test' });

			expect(handlers.handleAddWineAction).toHaveBeenCalledWith({
				type: 'enrich_now',
				messageId: 'test',
			});
		});

		it('should route new_input to conversation handler', async () => {
			await dispatchAction({ type: 'new_input', messageId: 'test' });

			expect(identification.clearIdentification).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('awaiting_input');
		});

		it('should route start_fresh to conversation handler', async () => {
			await dispatchAction({ type: 'start_fresh', messageId: 'test' });

			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should route start_over_error to conversation handler', async () => {
			await dispatchAction({ type: 'start_over_error', messageId: 'test' });

			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should route take_photo to camera handler', async () => {
			await dispatchAction({ type: 'take_photo', messageId: 'test' });

			expect(handlers.handleCameraAction).toHaveBeenCalledWith({
				type: 'take_photo',
				messageId: 'test',
			});
		});

		it('should route choose_photo to camera handler', async () => {
			await dispatchAction({ type: 'choose_photo', messageId: 'test' });

			expect(handlers.handleCameraAction).toHaveBeenCalledWith({
				type: 'choose_photo',
				messageId: 'test',
			});
		});
	});

	describe('action aliases', () => {
		it('should normalize "add" to "add_to_cellar"', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'add', messageId: 'test' });

			expect(handlers.handleAddWineAction).toHaveBeenCalledWith({
				type: 'add_to_cellar',
				messageId: 'test',
			});
		});

		it('should normalize "remember_wine" to "remember"', async () => {
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({ type: 'remember_wine', messageId: 'test' });

			expect(handlers.handleEnrichmentAction).toHaveBeenCalledWith({
				type: 'remember',
				messageId: 'test',
			});
		});
	});

	describe('chip_tap safety net', () => {
		it('should unwrap chip_tap and re-dispatch', async () => {
			await dispatchAction({
				type: 'chip_tap',
				payload: {
					action: 'start_over',
					messageId: 'test',
				},
			});

			expect(conversation.resetConversation).toHaveBeenCalled();
		});

		it('should unwrap chip_tap with data payload', async () => {
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('confirming');
			vi.mocked(identification.getResult).mockReturnValue({
				producer: 'Test',
				wineName: 'Wine',
			});

			await dispatchAction({
				type: 'chip_tap',
				payload: {
					action: 'add_to_cellar',
					messageId: 'test',
					data: { some: 'data' },
				},
			});

			expect(handlers.handleAddWineAction).toHaveBeenCalled();
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
	});

	describe('error handling', () => {
		it('should catch errors from handlers and show in conversation', async () => {
			vi.mocked(handlers.handleIdentificationAction).mockRejectedValueOnce(
				new Error('Identification error')
			);

			await dispatchAction({ type: 'submit_text', payload: 'test' });

			// Error middleware should catch and display
			expect(conversation.addMessage).toHaveBeenCalled();
			expect(conversation.setPhase).toHaveBeenCalledWith('error');
		});
	});

	describe('validation', () => {
		it('should skip invalid actions', async () => {
			// correct action requires identification result and confirming phase
			vi.mocked(conversation.getCurrentPhase).mockReturnValue('greeting');
			vi.mocked(identification.getResult).mockReturnValue(null);

			await dispatchAction({ type: 'correct', messageId: 'test' });

			// Validation middleware skips the action when prerequisites not met
			expect(handlers.handleIdentificationAction).not.toHaveBeenCalled();
		});
	});
});
