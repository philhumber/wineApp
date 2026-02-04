/**
 * Agent Persistence Coordinator
 *
 * Centralizes session persistence across all agent stores.
 * Addresses Phase 4 review findings:
 * - Cross-store coordination
 * - Ordered restoration (identification → enrichment → addWine → conversation)
 * - Unified storage key
 * - Quota handling with graceful degradation
 * - Loading state reset on hydration
 */

import { writable, get } from 'svelte/store';
import type {
  AgentMessage,
  AgentPhase,
  AddWineStep,
  WineIdentificationResult,
  EnrichmentData,
} from '$lib/agent/types';

// ===========================================
// Types
// ===========================================

export interface PersistedState {
  version: number;

  // Conversation state
  messages: AgentMessage[];
  phase: AgentPhase;
  addWineStep: AddWineStep | null;

  // Identification state
  identificationResult: WineIdentificationResult | null;
  augmentationContext: AugmentationContext | null;
  pendingNewSearch: string | null;

  // Enrichment state
  enrichmentData: EnrichmentData | null;

  // AddWine state
  addWineState: AddWineStateSlice | null;

  // Image data (separate for quota handling)
  imageData: ImageDataSlice | null;

  // Timestamps
  lastActivityAt: number;
}

export interface AugmentationContext {
  originalInput?: string;
  imageData?: string;
  conversationHistory?: string[];
}

export interface AddWineStateSlice {
  existingWineId?: number;
  selectedRegionId?: number;
  selectedProducerId?: number;
  selectedWineId?: number;
  bottleFormData?: Record<string, unknown>;
  entityMatchStep?: 'region' | 'producer' | 'wine';
}

export interface ImageDataSlice {
  data: string;
  mimeType: string;
}

// ===========================================
// Constants
// ===========================================

const STORAGE_KEY = 'agent_session_v2';
const CURRENT_VERSION = 2;
const MAX_MESSAGES = 30;
const DEBOUNCE_MS = 500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ===========================================
// State
// ===========================================

const isPersisting = writable(false);
const lastPersistError = writable<string | null>(null);

// Debounce timer
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// ===========================================
// Storage Helpers
// ===========================================

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    // Test that sessionStorage is available
    sessionStorage.setItem('test', 'test');
    sessionStorage.removeItem('test');
    return sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return localStorage;
  } catch {
    return null;
  }
}

// ===========================================
// Persistence Functions
// ===========================================

/**
 * Persist state to sessionStorage with debouncing.
 * Call this whenever state changes.
 */
export function persistState(state: Partial<PersistedState>, immediate = false): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  const doPersist = () => {
    const storage = getStorage();
    if (!storage) return;

    isPersisting.set(true);
    lastPersistError.set(null);

    try {
      // Load existing state and merge
      const existing = loadStateRaw() ?? createEmptyState();
      const merged: PersistedState = {
        ...existing,
        ...state,
        version: CURRENT_VERSION,
        lastActivityAt: Date.now(),
      };

      // Trim messages if needed
      if (merged.messages.length > MAX_MESSAGES) {
        merged.messages = merged.messages.slice(-MAX_MESSAGES);
      }

      // Try to save
      const json = JSON.stringify(merged);
      storage.setItem(STORAGE_KEY, json);
    } catch (e) {
      // Quota exceeded - try graceful degradation
      if (isQuotaError(e)) {
        persistWithDegradation(state);
      } else {
        lastPersistError.set(e instanceof Error ? e.message : 'Unknown error');
        console.error('[AgentPersistence] Failed to persist:', e);
      }
    } finally {
      isPersisting.set(false);
    }
  };

  if (immediate) {
    doPersist();
  } else {
    persistTimer = setTimeout(doPersist, DEBOUNCE_MS);
  }
}

/**
 * When quota is exceeded, drop data in order of importance:
 * 1. Image data (largest)
 * 2. Enrichment data
 * 3. Old messages (keep last 10)
 */
function persistWithDegradation(state: Partial<PersistedState>): void {
  const storage = getStorage();
  if (!storage) return;

  const existing = loadStateRaw() ?? createEmptyState();
  let merged: PersistedState = {
    ...existing,
    ...state,
    version: CURRENT_VERSION,
    lastActivityAt: Date.now(),
  };

  // Step 1: Drop image data
  merged.imageData = null;
  if (tryPersist(storage, merged)) return;

  // Step 2: Drop enrichment data
  merged.enrichmentData = null;
  if (tryPersist(storage, merged)) return;

  // Step 3: Keep only last 10 messages
  merged.messages = merged.messages.slice(-10);
  if (tryPersist(storage, merged)) return;

  // Step 4: Clear everything except critical state
  merged.messages = [];
  merged.augmentationContext = null;
  merged.addWineState = null;
  tryPersist(storage, merged);

  console.warn('[AgentPersistence] Quota exceeded, degraded persistence applied');
}

function tryPersist(storage: Storage, state: PersistedState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.code === 22)
  );
}

// ===========================================
// Load Functions
// ===========================================

function loadStateRaw(): PersistedState | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const json = storage.getItem(STORAGE_KEY);
    if (!json) return null;

    const state = JSON.parse(json) as PersistedState;
    return state;
  } catch {
    return null;
  }
}

/**
 * Load and hydrate persisted state.
 * Returns null if no valid state exists or session has expired.
 * Resets loading states on hydration (prevents orphan loading indicators).
 */
export function loadState(): PersistedState | null {
  const state = loadStateRaw();
  if (!state) return null;

  // Check version
  if (state.version !== CURRENT_VERSION) {
    console.log('[AgentPersistence] Version mismatch, clearing state');
    clearState();
    return null;
  }

  // Check session timeout
  if (Date.now() - state.lastActivityAt > SESSION_TIMEOUT_MS) {
    console.log('[AgentPersistence] Session expired, clearing state');
    clearState();
    return null;
  }

  // Reset orphaned loading states
  // (prevents UI stuck in loading after tab switch)
  const hydrated: PersistedState = {
    ...state,
    // If phase was 'identifying' or similar loading phase, reset to previous safe phase
    phase: resetLoadingPhase(state.phase),
  };

  return hydrated;
}

/**
 * Reset phases that represent loading states.
 * Called on hydration to prevent orphan loading indicators.
 */
function resetLoadingPhase(phase: AgentPhase): AgentPhase {
  // These phases indicate "in progress" operations that won't resume
  const loadingPhases: AgentPhase[] = ['identifying', 'enriching'];

  if (loadingPhases.includes(phase)) {
    // Reset to a safe phase based on context
    // In a real implementation, we'd check if there's a result
    return 'awaiting_input';
  }

  return phase;
}

/**
 * Clear all persisted state.
 */
export function clearState(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
}

/**
 * Create empty initial state.
 */
export function createEmptyState(): PersistedState {
  return {
    version: CURRENT_VERSION,
    messages: [],
    phase: 'greeting',
    addWineStep: null,
    identificationResult: null,
    augmentationContext: null,
    pendingNewSearch: null,
    enrichmentData: null,
    addWineState: null,
    imageData: null,
    lastActivityAt: Date.now(),
  };
}

// ===========================================
// Panel State (localStorage - persists across sessions)
// ===========================================

const PANEL_STATE_KEY = 'agent_panel_state';

export interface PanelState {
  isOpen: boolean;
}

export function loadPanelState(): PanelState {
  const storage = getLocalStorage();
  if (!storage) return { isOpen: false };

  try {
    const json = storage.getItem(PANEL_STATE_KEY);
    if (!json) return { isOpen: false };
    return JSON.parse(json);
  } catch {
    return { isOpen: false };
  }
}

export function persistPanelState(state: PanelState): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors for panel state
  }
}

// ===========================================
// Restore Functions (Ordered)
// ===========================================

/**
 * Restore all stores from persisted state.
 * Order matters: identification → enrichment → addWine → conversation
 *
 * Returns callbacks for each store to call during initialization.
 */
export function createRestoreCallbacks(state: PersistedState): RestoreCallbacks {
  return {
    restoreIdentification: () => ({
      result: state.identificationResult,
      augmentationContext: state.augmentationContext,
      pendingNewSearch: state.pendingNewSearch,
      imageData: state.imageData,
    }),

    restoreEnrichment: () => ({
      data: state.enrichmentData,
    }),

    restoreAddWine: () => ({
      state: state.addWineState,
    }),

    restoreConversation: () => ({
      messages: state.messages,
      phase: state.phase,
      addWineStep: state.addWineStep,
    }),
  };
}

export interface RestoreCallbacks {
  restoreIdentification: () => {
    result: WineIdentificationResult | null;
    augmentationContext: AugmentationContext | null;
    pendingNewSearch: string | null;
    imageData: ImageDataSlice | null;
  };
  restoreEnrichment: () => {
    data: EnrichmentData | null;
  };
  restoreAddWine: () => {
    state: AddWineStateSlice | null;
  };
  restoreConversation: () => {
    messages: AgentMessage[];
    phase: AgentPhase;
    addWineStep: AddWineStep | null;
  };
}

// ===========================================
// Exports
// ===========================================

export { isPersisting, lastPersistError };
