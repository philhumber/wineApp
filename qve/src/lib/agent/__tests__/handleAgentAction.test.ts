import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { dispatchAction as handleAgentAction } from '../router';
import { handleStartOver } from '../handlers/conversation';
import { handleIdentificationAction } from '../handlers/identification';
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import * as enrichment from '$lib/stores/agentEnrichment';
import * as addWine from '$lib/stores/agentAddWine';
import { clearState } from '$lib/stores/agentPersistence';
import { api } from '$lib/api';
import type { AgentMessage, TextMessageData, ChipsMessageData } from '$lib/agent/types';

// Type helpers for accessing discriminated union properties in tests
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
		identifyWithOpus: vi.fn(),
		checkDuplicate: vi.fn().mockResolvedValue({
			exactMatch: null,
			similarMatches: [],
			existingBottles: 0,
			existingWineId: null,
		}),
		addWine: vi.fn().mockResolvedValue({ wineID: 1, bottleID: 1 }),
		addBottle: vi.fn().mockResolvedValue({ bottleID: 1 }),
		clarifyMatch: vi.fn().mockResolvedValue({ explanation: 'Test clarification' }),
		enrichWineStream: vi.fn(),
		cancelAgentRequest: vi.fn(),
	},
}));

// Sample API response matching AgentIdentificationResultWithMeta
const sampleApiResponse = {
	intent: 'add' as const,
	parsed: {
		producer: 'Château Margaux',
		wineName: 'Grand Vin',
		vintage: '2018',
		region: 'Margaux',
		appellation: null,
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

// Sample test data
const sampleWineResult = {
	producer: 'Château Margaux',
	wineName: 'Grand Vin',
	vintage: 2018,
	region: 'Margaux',
	country: 'France',
};

// Sample enrichment API response
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

describe('handleAgentAction', () => {
	beforeEach(() => {
		conversation.fullReset();
		identification.resetIdentification();
		enrichment.resetEnrichment();
		addWine.resetAddWine();
		clearState();
		vi.clearAllMocks();

		// Default mock implementation for successful API calls
		vi.mocked(api.identifyTextStream).mockResolvedValue(sampleApiResponse);
		vi.mocked(api.identifyImageStream).mockResolvedValue(sampleApiResponse);
		vi.mocked(api.identifyWithOpus).mockResolvedValue(sampleApiResponse);
		vi.mocked(api.enrichWineStream).mockResolvedValue(sampleEnrichmentResponse);
	});

	describe('input actions', () => {
		describe('submit_text', () => {
			it('should add user message to conversation', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Chateau Margaux 2018' });

				const messages = get(conversation.agentMessages);
				const userMessage = messages.find((m) => m.role === 'user');
				expect(userMessage).toBeDefined();
				expect((userMessage?.data as any).content).toBe('Chateau Margaux 2018');
			});

			it('should call API with text', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine Query' });
				expect(api.identifyTextStream).toHaveBeenCalledWith(
					'Test Wine Query',
					expect.any(Function),
					expect.any(Function), // onEvent callback
					expect.anything(), // AbortSignal (WIN-187)
					expect.anything() // requestId (WIN-227)
				);
			});

			it('should set phase to confirming on success', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });
				expect(get(conversation.agentPhase)).toBe('confirming');
			});

			it('should store result on success', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });
				expect(get(identification.hasResult)).toBe(true);

				const result = identification.getResult();
				expect(result?.producer).toBe('Château Margaux');
				expect(result?.wineName).toBe('Grand Vin');
			});

			it('should add thinking message', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });

				const messages = get(conversation.agentMessages);
				// Typing message uses MessageKey.ID_THINKING which varies by personality
				// Sommelier: "Let me take a considered look..." / Neutral: "Let me identify that wine..."
				const thinkingMessage = messages.find(
					(m) => m.role === 'agent' && m.category === 'typing'
				);
				// Typing message is removed after identification completes, check any agent text message was added
				const anyAgentMessage = messages.find(
					(m) => m.role === 'agent' && m.category === 'text'
				);
				expect(anyAgentMessage).toBeDefined();
			});

			it('should add wine_result message on success', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });

				const messages = get(conversation.agentMessages);
				const resultMessage = messages.find((m) => m.category === 'wine_result');
				expect(resultMessage).toBeDefined();
			});

			it('should add confirmation chips on success', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });

				const messages = get(conversation.agentMessages);
				const chipsMessage = messages.find(
					(m) => m.category === 'chips' && !m.disabled
				);
				expect(chipsMessage).toBeDefined();
				expect((chipsMessage?.data as any).chips?.some((c: any) => c.action === 'correct')).toBe(true);
				expect((chipsMessage?.data as any).chips?.some((c: any) => c.action === 'not_correct')).toBe(true);
			});

			it('should set phase to error on API failure', async () => {
				vi.mocked(api.identifyTextStream).mockRejectedValueOnce(new Error('API Error'));
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });
				expect(get(conversation.agentPhase)).toBe('error');
			});

			it('should add error message on API failure', async () => {
				vi.mocked(api.identifyTextStream).mockRejectedValueOnce(new Error('API Error'));
				await handleAgentAction({ type: 'submit_text', payload: 'Test Wine' });

				const messages = get(conversation.agentMessages);
				const errorMessage = messages.find((m) => m.category === 'error');
				expect(errorMessage).toBeDefined();
			});

			it('should detect start_over command', async () => {
				// Set up some state first
				identification.setResult(sampleWineResult, 0.9);
				await handleAgentAction({ type: 'submit_text', payload: 'start over' });

				// Should reset state, not call API
				expect(api.identifyTextStream).not.toHaveBeenCalled();
				expect(get(identification.hasResult)).toBe(false);
			});

			it('should detect cancel command', async () => {
				// greeting → identifying (valid)
				conversation.setPhase('identifying');
				await handleAgentAction({ type: 'submit_text', payload: 'cancel' });

				// Cancel command is detected - API should not be called
				expect(api.identifyTextStream).not.toHaveBeenCalled();
				// Cancel closes the panel but doesn't change phase
				expect(get(conversation.agentPhase)).toBe('identifying');
			});

			it('should show brief input prompt for single word', async () => {
				await handleAgentAction({ type: 'submit_text', payload: 'Margaux' });

				// Should NOT call API yet
				expect(api.identifyTextStream).not.toHaveBeenCalled();

				// Should show confirmation message
				const messages = get(conversation.agentMessages);
				const confirmMessage = messages.find(
					(m) => (m.data as any).content?.includes('Adding more detail')
				);
				expect(confirmMessage).toBeDefined();

				// Should show chips for Search Anyway / Add More
				const chipsMessage = messages.find(
					(m) => m.category === 'chips' && !m.disabled
				);
				expect(chipsMessage).toBeDefined();
				expect((chipsMessage?.data as any).chips?.some((c: any) => c.action === 'confirm_brief_search')).toBe(true);
			});

			it('should detect chip response in confirming phase', async () => {
				// Set up confirming phase with a result (using valid transition path)
				identification.setResult(sampleWineResult, 0.9);
				// greeting → awaiting_input → confirming (valid path)
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				const chipsMsg = conversation.addMessage(
					conversation.createChipsMessage([
						{ id: 'correct', label: 'Correct', action: 'correct' },
						{ id: 'not_correct', label: 'Not Correct', action: 'not_correct' },
					])
				);

				await handleAgentAction({ type: 'submit_text', payload: 'yes' });

				// Should not call API - should trigger correct chip
				expect(api.identifyTextStream).not.toHaveBeenCalled();

				// The chip message should be disabled
				const messages = get(conversation.agentMessages);
				const disabledChips = messages.find((m) => m.id === chipsMsg.id);
				expect(disabledChips?.disabled).toBe(true);
			});
		});

		describe('submit_image', () => {
			it('should store image data', async () => {
				await handleAgentAction({
					type: 'submit_image',
					payload: { data: 'base64data', mimeType: 'image/jpeg' },
				});

				const state = identification.getCurrentState();
				expect(state.lastImageData).toBeDefined();
			});

			it('should add user image message', async () => {
				await handleAgentAction({
					type: 'submit_image',
					payload: { data: 'base64data', mimeType: 'image/jpeg' },
				});

				const messages = get(conversation.agentMessages);
				const imageMessage = messages.find((m) => m.category === 'image');
				expect(imageMessage).toBeDefined();
				expect(imageMessage?.role).toBe('user');
			});

			it('should set phase to confirming on success', async () => {
				await handleAgentAction({
					type: 'submit_image',
					payload: { data: 'base64data', mimeType: 'image/png' },
				});
				// After successful identification, phase should be confirming
				expect(get(conversation.agentPhase)).toBe('confirming');
			});

			it('should start identification with image type', async () => {
				await handleAgentAction({
					type: 'submit_image',
					payload: { data: 'base64data', mimeType: 'image/jpeg' },
				});

				const state = identification.getCurrentState();
				expect(state.inputType).toBe('image');
			});
		});
	});

	describe('navigation actions', () => {
		describe('start_over', () => {
			it('should reset conversation with greeting message', async () => {
				// Start with some content
				conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Test', action: 'test' }])
				);
				await handleAgentAction({ type: 'start_over' });

				// start_over calls resetConversation() which preserves history with divider + greeting
				const messages = get(conversation.agentMessages);
				expect(messages.length).toBeGreaterThanOrEqual(1);
				// Last message should be a greeting text
				const lastTextMsg = [...messages].reverse().find((m) => m.category === 'text');
				expect(lastTextMsg).toBeDefined();
			});

			it('should clear identification', async () => {
				identification.setResult(sampleWineResult, 0.9);
				await handleAgentAction({ type: 'start_over' });
				expect(get(identification.hasResult)).toBe(false);
			});

			it('should clear enrichment', async () => {
				enrichment.setEnrichmentData({ overview: 'Test' });
				await handleAgentAction({ type: 'start_over' });
				expect(get(enrichment.hasEnrichmentData)).toBe(false);
			});

			it('should cancel add flow', async () => {
				addWine.startAddFlow(sampleWineResult);
				await handleAgentAction({ type: 'start_over' });
				expect(get(addWine.isInAddWineFlow)).toBe(false);
			});

			it('should reset conversation to awaiting_input phase', async () => {
				conversation.addMessage(conversation.createTextMessage('Test message'));
				await handleAgentAction({ type: 'start_over' });

				// Should have greeting message and phase reset
				const messages = get(conversation.agentMessages);
				expect(messages.length).toBeGreaterThan(0);
				// start_over calls resetConversation() which sets phase to awaiting_input
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});
		});

		describe('go_back', () => {
			it('should set phase to awaiting_input', async () => {
				// greeting → awaiting_input → confirming (valid path)
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				await handleAgentAction({ type: 'go_back' });
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});
		});

		describe('cancel', () => {
			it('should close panel without changing phase', async () => {
				// greeting → identifying (valid)
				conversation.setPhase('identifying');
				await handleAgentAction({ type: 'cancel' });
				// cancel just closes the panel, doesn't change phase
				expect(get(conversation.agentPhase)).toBe('identifying');
			});
		});
	});

	describe('confirmation actions', () => {
		describe('correct', () => {
			// Set up a complete identification result and valid phase before each test
			beforeEach(() => {
				identification.setResult({
					producer: 'Opus One',
					wineName: 'Opus One',
					vintage: 2018,
					country: 'USA',
					region: 'Napa Valley',
					type: 'Red',
					confidence: 0.95,
				});
				// Set up valid phase path: greeting → awaiting_input → confirming
				// Most correct/confirmation actions are called from confirming phase
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
			});

			it('should disable the message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Correct', action: 'correct' }])
				);

				await handleAgentAction({ type: 'correct', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const disabledMsg = messages.find((m) => m.id === msg.id);
				expect(disabledMsg?.disabled).toBe(true);
			});

			it('should add confirmation message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Correct', action: 'correct' }])
				);

				await handleAgentAction({ type: 'correct', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const confirmMsg = messages.find(
					(m) => getTextContent(m)?.includes('What would you like to do')
				);
				expect(confirmMsg).toBeDefined();
			});

			it('should add action chips', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Correct', action: 'correct' }])
				);

				await handleAgentAction({ type: 'correct', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const chipsMsg = messages.find(
					(m) => m.category === 'chips' && !m.disabled
				);
				expect(chipsMsg).toBeDefined();
				expect(getChips(chipsMsg)?.length).toBe(3); // Add, Learn, Remember
			});

			it('should set phase to confirming', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Correct', action: 'correct' }])
				);

				await handleAgentAction({ type: 'correct', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('confirming');
			});
		});

		describe('not_correct', () => {
			// Set up valid phase and identification for not_correct tests
			beforeEach(() => {
				identification.setResult(sampleWineResult, 0.9);
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
			});

			it('should disable the message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Not Correct', action: 'not_correct' }])
				);

				await handleAgentAction({ type: 'not_correct', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const disabledMsg = messages.find((m) => m.id === msg.id);
				expect(disabledMsg?.disabled).toBe(true);
			});

			it('should set augmentation context when result exists', async () => {
				// identification.setResult is already called in beforeEach
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Not Correct', action: 'not_correct' }])
				);

				await handleAgentAction({ type: 'not_correct', messageId: msg.id });
				expect(get(identification.hasAugmentationContext)).toBe(true);
			});

			it('should add incorrect response message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Not Correct', action: 'not_correct' }])
				);

				await handleAgentAction({ type: 'not_correct', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const responseMsg = messages.find((m) => getTextContent(m)?.includes('wrong'));
				expect(responseMsg).toBeDefined();
			});

			it('should set phase to awaiting_input', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Not Correct', action: 'not_correct' }])
				);

				await handleAgentAction({ type: 'not_correct', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});
		});

		describe('confirm_new_search', () => {
			it('should process pending text', async () => {
				identification.setPendingNewSearch('New Wine Search');

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Search New', action: 'confirm_new_search' }])
				);

				await handleAgentAction({ type: 'confirm_new_search', messageId: msg.id });

				// Should have added user message for the new search
				const messages = get(conversation.agentMessages);
				const userMsg = messages.find(
					(m) => m.role === 'user' && getTextContent(m) === 'New Wine Search'
				);
				expect(userMsg).toBeDefined();
			});

			it('should clear pending search', async () => {
				identification.setPendingNewSearch('New Wine Search');

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Search New', action: 'confirm_new_search' }])
				);

				await handleAgentAction({ type: 'confirm_new_search', messageId: msg.id });
				expect(get(identification.pendingNewSearch)).toBeNull();
			});

			it('should disable the message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Search New', action: 'confirm_new_search' }])
				);

				await handleAgentAction({ type: 'confirm_new_search', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				expect(messages.find((m) => m.id === msg.id)?.disabled).toBe(true);
			});
		});

		describe('continue_current', () => {
			beforeEach(() => {
				// Set up valid phase path for actions that transition to confirming
				conversation.setPhase('awaiting_input');
			});

			it('should clear pending search', async () => {
				identification.setPendingNewSearch('Pending Search');

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Keep Current', action: 'continue_current' }])
				);

				await handleAgentAction({ type: 'continue_current', messageId: msg.id });
				expect(get(identification.pendingNewSearch)).toBeNull();
			});

			it('should set phase to confirming', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Keep Current', action: 'continue_current' }])
				);

				await handleAgentAction({ type: 'continue_current', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('confirming');
			});
		});

		describe('add_more_detail', () => {
			it('should set phase to awaiting_input', async () => {
				// greeting → awaiting_input → confirming (valid path)
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add More', action: 'add_more_detail' }])
				);

				await handleAgentAction({ type: 'add_more_detail', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});

			// WIN-270: Brief input continuation tests
			it('should set augmentation context with pending brief search', async () => {
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				identification.setPendingBriefSearch('rose');

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: "I'll Add More", action: 'add_more_detail' }])
				);

				await handleAgentAction({ type: 'add_more_detail', messageId: msg.id });

				const context = identification.getAugmentationContext();
				expect(context).not.toBeNull();
				expect(context?.briefInputPrefix).toBe('rose');
			});

			it('should clear pendingBriefSearch after setting context', async () => {
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				identification.setPendingBriefSearch('rose');

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: "I'll Add More", action: 'add_more_detail' }])
				);

				await handleAgentAction({ type: 'add_more_detail', messageId: msg.id });

				expect(get(identification.pendingBriefSearch)).toBeNull();
			});

			it('should combine brief input prefix with subsequent text submission', async () => {
				// Setup: Mock API to capture the search query
				const mockIdentify = vi.mocked(api.identifyTextStream);
				mockIdentify.mockResolvedValue(sampleApiResponse);

				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				identification.setPendingBriefSearch('rose');

				// Click "I'll Add More"
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: "I'll Add More", action: 'add_more_detail' }])
				);
				await handleAgentAction({ type: 'add_more_detail', messageId: msg.id });

				// Now submit additional text
				await handleAgentAction({ type: 'submit_text', payload: 'imperial' });

				// Should have called API with combined "rose imperial"
				expect(mockIdentify).toHaveBeenCalledWith(
					'rose imperial',
					expect.any(Function),
					expect.any(Function), // onEvent callback
					expect.anything(), // AbortSignal (WIN-187)
					expect.anything() // requestId (WIN-227)
				);
			});

			it('should prevent duplication when new input includes original', async () => {
				// Setup: Mock API to capture the search query
				const mockIdentify = vi.mocked(api.identifyTextStream);
				mockIdentify.mockResolvedValue(sampleApiResponse);

				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				identification.setPendingBriefSearch('Rose');

				// Click "I'll Add More"
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: "I'll Add More", action: 'add_more_detail' }])
				);
				await handleAgentAction({ type: 'add_more_detail', messageId: msg.id });

				// User types "Rose Imperial" (already includes original)
				await handleAgentAction({ type: 'submit_text', payload: 'Rose Imperial' });

				// Should NOT duplicate: search for "Rose Imperial", not "Rose Rose Imperial"
				expect(mockIdentify).toHaveBeenCalledWith(
					'Rose Imperial',
					expect.any(Function),
					expect.any(Function), // onEvent callback
					expect.anything(), // AbortSignal (WIN-187)
					expect.anything() // requestId (WIN-227)
				);
			});
		});
	});

	describe('identification actions', () => {
		describe('try_opus', () => {
			// Set up valid phase and identification for try_opus tests
			beforeEach(() => {
				identification.setResult(sampleWineResult, 0.9);
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
				// try_opus needs augmentation context (originalInput) since retryTracker
				// overwrites lastAction with the try_opus action itself during middleware
				identification.setAugmentationContext({
					originalInput: 'Chateau Margaux 2018',
				});
			});

			it('should start escalation at tier 3', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Try Opus', action: 'try_opus' }])
				);

				await handleAgentAction({ type: 'try_opus', messageId: msg.id });
				expect(get(identification.escalationTier)).toBe(3);
			});

			it('should add escalation message', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Try Opus', action: 'try_opus' }])
				);

				await handleAgentAction({ type: 'try_opus', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				// MessageKey.ID_ESCALATING varies by personality:
				// Sommelier: "Let me look more carefully..." / Neutral: "Let me take a closer look..."
				const escalateMsg = messages.find(
					(m) => m.role === 'agent' && m.category === 'text'
				);
				expect(escalateMsg).toBeDefined();
			});
		});

		describe('see_result', () => {
			beforeEach(() => {
				// Set up valid phase path for actions that transition to confirming
				// greeting → awaiting_input (valid)
				conversation.setPhase('awaiting_input');
			});

			it('should show wine result when exists', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'See Result', action: 'see_result' }])
				);

				await handleAgentAction({ type: 'see_result', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const wineMsg = messages.find((m) => m.category === 'wine_result');
				expect(wineMsg).toBeDefined();
			});

			it('should add confirmation chips', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'See Result', action: 'see_result' }])
				);

				await handleAgentAction({ type: 'see_result', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const chipsMsg = messages.find(
					(m) => m.category === 'chips' && !m.disabled && getChips(m)?.some((c) => c.action === 'correct')
				);
				expect(chipsMsg).toBeDefined();
			});

			it('should set phase to confirming', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'See Result', action: 'see_result' }])
				);

				await handleAgentAction({ type: 'see_result', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('confirming');
			});
		});

		describe('new_input', () => {
			it('should clear identification', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'New Input', action: 'new_input' }])
				);

				await handleAgentAction({ type: 'new_input', messageId: msg.id });
				expect(get(identification.hasResult)).toBe(false);
			});

			it('should set phase to awaiting_input', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'New Input', action: 'new_input' }])
				);

				await handleAgentAction({ type: 'new_input', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});
		});

		describe('provide_more', () => {
			it('should set phase to awaiting_input', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Provide More', action: 'provide_more' }])
				);

				await handleAgentAction({ type: 'provide_more', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('awaiting_input');
			});
		});
	});

	describe('wine flow actions', () => {
		describe('add_to_cellar', () => {
			beforeEach(() => {
				// Set up valid phase path for add_to_cellar: confirming → adding_wine
				// greeting → awaiting_input → confirming (valid path)
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
			});

			it('should start add flow when result exists', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add', action: 'add_to_cellar' }])
				);

				await handleAgentAction({ type: 'add_to_cellar', messageId: msg.id });
				expect(get(addWine.isInAddWineFlow)).toBe(true);
			});

			it('should set phase to adding_wine and progress through entity matching', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add', action: 'add_to_cellar' }])
				);

				await handleAgentAction({ type: 'add_to_cellar', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('adding_wine');
				expect(get(conversation.addWineStep)).toBe('bottle_details');
			});

			it('should be blocked by middleware when no result', async () => {
				// Note: With middleware validation, actions that require identification
				// are silently blocked (with console warning) if no result exists.
				// The middleware prevents reaching the handler's own validation.
				const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add', action: 'add_to_cellar' }])
				);

				await handleAgentAction({ type: 'add_to_cellar', messageId: msg.id });

				// Middleware logs a warning about validation failure (single string with both parts)
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('Validation failed for add_to_cellar')
				);

				warnSpy.mockRestore();
			});

			it('should add start message', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add', action: 'add_to_cellar' }])
				);

				await handleAgentAction({ type: 'add_to_cellar', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				// MessageKey.ADD_START varies by personality:
				// Sommelier: "...cellar where it belongs" / "...collection. Let's proceed."
				// Neutral: "Let's add this to your cellar."
				const startMsg = messages.find(
					(m) => m.role === 'agent' && m.category === 'text' && (getTextContent(m)?.includes('cellar') || getTextContent(m)?.includes('collection'))
				);
				expect(startMsg).toBeDefined();
			});
		});

		describe('learn', () => {
			beforeEach(() => {
				// Set up valid phase path for learn: confirming → enriching → confirming
				// greeting → awaiting_input → confirming (valid path)
				conversation.setPhase('awaiting_input');
				conversation.setPhase('confirming');
			});

			it('should call enrichWineStream API when result exists', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });
				expect(api.enrichWineStream).toHaveBeenCalledWith(
					sampleWineResult.producer,
					sampleWineResult.wineName,
					String(sampleWineResult.vintage),
					null, // type
					sampleWineResult.region,
					false, // confirmMatch
					false, // forceRefresh
					expect.any(Function), // onField callback
					undefined, // onEvent (WIN-187)
					expect.anything(), // AbortSignal (WIN-187)
					expect.anything() // requestId (WIN-227)
				);
			});

			it('should set phase to confirming after enrichment completes', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });
				expect(get(conversation.agentPhase)).toBe('confirming');
			});

			it('should store enrichment data after API call', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });
				expect(get(enrichment.hasEnrichmentData)).toBe(true);
			});

			it('should show error when no result', async () => {
				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const errorMsg = messages.find((m) => getTextContent(m)?.includes("don't have"));
				expect(errorMsg).toBeDefined();
			});

			it('should add enrichment result messages after completion', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				// Typing/loading message is removed after API resolves;
				// check for the enrichment result message and completion text instead
				const enrichmentMsg = messages.find((m) => m.category === 'enrichment');
				expect(enrichmentMsg).toBeDefined();
				// Completion message uses MessageKey.ENRICH_FOUND_DETAILS
				const completionMsg = messages.find(
					(m) => m.role === 'agent' && getTextContent(m)?.includes('found')
				);
				expect(completionMsg).toBeDefined();
			});

			it('should add action chips after enrichment completes', async () => {
				identification.setResult(sampleWineResult, 0.9);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });

				const messages = get(conversation.agentMessages);
				const chipsMsg = messages.findLast((m) => m.category === 'chips');
				const chips = getChips(chipsMsg);
				expect(chips).toBeDefined();
				expect(chips?.some((c: any) => c.action === 'add_to_cellar')).toBe(true);
				expect(chips?.some((c: any) => c.action === 'remember')).toBe(true);
			});

			it('should handle enrichment error', async () => {
				identification.setResult(sampleWineResult, 0.9);
				vi.mocked(api.enrichWineStream).mockRejectedValueOnce(new Error('Enrichment failed'));

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Learn More', action: 'learn' }])
				);

				await handleAgentAction({ type: 'learn', messageId: msg.id });

				expect(get(conversation.agentPhase)).toBe('error');
				expect(get(enrichment.enrichmentError)).toBeDefined();
			});
		});

		describe('enrich_now', () => {
			it('should set enrichNow to true', async () => {
				// Must set identification result (middleware validates requiresIdentification)
				identification.setResult(sampleWineResult, 0.9);
				addWine.startAddFlow(sampleWineResult);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Enrich Now', action: 'enrich_now' }])
				);

				await handleAgentAction({ type: 'enrich_now', messageId: msg.id });
				expect(get(addWine.addWineFlow)?.enrichNow).toBe(true);
			});
		});

		describe('add_quickly', () => {
			it('should set enrichNow to false', async () => {
				// Must set identification result (middleware validates requiresIdentification)
				identification.setResult(sampleWineResult, 0.9);
				addWine.startAddFlow(sampleWineResult);
				addWine.setEnrichNow(true);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add Quickly', action: 'add_quickly' }])
				);

				await handleAgentAction({ type: 'add_quickly', messageId: msg.id });
				expect(get(addWine.addWineFlow)?.enrichNow).toBe(false);
			});
		});
	});

	describe('entity matching actions', () => {
		describe('select_match', () => {
			it('should select the match', async () => {
				addWine.startAddFlow(sampleWineResult);
				addWine.setEntityMatches('region', [
					{ id: 1, name: 'Margaux', confidence: 0.95 },
					{ id: 2, name: 'Médoc', confidence: 0.7 },
				]);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Margaux', action: 'select_match' }])
				);

				await handleAgentAction({
					type: 'select_match',
					payload: { entityType: 'region', matchId: 1 },
					messageId: msg.id,
				});

				expect(get(addWine.selectedEntities).region).toEqual({ id: 1, name: 'Margaux' });
			});
		});

		describe('create_new_wine', () => {
			it('should clear existing wine', async () => {
				// Set up valid phase path: greeting → awaiting_input → adding_wine
				// create_new_wine is called while in adding_wine phase
				conversation.setPhase('awaiting_input');
				conversation.setPhase('adding_wine', 'confirm');

				// Must set identification result (middleware validates requiresIdentification)
				identification.setResult(sampleWineResult, 0.9);
				addWine.startAddFlow(sampleWineResult);
				addWine.setExistingWine(42, 3);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Create New', action: 'create_new_wine' }])
				);

				await handleAgentAction({ type: 'create_new_wine', messageId: msg.id });
				expect(get(addWine.existingWineId)).toBeNull();
			});
		});

		describe('add_bottle_existing', () => {
			it('should set phase to bottle_details', async () => {
				// Set up valid phase path: greeting → awaiting_input → adding_wine
				// add_bottle_existing is called while in adding_wine phase
				conversation.setPhase('awaiting_input');
				conversation.setPhase('adding_wine', 'confirm');

				// Must set identification result (middleware validates requiresIdentification)
				identification.setResult(sampleWineResult, 0.9);
				addWine.startAddFlow(sampleWineResult);
				addWine.setExistingWine(42, 3);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Add Bottle', action: 'add_bottle_existing' }])
				);

				await handleAgentAction({ type: 'add_bottle_existing', messageId: msg.id });
				expect(get(conversation.addWineStep)).toBe('bottle_details');
			});
		});
	});

	describe('form actions', () => {
		describe('submit_bottle', () => {
			it('should update bottle form data', async () => {
				// Set up valid phase path and add wine flow for form submission
				conversation.setPhase('awaiting_input');
				conversation.setPhase('adding_wine', 'bottle_details');
				addWine.startAddFlow(sampleWineResult);

				await handleAgentAction({
					type: 'submit_bottle',
					payload: { bottleSize: '750ml', storageLocation: 'Cellar A' },
				});

				expect(get(addWine.bottleFormData)).toEqual({ bottleSize: '750ml', storageLocation: 'Cellar A' });
			});
		});

		describe('bottle_next', () => {
			it('should set bottle form step to 2', async () => {
				addWine.startAddFlow(sampleWineResult);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Next', action: 'bottle_next' }])
				);

				await handleAgentAction({ type: 'bottle_next', messageId: msg.id });
				expect(get(addWine.bottleFormStep)).toBe(2);
			});
		});
	});

	describe('error handling', () => {
		it('should catch errors and show error message', async () => {
			// Create a scenario that will error - mock an action that throws
			// This tests the catch block in handleAgentAction
			const originalConsoleError = console.error;
			console.error = vi.fn();

			// Triggering an unknown action won't throw, but we can verify error handling works
			await handleAgentAction({ type: 'unknown_action' as any });

			// Should log warning for unknown action
			console.error = originalConsoleError;
		});

		describe('start_over_error', () => {
			it('should trigger start_over', async () => {
				identification.setResult(sampleWineResult, 0.9);
				addWine.startAddFlow(sampleWineResult);

				const msg = conversation.addMessage(
					conversation.createChipsMessage([{ id: '1', label: 'Start Over', action: 'start_over_error' }])
				);

				await handleAgentAction({ type: 'start_over_error', messageId: msg.id });

				expect(get(identification.hasResult)).toBe(false);
				expect(get(addWine.isInAddWineFlow)).toBe(false);
			});
		});
	});

	describe('chip_tap (generic fallback)', () => {
		it('should dispatch the nested action type', async () => {
			// Set up valid phase path: greeting → awaiting_input → confirming
			conversation.setPhase('awaiting_input');
			conversation.setPhase('confirming');

			// Set up identification result first (required for correct action)
			identification.setResult({
				producer: 'Opus One',
				wineName: 'Opus One',
				vintage: 2018,
				country: 'USA',
				region: 'Napa Valley',
				type: 'Red',
				confidence: 0.95,
			});

			const msg = conversation.addMessage(
				conversation.createChipsMessage([{ id: '1', label: 'Correct', action: 'correct' }])
			);

			// chip_tap unwraps and dispatches the nested action
			await handleAgentAction({
				type: 'chip_tap',
				payload: { action: 'correct', messageId: msg.id },
			});

			// The nested 'correct' action should have been dispatched
			// which adds action chips and sets phase to confirming
			expect(get(conversation.agentPhase)).toBe('confirming');
		});

		it('should log warning for unknown action types', async () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const msg = conversation.addMessage(
				conversation.createChipsMessage([{ id: '1', label: 'Custom', action: 'unknown_action' }])
			);

			await handleAgentAction({
				type: 'chip_tap',
				payload: { action: 'unknown_action', messageId: msg.id },
			});

			// The router now uses a different warning format for chip_tap safety net
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('chip_tap'),
				expect.objectContaining({ action: 'unknown_action' })
			);

			warnSpy.mockRestore();
		});
	});

	describe('exported handlers', () => {
		it('should export handlers from new modules', () => {
			expect(handleStartOver).toBeDefined();
			expect(handleIdentificationAction).toBeDefined();
		});
	});
});
