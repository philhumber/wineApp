/**
 * Agent Store
 * Manages AI Agent state for wine identification
 *
 * Phase 1: Text-based identification with confidence scoring
 * Phase 2: Image identification, panel state, enrichment
 * Phase 3: Conversational flow with sommelier-style messaging
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api';
import type {
	AgentIdentificationResult,
	AgentIdentificationResultWithMeta,
	AgentParsedWine,
	AgentAction,
	AgentCandidate,
	AgentInputType,
	AgentImageQuality,
	AgentEnrichmentData,
	AgentErrorInfo,
	AgentErrorType,
	DuplicateMatch,
	Region,
	Producer,
	Wine,
	StreamEvent
} from '$lib/api/types';
import { AgentError } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// STREAMING TYPES (WIN-181)
// ─────────────────────────────────────────────────────────

/** State for a single field being streamed */
export interface StreamingFieldState {
	value: unknown;
	isTyping: boolean;
	arrivedAt: number;
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const PANEL_STORAGE_KEY = 'agentPanelOpen';
const MAX_RETRIES = 2;
const MAX_MESSAGES = 30;

// ─────────────────────────────────────────────────────────
// SESSION PERSISTENCE
// ─────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'agentSessionState';
const SESSION_VERSION = 2;

interface AgentSessionState {
	version: number;
	messages: AgentMessage[];
	lastResult: AgentIdentificationResult | null;
	augmentationContext: AgentAugmentationContext | null;
	enrichmentData: AgentEnrichmentData | null;
	enrichmentForWine: { producer: string; wineName: string } | null;
	phase: AgentPhase;
	lastImageData: string | null;
	lastImageMimeType: string | null;
	lastInputType: AgentInputType | null;
	pendingNewSearch: PendingNewSearch | null;
	addState: AgentAddState | null;
}

function getStoredSessionState(): AgentSessionState | null {
	if (typeof window === 'undefined') return null;
	try {
		const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored);

		// Version check
		if (parsed.version !== SESSION_VERSION) {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
			return null;
		}

		// Basic validation
		if (!parsed.messages || !Array.isArray(parsed.messages)) return null;
		if (!parsed.phase || typeof parsed.phase !== 'string') return null;

		return parsed as AgentSessionState;
	} catch {
		sessionStorage.removeItem(SESSION_STORAGE_KEY);
		return null;
	}
}

function clearSessionState(): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(SESSION_STORAGE_KEY);
	} catch {
		// Ignore errors
	}
}

let persistenceTimeout: ReturnType<typeof setTimeout> | null = null;

function storeSessionState(state: AgentSessionState, immediate = false): void {
	if (typeof window === 'undefined') return;

	const doPersist = () => {
		try {
			// Strip transient UI state before persisting
			const cleanState: AgentSessionState = {
				...state,
				// Strip ObjectURLs and isNew flag from messages (WIN-168: prevent re-animation on reload)
				messages: state.messages.map((msg) => ({
					...msg,
					imageUrl: msg.imageUrl?.startsWith('data:') ? msg.imageUrl : undefined,
					isNew: false
				}))
			};

			const serialized = JSON.stringify(cleanState);

			// Check size (~5MB limit, leave 1MB buffer)
			if (serialized.length > 4 * 1024 * 1024) {
				// Try without image data
				const stateWithoutImage = { ...cleanState, lastImageData: null };
				sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateWithoutImage));
				console.warn('Agent session: Image data dropped due to size');
			} else {
				sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
			}
		} catch {
			// Quota exceeded - try minimal state
			try {
				const minimalState: AgentSessionState = {
					version: SESSION_VERSION,
					// Strip isNew to prevent re-animation on reload (WIN-168)
					messages: state.messages.slice(-10).map(m => ({ ...m, isNew: false })),
					phase: state.phase,
					lastResult: state.lastResult,
					lastImageData: null,
					lastImageMimeType: null,
					lastInputType: state.lastInputType,
					augmentationContext: state.augmentationContext, // Preserve context for retry
					enrichmentData: null,
					enrichmentForWine: null,
					pendingNewSearch: state.pendingNewSearch, // Preserve for mobile tab switches
					addState: null
				};
				sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(minimalState));
				console.warn('Agent session: Reduced to minimal state due to quota');
			} catch {
				console.warn('Agent session: Unable to persist state');
			}
		}
	};

	if (immediate) {
		if (persistenceTimeout) clearTimeout(persistenceTimeout);
		persistenceTimeout = null;
		doPersist();
	} else {
		// Debounce non-critical updates
		if (persistenceTimeout) clearTimeout(persistenceTimeout);
		persistenceTimeout = setTimeout(doPersist, 500);
	}
}

// ─────────────────────────────────────────────────────────
// CONVERSATION TYPES
// ─────────────────────────────────────────────────────────

// ============================================
// ADD WINE FLOW TYPES
// ============================================

export type AgentAddSelectionMode = 'search' | 'create';

export interface AgentAddRegionData {
	regionName: string;
	country: string; // Country NAME (not code), normalized via InferenceEngine
}

export interface AgentAddProducerData {
	producerName: string;
	regionName?: string; // For context when no regionID yet
}

export interface AgentAddWineData {
	wineName: string;
	wineYear: string;
	isNonVintage?: boolean;  // WIN-176: True for NV wines
	wineType: string; // Must match DB winetype table
	producerName?: string; // For context when no producerID yet
}

export interface AgentAddBottleData {
	// Part 1 (required)
	bottleSize: string; // Maps to bottleType in payload
	storageLocation: string;
	source: string; // Maps to bottleSource in payload
	// Part 2 (optional)
	price?: string;
	currency?: string;
	purchaseDate?: string;
}

export interface AgentAddState {
	// Original identification
	identified: AgentParsedWine;

	// Selection mode per step
	mode: {
		region: AgentAddSelectionMode;
		producer: AgentAddSelectionMode;
		wine: AgentAddSelectionMode;
	};

	// Form data for new entities (names only, no enrichment data)
	regionData: AgentAddRegionData;
	producerData: AgentAddProducerData;
	wineData: AgentAddWineData;
	bottleData: AgentAddBottleData;

	// Selected existing entities (null when mode = 'create')
	selected: {
		region: Region | null;
		producer: Producer | null;
		wine: Wine | null;
	};

	// Fuzzy matches found at each step
	matches: {
		region: DuplicateMatch[];
		producer: DuplicateMatch[];
		wine: DuplicateMatch[];
	};

	// Bottle form phase (1 or 2)
	bottleFormPart: 1 | 2;

	// For adding bottle to existing wine (WIN-145)
	existingWineId?: number;
}

/** Conversation phases for state machine */
export type AgentPhase =
	| 'greeting'
	| 'path_selection'
	| 'coming_soon'
	| 'await_input'
	| 'identifying'
	| 'result_confirm'
	| 'action_select'
	| 'handle_incorrect'
	| 'augment_input'
	| 'escalation_choice' // User decides: try harder (Opus) or conversational
	| 'confirm_new_search' // User typed during active identification, confirming intent
	| 'confirm_cache_match' // WIN-162: User confirms non-exact cache match
	| 'complete'
	// Add wine flow phases
	| 'add_confirm' // "Add to cellar?"
	| 'add_region' // Region matching
	| 'add_producer' // Producer matching
	| 'add_wine' // Wine matching
	| 'add_bottle_part1' // Bottle details part 1
	| 'add_bottle_part2' // Bottle details part 2
	| 'add_enrichment' // Enrichment choice
	| 'add_complete' // Success
	| 'add_manual_entry'; // Fill missing required fields

/** Message content types */
export type AgentMessageType =
	| 'greeting'
	| 'text'
	| 'divider' // Conversation separator (WIN-174)
	| 'chips'
	| 'image_preview'
	| 'wine_result'
	| 'wine_enrichment'
	| 'cache_match_confirm' // WIN-162: Confirm non-exact cache match
	| 'low_confidence'
	| 'partial_match'
	| 'disambiguation'
	| 'coming_soon'
	| 'error'
	// Add wine flow message types
	| 'add_confirm' // "Add to cellar?"
	| 'match_selection' // Show fuzzy matches
	| 'match_confirmed' // User confirmed selection
	| 'existing_wine_choice' // Wine exists - add bottle or create new? (WIN-145)
	| 'manual_entry' // Fill missing required fields
	| 'bottle_form' // Bottle details form (both parts)
	| 'enrichment_choice' // "Enrich now?" / "Add quickly"
	| 'add_complete'; // Success

/** Action chip definition */
export interface AgentChip {
	id: string;
	label: string;
	icon?: string;
	action: string;
	disabled?: boolean;
	selected?: boolean;
}

/** Single message in conversation */
export interface AgentMessage {
	id: string;
	role: 'agent' | 'user';
	type: AgentMessageType;
	content: string;
	timestamp: number;
	chips?: AgentChip[];
	imageUrl?: string;
	wineResult?: AgentParsedWine;
	confidence?: number;
	candidates?: AgentCandidate[];
	enrichmentData?: AgentEnrichmentData;
	enrichmentSource?: 'cache' | 'web_search' | 'inference';
	// Add-flow specific fields
	matches?: DuplicateMatch[];
	matchType?: 'region' | 'producer' | 'wine';
	bottleFormPart?: 1 | 2;
	addedWine?: Wine;
	// Existing wine choice fields (WIN-145)
	existingWineId?: number;
	existingBottles?: number;
	// WIN-162: Cache match confirmation fields
	cacheMatchType?: 'abbreviation' | 'alias' | 'fuzzy';
	searchedFor?: { producer: string | null; wineName: string | null; vintage: string | null };
	matchedTo?: { producer: string | null; wineName: string | null; vintage: string | null };
	cacheConfidence?: number;
	// WIN-168: Typewriter animation flag
	isNew?: boolean;
}

/** Context for augmentation (Not Correct flow) */
export interface AgentAugmentationContext {
	originalInput: string;
	originalInputType: AgentInputType;
	originalResult: AgentIdentificationResult | null; // WIN-181: Can be null for handle_incorrect phase (wrong result discarded)
	userFeedback?: string;
	isCorrection?: boolean; // User said "Not Correct" - give their clarifying info higher weight
}

/** Pending new search confirmation state */
export interface PendingNewSearch {
	text: string;
	previousPhase: AgentPhase;
}

// ─────────────────────────────────────────────────────────
// GREETING MESSAGES (Sommelier tone)
// ─────────────────────────────────────────────────────────

const GREETINGS = {
	morning: [
		'Good morning. What shall we uncork today?',
		'A fresh day for discoveries. What are you considering?',
		'Morning light reveals the finest vintages. What catches your eye?'
	],
	afternoon: [
		'Good afternoon. Shall we explore your cellar?',
		'The light is perfect. What vintage intrigues you?',
		'A fine hour for contemplation. What wine has your attention?'
	],
	evening: [
		'Good evening. The cellar awaits your curiosity.',
		'A fine hour for wine. What catches your eye?',
		'Evening sips begin with discovery. What shall we find?'
	]
};

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
	const hour = new Date().getHours();
	if (hour < 12) return 'morning';
	if (hour < 17) return 'afternoon';
	return 'evening';
}

function getRandomGreeting(): string {
	const timeOfDay = getTimeOfDay();
	const greetings = GREETINGS[timeOfDay];
	return greetings[Math.floor(Math.random() * greetings.length)];
}

function generateMessageId(): string {
	return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract structured error info from caught error
 */
function extractErrorInfo(error: unknown, fallbackMessage: string): AgentErrorInfo {
	if (AgentError.isAgentError(error)) {
		return {
			type: error.type,
			userMessage: error.userMessage,
			retryable: error.retryable,
			supportRef: error.supportRef
		};
	}
	return {
		type: 'unknown',
		userMessage: error instanceof Error ? error.message : fallbackMessage,
		retryable: true,
		supportRef: null
	};
}

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

/** WIN-162: Pending cache match confirmation context */
export interface PendingCacheMatch {
	parsed: AgentParsedWine;
	matchType: 'abbreviation' | 'alias' | 'fuzzy';
	searchedFor: { producer: string | null; wineName: string | null; vintage: string | null };
	matchedTo: { producer: string | null; wineName: string | null; vintage: string | null };
	confidence: number;
}

export interface AgentState {
	// Core state
	isLoading: boolean;
	lastResult: AgentIdentificationResult | null;
	error: AgentErrorInfo | null;

	// Phase 2: Panel state
	isPanelOpen: boolean;
	currentInputType: AgentInputType | null;

	// Phase 2: Enrichment state
	isEnriching: boolean;
	enrichmentError: AgentErrorInfo | null;
	enrichmentData: AgentEnrichmentData | null;

	// Image quality (for image inputs)
	imageQuality: AgentImageQuality | null;

	// Phase 3: Conversation state
	phase: AgentPhase;
	messages: AgentMessage[];
	augmentationContext: AgentAugmentationContext | null;
	isTyping: boolean;
	pendingNewSearch: PendingNewSearch | null;

	// WIN-162: Pending cache match confirmation
	pendingCacheMatch: PendingCacheMatch | null;

	// Session persistence fields
	lastImageData: string | null;
	lastImageMimeType: string | null;
	enrichmentForWine: { producer: string; wineName: string } | null;

	// Add wine flow state
	addState: AgentAddState | null;

	// Streaming state (WIN-181) - transient, not persisted
	isStreaming: boolean;
	streamingFields: Map<string, StreamingFieldState>;
	streamingChips: { content: string; chips: AgentChip[] } | null;
	// Enrichment streaming chips (separate from identification to avoid confusion)
	enrichmentStreamingChips: { content: string; chips: AgentChip[] } | null;
	// Store enrichment result for use when user acts on chips
	pendingEnrichmentResult: AgentEnrichmentData | null;
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Get initial panel state from localStorage
 */
function getStoredPanelState(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem(PANEL_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

/**
 * Persist panel state to localStorage
 */
function storePanelState(isOpen: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(PANEL_STORAGE_KEY, String(isOpen));
	} catch {
		// Ignore localStorage errors
	}
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number = MAX_RETRIES
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s...
				await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
			}
		}
	}

	throw lastError;
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

const initialState: AgentState = {
	isLoading: false,
	lastResult: null,
	error: null,
	isPanelOpen: false, // Will be hydrated from localStorage
	currentInputType: null,
	isEnriching: false,
	enrichmentError: null,
	enrichmentData: null,
	imageQuality: null,
	// Conversation state
	phase: 'greeting',
	messages: [],
	augmentationContext: null,
	isTyping: false,
	pendingNewSearch: null,
	// WIN-162: Pending cache match confirmation
	pendingCacheMatch: null,
	// Session persistence
	lastImageData: null,
	lastImageMimeType: null,
	enrichmentForWine: null,
	// Add wine flow
	addState: null,
	// Streaming (WIN-181)
	isStreaming: false,
	streamingFields: new Map(),
	streamingChips: null as { content: string; chips: AgentChip[] } | null,
	enrichmentStreamingChips: null as { content: string; chips: AgentChip[] } | null,
	pendingEnrichmentResult: null
};

function createAgentStore() {
	const { subscribe, set, update } = writable<AgentState>(initialState);

	// Hydrate from sessionStorage on client
	if (typeof window !== 'undefined') {
		const storedSession = getStoredSessionState();
		const panelOpen = getStoredPanelState();

		if (storedSession && panelOpen) {
			// Restore session - but fix orphaned loading states
			update((state) => ({
				...state,
				// Strip isNew flag to prevent re-animation on reload (WIN-168)
				messages: storedSession.messages.map(m => ({ ...m, isNew: false })),
				lastResult: storedSession.lastResult,
				augmentationContext: storedSession.augmentationContext,
				enrichmentData: storedSession.enrichmentData,
				enrichmentForWine: storedSession.enrichmentForWine,
				phase: storedSession.phase,
				lastImageData: storedSession.lastImageData,
				lastImageMimeType: storedSession.lastImageMimeType,
				currentInputType: storedSession.lastInputType,
				pendingNewSearch: storedSession.pendingNewSearch ?? null,
				addState: storedSession.addState ?? null,
				isPanelOpen: true,
				// Reset orphaned loading states
				isLoading: false,
				isEnriching: false,
				isTyping: false,
				error: null,
				enrichmentError: null
			}));
		} else {
			// No session to restore, just set panel state
			update((state) => ({ ...state, isPanelOpen: panelOpen }));
		}
	}

	// Persistence helper - builds session state and stores it
	function persistCurrentState(state: AgentState, immediate = false): void {
		storeSessionState(
			{
				version: SESSION_VERSION,
				messages: state.messages,
				lastResult: state.lastResult,
				augmentationContext: state.augmentationContext,
				enrichmentData: state.enrichmentData,
				enrichmentForWine: state.enrichmentForWine,
				phase: state.phase,
				lastImageData: state.lastImageData,
				lastImageMimeType: state.lastImageMimeType,
				lastInputType: state.currentInputType,
				pendingNewSearch: state.pendingNewSearch,
				addState: state.addState
			},
			immediate
		);
	}

	return {
		subscribe,

		// ─────────────────────────────────────────────────────
		// IDENTIFICATION
		// ─────────────────────────────────────────────────────

		/**
		 * Identify wine from text input
		 */
		identify: async (text: string): Promise<AgentIdentificationResult | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				error: null,
				currentInputType: 'text',
				imageQuality: null
			}));

			try {
				const result = await api.identifyText(text);

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						lastResult: result,
						error: null
					};
					persistCurrentState(newState, true);
					return newState;
				});
				return result;
			} catch (error) {
				const errorInfo = extractErrorInfo(error, 'Identification failed');
				update((state) => ({
					...state,
					isLoading: false,
					error: errorInfo
				}));
				return null;
			}
		},

		/**
		 * Identify wine from text with streaming response (WIN-181)
		 * Fields are emitted progressively as they arrive from the LLM.
		 * Falls back to non-streaming on error.
		 */
		identifyWithStreaming: async (text: string): Promise<AgentIdentificationResult | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				isStreaming: true,
				streamingFields: new Map(),
				error: null,
				currentInputType: 'text',
				imageQuality: null
			}));

			try {
				const result = await api.identifyTextStream(
					text,
					// onField callback - update streaming fields as they arrive
					(field, value) => {
						update((state) => {
							const fields = new Map(state.streamingFields);
							fields.set(field, {
								value,
								isTyping: true,
								arrivedAt: Date.now()
							});
							return { ...state, streamingFields: fields };
						});
					}
				);

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						isStreaming: false,
						// WIN-181: Keep streamingFields populated so streaming card stays visible
						// Fields will be cleared when user takes action (correct/not correct)
						lastResult: result,
						error: null
					};
					persistCurrentState(newState, true);
					return newState;
				});

				return result;
			} catch (error) {
				// Fallback to non-streaming on error
				console.warn('Streaming failed, falling back to non-streaming:', error);
				update((state) => ({
					...state,
					isStreaming: false,
					streamingFields: new Map()
				}));
				// Use the regular identify method as fallback
				return agent.identify(text);
			}
		},

		/**
		 * Identify wine from image with streaming response (WIN-181)
		 */
		identifyImageWithStreaming: async (file: File): Promise<AgentIdentificationResultWithMeta | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				isStreaming: true,
				streamingFields: new Map(),
				error: null,
				currentInputType: 'image',
				imageQuality: null
			}));

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);

				const result = await api.identifyImageStream(
					imageData,
					mimeType,
					undefined, // supplementaryText
					// onField callback
					(field, value) => {
						update((state) => {
							const fields = new Map(state.streamingFields);
							fields.set(field, {
								value,
								isTyping: true,
								arrivedAt: Date.now()
							});
							return { ...state, streamingFields: fields };
						});
					}
				);

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						isStreaming: false,
						// WIN-181: Keep streamingFields populated so streaming card stays visible
						// Fields will be cleared when user takes action (correct/not correct)
						lastResult: result,
						error: null,
						imageQuality: result.quality ?? null,
						lastImageData: imageData,
						lastImageMimeType: mimeType
					};
					persistCurrentState(newState, true);
					return newState;
				});

				return result;
			} catch (error) {
				// Fallback to non-streaming on error
				console.warn('Streaming failed, falling back to non-streaming:', error);
				update((state) => ({
					...state,
					isStreaming: false,
					streamingFields: new Map() // Clear on error - fallback will show regular result
				}));
				// Use the regular identifyImage method as fallback
				return agent.identifyImage(file);
			}
		},

		/**
		 * Mark a streaming field as done typing (WIN-181)
		 * Called by UI after typewriter animation completes
		 */
		markFieldTypingComplete: (field: string) => {
			update((state) => {
				const fields = new Map(state.streamingFields);
				const fieldState = fields.get(field);
				if (fieldState) {
					fields.set(field, { ...fieldState, isTyping: false });
				}
				return { ...state, streamingFields: fields };
			});
		},

		/**
		 * Clear streaming result (WIN-181)
		 * Called when user takes action on the streaming card (correct/not correct)
		 */
		clearStreamingResult: () => {
			update((state) => ({
				...state,
				streamingFields: new Map(),
				streamingChips: null
			}));
		},

		/**
		 * Set chips to display below streaming card (WIN-181)
		 */
		setStreamingChips: (content: string, chips: AgentChip[]) => {
			update((state) => ({
				...state,
				streamingChips: { content, chips }
			}));
		},

		/**
		 * Set chips to display below enrichment streaming card (WIN-181)
		 */
		setEnrichmentStreamingChips: (content: string, chips: AgentChip[]) => {
			update((state) => ({
				...state,
				enrichmentStreamingChips: { content, chips }
			}));
		},

		/**
		 * Clear enrichment streaming result (WIN-181)
		 * Called when user takes action on the enrichment streaming card
		 */
		clearEnrichmentStreamingResult: () => {
			update((state) => ({
				...state,
				streamingFields: new Map(),
				enrichmentStreamingChips: null,
				pendingEnrichmentResult: null
			}));
		},

		/**
		 * Identify wine from image file (Phase 2)
		 * Compresses image and sends to backend with retry logic
		 */
		identifyImage: async (file: File): Promise<AgentIdentificationResultWithMeta | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				error: null,
				currentInputType: 'image',
				imageQuality: null
			}));

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);

				// Call API with retry
				const result = await withRetry(() => api.identifyImage(imageData, mimeType));

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						lastResult: result,
						error: null,
						imageQuality: result.quality ?? null,
						lastImageData: imageData,
						lastImageMimeType: mimeType
					};
					persistCurrentState(newState, true);
					return newState;
				});

				return result;
			} catch (error) {
				const errorInfo = extractErrorInfo(error, 'Image identification failed. Please try again.');
				update((state) => ({
					...state,
					isLoading: false,
					error: errorInfo
				}));
				return null;
			}
		},

		/**
		 * Re-identify wine from image with supplementary text context
		 * Compresses image and sends with user-provided hints for better identification
		 */
		identifyImageWithSupplementaryText: async (
			file: File,
			supplementaryText: string
		): Promise<AgentIdentificationResultWithMeta | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				error: null,
				currentInputType: 'image',
				imageQuality: null
			}));

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);

				// Call API with supplementary text and retry
				const result = await withRetry(() =>
					api.identifyImage(imageData, mimeType, supplementaryText)
				);

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						lastResult: result,
						error: null,
						imageQuality: result.quality ?? null,
						lastImageData: imageData,
						lastImageMimeType: mimeType
					};
					persistCurrentState(newState, true);
					return newState;
				});

				return result;
			} catch (error) {
				const errorInfo = extractErrorInfo(error, 'Image identification failed. Please try again.');
				update((state) => ({
					...state,
					isLoading: false,
					error: errorInfo
				}));
				return null;
			}
		},

		/**
		 * User-triggered escalation to Claude Opus for maximum accuracy
		 * Called when user clicks "Try Harder" after a user_choice action
		 * Supports both text and image inputs
		 */
		identifyWithOpus: async (
			input: string,
			inputType: AgentInputType,
			priorResult: AgentIdentificationResult,
			mimeType?: string,
			supplementaryText?: string
		): Promise<AgentIdentificationResult | null> => {
			update((state) => ({
				...state,
				isLoading: true,
				error: null
			}));

			try {
				const result = await withRetry(() =>
					api.identifyWithOpus(input, inputType, priorResult, mimeType, supplementaryText)
				);

				update((state) => {
					const newState = {
						...state,
						isLoading: false,
						lastResult: result,
						error: null
					};
					persistCurrentState(newState, true);
					return newState;
				});

				return result;
			} catch (error) {
				const errorInfo = extractErrorInfo(error, 'Premium identification failed. Please try again.');
				update((state) => ({
					...state,
					isLoading: false,
					error: errorInfo
				}));
				return null;
			}
		},

		// ─────────────────────────────────────────────────────
		// PANEL CONTROLS
		// ─────────────────────────────────────────────────────

		/**
		 * Open the agent panel
		 */
		openPanel: () => {
			update((state) => ({ ...state, isPanelOpen: true }));
			storePanelState(true);
		},

		/**
		 * Close the agent panel
		 */
		closePanel: () => {
			update((state) => ({ ...state, isPanelOpen: false }));
			storePanelState(false);
		},

		/**
		 * Toggle the agent panel
		 */
		togglePanel: () => {
			update((state) => {
				const newState = !state.isPanelOpen;
				storePanelState(newState);
				return { ...state, isPanelOpen: newState };
			});
		},

		// ─────────────────────────────────────────────────────
		// ENRICHMENT (Phase 2)
		// ─────────────────────────────────────────────────────

		/**
		 * Set enrichment loading state
		 */
		setEnriching: (isEnriching: boolean) => {
			update((state) => ({ ...state, isEnriching, enrichmentError: null }));
		},

		/**
		 * Set enrichment error
		 */
		setEnrichmentError: (error: AgentErrorInfo | null) => {
			update((state) => ({ ...state, isEnriching: false, enrichmentError: error }));
		},

		/**
		 * Enrich wine with additional details (grape composition, critic scores, etc.)
		 * WIN-162: Now handles pendingConfirmation for non-exact cache matches
		 */
		enrichWine: async (parsed: AgentParsedWine, confirmMatch = false, forceRefresh = false): Promise<void> => {
			// Validate required fields
			if (!parsed.producer || !parsed.wineName) {
				const errorMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'text',
					content: 'I need at least the producer and wine name to find more information.',
					timestamp: Date.now(),
					isNew: true
				};
				update((s) => ({
					...s,
					messages: [...s.messages, errorMessage]
				}));
				return;
			}

			update((s) => ({ ...s, isEnriching: true, enrichmentError: null }));

			try {
				const result = await api.enrichWine(
					parsed.producer,
					parsed.wineName,
					parsed.vintage,
					parsed.wineType,
					parsed.region,
					confirmMatch,
					forceRefresh
				);

				// WIN-162: Handle pending confirmation for non-exact cache matches
				// Note: If pendingConfirmation is true, matchType should never be 'exact' (by backend design)
				// But we add defensive fallback to 'alias' just in case
				if (result.pendingConfirmation && result.matchedTo) {
					const resolvedMatchType: 'abbreviation' | 'alias' | 'fuzzy' =
						result.matchType && result.matchType !== 'exact'
							? (result.matchType as 'abbreviation' | 'alias' | 'fuzzy')
							: 'alias';

					const confirmMessage: AgentMessage = {
						id: generateMessageId(),
						role: 'agent',
						type: 'cache_match_confirm',
						content: `I found cached data for ${result.matchedTo.producer || ''} ${result.matchedTo.wineName || ''} ${result.matchedTo.vintage || ''}. Is this the wine you're looking for?`.trim(),
						timestamp: Date.now(),
						isNew: true,
						cacheMatchType: resolvedMatchType,
						searchedFor: result.searchedFor,
						matchedTo: result.matchedTo,
						cacheConfidence: result.confidence,
						chips: [
							{ id: 'confirm_cache_match', label: 'Yes, use cached data', icon: 'check', action: 'confirm_cache_match' },
							{ id: 'force_refresh', label: 'No, search online', icon: 'search', action: 'force_refresh' }
						]
					};

					update((s) => {
						const newState = {
							...s,
							isEnriching: false,
							phase: 'confirm_cache_match' as AgentPhase,
							pendingCacheMatch: {
								parsed,
								matchType: resolvedMatchType,
								searchedFor: result.searchedFor!,
								matchedTo: result.matchedTo!,
								confidence: result.confidence || 0.9
							},
							messages: [...s.messages, confirmMessage]
						};
						persistCurrentState(newState, true);
						return newState;
					});
					return;
				}

				// Normal enrichment result - add enrichment message
				const enrichMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'wine_enrichment',
					content: "Here's what I found about this wine.",
					timestamp: Date.now(),
					isNew: true,
					enrichmentData: result.data ?? undefined,
					enrichmentSource: result.source,
					chips: [
						{ id: 'add_to_cellar', label: 'Add to Cellar', icon: 'plus', action: 'add_to_cellar' },
						{ id: 'remember_wine', label: 'Remember Wine', icon: 'heart', action: 'remember_wine' }
					]
				};

				update((s) => {
					const newState = {
						...s,
						isEnriching: false,
						enrichmentData: result.data,
						enrichmentForWine: { producer: parsed.producer!, wineName: parsed.wineName! },
						pendingCacheMatch: null,
						phase: 'action_select' as AgentPhase, // WIN-162: Transition to action_select after enrichment
						messages: [...s.messages, enrichMessage]
					};
					persistCurrentState(newState, true);
					return newState;
				});
			} catch (error) {
				const errorInfo = extractErrorInfo(error, 'Enrichment failed');

				const errorMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'text',
					content: errorInfo.userMessage || "I couldn't find additional information about this wine. You can still add it to your cellar.",
					timestamp: Date.now(),
					isNew: true
				};

				update((s) => ({
					...s,
					isEnriching: false,
					enrichmentError: errorInfo,
					enrichmentData: null,
					pendingCacheMatch: null,
					phase: 'await_input' as AgentPhase, // WIN-162: Return to await_input on error
					messages: [...s.messages, errorMessage]
				}));
			}
		},

		/**
		 * Enrich wine with streaming response (WIN-181)
		 * Fields are emitted progressively as they arrive from the LLM.
		 */
		enrichWineWithStreaming: async (parsed: AgentParsedWine, confirmMatch = false, forceRefresh = false): Promise<void> => {
			// Validate required fields
			if (!parsed.producer || !parsed.wineName) {
				const errorMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'text',
					content: 'I need at least the producer and wine name to find more information.',
					timestamp: Date.now(),
					isNew: true
				};
				update((s) => ({
					...s,
					messages: [...s.messages, errorMessage]
				}));
				return;
			}

			update((s) => ({
				...s,
				isEnriching: true,
				isStreaming: true,
				streamingFields: new Map(),
				enrichmentError: null
			}));

			try {
				const result = await api.enrichWineStream(
					parsed.producer,
					parsed.wineName,
					parsed.vintage,
					parsed.wineType,
					parsed.region,
					confirmMatch,
					forceRefresh,
					// onField callback - update streaming fields as they arrive
					(field, value) => {
						update((state) => {
							const fields = new Map(state.streamingFields);
							fields.set(field, {
								value,
								isTyping: true,
								arrivedAt: Date.now()
							});
							return { ...state, streamingFields: fields };
						});
					}
				);

				// Handle pending confirmation
				if (result.pendingConfirmation && result.matchedTo) {
					const resolvedMatchType: 'abbreviation' | 'alias' | 'fuzzy' =
						result.matchType && result.matchType !== 'exact'
							? (result.matchType as 'abbreviation' | 'alias' | 'fuzzy')
							: 'alias';

					const confirmMessage: AgentMessage = {
						id: generateMessageId(),
						role: 'agent',
						type: 'cache_match_confirm',
						content: `I found cached data for ${result.matchedTo.producer || ''} ${result.matchedTo.wineName || ''} ${result.matchedTo.vintage || ''}. Is this the wine you're looking for?`.trim(),
						timestamp: Date.now(),
						isNew: true,
						cacheMatchType: resolvedMatchType,
						searchedFor: result.searchedFor,
						matchedTo: result.matchedTo,
						cacheConfidence: result.confidence,
						chips: [
							{ id: 'confirm_cache_match', label: 'Yes, use cached data', icon: 'check', action: 'confirm_cache_match' },
							{ id: 'force_refresh', label: 'No, search online', icon: 'search', action: 'force_refresh' }
						]
					};

					update((s) => {
						const newState = {
							...s,
							isEnriching: false,
							isStreaming: false,
							streamingFields: new Map(),
							phase: 'confirm_cache_match' as AgentPhase,
							pendingCacheMatch: {
								parsed,
								matchType: resolvedMatchType,
								searchedFor: result.searchedFor!,
								matchedTo: result.matchedTo!,
								confidence: result.confidence || 0.9
							},
							messages: [...s.messages, confirmMessage]
						};
						persistCurrentState(newState, true);
						return newState;
					});
					return;
				}

				// Normal enrichment result - keep streaming card visible and set chips below
				// WIN-181: Don't add message, don't clear streamingFields - let the card stay visible
				const enrichmentChips: AgentChip[] = [
					{ id: 'add_to_cellar', label: 'Add to Cellar', icon: 'plus', action: 'add_to_cellar' },
					{ id: 'remember_wine', label: 'Remember Wine', icon: 'heart', action: 'remember_wine' }
				];

				update((s) => {
					const newState = {
						...s,
						isEnriching: false,
						isStreaming: false,
						// WIN-181: Keep streamingFields populated so enrichment card stays visible
						// Fields will be cleared when user takes action
						enrichmentData: result.data,
						enrichmentForWine: { producer: parsed.producer!, wineName: parsed.wineName! },
						pendingCacheMatch: null,
						pendingEnrichmentResult: result.data ?? null,
						enrichmentStreamingChips: {
							content: "Here's what I found about this wine.",
							chips: enrichmentChips
						},
						phase: 'action_select' as AgentPhase
						// Don't add message - the streaming card will display the data
					};
					persistCurrentState(newState, true);
					return newState;
				});
			} catch (error) {
				// Fallback to non-streaming on error
				console.warn('Streaming enrichment failed, falling back:', error);
				update((state) => ({
					...state,
					isStreaming: false,
					streamingFields: new Map()
				}));
				// Use the regular enrichment method as fallback
				await agent.enrichWine(parsed, confirmMatch, forceRefresh);
			}
		},

		/**
		 * Clear enrichment data and error
		 */
		clearEnrichment: (): void => {
			update((s) => ({
				...s,
				enrichmentData: null,
				enrichmentError: null
			}));
		},

		/**
		 * WIN-162: Confirm a non-exact cache match
		 * User accepted the canonical resolution - fetch enrichment with confirmMatch=true
		 */
		confirmCacheMatch: async (): Promise<void> => {
			const state = get({ subscribe });
			const pending = state.pendingCacheMatch;
			if (!pending) {
				console.warn('confirmCacheMatch called without pendingCacheMatch');
				return;
			}
			// Re-call enrichWine with confirmMatch=true
			await agent.enrichWine(pending.parsed, true, false);
		},

		/**
		 * WIN-162: Reject cache match and force fresh search
		 * User rejected the canonical resolution - fetch enrichment with forceRefresh=true
		 */
		forceRefreshEnrichment: async (): Promise<void> => {
			const state = get({ subscribe });
			const pending = state.pendingCacheMatch;
			if (!pending) {
				console.warn('forceRefreshEnrichment called without pendingCacheMatch');
				return;
			}
			// Re-call enrichWine with forceRefresh=true
			await agent.enrichWine(pending.parsed, false, true);
		},

		// ─────────────────────────────────────────────────────
		// RESET / CLEAR
		// ─────────────────────────────────────────────────────

		/**
		 * Clear last result and error (keeps panel state)
		 */
		reset: () => {
			update((state) => ({
				...initialState,
				isPanelOpen: state.isPanelOpen // Preserve panel state
			}));
		},

		/**
		 * Clear just the error
		 */
		clearError: () => update((state) => ({ ...state, error: null, enrichmentError: null })),

		/**
		 * Full reset including panel state
		 */
		fullReset: () => {
			clearSessionState();
			set(initialState);
			storePanelState(false);
		},

		// ─────────────────────────────────────────────────────
		// CONVERSATION METHODS
		// ─────────────────────────────────────────────────────

		/**
		 * Start a new conversation session with greeting
		 */
		startSession: () => {
			clearSessionState(); // Clear old session before starting new one

			const greeting = getRandomGreeting();
			const greetingMessage: AgentMessage = {
				id: generateMessageId(),
				role: 'agent',
				type: 'greeting',
				content: greeting,
				timestamp: Date.now(),
				isNew: true,
				chips: [
					{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
					{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
				]
			};

			update((state) => ({
				...state,
				phase: 'path_selection',
				messages: [greetingMessage],
				lastResult: null,
				error: null,
				augmentationContext: null,
				pendingNewSearch: null,
				enrichmentData: null,
				enrichmentError: null,
				addState: null,
				// WIN-181: Clear streaming state on session start
				isStreaming: false,
				streamingFields: new Map(),
				streamingChips: null,
				enrichmentStreamingChips: null,
				pendingEnrichmentResult: null
			}));
		},

		/**
		 * Add a message to the conversation
		 */
		addMessage: (
			message: Omit<AgentMessage, 'id' | 'timestamp'>
		) => {
			const fullMessage: AgentMessage = {
				...message,
				id: generateMessageId(),
				timestamp: Date.now(),
				isNew: true
			};

			update((state) => {
				// Trim to MAX_MESSAGES, removing oldest first
				const newMessages = [...state.messages, fullMessage];
				if (newMessages.length > MAX_MESSAGES) {
					newMessages.splice(0, newMessages.length - MAX_MESSAGES);
				}
				const newState = { ...state, messages: newMessages };
				persistCurrentState(newState); // Debounced
				return newState;
			});

			return fullMessage.id;
		},

		/**
		 * Set the current conversation phase
		 */
		setPhase: (phase: AgentPhase) => {
			update((state) => {
				const newState = { ...state, phase };
				persistCurrentState(newState); // Debounced
				return newState;
			});
		},

		/**
		 * Set typing indicator state
		 */
		setTyping: (isTyping: boolean) => {
			update((state) => ({ ...state, isTyping }));
		},

		/**
		 * Cancel identification in progress (WIN-174)
		 * UI-only: resets state and shows friendly message
		 */
		cancelIdentification: () => {
			update((state) => ({
				...state,
				isLoading: false,
				isTyping: false,
				phase: 'await_input' as AgentPhase
			}));

			// Add friendly cancellation message
			const messageId = generateMessageId();
			update((state) => ({
				...state,
				messages: [
					...state.messages,
					{
						id: messageId,
						role: 'agent' as const,
						type: 'text' as AgentMessageType,
						content: "No problem, I've stopped. What would you like to do?",
						timestamp: Date.now(),
						isNew: true,
						chips: [
							{ id: 'try_again', label: 'Try Again', icon: 'refresh', action: 'try_again' },
							{ id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }
						]
					}
				]
			}));
		},

		/**
		 * Set augmentation context for retry flow
		 */
		setAugmentationContext: (context: AgentAugmentationContext | null) => {
			update((state) => {
				const newState = { ...state, augmentationContext: context };
				persistCurrentState(newState, true); // Immediate - critical for retry flow
				return newState;
			});
		},

		/**
		 * Set pending new search for confirmation flow
		 */
		setPendingNewSearch: (pending: PendingNewSearch | null) => {
			update((state) => {
				const newState = { ...state, pendingNewSearch: pending };
				persistCurrentState(newState, true); // Immediate - critical for mobile tab switches
				return newState;
			});
		},

		/**
		 * Disable chips from the last message and mark the selected one
		 * Called when user selects a chip to prevent reselection
		 * @param selectedAction - The action of the chip that was selected (optional, for highlighting)
		 */
		clearLastChips: (selectedAction?: string) => {
			update((state) => {
				const messages = [...state.messages];
				// Find last message with chips and disable them
				for (let i = messages.length - 1; i >= 0; i--) {
					const msg = messages[i];
					if (msg.chips && msg.chips.length > 0) {
						messages[i] = {
							...msg,
							chips: msg.chips.map(chip => ({
								...chip,
								disabled: true,
								selected: chip.action === selectedAction
							}))
						};
						break;
					}
				}
				// Also disable streaming chips if present
				const newStreamingChips = state.streamingChips
					? {
						...state.streamingChips,
						chips: state.streamingChips.chips.map(chip => ({
							...chip,
							disabled: true,
							selected: chip.action === selectedAction
						}))
					}
					: null;
				const newEnrichmentChips = state.enrichmentStreamingChips
					? {
						...state.enrichmentStreamingChips,
						chips: state.enrichmentStreamingChips.chips.map(chip => ({
							...chip,
							disabled: true,
							selected: chip.action === selectedAction
						}))
					}
					: null;
				return {
					...state,
					messages,
					streamingChips: newStreamingChips,
					enrichmentStreamingChips: newEnrichmentChips
				};
			});
		},

		/**
		 * Reset conversation and start fresh (preserves panel state and history)
		 * Adds a divider and new greeting without clearing messages
		 */
		resetConversation: () => {
			const greeting = getRandomGreeting();

			// Add a divider message to show conversation restart (WIN-174)
			const dividerMessage: AgentMessage = {
				id: generateMessageId(),
				role: 'agent',
				type: 'divider',
				content: 'New conversation',
				timestamp: Date.now(),
				isNew: false // No typewriter animation for dividers
			};

			const greetingMessage: AgentMessage = {
				id: generateMessageId(),
				role: 'agent',
				type: 'greeting',
				content: greeting,
				timestamp: Date.now(),
				isNew: true,
				chips: [
					{ id: 'identify', label: 'Identify', icon: 'search', action: 'identify' },
					{ id: 'recommend', label: 'Recommend', icon: 'sparkle', action: 'recommend' }
				]
			};

			update((state) => {
				// Keep existing messages, add divider and new greeting
				let newMessages = [...state.messages, dividerMessage, greetingMessage];

				// Trim to MAX_MESSAGES if needed
				if (newMessages.length > MAX_MESSAGES) {
					newMessages = newMessages.slice(-MAX_MESSAGES);
				}

				const newState = {
					...state,
					phase: 'path_selection' as AgentPhase,
					messages: newMessages,
					lastResult: null,
					error: null,
					augmentationContext: null,
					pendingNewSearch: null,
					isTyping: false,
					enrichmentData: null,
					enrichmentError: null,
					addState: null,
					// WIN-181: Clear streaming state on conversation reset
					isStreaming: false,
					streamingFields: new Map(),
					streamingChips: null,
					enrichmentStreamingChips: null,
					pendingEnrichmentResult: null
				};

				// Persist immediately to ensure greeting appears after error recovery
				persistCurrentState(newState, true);

				return newState;
			});
		},

		// ─────────────────────────────────────────────────────
		// ADD WINE FLOW METHODS
		// ─────────────────────────────────────────────────────

		/**
		 * Initialize add flow from identification result
		 */
		initializeAddFlow: (identified: AgentParsedWine) => {
			update((state) => {
				const newState = {
					...state,
					addState: {
						identified,
						mode: {
							region: 'search' as AgentAddSelectionMode,
							producer: 'search' as AgentAddSelectionMode,
							wine: 'search' as AgentAddSelectionMode
						},
						regionData: {
							regionName: identified.region || '',
							country: identified.country || ''
						},
						producerData: {
							producerName: identified.producer || '',
							regionName: identified.region || ''
						},
						wineData: {
							wineName: identified.wineName || '',
							wineYear: identified.vintage || '',
							wineType: identified.wineType || '',
							producerName: identified.producer || ''
						},
						bottleData: { bottleSize: '', storageLocation: '', source: '' },
						selected: { region: null, producer: null, wine: null },
						matches: { region: [], producer: [], wine: [] },
						bottleFormPart: 1 as const
					}
				};
				persistCurrentState(newState, true);
				return newState;
			});
		},

		/**
		 * Update selection at each step
		 */
		setAddSelection: (
			step: 'region' | 'producer' | 'wine',
			mode: AgentAddSelectionMode,
			entity?: Region | Producer | Wine
		) => {
			update((state) => {
				if (!state.addState) return state;

				const newState = {
					...state,
					addState: {
						...state.addState,
						mode: { ...state.addState.mode, [step]: mode },
						selected: {
							...state.addState.selected,
							[step]: mode === 'search' && entity ? entity : null
						}
					}
				};
				persistCurrentState(newState, true);
				return newState;
			});
		},

		/**
		 * Store fuzzy matches
		 */
		setAddMatches: (step: 'region' | 'producer' | 'wine', matches: DuplicateMatch[]) => {
			update((state) => {
				if (!state.addState) return state;

				const newState = {
					...state,
					addState: {
						...state.addState,
						matches: { ...state.addState.matches, [step]: matches }
					}
				};
				persistCurrentState(newState, true);
				return newState;
			});
		},

		/**
		 * Update form data for entities or bottle
		 */
		updateAddFormData: (
			step: 'region' | 'producer' | 'wine' | 'bottle',
			data: Partial<AgentAddRegionData | AgentAddProducerData | AgentAddWineData | AgentAddBottleData>
		) => {
			update((state) => {
				if (!state.addState) return state;

				let newAddState = { ...state.addState };

				switch (step) {
					case 'region':
						newAddState.regionData = { ...newAddState.regionData, ...data as Partial<AgentAddRegionData> };
						break;
					case 'producer':
						newAddState.producerData = { ...newAddState.producerData, ...data as Partial<AgentAddProducerData> };
						break;
					case 'wine':
						newAddState.wineData = { ...newAddState.wineData, ...data as Partial<AgentAddWineData> };
						break;
					case 'bottle':
						newAddState.bottleData = { ...newAddState.bottleData, ...data as Partial<AgentAddBottleData> };
						break;
				}

				const newState = { ...state, addState: newAddState };
				persistCurrentState(newState);
				return newState;
			});
		},

		/**
		 * Advance bottle form part (1 → 2)
		 */
		advanceBottleFormPart: () => {
			update((state) => {
				if (!state.addState || state.addState.bottleFormPart !== 1) return state;

				const newState = {
					...state,
					addState: { ...state.addState, bottleFormPart: 2 as const }
				};
				persistCurrentState(newState);
				return newState;
			});
		},

		/**
		 * Clear add state (on "Start Over" or completion)
		 */
		clearAddState: () => {
			update((state) => {
				const newState = { ...state, addState: null };
				persistCurrentState(newState, true);
				return newState;
			});
		},

		/**
		 * Update add state with partial data (WIN-145: for existingWineId)
		 */
		updateAddState: (updates: Partial<AgentAddState>) => {
			update((state) => {
				if (!state.addState) return state;
				const newState = {
					...state,
					addState: { ...state.addState, ...updates }
				};
				persistCurrentState(newState);
				return newState;
			});
		},

		/**
		 * Validate state before submission - returns error message or null
		 */
		validateAddState: (): string | null => {
			const state = get(agent);
			if (!state.addState) return 'Add flow not initialized';

			const addState = state.addState;

			// Region validation
			if (addState.mode.region === 'search' && !addState.selected.region) {
				return 'Region selection is incomplete';
			}
			if (addState.mode.region === 'create') {
				if (!addState.regionData.regionName?.trim()) return 'Region name is required';
				if (!addState.regionData.country?.trim()) return 'Country is required';
			}

			// Producer validation
			if (addState.mode.producer === 'search' && !addState.selected.producer) {
				return 'Producer selection is incomplete';
			}
			if (addState.mode.producer === 'create' && !addState.producerData.producerName?.trim()) {
				return 'Producer name is required';
			}

			// Wine validation
			if (addState.mode.wine === 'search' && !addState.selected.wine) {
				return 'Wine selection is incomplete';
			}
			if (addState.mode.wine === 'create') {
				if (!addState.wineData.wineName?.trim()) return 'Wine name is required';
				if (!addState.wineData.wineType?.trim()) return 'Wine type is required';
			}

			// Bottle validation (required fields)
			if (!addState.bottleData.bottleSize || !addState.bottleData.storageLocation || !addState.bottleData.source) {
				return 'Please complete the bottle details';
			}

			return null; // Valid
		}
	};
}

export const agent = createAgentStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Parsed wine data from last identification */
export const agentParsed = derived<typeof agent, AgentParsedWine | null>(
	agent,
	($agent) => $agent.lastResult?.parsed ?? null
);

/** Recommended action from last identification */
export const agentAction = derived<typeof agent, AgentAction | null>(
	agent,
	($agent) => $agent.lastResult?.action ?? null
);

/** Disambiguation candidates from last identification */
export const agentCandidates = derived<typeof agent, AgentCandidate[]>(
	agent,
	($agent) => $agent.lastResult?.candidates ?? []
);

/** Confidence score from last identification */
export const agentConfidence = derived<typeof agent, number | null>(
	agent,
	($agent) => $agent.lastResult?.confidence ?? null
);

/** Whether agent is currently processing (identification or enrichment) */
export const agentLoading = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.isLoading || $agent.isEnriching
);

/** Whether agent is specifically identifying (not enriching) */
export const agentIdentifying = derived<typeof agent, boolean>(agent, ($agent) => $agent.isLoading);

/** Whether agent is enriching */
export const agentEnriching = derived<typeof agent, boolean>(agent, ($agent) => $agent.isEnriching);

/** Enrichment data from last enrichment call */
export const agentEnrichmentData = derived<typeof agent, AgentEnrichmentData | null>(
	agent,
	($agent) => $agent.enrichmentData
);

/** Whether agent has an error - returns structured error info */
export const agentError = derived<typeof agent, AgentErrorInfo | null>(
	agent,
	($agent) => $agent.error || $agent.enrichmentError
);

/** Convenience: just the error message */
export const agentErrorMessage = derived<typeof agent, string | null>(
	agent,
	($agent) => ($agent.error || $agent.enrichmentError)?.userMessage ?? null
);

/** Convenience: whether error is retryable */
export const agentErrorRetryable = derived<typeof agent, boolean>(
	agent,
	($agent) => ($agent.error || $agent.enrichmentError)?.retryable ?? false
);

/** Convenience: support reference for error */
export const agentErrorSupportRef = derived<typeof agent, string | null>(
	agent,
	($agent) => ($agent.error || $agent.enrichmentError)?.supportRef ?? null
);

/** Whether agent panel is open */
export const agentPanelOpen = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.isPanelOpen
);

/** Current input type (text or image) */
export const agentInputType = derived<typeof agent, AgentInputType | null>(
	agent,
	($agent) => $agent.currentInputType
);

/** Image quality info (for image inputs) */
export const agentImageQuality = derived<typeof agent, AgentImageQuality | null>(
	agent,
	($agent) => $agent.imageQuality
);

/** Whether agent has a result ready */
export const agentHasResult = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.lastResult !== null
);

// ─────────────────────────────────────────────────────────
// CONVERSATION DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Current conversation phase */
export const agentPhase = derived<typeof agent, AgentPhase>(
	agent,
	($agent) => $agent.phase
);

/** All messages in the conversation */
export const agentMessages = derived<typeof agent, AgentMessage[]>(
	agent,
	($agent) => $agent.messages
);

/** Whether agent is showing typing indicator */
export const agentIsTyping = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.isTyping
);

/** Whether there's an active augmentation context */
export const agentHasAugmentationContext = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.augmentationContext !== null
);

/** The augmentation context if present */
export const agentAugmentationContext = derived<typeof agent, AgentAugmentationContext | null>(
	agent,
	($agent) => $agent.augmentationContext
);

/** Whether the conversation has started (has messages) */
export const agentHasStarted = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.messages.length > 0
);

/** Pending new search confirmation state */
export const agentPendingNewSearch = derived<typeof agent, PendingNewSearch | null>(
	agent,
	($agent) => $agent.pendingNewSearch
);

// ─────────────────────────────────────────────────────────
// ADD WINE FLOW DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Add wine flow state */
export const agentAddState = derived<typeof agent, AgentAddState | null>(
	agent,
	($agent) => $agent.addState
);

// ─────────────────────────────────────────────────────────
// STREAMING DERIVED STORES (WIN-181)
// ─────────────────────────────────────────────────────────

/** Whether agent is currently streaming a response */
export const agentIsStreaming = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.isStreaming
);

/** Map of streaming field states */
export const agentStreamingFields = derived<typeof agent, Map<string, StreamingFieldState>>(
	agent,
	($agent) => $agent.streamingFields
);

/** Chips to display below streaming card */
export const agentStreamingChips = derived(
	agent,
	($agent) => $agent.streamingChips
);

/** Chips to display below enrichment streaming card */
export const agentEnrichmentStreamingChips = derived(
	agent,
	($agent) => $agent.enrichmentStreamingChips
);

/** Pending enrichment result for when user acts on chips */
export const agentPendingEnrichmentResult = derived(
	agent,
	($agent) => $agent.pendingEnrichmentResult
);
