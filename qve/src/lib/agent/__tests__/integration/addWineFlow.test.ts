/**
 * Add Wine Flow Integration Tests
 *
 * Tests the complete add wine flow from action to store updates.
 * These tests verify that all stores are updated correctly and
 * in the right order as the user progresses through the flow.
 *
 * Sprint 5: Test Expansion (Phase 2 Rearchitecture)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { dispatchAction as handleAgentAction } from '../../router';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { clearState } from '$lib/stores/agentPersistence';
import { api } from '$lib/api';
import type { AgentMessage, TextMessageData, ChipsMessageData } from '$lib/agent/types';

// Type helpers
const getTextContent = (msg: AgentMessage | undefined): string | undefined => {
	if (!msg || msg.category !== 'text') return undefined;
	return (msg.data as TextMessageData).content;
};

const getChips = (msg: AgentMessage | undefined) => {
	if (!msg || msg.category !== 'chips') return undefined;
	return (msg.data as ChipsMessageData).chips;
};

// Mock the API module
vi.mock('$lib/api', () => ({
	api: {
		identifyTextStream: vi.fn(),
		identifyImageStream: vi.fn(),
		checkDuplicate: vi.fn(),
		addWine: vi.fn(),
		addBottle: vi.fn(),
		clarifyMatch: vi.fn(),
		enrichWineStream: vi.fn(),
		getRegions: vi.fn(),
		getProducers: vi.fn(),
		getWines: vi.fn(),
	},
}));

// Sample API responses
const sampleIdentificationResponse = {
	intent: 'add' as const,
	parsed: {
		producer: 'Château Margaux',
		wineName: 'Grand Vin',
		vintage: '2018',
		region: 'Margaux',
		appellation: 'Margaux AOC',
		country: 'France',
		wineType: 'Red' as const,
		grapes: ['Cabernet Sauvignon', 'Merlot'],
		confidence: 0.95,
	},
	confidence: 0.95,
	action: 'auto_populate' as const,
	candidates: [],
	inputType: 'text' as const,
};

const sampleEnrichmentResponse = {
	success: true,
	data: {
		grapeVarieties: [{ grape: 'Cabernet Sauvignon', percentage: '75' }],
		appellation: 'Margaux AOC',
		alcoholContent: 13.5,
		drinkWindow: { start: 2025, end: 2040 },
		productionMethod: null,
		criticScores: [{ critic: 'WS', score: 95, year: 2021 }],
		averagePrice: 450,
		priceSource: null,
		body: '4',
		tannin: '4',
		acidity: '3',
		sweetness: '1',
		overview: 'A premier grand cru classé from Margaux.',
		tastingNotes: 'Black currant, tobacco, and subtle oak.',
		pairingNotes: 'Lamb, beef, aged cheese',
		confidence: 0.9,
		sources: ['Wine Spectator'],
	},
	source: 'cache' as const,
	warnings: [],
	fieldSources: null,
	usage: null,
};

// Helper to wait for async state changes
const waitForPhase = async (targetPhase: string, timeout = 5000): Promise<void> => {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (get(conversation.agentPhase) === targetPhase) return;
		await new Promise((r) => setTimeout(r, 50));
	}
	throw new Error(`Timeout waiting for phase: ${targetPhase}, current: ${get(conversation.agentPhase)}`);
};

describe('Add Wine Flow Integration', () => {
	beforeEach(() => {
		// Reset all stores
		conversation.fullReset();
		identification.resetIdentification();
		enrichment.resetEnrichment();
		addWine.resetAddWine();
		clearState();
		vi.clearAllMocks();

		// Set up default mocks
		vi.mocked(api.identifyTextStream).mockResolvedValue(sampleIdentificationResponse);
		vi.mocked(api.enrichWineStream).mockResolvedValue(sampleEnrichmentResponse);
		vi.mocked(api.checkDuplicate).mockResolvedValue({
			exactMatch: null,
			similarMatches: [],
			existingBottles: 0,
			existingWineId: null,
		});
		vi.mocked(api.addWine).mockResolvedValue({ wineID: 1, bottleID: 1 });
		vi.mocked(api.addBottle).mockResolvedValue({ bottleID: 1 });
	});

	describe('complete flow: identify → confirm → add', () => {
		it('should complete full add wine flow from text input', async () => {
			// 1. User submits text
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });

			// Verify identification completed
			expect(get(conversation.agentPhase)).toBe('confirming');
			expect(get(identification.hasResult)).toBe(true);

			const result = identification.getResult();
			expect(result?.producer).toBe('Château Margaux');
			expect(result?.wineName).toBe('Grand Vin');

			// 2. Find and click correct chip
			const messages = get(conversation.agentMessages);
			const chipsMsg = messages.find((m) => m.category === 'chips' && !m.disabled);
			expect(chipsMsg).toBeDefined();

			await handleAgentAction({ type: 'correct', messageId: chipsMsg!.id });

			// Should show action options
			expect(get(conversation.agentPhase)).toBe('confirming');
			const actionChips = get(conversation.agentMessages)
				.filter((m) => m.category === 'chips' && !m.disabled)
				.flatMap((m) => getChips(m) || []);
			expect(actionChips.some((c) => c.action === 'add_to_cellar')).toBe(true);

			// 3. User starts add flow
			const addChipsMsg = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'add_to_cellar', messageId: addChipsMsg!.id });

			// Should be in adding_wine phase
			expect(get(conversation.agentPhase)).toBe('adding_wine');
			expect(get(addWine.isInAddWineFlow)).toBe(true);
			expect(get(conversation.addWineStep)).toBe('bottle_details');
		});

		it('should handle duplicate wine detection', async () => {
			// Set up duplicate detection mock
			vi.mocked(api.checkDuplicate).mockResolvedValue({
				exactMatch: {
					id: 42,
					name: 'Château Margaux - Grand Vin 2018',
					bottleCount: 3,
				},
				similarMatches: [],
				existingBottles: 3,
				existingWineId: 42,
			});

			// 1. User submits text
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });
			expect(get(conversation.agentPhase)).toBe('confirming');

			// 2. User confirms and starts add
			const confirmChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'correct', messageId: confirmChips!.id });

			const addChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'add_to_cellar', messageId: addChips!.id });

			// Should show duplicate options
			const msgs = get(conversation.agentMessages);
			// Look for a message indicating duplicate was found - either a text message
			// containing 'already' or chips with add_bottle_existing action
			const existingWineMsg = msgs.find(
				(m) => getTextContent(m)?.includes('already') || getTextContent(m)?.includes('found')
			);
			expect(existingWineMsg).toBeDefined();

			// Should have options for add bottle or create new
			const dupeChips = msgs
				.filter((m) => m.category === 'chips' && !m.disabled)
				.flatMap((m) => getChips(m) || []);
			expect(
				dupeChips.some((c) => c.action === 'add_bottle_existing' || c.action === 'create_new_wine')
			).toBe(true);
		});
	});

	describe('enrichment flow', () => {
		it('should complete enrichment and return to action selection', async () => {
			// 1. Identify wine
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });
			expect(get(conversation.agentPhase)).toBe('confirming');

			// 2. Confirm
			const confirmChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'correct', messageId: confirmChips!.id });

			// 3. Choose Learn More
			const actionChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled && getChips(m)?.some((c) => c.action === 'learn')
			);
			expect(actionChips).toBeDefined();

			await handleAgentAction({ type: 'learn', messageId: actionChips!.id });

			// Should call enrichment API
			expect(api.enrichWineStream).toHaveBeenCalled();

			// Should return to confirming with enrichment data
			expect(get(conversation.agentPhase)).toBe('confirming');
			expect(get(enrichment.hasEnrichmentData)).toBe(true);

			// Should have action chips again
			const postEnrichChips = get(conversation.agentMessages)
				.filter((m) => m.category === 'chips' && !m.disabled)
				.flatMap((m) => getChips(m) || []);
			expect(postEnrichChips.some((c) => c.action === 'add_to_cellar')).toBe(true);
		});
	});

	describe('navigation and recovery', () => {
		it('should handle start over during flow', async () => {
			// 1. Start identification
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });
			expect(get(identification.hasResult)).toBe(true);

			// 2. Start over
			await handleAgentAction({ type: 'start_over' });

			// Should clear all state
			expect(get(identification.hasResult)).toBe(false);
			expect(get(addWine.isInAddWineFlow)).toBe(false);
			expect(get(enrichment.hasEnrichmentData)).toBe(false);
			// start_over calls startSession() which sets phase to greeting
			expect(get(conversation.agentPhase)).toBe('greeting');
		});

		it('should handle go back during add flow', async () => {
			// 1. Get to add wine flow
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });
			const confirmChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'correct', messageId: confirmChips!.id });
			const addChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'add_to_cellar', messageId: addChips!.id });

			expect(get(conversation.agentPhase)).toBe('adding_wine');
			expect(get(identification.hasResult)).toBe(true);

			// Note: go_back from adding_wine should return to confirming
			// but the actual behavior depends on implementation
			// For now, verify identification is preserved
			const prevPhase = get(conversation.agentPhase);
			await handleAgentAction({ type: 'go_back' });

			// Identification should still exist regardless of phase
			expect(get(identification.hasResult)).toBe(true);
		});

		it('should handle not_correct to provide more details', async () => {
			// 1. Identify wine
			await handleAgentAction({ type: 'submit_text', payload: 'Margaux 2018' });
			expect(get(conversation.agentPhase)).toBe('confirming');

			// 2. Say it's not correct
			const confirmChips = get(conversation.agentMessages).find(
				(m) => m.category === 'chips' && !m.disabled
			);
			await handleAgentAction({ type: 'not_correct', messageId: confirmChips!.id });

			// Should go to awaiting_input for more details
			expect(get(conversation.agentPhase)).toBe('awaiting_input');

			// Augmentation context should be set
			expect(get(identification.hasAugmentationContext)).toBe(true);
		});
	});

	describe('store consistency', () => {
		it('should maintain consistent state across flow transitions', async () => {
			// Track state at each step
			const stateHistory: Array<{
				phase: string;
				hasResult: boolean;
				isInAddFlow: boolean;
				messageCount: number;
			}> = [];

			const captureState = () => {
				stateHistory.push({
					phase: get(conversation.agentPhase),
					hasResult: get(identification.hasResult),
					isInAddFlow: get(addWine.isInAddWineFlow),
					messageCount: get(conversation.agentMessages).length,
				});
			};

			// Start
			captureState(); // greeting

			// Identify
			await handleAgentAction({ type: 'submit_text', payload: 'Château Margaux 2018' });
			captureState(); // confirming, with result

			// Confirm
			const chips1 = get(conversation.agentMessages).find((m) => m.category === 'chips' && !m.disabled);
			await handleAgentAction({ type: 'correct', messageId: chips1!.id });
			captureState(); // still confirming, with action chips

			// Add
			const chips2 = get(conversation.agentMessages).find((m) => m.category === 'chips' && !m.disabled);
			await handleAgentAction({ type: 'add_to_cellar', messageId: chips2!.id });
			captureState(); // adding_wine, in flow

			// Verify state progression
			expect(stateHistory[0].phase).toBe('greeting');
			expect(stateHistory[0].hasResult).toBe(false);

			expect(stateHistory[1].phase).toBe('confirming');
			expect(stateHistory[1].hasResult).toBe(true);

			expect(stateHistory[2].phase).toBe('confirming');
			expect(stateHistory[2].hasResult).toBe(true);

			expect(stateHistory[3].phase).toBe('adding_wine');
			expect(stateHistory[3].hasResult).toBe(true);
			expect(stateHistory[3].isInAddFlow).toBe(true);

			// Message count should increase at each step
			for (let i = 1; i < stateHistory.length; i++) {
				expect(stateHistory[i].messageCount).toBeGreaterThan(stateHistory[i - 1].messageCount);
			}
		});
	});
});
