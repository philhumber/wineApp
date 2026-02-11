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
  forWine: EnrichmentWineInfo | null;
  lastRequest: EnrichmentRequest | null; // For retry support
}

// ===========================================
// Initial State
// ===========================================

const initialState: EnrichmentState = {
  isEnriching: false,
  data: null,
  error: null,
  source: null,
  forWine: null,
  lastRequest: null,
};

const store = writable<EnrichmentState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const isEnriching = derived(store, ($s) => $s.isEnriching);
export const enrichmentData = derived(store, ($s) => $s.data);
export const enrichmentError = derived(store, ($s) => $s.error);
export const enrichmentSource = derived(store, ($s) => $s.source);
export const enrichmentForWine = derived(store, ($s) => $s.forWine);
export const lastEnrichmentRequest = derived(store, ($s) => $s.lastRequest);

// Computed derived stores
export const hasEnrichmentData = derived(store, ($s) => $s.data !== null);

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
 * Clear enriching state (WIN-187: for cancellation).
 * Stops the loading indicator without clearing data.
 */
export function clearEnriching(): void {
  store.update((state) => ({
    ...state,
    isEnriching: false,
  }));
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
      forWine: state.forWine?.wineName,
    });
  });
}
