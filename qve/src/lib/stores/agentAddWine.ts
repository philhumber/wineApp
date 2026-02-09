/**
 * Agent Add Wine Store
 *
 * Handles:
 * - Add-to-cellar flow state
 * - Entity matching (region, producer, wine)
 * - Bottle form data
 * - Duplicate detection
 * - Submission
 *
 * Part of the Phase 4 store split from the monolithic agent.ts
 */

import { writable, derived, get } from 'svelte/store';
import { persistState } from './agentPersistence';
import { validateRequired, validateLength, validatePriceCurrency, FIELD_MAX_LENGTHS } from '$lib/utils/validation';
import type {
  WineIdentificationResult,
  BottleFormData,
  AgentErrorInfo,
  AddWineStep,
  EntityType,
} from '$lib/agent/types';

// ===========================================
// Types
// ===========================================

export interface EntityMatch {
  id: number;
  name: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface SelectedEntities {
  region: { id: number; name: string } | null;
  producer: { id: number; name: string } | null;
  wine: { id: number; name: string } | null;
}

export interface AddWineFlowState {
  // Source wine data
  wineResult: WineIdentificationResult;

  // Current step in the flow
  step: AddWineStep;

  // Entity matching state
  currentEntityType: EntityType | null;
  entityMatches: Record<EntityType, EntityMatch[]>;
  selectedEntities: SelectedEntities;
  newEntities: Partial<Record<EntityType, string>>;

  // Duplicate handling
  existingWineId: number | null;
  existingBottleCount: number;

  // Bottle form
  bottleFormData: BottleFormData;
  bottleFormStep: 1 | 2;

  // Enrichment choice
  enrichNow: boolean;

  // Status
  isSubmitting: boolean;
  error: AgentErrorInfo | null;
  addedWineId: number | null;

  // Validation errors
  errors: {
    bottle: Record<string, string>;
    manual: Record<string, string>;
  };
}

// ===========================================
// Initial State
// ===========================================

const initialFlowState: AddWineFlowState | null = null;

interface AddWineState {
  flow: AddWineFlowState | null;
}

const initialState: AddWineState = {
  flow: null,
};

const store = writable<AddWineState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const addWineFlow = derived(store, ($s) => $s.flow);
export const isInAddWineFlow = derived(store, ($s) => $s.flow !== null);
export const isAddingWine = derived(store, ($s) => $s.flow?.isSubmitting ?? false);

// Current step
export const addWineStep = derived(store, ($s) => $s.flow?.step ?? null);

// Entity matching
export const currentEntityType = derived(store, ($s) => $s.flow?.currentEntityType ?? null);
export const entityMatches = derived(store, ($s) => $s.flow?.entityMatches ?? {
  region: [],
  producer: [],
  wine: [],
});
export const selectedEntities = derived(store, ($s) => $s.flow?.selectedEntities ?? {
  region: null,
  producer: null,
  wine: null,
});

// Duplicate state
export const existingWineId = derived(store, ($s) => $s.flow?.existingWineId ?? null);
export const existingBottleCount = derived(store, ($s) => $s.flow?.existingBottleCount ?? 0);
export const hasDuplicate = derived(store, ($s) => $s.flow !== null && $s.flow.existingWineId !== null);

// Bottle form
export const bottleFormData = derived(store, ($s) => $s.flow?.bottleFormData ?? {});
export const bottleFormStep = derived(store, ($s) => $s.flow?.bottleFormStep ?? 1);

// Error state
export const addWineError = derived(store, ($s) => $s.flow?.error ?? null);
export const addedWineId = derived(store, ($s) => $s.flow?.addedWineId ?? null);

// ===========================================
// Actions
// ===========================================

/**
 * Start the add wine flow with an identification result.
 */
export function startAddFlow(wineResult: WineIdentificationResult): void {
  store.set({
    flow: {
      wineResult,
      step: 'confirm',
      currentEntityType: null,
      entityMatches: {
        region: [],
        producer: [],
        wine: [],
      },
      selectedEntities: {
        region: null,
        producer: null,
        wine: null,
      },
      newEntities: {},
      existingWineId: null,
      existingBottleCount: 0,
      bottleFormData: {},
      bottleFormStep: 1,
      enrichNow: false,
      isSubmitting: false,
      error: null,
      addedWineId: null,
      errors: { bottle: {}, manual: {} },
    },
  });

  persistAddWineState();
}

/**
 * Set current step in the flow.
 */
export function setAddWineStep(step: AddWineStep): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: { ...state.flow, step },
    };
  });

  persistAddWineState();
}

/**
 * Set entity matches for a given type.
 */
export function setEntityMatches(entityType: EntityType, matches: EntityMatch[]): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        currentEntityType: entityType,
        entityMatches: {
          ...state.flow.entityMatches,
          [entityType]: matches,
        },
      },
    };
  });
}

/**
 * Select a matched entity.
 */
export function selectMatch(entityType: EntityType, match: EntityMatch): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        selectedEntities: {
          ...state.flow.selectedEntities,
          [entityType]: { id: match.id, name: match.name },
        },
        currentEntityType: null,
      },
    };
  });

  persistAddWineState();
}

/**
 * Select a matched entity by ID.
 */
export function selectMatchById(entityType: EntityType, matchId: number): void {
  const state = get(store);
  if (!state.flow) return;

  const matches = state.flow.entityMatches[entityType];
  const match = matches.find((m) => m.id === matchId);
  if (match) {
    selectMatch(entityType, match);
  }
}

/**
 * Create a new entity (when no match selected).
 */
export function createNewEntity(entityType: EntityType, name: string): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        newEntities: {
          ...state.flow.newEntities,
          [entityType]: name,
        },
        currentEntityType: null,
      },
    };
  });

  persistAddWineState();
}

/**
 * Set existing wine for duplicate handling.
 */
export function setExistingWine(wineId: number, bottleCount: number): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        existingWineId: wineId,
        existingBottleCount: bottleCount,
      },
    };
  });

  persistAddWineState();
}

/**
 * Clear existing wine (user chose to create new).
 */
export function clearExistingWine(): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        existingWineId: null,
        existingBottleCount: 0,
      },
    };
  });
}

/**
 * Update bottle form data.
 */
export function updateBottleFormData(data: Partial<BottleFormData>): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        bottleFormData: { ...state.flow.bottleFormData, ...data },
      },
    };
  });
}

/**
 * Set bottle form step.
 */
export function setBottleFormStep(step: 1 | 2): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: { ...state.flow, bottleFormStep: step },
    };
  });
}

/**
 * Set enrichment choice.
 */
export function setEnrichNow(enrichNow: boolean): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: { ...state.flow, enrichNow },
    };
  });
}

/**
 * Start submission.
 */
export function startSubmission(): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: { ...state.flow, isSubmitting: true, error: null },
    };
  });
}

/**
 * Complete submission successfully.
 */
export function completeSubmission(wineId: number): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: {
        ...state.flow,
        isSubmitting: false,
        addedWineId: wineId,
        step: 'complete',
      },
    };
  });

  persistAddWineState(true);
}

/**
 * Set submission error.
 */
export function setSubmissionError(error: AgentErrorInfo): void {
  store.update((state) => {
    if (!state.flow) return state;
    return {
      ...state,
      flow: { ...state.flow, isSubmitting: false, error },
    };
  });
}

/**
 * Cancel the add wine flow.
 */
export function cancelAddFlow(): void {
  store.set(initialState);
  persistAddWineState(true);
}

/**
 * Reset the add wine store.
 */
export function resetAddWine(): void {
  store.set(initialState);
  persistAddWineState(true);
}

// ===========================================
// Initialization
// ===========================================

/**
 * Restore add wine state from persistence.
 */
export function restoreFromPersistence(data: {
  state: {
    existingWineId?: number;
    selectedRegionId?: number;
    selectedProducerId?: number;
    selectedWineId?: number;
    bottleFormData?: Record<string, unknown>;
    entityMatchStep?: EntityType;
  } | null;
}): void {
  // For now, we don't fully restore add wine flow
  // (complex nested state that may be stale)
  // Just reset to initial state
  store.set(initialState);
}

// ===========================================
// Persistence
// ===========================================

function persistAddWineState(immediate = false): void {
  const state = get(store);

  if (!state.flow) {
    persistState({ addWineState: null }, immediate);
    return;
  }

  // Persist minimal state (not the full flow)
  // Convert null to undefined for persistence compatibility
  persistState(
    {
      addWineState: {
        existingWineId: state.flow.existingWineId ?? undefined,
        selectedRegionId: state.flow.selectedEntities.region?.id,
        selectedProducerId: state.flow.selectedEntities.producer?.id,
        selectedWineId: state.flow.selectedEntities.wine?.id,
        bottleFormData: state.flow.bottleFormData as Record<string, unknown>,
        entityMatchStep: state.flow.currentEntityType ?? undefined,
      },
    },
    immediate
  );
}

// ===========================================
// Getters (for action handler)
// ===========================================

export function getCurrentFlow(): AddWineFlowState | null {
  return get(store).flow;
}

export function getWineResult(): WineIdentificationResult | null {
  return get(store).flow?.wineResult ?? null;
}

export function getSelectedEntities(): SelectedEntities | null {
  return get(store).flow?.selectedEntities ?? null;
}

export function getBottleFormData(): BottleFormData {
  return get(store).flow?.bottleFormData ?? {};
}

// ===========================================
// Validation
// ===========================================

export function validateFieldBlur(form: 'bottle' | 'manual', field: string, value: string): void {
  let error: string | null = null;
  if (form === 'bottle') {
    switch (field) {
      case 'storageLocation':
        error = validateRequired(value, 'Storage location') ?? validateLength(value, FIELD_MAX_LENGTHS.storageLocation);
        break;
      case 'source':
        error = validateRequired(value, 'Source') ?? validateLength(value, FIELD_MAX_LENGTHS.source);
        break;
    }
  } else {
    switch (field) {
      case 'wineName':
        error = validateRequired(value, 'Wine name') ?? validateLength(value, FIELD_MAX_LENGTHS.wineName);
        break;
      case 'producer':
        error = validateRequired(value, 'Producer') ?? validateLength(value, FIELD_MAX_LENGTHS.producerName);
        break;
      case 'region':
        error = validateRequired(value, 'Region') ?? validateLength(value, FIELD_MAX_LENGTHS.regionName);
        break;
    }
  }
  store.update((state) => {
    if (!state.flow) return state;
    const formErrors = { ...state.flow.errors[form] };
    if (error) { formErrors[field] = error; } else { delete formErrors[field]; }
    return { ...state, flow: { ...state.flow, errors: { ...state.flow.errors, [form]: formErrors } } };
  });
}

export function validateBottleForm(): boolean {
  const state = get(store);
  if (!state.flow) return false;
  const errors: Record<string, string> = {};
  const data = state.flow.bottleFormData;
  if (!data.storageLocation?.trim()) errors.storageLocation = 'Storage location is required';
  if (!data.source?.trim()) errors.source = 'Source is required';
  const priceStr = data.price !== undefined ? String(data.price) : '';
  const priceCurrencyErrors = validatePriceCurrency(priceStr, data.currency);
  if (priceCurrencyErrors.price) errors.price = priceCurrencyErrors.price;
  if (priceCurrencyErrors.currency) errors.currency = priceCurrencyErrors.currency;
  store.update((s) => {
    if (!s.flow) return s;
    return { ...s, flow: { ...s.flow, errors: { ...s.flow.errors, bottle: errors } } };
  });
  return Object.keys(errors).length === 0;
}

export function clearError(form: 'bottle' | 'manual', field: string): void {
  store.update((state) => {
    if (!state.flow) return state;
    const formErrors = { ...state.flow.errors[form] };
    delete formErrors[field];
    return { ...state, flow: { ...state.flow, errors: { ...state.flow.errors, [form]: formErrors } } };
  });
}

export const addWineErrors = derived(store, ($s) => $s.flow?.errors ?? { bottle: {}, manual: {} });

// ===========================================
// Debug
// ===========================================

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  store.subscribe((state) => {
    if (state.flow) {
      console.debug('[AgentAddWine]', {
        step: state.flow.step,
        currentEntityType: state.flow.currentEntityType,
        existingWineId: state.flow.existingWineId,
        isSubmitting: state.flow.isSubmitting,
        selectedRegion: state.flow.selectedEntities.region?.name,
        selectedProducer: state.flow.selectedEntities.producer?.name,
        selectedWine: state.flow.selectedEntities.wine?.name,
      });
    } else {
      console.debug('[AgentAddWine] Not in add flow');
    }
  });
}
