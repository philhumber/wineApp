/**
 * Agent Store
 * Manages AI Agent state for wine identification
 *
 * Phase 1: Text-based identification with confidence scoring
 */

import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';
import type { AgentIdentificationResult, AgentParsedWine, AgentAction, AgentCandidate } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface AgentState {
	isLoading: boolean;
	lastResult: AgentIdentificationResult | null;
	error: string | null;
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

const initialState: AgentState = {
	isLoading: false,
	lastResult: null,
	error: null
};

function createAgentStore() {
	const { subscribe, set, update } = writable<AgentState>(initialState);

	return {
		subscribe,

		/**
		 * Identify wine from text input
		 */
		identify: async (text: string): Promise<AgentIdentificationResult | null> => {
			update((state) => ({ ...state, isLoading: true, error: null }));

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
		 * Clear last result and error
		 */
		reset: () => set(initialState),

		/**
		 * Clear just the error
		 */
		clearError: () => update((state) => ({ ...state, error: null }))
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

/** Whether agent is currently processing */
export const agentLoading = derived<typeof agent, boolean>(
	agent,
	($agent) => $agent.isLoading
);

/** Whether agent has an error */
export const agentError = derived<typeof agent, string | null>(
	agent,
	($agent) => $agent.error
);
