/**
 * Cancellation Tests (WIN-187)
 *
 * Tests that cancelling in-flight LLM requests:
 * - Actually aborts the HTTP request
 * - Prevents state updates from cancelled requests
 * - Keeps chips functional after cancellation
 * - Does not display enrichment card from cancelled requests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { get } from 'svelte/store';
import { dispatchAction } from '../router';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import { clearState } from '$lib/stores/agentPersistence';
import { _resetAbortState } from '../requestLifecycle';
import { setLastAction, getLastAction } from '../middleware/retryTracker';
import { api } from '$lib/api';
import type { ChipsMessageData, AgentChip, AgentAction } from '../types';

// Mock the API module
vi.mock('$lib/api', () => ({
	api: {
		identifyTextStream: vi.fn(),
		identifyImageStream: vi.fn(),
		enrichWineStream: vi.fn(),
		checkDuplicate: vi.fn(),
		cancelAgentRequest: vi.fn(),
	},
}));

// Delay helper for simulating streaming
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('LLM Request Cancellation (WIN-187)', () => {
	beforeEach(() => {
		conversation.fullReset();
		identification.resetIdentification();
		enrichment.resetEnrichment();
		clearState();
		_resetAbortState(); // WIN-187: Reset abort controller state between tests
		vi.clearAllMocks();
	});

	describe('identification cancellation', () => {
		it('should abort in-flight identification when cancelled', async () => {
			let abortSignalReceived: AbortSignal | undefined;
			let wasAborted = false;

			// Mock a slow identification that captures the abort signal
			vi.mocked(api.identifyTextStream).mockImplementation(
				async (text, onField?, onEvent?, signal?) => {
					abortSignalReceived = signal;

					// Listen for abort
					if (signal) {
						signal.addEventListener('abort', () => {
							wasAborted = true;
						});
					}

					// Simulate slow request
					await delay(100);

					// If aborted, throw
					if (signal?.aborted) {
						throw new DOMException('Aborted', 'AbortError');
					}

					return {
						intent: 'add' as const,
						parsed: {
							producer: 'Test Producer',
							wineName: 'Test Wine',
							vintage: '2020',
							region: null,
							appellation: null,
							country: null,
							wineType: 'Red' as const,
							grapes: [],
							confidence: 0.95,
						},
						confidence: 0.95,
						action: 'auto_populate' as const,
						candidates: [],
						inputType: 'text' as const,
					};
				}
			);

			// Start identification (don't await)
			const identifyPromise = dispatchAction({ type: 'submit_text', payload: 'test wine' });

			// Wait for identification to start
			await delay(10);
			expect(conversation.getCurrentPhase()).toBe('identifying');

			// Cancel the identification via proper action
			await dispatchAction({ type: 'cancel_request' });

			// Wait for promise to settle
			await identifyPromise;

			// Verify abort signal was passed and triggered
			expect(abortSignalReceived).toBeDefined();
			expect(wasAborted).toBe(true);

			// Verify phase is reset
			expect(conversation.getCurrentPhase()).toBe('awaiting_input');
		});

		it('should not add wine result message after cancellation', async () => {
			// Mock identification that will complete after cancellation
			vi.mocked(api.identifyTextStream).mockImplementation(async (text, onField?, onEvent?, signal?) => {
				await delay(50);

				// Return result even if cancelled (simulating race condition)
				return {
					intent: 'add' as const,
					parsed: {
						producer: 'Cancelled Producer',
						wineName: 'Cancelled Wine',
						vintage: '2020',
						region: null,
						appellation: null,
						country: null,
						wineType: 'Red' as const,
						grapes: [],
						confidence: 0.95,
					},
					confidence: 0.95,
					action: 'auto_populate' as const,
					candidates: [],
					inputType: 'text' as const,
				};
			});

			// Start identification
			const identifyPromise = dispatchAction({ type: 'submit_text', payload: 'test wine' });

			// Cancel via proper action
			await delay(10);
			await dispatchAction({ type: 'cancel_request' });

			await identifyPromise;

			// Check that no wine_result message was added (only text + chips from cancellation)
			const messages = get(conversation.agentMessages);
			const wineResultMessages = messages.filter((m) => m.category === 'wine_result');
			expect(wineResultMessages).toHaveLength(0);
		});

		it('should keep chips functional after cancellation', async () => {
			vi.mocked(api.identifyTextStream).mockImplementation(async (text, onField?, onEvent?, signal?) => {
				await delay(50);
				if (signal?.aborted) {
					throw new DOMException('Aborted', 'AbortError');
				}
				return {
					intent: 'add' as const,
					parsed: {
						producer: 'Test',
						wineName: 'Test',
						vintage: '2020',
						region: null,
						appellation: null,
						country: null,
						wineType: 'Red' as const,
						grapes: [],
						confidence: 0.95,
					},
					confidence: 0.95,
					action: 'auto_populate' as const,
					candidates: [],
					inputType: 'text' as const,
				};
			});

			// Start and cancel via proper action
			const identifyPromise = dispatchAction({ type: 'submit_text', payload: 'test' });
			await delay(10);
			await dispatchAction({ type: 'cancel_request' });
			await identifyPromise;

			// Find chips in the cancellation message (message.disabled controls if chips are clickable)
			const messages = get(conversation.agentMessages);
			const chipsMessage = messages.find((m) => m.category === 'chips' && !m.disabled);

			expect(chipsMessage).toBeDefined();
			const chips = (chipsMessage?.data as ChipsMessageData)?.chips;
			expect(chips?.length).toBeGreaterThan(0);

			// Message should not be disabled (which is what makes chips clickable)
			expect(chipsMessage?.disabled).not.toBe(true);
		});
	});

	describe('enrichment cancellation', () => {
		beforeEach(async () => {
			// Set up identified wine for enrichment tests
			vi.mocked(api.identifyTextStream).mockResolvedValue({
				intent: 'add' as const,
				parsed: {
					producer: 'Château Margaux',
					wineName: 'Grand Vin',
					vintage: '2018',
					region: 'Margaux',
					appellation: null,
					country: 'France',
					wineType: 'Red' as const,
					grapes: [],
					confidence: 0.95,
				},
				confidence: 0.95,
				action: 'auto_populate' as const,
				candidates: [],
				inputType: 'text' as const,
			});

			await dispatchAction({ type: 'submit_text', payload: 'test' });
			const chips = get(conversation.agentMessages).find((m) => m.category === 'chips' && !m.disabled);
			await dispatchAction({ type: 'correct', messageId: chips!.id });
		});

		it('should abort in-flight enrichment when cancelled', async () => {
			let wasAborted = false;

			vi.mocked(api.enrichWineStream).mockImplementation(
				async (_producer, _wineName, _vintage, _wineType, _region, _confirmMatch, _forceRefresh, _onField?, _onTextDelta?, _onEvent?, signal?) => {
					if (signal) {
						signal.addEventListener('abort', () => {
							wasAborted = true;
						});
					}

					await delay(100);

					if (signal?.aborted) {
						throw new DOMException('Aborted', 'AbortError');
					}

					return {
						success: true,
						data: {
							overview: 'Test overview',
							grapeVarieties: null,
							criticScores: null,
							drinkWindow: null,
							body: null,
							tannin: null,
							acidity: null,
							sweetness: null,
							tastingNotes: null,
							pairingNotes: null,
							appellation: null,
							alcoholContent: null,
							productionMethod: null,
							averagePrice: null,
							priceSource: null,
							confidence: 0.9,
							sources: ['test'],
						},
						source: 'web_search' as const,
						warnings: [],
						fieldSources: null,
						usage: null,
					};
				}
			);

			// Find Learn More chip and click it
			const messages = get(conversation.agentMessages);
			const chipsMsg = messages.find((m) => m.category === 'chips' && !m.disabled);
			const chipsData = chipsMsg?.data as ChipsMessageData | undefined;
			const learnChip = chipsData?.chips?.find((c: AgentChip) => c.action === 'learn');

			if (learnChip) {
				const enrichPromise = dispatchAction({ type: 'learn', messageId: chipsMsg!.id });
				await delay(10);

				// Cancel while enriching via proper action
				await dispatchAction({ type: 'cancel_request' });

				await enrichPromise;
				expect(wasAborted).toBe(true);
			}
		});

		it('should not display enrichment card after cancellation', async () => {
			vi.mocked(api.enrichWineStream).mockImplementation(
				async (_producer, _wineName, _vintage, _wineType, _region, _confirmMatch, _forceRefresh, _onField?, _onTextDelta?, _onEvent?, _signal?) => {
					await delay(50);

					// Return data even if cancelled (simulating race)
					return {
						success: true,
						data: {
							overview: 'Cancelled enrichment overview',
							grapeVarieties: null,
							criticScores: null,
							drinkWindow: null,
							body: null,
							tannin: null,
							acidity: null,
							sweetness: null,
							tastingNotes: null,
							pairingNotes: null,
							appellation: null,
							alcoholContent: null,
							productionMethod: null,
							averagePrice: null,
							priceSource: null,
							confidence: 0.9,
							sources: ['test'],
						},
						source: 'web_search' as const,
						warnings: [],
						fieldSources: null,
						usage: null,
					};
				}
			);

			const messages = get(conversation.agentMessages);
			const chipsMsg = messages.find((m) => m.category === 'chips' && !m.disabled);

			if (chipsMsg) {
				const enrichPromise = dispatchAction({ type: 'learn', messageId: chipsMsg.id });
				await delay(10);
				await dispatchAction({ type: 'cancel_request' });
				await enrichPromise;

				// Check that no enrichment message was added
				const finalMessages = get(conversation.agentMessages);
				const enrichmentMessages = finalMessages.filter((m) => m.category === 'enrichment');
				expect(enrichmentMessages).toHaveLength(0);
			}
		});

		it('should transition to confirming (not awaiting_input) when cancelling enrichment', async () => {
			// Set up state directly: greeting → awaiting_input → confirming → enriching
			conversation.resetConversation(); // bypasses validation, sets awaiting_input
			conversation.setPhase('confirming'); // awaiting_input → confirming (valid)
			conversation.setPhase('enriching'); // confirming → enriching (valid)
			expect(conversation.getCurrentPhase()).toBe('enriching');

			// Cancel while enriching
			await dispatchAction({ type: 'cancel_request' });

			// Should go back to confirming (user still has an identified wine),
			// NOT awaiting_input which is an invalid transition from enriching
			expect(conversation.getCurrentPhase()).toBe('confirming');
		});

		it('should allow retry of learn action after cancellation via retry tracker', async () => {
			// The 'learn' action must be in DEFAULT_RETRYABLE_ACTIONS so that
			// "Try Again" can replay it after cancellation.

			// Simulate dispatching a learn action through the middleware chain
			// so the retry tracker records it
			vi.mocked(api.enrichWineStream).mockImplementation(async () => {
				await delay(100);
				throw new DOMException('Aborted', 'AbortError');
			});

			// Set up state: get to confirming with an identification result
			conversation.resetConversation();
			conversation.setPhase('confirming');
			identification.setResult({
				producer: 'Château Margaux',
				wineName: 'Grand Vin',
				vintage: '2018',
				region: 'Margaux',
				country: 'France',
				type: 'Red',
			});

			// Dispatch learn — this goes through the middleware chain including withRetryTracking
			const learnPromise = dispatchAction({ type: 'learn', messageId: 'msg_test' });
			await delay(10);

			// Cancel
			await dispatchAction({ type: 'cancel_request' });
			await learnPromise;

			// The retry tracker should have recorded the 'learn' action
			const lastAction = getLastAction();
			expect(lastAction).not.toBeNull();
			expect(lastAction?.type).toBe('learn');
		});

		it('should track learn action via chip_tap for retry', async () => {
			// In the real app, chips dispatch as chip_tap which is unwrapped in the router.
			// The unwrapped action must go through middleware so the retry tracker captures it.

			vi.mocked(api.enrichWineStream).mockImplementation(async () => {
				await delay(100);
				throw new DOMException('Aborted', 'AbortError');
			});

			// Set up state: confirming with identification result
			conversation.resetConversation();
			conversation.setPhase('confirming');
			identification.setResult({
				producer: 'Château Margaux',
				wineName: 'Grand Vin',
				vintage: '2018',
				region: 'Margaux',
				country: 'France',
				type: 'Red',
			});

			// Dispatch as chip_tap (how ChipsMessage.svelte dispatches)
			const learnPromise = dispatchAction({
				type: 'chip_tap',
				payload: { action: 'learn', messageId: 'msg_chips_1' },
			} as unknown as AgentAction);
			await delay(10);

			await dispatchAction({ type: 'cancel_request' });
			await learnPromise;

			// The retry tracker should have recorded the unwrapped 'learn' action
			const lastAction = getLastAction();
			expect(lastAction).not.toBeNull();
			expect(lastAction?.type).toBe('learn');
		});
	});

	describe('cancel UI integration', () => {
		it('should handle cancel_request action gracefully', async () => {
			// This tests that the cancel_request action works correctly even without
			// an in-flight request. The actual typing indicator UI with cancel link
			// is tested in component tests.

			// Cancel request should work without error even if nothing is in progress
			await dispatchAction({ type: 'cancel_request' });

			// Verify phase is awaiting_input after cancel
			expect(conversation.getCurrentPhase()).toBe('awaiting_input');

			// Verify cancellation message was added
			const messages = get(conversation.agentMessages);
			const textMessages = messages.filter((m) => m.category === 'text');
			const cancelMessage = textMessages.find((m) =>
				(m.data as { content: string }).content.includes("I've stopped")
			);
			expect(cancelMessage).toBeDefined();

			// Verify chips are present for next action
			const chipsMessage = messages.find((m) => m.category === 'chips' && !m.disabled);
			expect(chipsMessage).toBeDefined();
		});
	});
});
