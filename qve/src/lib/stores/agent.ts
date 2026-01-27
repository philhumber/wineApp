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
	AgentImageQuality
} from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const PANEL_STORAGE_KEY = 'agentPanelOpen';
const MAX_RETRIES = 2;
const MAX_MESSAGES = 30;

// ─────────────────────────────────────────────────────────
// CONVERSATION TYPES
// ─────────────────────────────────────────────────────────

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
	| 'complete';

/** Message content types */
export type AgentMessageType =
	| 'greeting'
	| 'text'
	| 'chips'
	| 'image_preview'
	| 'wine_result'
	| 'disambiguation'
	| 'coming_soon'
	| 'error';

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
}

/** Context for augmentation (Not Correct flow) */
export interface AgentAugmentationContext {
	originalInput: string;
	originalInputType: AgentInputType;
	originalResult: AgentIdentificationResult;
	userFeedback?: string;
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

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface AgentState {
	// Core state
	isLoading: boolean;
	lastResult: AgentIdentificationResult | null;
	error: string | null;

	// Phase 2: Panel state
	isPanelOpen: boolean;
	currentInputType: AgentInputType | null;

	// Phase 2: Enrichment state
	isEnriching: boolean;
	enrichmentError: string | null;

	// Image quality (for image inputs)
	imageQuality: AgentImageQuality | null;

	// Phase 3: Conversation state
	phase: AgentPhase;
	messages: AgentMessage[];
	augmentationContext: AgentAugmentationContext | null;
	isTyping: boolean;
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
	imageQuality: null,
	// Conversation state
	phase: 'greeting',
	messages: [],
	augmentationContext: null,
	isTyping: false
};

function createAgentStore() {
	const { subscribe, set, update } = writable<AgentState>(initialState);

	// Hydrate panel state from localStorage on client
	if (typeof window !== 'undefined') {
		update((state) => ({ ...state, isPanelOpen: getStoredPanelState() }));
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
				update((state) => ({
					...state,
					isLoading: false,
					lastResult: result,
					error: null
				}));
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Identification failed';
				update((state) => ({
					...state,
					isLoading: false,
					error: message
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

			try {
				// Compress image for upload
				const { imageData, mimeType } = await api.compressImageForIdentification(file);

				// Call API with retry
				const result = await withRetry(() => api.identifyImage(imageData, mimeType));

				update((state) => ({
					...state,
					isLoading: false,
					lastResult: result,
					error: null,
					imageQuality: result.quality ?? null
				}));

				return result;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Image identification failed. Please try again.';
				update((state) => ({
					...state,
					isLoading: false,
					error: message
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
				augmentationContext: null
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
				return { ...state, messages: newMessages };
			});

			return fullMessage.id;
		},

		/**
		 * Set the current conversation phase
		 */
		setPhase: (phase: AgentPhase) => {
			update((state) => ({ ...state, phase }));
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
			update((state) => ({ ...state, augmentationContext: context }));
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
					isTyping: false
				};
			});
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

/** Whether agent has an error */
export const agentError = derived<typeof agent, string | null>(
	agent,
	($agent) => $agent.error || $agent.enrichmentError
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
