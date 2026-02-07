/**
 * Agent Enrichment Store
 *
 * Handles:
 * - Enrichment loading state
 * - Enrichment data
 * - Streaming fields for enrichment
 * - Cache confirmation
 *
 * Part of the Phase 4 store split from the monolithic agent.ts
 */

import { writable, derived, get } from 'svelte/store';
import { persistState } from './agentPersistence';
import type {
  EnrichmentData,
  AgentErrorInfo,
  StreamingField,
} from '$lib/agent/types';

// ===========================================
// Types
// ===========================================

export interface EnrichmentWineInfo {
  producer: string;
  wineName: string;
  vintage?: number | string;
  region?: string;
  country?: string;
}

export interface EnrichmentRequest {
  producer: string;
  wineName: string;
  vintage: string | null;
  type: string | null;
  region: string | null;
}

interface EnrichmentState {
  isEnriching: boolean;
  data: EnrichmentData | null;
  error: AgentErrorInfo | null;
  source: 'cache' | 'web_search' | 'inference' | null;
  streamingFields: Map<string, StreamingField>;
  forWine: EnrichmentWineInfo | null;
  lastRequest: EnrichmentRequest | null; // For retry support
  pendingResult: EnrichmentData | null; // Buffered during streaming
}

// ===========================================
// Initial State
// ===========================================

const initialState: EnrichmentState = {
  isEnriching: false,
  data: null,
  error: null,
  source: null,
  streamingFields: new Map(),
  forWine: null,
  lastRequest: null,
  pendingResult: null,
};

const store = writable<EnrichmentState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const isEnriching = derived(store, ($s) => $s.isEnriching);
export const enrichmentData = derived(store, ($s) => $s.data);
export const enrichmentError = derived(store, ($s) => $s.error);
export const enrichmentSource = derived(store, ($s) => $s.source);
export const enrichmentStreamingFields = derived(store, ($s) => $s.streamingFields);
export const enrichmentForWine = derived(store, ($s) => $s.forWine);
export const lastEnrichmentRequest = derived(store, ($s) => $s.lastRequest);

// Computed derived stores
export const hasEnrichmentData = derived(store, ($s) => $s.data !== null);
export const isEnrichmentStreaming = derived(
  store,
  ($s) => $s.streamingFields.size > 0 && [...$s.streamingFields.values()].some((f) => f.isTyping)
);

// Enrichment section availability
export const hasOverview = derived(
  store,
  ($s) => $s.data?.overview !== undefined && $s.data.overview !== ''
);
export const hasGrapeComposition = derived(
  store,
  ($s) => ($s.data?.grapeComposition?.length ?? 0) > 0
);
export const hasTastingNotes = derived(
  store,
  ($s) => $s.data?.tastingNotes !== undefined
);
export const hasCriticScores = derived(
  store,
  ($s) => ($s.data?.criticScores?.length ?? 0) > 0
);
export const hasDrinkWindow = derived(
  store,
  ($s) => $s.data?.drinkWindow !== undefined
);
export const hasFoodPairings = derived(
  store,
  ($s) => ($s.data?.foodPairings?.length ?? 0) > 0
);

// ===========================================
// Actions
// ===========================================

/**
 * Start enrichment process.
 */
export function startEnrichment(wineInfo: EnrichmentWineInfo): void {
  store.update((state) => ({
    ...state,
    isEnriching: true,
    error: null,
    forWine: wineInfo,
    streamingFields: new Map(),
    pendingResult: null,
  }));
}

/**
 * Set last enrichment request (for retry support).
 */
export function setLastRequest(request: EnrichmentRequest): void {
  store.update((state) => ({
    ...state,
    lastRequest: request,
  }));
}

/**
 * Get and clear last enrichment request.
 */
export function getLastRequest(): EnrichmentRequest | null {
  return get(store).lastRequest;
}

/**
 * Set the enrichment result.
 */
export function setEnrichmentData(
  data: EnrichmentData,
  source: 'cache' | 'web_search' | 'inference' = 'inference'
): void {
  store.update((state) => ({
    ...state,
    isEnriching: false,
    data,
    source,
    error: null,
    streamingFields: new Map(),
    pendingResult: null,
  }));

  // Persist immediately
  persistEnrichmentState(true);
}

/**
 * Set enrichment error.
 */
export function setEnrichmentError(error: AgentErrorInfo): void {
  store.update((state) => ({
    ...state,
    isEnriching: false,
    error,
    streamingFields: new Map(),
  }));
}

/**
 * Clear error state.
 */
export function clearEnrichmentError(): void {
  store.update((state) => ({
    ...state,
    error: null,
  }));
}

/**
 * Update a streaming field for enrichment.
 */
export function updateEnrichmentStreamingField(
  fieldName: string,
  value: string,
  isTyping: boolean
): void {
  store.update((state) => {
    const newFields = new Map(state.streamingFields);
    newFields.set(fieldName, { value, isTyping });
    return { ...state, streamingFields: newFields };
  });
}

/**
 * Complete a streaming field.
 */
export function completeEnrichmentStreamingField(fieldName: string): void {
  store.update((state) => {
    const field = state.streamingFields.get(fieldName);
    if (!field) return state;

    const newFields = new Map(state.streamingFields);
    newFields.set(fieldName, { ...field, isTyping: false });
    return { ...state, streamingFields: newFields };
  });
}

/**
 * Clear all streaming fields.
 */
export function clearEnrichmentStreamingFields(): void {
  store.update((state) => ({
    ...state,
    streamingFields: new Map(),
  }));
}

/**
 * Set pending result (buffered during streaming).
 */
export function setPendingEnrichmentResult(data: EnrichmentData): void {
  store.update((state) => ({
    ...state,
    pendingResult: data,
  }));
}

/**
 * Commit pending result to main data.
 */
export function commitPendingEnrichmentResult(): void {
  store.update((state) => {
    if (!state.pendingResult) return state;
    return {
      ...state,
      data: state.pendingResult,
      pendingResult: null,
      isEnriching: false,
      streamingFields: new Map(),
    };
  });

  persistEnrichmentState(true);
}

/**
 * Clear enrichment state.
 */
export function clearEnrichment(): void {
  store.set(initialState);
  persistEnrichmentState();
}

/**
 * Full reset of enrichment state.
 */
export function resetEnrichment(): void {
  store.set(initialState);
  persistEnrichmentState(true);
}

// ===========================================
// Initialization
// ===========================================

/**
 * Restore enrichment state from persistence.
 */
export function restoreFromPersistence(data: {
  data: EnrichmentData | null;
}): void {
  store.set({
    ...initialState,
    data: data.data,
    // Note: isEnriching is NOT restored (prevents orphan loading states)
  });
}

// ===========================================
// Persistence
// ===========================================

function persistEnrichmentState(immediate = false): void {
  const state = get(store);

  persistState(
    {
      enrichmentData: state.data,
    },
    immediate
  );
}

// ===========================================
// Getters (for action handler)
// ===========================================

export function getCurrentState(): EnrichmentState {
  return get(store);
}

export function getData(): EnrichmentData | null {
  return get(store).data;
}

export function getForWine(): EnrichmentWineInfo | null {
  return get(store).forWine;
}

// ===========================================
// Debug
// ===========================================

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  store.subscribe((state) => {
    console.debug('[AgentEnrichment]', {
      isEnriching: state.isEnriching,
      hasData: state.data !== null,
      source: state.source,
      streamingFieldCount: state.streamingFields.size,
      forWine: state.forWine?.wineName,
    });
  });
}
