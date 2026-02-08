import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	persistState,
	loadState,
	clearState,
	createEmptyState,
	loadPanelState,
	persistPanelState,
	type PersistedState,
} from '../agentPersistence';

describe('agentPersistence', () => {
	beforeEach(() => {
		clearState();
		sessionStorage.clear();
		localStorage.clear();
	});

	describe('persistState / loadState', () => {
		it('should persist and load state', async () => {
			const state: Partial<PersistedState> = {
				messages: [
					{
						id: '1',
						category: 'text',
						role: 'agent',
						timestamp: Date.now(),
						data: { category: 'text', content: 'Test' },
					},
				],
				phase: 'confirming',
			};

			persistState(state, true); // immediate persist

			const loaded = loadState();
			expect(loaded).not.toBeNull();
			expect(loaded?.messages).toHaveLength(1);
			expect(loaded?.phase).toBe('confirming');
		});

		it('should return null when no state exists', () => {
			expect(loadState()).toBeNull();
		});

		it('should merge with existing state', async () => {
			// First persist
			persistState(
				{
					messages: [
						{
							id: '1',
							category: 'text',
							role: 'agent',
							timestamp: Date.now(),
							data: { category: 'text', content: 'First' },
						},
					],
					phase: 'greeting',
				},
				true
			);

			// Second persist with different data
			persistState(
				{
					phase: 'confirming',
				},
				true
			);

			const loaded = loadState();
			expect(loaded?.messages).toHaveLength(1); // Preserved from first
			expect(loaded?.phase).toBe('confirming'); // Updated in second
		});

		it('should trim messages when exceeding MAX_MESSAGES', () => {
			const messages = Array.from({ length: 35 }, (_, i) => ({
				id: `msg-${i}`,
				category: 'text' as const,
				role: 'agent' as const,
				timestamp: Date.now(),
				data: { category: 'text' as const, content: `Message ${i}` },
			}));

			persistState({ messages }, true);

			const loaded = loadState();
			expect(loaded?.messages).toHaveLength(30);
			// First messages should be trimmed
			expect(loaded?.messages[0].id).toBe('msg-5');
		});
	});

	describe('createEmptyState', () => {
		it('should create state with correct defaults', () => {
			const state = createEmptyState();

			expect(state.messages).toEqual([]);
			expect(state.phase).toBe('greeting');
			expect(state.addWineStep).toBeNull();
			expect(state.identificationResult).toBeNull();
			expect(state.augmentationContext).toBeNull();
			expect(state.pendingNewSearch).toBeNull();
			expect(state.enrichmentData).toBeNull();
			expect(state.addWineState).toBeNull();
			expect(state.imageData).toBeNull();
			expect(state.version).toBe(2);
		});

		it('should have current timestamp', () => {
			const before = Date.now();
			const state = createEmptyState();
			const after = Date.now();

			expect(state.lastActivityAt).toBeGreaterThanOrEqual(before);
			expect(state.lastActivityAt).toBeLessThanOrEqual(after);
		});
	});

	describe('clearState', () => {
		it('should clear persisted state', () => {
			persistState({ phase: 'confirming' }, true);
			clearState();
			expect(loadState()).toBeNull();
		});
	});

	describe('loadState - session expiration', () => {
		it('should return null for expired sessions', () => {
			const oldTimestamp = Date.now() - 31 * 60 * 1000; // 31 minutes ago

			// Manually set storage with old timestamp
			const state = {
				version: 2,
				messages: [],
				phase: 'confirming',
				addWineStep: null,
				identificationResult: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				addWineState: null,
				imageData: null,
				lastActivityAt: oldTimestamp,
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded).toBeNull();
		});

		it('should load valid recent sessions', () => {
			const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago

			const state = {
				version: 2,
				messages: [],
				phase: 'confirming',
				addWineStep: null,
				identificationResult: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				addWineState: null,
				imageData: null,
				lastActivityAt: recentTimestamp,
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded).not.toBeNull();
			expect(loaded?.phase).toBe('confirming');
		});
	});

	describe('loadState - version mismatch', () => {
		it('should return null for wrong version', () => {
			const state = {
				version: 1, // Old version
				messages: [],
				phase: 'confirming',
				lastActivityAt: Date.now(),
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded).toBeNull();
		});
	});

	describe('loadState - loading phase reset', () => {
		it('should reset identifying phase to awaiting_input', () => {
			const state = {
				version: 2,
				messages: [],
				phase: 'identifying', // Loading phase
				addWineStep: null,
				identificationResult: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				addWineState: null,
				imageData: null,
				lastActivityAt: Date.now(),
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded?.phase).toBe('awaiting_input');
		});

		it('should reset enriching phase to awaiting_input', () => {
			const state = {
				version: 2,
				messages: [],
				phase: 'enriching', // Loading phase
				addWineStep: null,
				identificationResult: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				addWineState: null,
				imageData: null,
				lastActivityAt: Date.now(),
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded?.phase).toBe('awaiting_input');
		});

		it('should preserve non-loading phases', () => {
			const state = {
				version: 2,
				messages: [],
				phase: 'confirming',
				addWineStep: null,
				identificationResult: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				addWineState: null,
				imageData: null,
				lastActivityAt: Date.now(),
			};
			sessionStorage.setItem('agent_session_v2', JSON.stringify(state));

			const loaded = loadState();
			expect(loaded?.phase).toBe('confirming');
		});
	});

	describe('Panel state (localStorage)', () => {
		it('should persist and load panel state', () => {
			persistPanelState({ isOpen: true });

			const loaded = loadPanelState();
			expect(loaded.isOpen).toBe(true);
		});

		it('should default to closed when no state', () => {
			const loaded = loadPanelState();
			expect(loaded.isOpen).toBe(false);
		});
	});

	describe('persistState with identification data', () => {
		it('should persist identification result', () => {
			const result = {
				producer: 'Test Producer',
				wineName: 'Test Wine',
				vintage: 2020,
				confidence: 0.9,
			};

			persistState({ identificationResult: result }, true);

			const loaded = loadState();
			expect(loaded?.identificationResult).toEqual(result);
		});

		it('should persist augmentation context', () => {
			const context = {
				originalInput: 'Chateau Margaux',
				conversationHistory: ['First message', 'Second message'],
			};

			persistState({ augmentationContext: context }, true);

			const loaded = loadState();
			expect(loaded?.augmentationContext?.originalInput).toBe('Chateau Margaux');
		});

		it('should persist pendingNewSearch', () => {
			persistState({ pendingNewSearch: 'New search query' }, true);

			const loaded = loadState();
			expect(loaded?.pendingNewSearch).toBe('New search query');
		});
	});

	describe('persistState with enrichment data', () => {
		it('should persist enrichment data', () => {
			const enrichment = {
				overview: 'A fantastic wine',
				grapeComposition: [{ grape: 'Cabernet Sauvignon', percentage: '75%' }],
			};

			persistState({ enrichmentData: enrichment }, true);

			const loaded = loadState();
			expect(loaded?.enrichmentData?.overview).toBe('A fantastic wine');
		});
	});

	describe('persistState with addWine state', () => {
		it('should persist addWine state', () => {
			const addWineState = {
				existingWineId: 123,
				selectedRegionId: 45,
				entityMatchStep: 'producer' as const,
			};

			persistState({ addWineState }, true);

			const loaded = loadState();
			expect(loaded?.addWineState?.existingWineId).toBe(123);
			expect(loaded?.addWineState?.entityMatchStep).toBe('producer');
		});
	});

	describe('persistState with image data', () => {
		it('should persist image data', () => {
			const imageData = {
				data: 'base64-encoded-image-data',
				mimeType: 'image/jpeg',
			};

			persistState({ imageData }, true);

			const loaded = loadState();
			expect(loaded?.imageData?.data).toBe('base64-encoded-image-data');
			expect(loaded?.imageData?.mimeType).toBe('image/jpeg');
		});
	});

	describe('persistState - race condition (WIN-230)', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should accumulate state changes during debounce window', async () => {
			// Set up initial state
			persistState({ phase: 'greeting', messages: [] }, true);

			// Simulate two stores calling persistState in quick succession (debounced)
			// Store A updates phase (use 'confirming' - not a loading phase that gets reset)
			persistState({ phase: 'confirming' });
			// Store B updates messages before debounce fires
			persistState({
				messages: [
					{
						id: 'msg-1',
						category: 'text',
						role: 'agent',
						timestamp: Date.now(),
						data: { category: 'text', content: 'Test message' },
					},
				],
			});

			// Wait for debounce to complete
			vi.advanceTimersByTime(600);

			const loaded = loadState();
			// BOTH changes should be persisted
			expect(loaded?.phase).toBe('confirming'); // From Store A
			expect(loaded?.messages).toHaveLength(1); // From Store B
		});

		it('should not lose state from earlier calls when debounce timer is reset', async () => {
			// Initial state with some data
			persistState(
				{
					phase: 'greeting',
					identificationResult: {
						producer: 'Initial Producer',
						wineName: 'Initial Wine',
						vintage: 2020,
						confidence: 0.8,
					},
				},
				true
			);

			// Multiple rapid updates during debounce window
			// Use 'adding_wine' - a non-loading phase that won't be reset
			persistState({ phase: 'adding_wine' }); // Update 1
			persistState({ pendingNewSearch: 'new query' }); // Update 2 - resets timer
			persistState({
				enrichmentData: { overview: 'Great wine' },
			}); // Update 3 - resets timer again

			// Wait for debounce
			vi.advanceTimersByTime(600);

			const loaded = loadState();
			// All three updates should be present
			expect(loaded?.phase).toBe('adding_wine');
			expect(loaded?.pendingNewSearch).toBe('new query');
			expect(loaded?.enrichmentData?.overview).toBe('Great wine');
			// Original data should still be there
			expect(loaded?.identificationResult?.producer).toBe('Initial Producer');
		});
	});
});
