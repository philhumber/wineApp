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
	Wine
} from '$lib/api/types';
import { AgentError } from '$lib/api/types';

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
				// Strip ObjectURLs from messages (they won't work after reload)
				messages: state.messages.map((msg) => ({
					...msg,
					imageUrl: msg.imageUrl?.startsWith('data:') ? msg.imageUrl : undefined
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
					messages: state.messages.slice(-10),
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
	| 'chips'
	| 'image_preview'
	| 'wine_result'
	| 'wine_enrichment'
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
}

/** Context for augmentation (Not Correct flow) */
export interface AgentAugmentationContext {
	originalInput: string;
	originalInputType: AgentInputType;
	originalResult: AgentIdentificationResult;
	userFeedback?: string;
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

	// Session persistence fields
	lastImageData: string | null;
	lastImageMimeType: string | null;
	enrichmentForWine: { producer: string; wineName: string } | null;

	// Add wine flow state
	addState: AgentAddState | null;
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
	// Session persistence
	lastImageData: null,
	lastImageMimeType: null,
	enrichmentForWine: null,
	// Add wine flow
	addState: null
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
				messages: storedSession.messages,
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

			// Debug: Log query initiation
			console.group('🍷 Agent: Text Identification Request');
			console.log('Input:', text);
			console.log('Timestamp:', new Date().toISOString());
			console.groupEnd();

			try {
				const result = await api.identifyText(text);

				// Debug: Log full context chain and escalation info
				console.group('🍷 Agent: Text Identification Result');
				console.log('Input:', text);
				console.log('Success:', result.success ?? true);

				if (result.escalation) {
					console.group('📊 Escalation Chain');
					console.log('Final Tier:', result.escalation.final_tier);

					// Log each tier's context
					Object.entries(result.escalation.tiers).forEach(([tier, data]) => {
						console.group(`  Tier: ${tier}`);
						console.log('Model:', (data as Record<string, unknown>).model);
						console.log('Confidence:', (data as Record<string, unknown>).confidence);
						if ((data as Record<string, unknown>).thinking_level) {
							console.log('Thinking Level:', (data as Record<string, unknown>).thinking_level);
						}
						console.groupEnd();
					});

					console.log('Total Cost: $' + (result.escalation.total_cost?.toFixed(6) ?? '0'));
					console.groupEnd();
				}

				console.group('📋 Parsed Result');
				console.log('Producer:', result.parsed?.producer ?? 'null');
				console.log('Wine Name:', result.parsed?.wineName ?? 'null');
				console.log('Vintage:', result.parsed?.vintage ?? 'null');
				console.log('Region:', result.parsed?.region ?? 'null');
				console.log('Country:', result.parsed?.country ?? 'null');
				console.log('Type:', result.parsed?.wineType ?? 'null');
				console.groupEnd();

				console.log('Confidence:', result.confidence);
				console.log('Action:', result.action);

				if (result.inferences_applied?.length) {
					console.log('Inferences Applied:', result.inferences_applied);
				}

				if (result.usage) {
					console.group('📈 Usage');
					console.log('Input Tokens:', result.usage.tokens?.input);
					console.log('Output Tokens:', result.usage.tokens?.output);
					console.log('Latency:', result.usage.latencyMs + 'ms');
					console.groupEnd();
				}

				console.groupEnd();

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

			// Debug: Log query initiation
			console.group('🍷 Agent: Image Identification Request');
			console.log('File:', file.name);
			console.log('Size:', (file.size / 1024).toFixed(1) + ' KB');
			console.log('Type:', file.type);
			console.log('Timestamp:', new Date().toISOString());
			console.groupEnd();

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);
				console.log('🖼️ Compressed image:', (imageData.length / 1024).toFixed(1) + ' KB base64');

				// Call API with retry
				const result = await withRetry(() => api.identifyImage(imageData, mimeType));

				// Debug: Log full context chain and escalation info
				console.group('🍷 Agent: Image Identification Result');
				console.log('Success:', result.success ?? true);

				if (result.quality) {
					console.group('🖼️ Image Quality');
					console.log('Score:', result.quality.score);
					console.log('Valid:', result.quality.valid);
					if (result.quality.issues?.length) {
						console.log('Issues:', result.quality.issues);
					}
					console.groupEnd();
				}

				if (result.escalation) {
					console.group('📊 Escalation Chain');
					console.log('Final Tier:', result.escalation.final_tier);

					Object.entries(result.escalation.tiers).forEach(([tier, data]) => {
						console.group(`  Tier: ${tier}`);
						console.log('Model:', (data as Record<string, unknown>).model);
						console.log('Confidence:', (data as Record<string, unknown>).confidence);
						if ((data as Record<string, unknown>).thinking_level) {
							console.log('Thinking Level:', (data as Record<string, unknown>).thinking_level);
						}
						console.groupEnd();
					});

					console.log('Total Cost: $' + (result.escalation.total_cost?.toFixed(6) ?? '0'));
					console.groupEnd();
				}

				console.group('📋 Parsed Result');
				console.log('Producer:', result.parsed?.producer ?? 'null');
				console.log('Wine Name:', result.parsed?.wineName ?? 'null');
				console.log('Vintage:', result.parsed?.vintage ?? 'null');
				console.log('Region:', result.parsed?.region ?? 'null');
				console.log('Country:', result.parsed?.country ?? 'null');
				console.log('Type:', result.parsed?.wineType ?? 'null');
				console.groupEnd();

				console.log('Confidence:', result.confidence);
				console.log('Action:', result.action);

				if (result.inferences_applied?.length) {
					console.log('Inferences Applied:', result.inferences_applied);
				}

				console.groupEnd();

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

			// Debug: Log query initiation with supplementary context
			console.group('🍷 Agent: Image + Supplementary Text Request');
			console.log('File:', file.name);
			console.log('Size:', (file.size / 1024).toFixed(1) + ' KB');
			console.log('Supplementary Text:', supplementaryText);
			console.log('Timestamp:', new Date().toISOString());
			console.groupEnd();

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);
				console.log('🖼️ Compressed image:', (imageData.length / 1024).toFixed(1) + ' KB base64');

				// Call API with supplementary text and retry
				const result = await withRetry(() =>
					api.identifyImage(imageData, mimeType, supplementaryText)
				);

				// Debug: Log result with context chain
				console.group('🍷 Agent: Image + Supplementary Result');
				console.log('Supplementary Text Used:', supplementaryText);

				if (result.escalation) {
					console.group('📊 Escalation Chain');
					console.log('Final Tier:', result.escalation.final_tier);
					Object.entries(result.escalation.tiers).forEach(([tier, data]) => {
						console.log(`  ${tier}: confidence=${(data as Record<string, unknown>).confidence}, model=${(data as Record<string, unknown>).model}`);
					});
					console.log('Total Cost: $' + (result.escalation.total_cost?.toFixed(6) ?? '0'));
					console.groupEnd();
				}

				console.log('Confidence:', result.confidence);
				console.log('Action:', result.action);
				console.log('Producer:', result.parsed?.producer ?? 'null');
				console.log('Wine Name:', result.parsed?.wineName ?? 'null');
				console.groupEnd();

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

			// Debug: Log Opus escalation request with full context
			console.group('🚀 Agent: Opus Escalation Request (Tier 3)');
			console.log('Input Type:', inputType);
			console.log('Input Length:', input.length);
			if (supplementaryText) {
				console.log('Supplementary Text:', supplementaryText);
			}
			console.group('📋 Prior Result Context');
			console.log('Prior Confidence:', priorResult.confidence);
			console.log('Prior Action:', priorResult.action);
			console.log('Prior Producer:', priorResult.parsed?.producer ?? 'null');
			console.log('Prior Wine Name:', priorResult.parsed?.wineName ?? 'null');
			console.log('Prior Tier:', priorResult.escalation?.final_tier ?? 'unknown');
			console.groupEnd();
			console.log('Timestamp:', new Date().toISOString());
			console.groupEnd();

			try {
				const result = await withRetry(() =>
					api.identifyWithOpus(input, inputType, priorResult, mimeType, supplementaryText)
				);

				// Debug: Log Opus result with full context chain
				console.group('🍷 Agent: Opus (Tier 3) Result');
				console.log('Success:', result.success ?? true);

				if (result.escalation) {
					console.group('📊 Escalation Chain');
					console.log('Final Tier:', result.escalation.final_tier);

					Object.entries(result.escalation.tiers).forEach(([tier, data]) => {
						console.group(`  Tier: ${tier}`);
						console.log('Model:', (data as Record<string, unknown>).model);
						console.log('Confidence:', (data as Record<string, unknown>).confidence);
						console.groupEnd();
					});

					console.log('Total Cost: $' + (result.escalation.total_cost?.toFixed(6) ?? '0'));
					console.groupEnd();
				}

				console.group('📋 Parsed Result');
				console.log('Producer:', result.parsed?.producer ?? 'null');
				console.log('Wine Name:', result.parsed?.wineName ?? 'null');
				console.log('Vintage:', result.parsed?.vintage ?? 'null');
				console.log('Region:', result.parsed?.region ?? 'null');
				console.log('Country:', result.parsed?.country ?? 'null');
				console.log('Type:', result.parsed?.wineType ?? 'null');
				console.groupEnd();

				console.log('Confidence:', result.confidence);
				console.log('Action:', result.action);

				if (result.inferences_applied?.length) {
					console.log('Inferences Applied:', result.inferences_applied);
				}

				console.groupEnd();

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
		setEnrichmentError: (error: string | null) => {
			update((state) => ({ ...state, isEnriching: false, enrichmentError: error }));
		},

		/**
		 * Enrich wine with additional details (grape composition, critic scores, etc.)
		 */
		enrichWine: async (parsed: AgentParsedWine): Promise<void> => {
			// Validate required fields
			if (!parsed.producer || !parsed.wineName) {
				const errorMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'text',
					content: 'I need at least the producer and wine name to find more information.',
					timestamp: Date.now()
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
					parsed.region
				);

				// Add enrichment message to conversation with action chips
				const enrichMessage: AgentMessage = {
					id: generateMessageId(),
					role: 'agent',
					type: 'wine_enrichment',
					content: "Here's what I found about this wine.",
					timestamp: Date.now(),
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
					timestamp: Date.now()
				};

				update((s) => ({
					...s,
					isEnriching: false,
					enrichmentError: errorInfo,
					enrichmentData: null,
					messages: [...s.messages, errorMessage]
				}));
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
				addState: null
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
				timestamp: Date.now()
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
		 * Clear chips from the last message that has them
		 * Called when user selects a chip to prevent reselection
		 */
		clearLastChips: () => {
			update((state) => {
				const messages = [...state.messages];
				// Find last message with chips and clear them
				for (let i = messages.length - 1; i >= 0; i--) {
					if (messages[i].chips && messages[i].chips.length > 0) {
						messages[i] = { ...messages[i], chips: undefined };
						break;
					}
				}
				return { ...state, messages };
			});
		},

		/**
		 * Reset conversation and start fresh (preserves panel state and history)
		 * Adds a divider and new greeting without clearing messages
		 */
		resetConversation: () => {
			const greeting = getRandomGreeting();

			// Add a divider message to show conversation restart
			const dividerMessage: AgentMessage = {
				id: generateMessageId(),
				role: 'agent',
				type: 'text',
				content: '— New conversation —',
				timestamp: Date.now()
			};

			const greetingMessage: AgentMessage = {
				id: generateMessageId(),
				role: 'agent',
				type: 'greeting',
				content: greeting,
				timestamp: Date.now(),
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

				return {
					...state,
					phase: 'path_selection',
					messages: newMessages,
					lastResult: null,
					error: null,
					augmentationContext: null,
					pendingNewSearch: null,
					isTyping: false,
					enrichmentData: null,
					enrichmentError: null,
					addState: null
				};
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
