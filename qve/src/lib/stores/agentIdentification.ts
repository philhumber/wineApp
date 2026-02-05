/**
 * Agent Identification Store
 *
 * Handles:
 * - Identification loading state
 * - Last result
 * - Streaming fields
 * - Error state
 * - Augmentation context
 *
 * Part of the Phase 4 store split from the monolithic agent.ts
 */

import { writable, derived, get } from 'svelte/store';
import { persistState, loadState } from './agentPersistence';
import type {
  WineIdentificationResult,
  AgentErrorInfo,
  StreamingField,
} from '$lib/agent/types';

// ===========================================
// Types
// ===========================================

export interface AugmentationContext {
  originalInput?: string;
  imageData?: string;
  imageMimeType?: string;
  conversationHistory?: string[];
}

export interface ImageData {
  data: string;
  mimeType: string;
}

interface IdentificationState {
  isIdentifying: boolean;
  result: WineIdentificationResult | null;
  error: AgentErrorInfo | null;
  confidence: number | null;
  streamingFields: Map<string, StreamingField>;
  augmentationContext: AugmentationContext | null;
  pendingNewSearch: string | null;
  pendingBriefSearch: string | null;
  lastImageData: ImageData | null;
  inputType: 'text' | 'image' | null;
  isEscalating: boolean;
  escalationTier: number;
}

// ===========================================
// Initial State
// ===========================================

const initialState: IdentificationState = {
  isIdentifying: false,
  result: null,
  error: null,
  confidence: null,
  streamingFields: new Map(),
  augmentationContext: null,
  pendingNewSearch: null,
  pendingBriefSearch: null,
  lastImageData: null,
  inputType: null,
  isEscalating: false,
  escalationTier: 1,
};

const store = writable<IdentificationState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const isIdentifying = derived(store, ($s) => $s.isIdentifying);
export const identificationResult = derived(store, ($s) => $s.result);
export const identificationError = derived(store, ($s) => $s.error);
export const identificationConfidence = derived(store, ($s) => $s.confidence);
export const streamingFields = derived(store, ($s) => $s.streamingFields);
export const augmentationContext = derived(store, ($s) => $s.augmentationContext);
export const hasAugmentationContext = derived(store, ($s) => $s.augmentationContext !== null);
export const pendingNewSearch = derived(store, ($s) => $s.pendingNewSearch);
export const pendingBriefSearch = derived(store, ($s) => $s.pendingBriefSearch);
export const lastImageData = derived(store, ($s) => $s.lastImageData);
export const inputType = derived(store, ($s) => $s.inputType);
export const isEscalating = derived(store, ($s) => $s.isEscalating);
export const escalationTier = derived(store, ($s) => $s.escalationTier);

// Computed derived stores
export const hasResult = derived(store, ($s) => $s.result !== null);
export const isStreaming = derived(
  store,
  ($s) => $s.streamingFields.size > 0 && [...$s.streamingFields.values()].some((f) => f.isTyping)
);
export const isLowConfidence = derived(
  store,
  ($s) => $s.confidence !== null && $s.confidence < 0.7
);

// ===========================================
// Actions
// ===========================================

/**
 * Start identification process.
 */
export function startIdentification(inputType: 'text' | 'image'): void {
  store.update((state) => ({
    ...state,
    isIdentifying: true,
    error: null,
    inputType,
    streamingFields: new Map(),
    escalationTier: 1,
    isEscalating: false,
  }));
}

/**
 * Set the identification result.
 */
export function setResult(
  result: WineIdentificationResult,
  confidence?: number
): void {
  store.update((state) => ({
    ...state,
    isIdentifying: false,
    result,
    confidence: confidence ?? null,
    error: null,
    streamingFields: new Map(), // Clear streaming on final result
  }));

  // Persist immediately (critical state)
  persistIdentificationState(true);
}

/**
 * Set identification error.
 */
export function setError(error: AgentErrorInfo): void {
  store.update((state) => ({
    ...state,
    isIdentifying: false,
    error,
    streamingFields: new Map(),
    isEscalating: false,
  }));
}

/**
 * Clear error state.
 */
export function clearError(): void {
  store.update((state) => ({
    ...state,
    error: null,
  }));
}

/**
 * Update a streaming field.
 */
export function updateStreamingField(
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
 * Mark a streaming field as complete.
 */
export function completeStreamingField(fieldName: string): void {
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
export function clearStreamingFields(): void {
  store.update((state) => ({
    ...state,
    streamingFields: new Map(),
  }));
}

/**
 * Set augmentation context (for "Not Correct" flow).
 */
export function setAugmentationContext(context: AugmentationContext): void {
  store.update((state) => ({
    ...state,
    augmentationContext: context,
  }));

  persistIdentificationState(true);
}

/**
 * Clear augmentation context.
 */
export function clearAugmentationContext(): void {
  store.update((state) => ({
    ...state,
    augmentationContext: null,
  }));

  persistIdentificationState();
}

/**
 * Set pending new search (for confirmation flow).
 */
export function setPendingNewSearch(text: string | null): void {
  store.update((state) => ({
    ...state,
    pendingNewSearch: text,
  }));

  // Immediate persist - critical for mobile tab switches
  persistIdentificationState(true);
}

/**
 * Set pending brief search (for "Search Anyway" confirmation).
 */
export function setPendingBriefSearch(text: string | null): void {
  store.update((state) => ({
    ...state,
    pendingBriefSearch: text,
  }));

  // Persist for mobile tab switch survival (same as pendingNewSearch)
  persistIdentificationState(true);
}

/**
 * Get and clear pending brief search (atomic operation for handlers).
 */
export function consumePendingBriefSearch(): string | null {
  const state = get(store);
  const text = state.pendingBriefSearch;
  if (text) {
    store.update((s) => ({ ...s, pendingBriefSearch: null }));
  }
  return text;
}

/**
 * Set last image data.
 */
export function setLastImageData(data: string, mimeType: string): void {
  store.update((state) => ({
    ...state,
    lastImageData: { data, mimeType },
  }));
}

/**
 * Clear last image data.
 */
export function clearLastImageData(): void {
  store.update((state) => ({
    ...state,
    lastImageData: null,
  }));
}

/**
 * Start escalation to higher tier.
 */
export function startEscalation(tier: number): void {
  store.update((state) => ({
    ...state,
    isEscalating: true,
    escalationTier: tier,
  }));
}

/**
 * Complete escalation.
 */
export function completeEscalation(): void {
  store.update((state) => ({
    ...state,
    isEscalating: false,
  }));
}

/**
 * Clear identification state (but preserve context if needed).
 */
export function clearIdentification(preserveContext = false): void {
  store.update((state) => ({
    ...initialState,
    augmentationContext: preserveContext ? state.augmentationContext : null,
    lastImageData: preserveContext ? state.lastImageData : null,
  }));

  persistIdentificationState();
}

/**
 * Full reset of identification state.
 */
export function resetIdentification(): void {
  store.set(initialState);
  persistIdentificationState(true);
}

// ===========================================
// Initialization
// ===========================================

/**
 * Restore identification state from persistence.
 */
export function restoreFromPersistence(data: {
  result: WineIdentificationResult | null;
  augmentationContext: AugmentationContext | null;
  pendingNewSearch: string | null;
  pendingBriefSearch?: string | null;
  imageData: { data: string; mimeType: string } | null;
}): void {
  store.set({
    ...initialState,
    result: data.result,
    augmentationContext: data.augmentationContext,
    pendingNewSearch: data.pendingNewSearch,
    pendingBriefSearch: data.pendingBriefSearch ?? null,
    lastImageData: data.imageData,
    // Note: isIdentifying is NOT restored (prevents orphan loading states)
    confidence: data.result?.confidence ?? null,
  });
}

// ===========================================
// Persistence
// ===========================================

function persistIdentificationState(immediate = false): void {
  const state = get(store);

  persistState(
    {
      identificationResult: state.result,
      augmentationContext: state.augmentationContext,
      pendingNewSearch: state.pendingNewSearch,
      pendingBriefSearch: state.pendingBriefSearch,
      imageData: state.lastImageData,
    },
    immediate
  );
}

// ===========================================
// Getters (for action handler)
// ===========================================

export function getCurrentState(): IdentificationState {
  return get(store);
}

export function getResult(): WineIdentificationResult | null {
  return get(store).result;
}

export function getAugmentationContext(): AugmentationContext | null {
  return get(store).augmentationContext;
}

// ===========================================
// Debug
// ===========================================

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  store.subscribe((state) => {
    console.debug('[AgentIdentification]', {
      isIdentifying: state.isIdentifying,
      hasResult: state.result !== null,
      confidence: state.confidence,
      streamingFieldCount: state.streamingFields.size,
      hasAugmentation: state.augmentationContext !== null,
    });
  });
}
