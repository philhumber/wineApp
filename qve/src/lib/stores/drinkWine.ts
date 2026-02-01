/**
 * Drink Wine Store
 * Manages the drink/rate modal state
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api/client';
import { toasts } from './toast';
import type { Wine, Bottle, DrunkWine, DrinkBottlePayload, UpdateRatingPayload } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type OptionalRatingType = 'complexity' | 'drinkability' | 'surprise' | 'foodPairing';

export interface DrinkWineState {
  // Wine context
  wineID: number | null;
  wineName: string;
  wineRegion: string;
  wineCountry: string;
  wineImage: string | null;
  wineYear: string | null;

  // Bottle selection
  bottleID: number | null;
  availableBottles: Bottle[];

  // Main ratings (required, 1-10)
  overallRating: number;
  valueRating: number;

  // Optional ratings (0-5, 0 = not set)
  complexityRating: number;
  drinkabilityRating: number;
  surpriseRating: number;
  foodPairingRating: number;
  showMoreRatings: boolean;

  // Other fields
  drinkDate: string;
  buyAgain: boolean;
  notes: string;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;

  // Edit mode
  isEditMode: boolean;
  ratingID: number | null;

  // Original values for dirty checking in edit mode
  originalValues: {
    overallRating: number;
    valueRating: number;
    complexityRating: number;
    drinkabilityRating: number;
    surpriseRating: number;
    foodPairingRating: number;
    drinkDate: string;
    buyAgain: boolean;
    notes: string;
  } | null;
}

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

function getInitialState(): DrinkWineState {
  const today = new Date().toISOString().split('T')[0];

  return {
    wineID: null,
    wineName: '',
    wineRegion: '',
    wineCountry: '',
    wineImage: null,
    wineYear: null,

    bottleID: null,
    availableBottles: [],

    overallRating: 0,
    valueRating: 0,

    complexityRating: 0,
    drinkabilityRating: 0,
    surpriseRating: 0,
    foodPairingRating: 0,
    showMoreRatings: false,

    drinkDate: today,
    buyAgain: true,
    notes: '',

    isLoading: false,
    isSubmitting: false,
    errors: {},

    isEditMode: false,
    ratingID: null,
    originalValues: null
  };
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createDrinkWineStore() {
  const { subscribe, set, update } = writable<DrinkWineState>(getInitialState());

  return {
    subscribe,

    /**
     * Initialize the store with a wine and load its bottles
     */
    init: async (wine: Wine): Promise<void> => {
      const today = new Date().toISOString().split('T')[0];

      update((s) => ({
        ...getInitialState(),
        wineID: wine.wineID,
        wineName: wine.wineName,
        wineRegion: wine.regionName,
        wineCountry: wine.countryName,
        wineImage: wine.pictureURL,
        wineYear: wine.year,
        drinkDate: today,
        isLoading: true
      }));

      try {
        const bottles = await api.getBottles(wine.wineID);
        update((s) => ({
          ...s,
          availableBottles: bottles,
          bottleID: bottles.length === 1 ? bottles[0].bottleID : null,
          isLoading: false
        }));
      } catch (error) {
        console.error('Failed to load bottles:', error);
        toasts.error('Failed to load bottles');
        update((s) => ({
          ...s,
          availableBottles: [],
          isLoading: false
        }));
      }
    },

    /**
     * Initialize the store for editing an existing rating
     */
    initEdit: (drunkWine: DrunkWine): void => {
      // Determine if optional ratings section should be expanded
      const hasOptionalRatings =
        (drunkWine.complexityRating && drunkWine.complexityRating > 0) ||
        (drunkWine.drinkabilityRating && drunkWine.drinkabilityRating > 0) ||
        (drunkWine.surpriseRating && drunkWine.surpriseRating > 0) ||
        (drunkWine.foodPairingRating && drunkWine.foodPairingRating > 0);

      // Date from DB is already in YYYY-MM-DD format, use directly
      const drinkDate = drunkWine.drinkDate || new Date().toISOString().split('T')[0];

      // Store original values for dirty checking
      const originalValues = {
        overallRating: drunkWine.overallRating || 0,
        valueRating: drunkWine.valueRating || 0,
        complexityRating: drunkWine.complexityRating || 0,
        drinkabilityRating: drunkWine.drinkabilityRating || 0,
        surpriseRating: drunkWine.surpriseRating || 0,
        foodPairingRating: drunkWine.foodPairingRating || 0,
        drinkDate,
        buyAgain: drunkWine.buyAgain === 1,
        notes: drunkWine.notes || ''
      };

      set({
        wineID: drunkWine.wineID,
        wineName: drunkWine.wineName,
        wineRegion: drunkWine.regionName,
        wineCountry: drunkWine.countryName,
        wineImage: drunkWine.pictureURL,
        wineYear: drunkWine.year,

        // Bottle is already determined in edit mode
        bottleID: drunkWine.bottleID,
        availableBottles: [],

        // Pre-populate ratings
        overallRating: originalValues.overallRating,
        valueRating: originalValues.valueRating,

        complexityRating: originalValues.complexityRating,
        drinkabilityRating: originalValues.drinkabilityRating,
        surpriseRating: originalValues.surpriseRating,
        foodPairingRating: originalValues.foodPairingRating,
        showMoreRatings: !!hasOptionalRatings,

        drinkDate: originalValues.drinkDate,
        buyAgain: originalValues.buyAgain,
        notes: originalValues.notes,

        isLoading: false,
        isSubmitting: false,
        errors: {},

        isEditMode: true,
        ratingID: drunkWine.ratingID,
        originalValues
      });
    },

    /**
     * Select a bottle
     */
    selectBottle: (bottleID: number): void => {
      update((s) => ({
        ...s,
        bottleID,
        errors: { ...s.errors, bottleID: '' }
      }));
    },

    /**
     * Set overall rating (1-10)
     */
    setOverallRating: (value: number): void => {
      update((s) => ({
        ...s,
        overallRating: Math.max(0, Math.min(10, value)),
        errors: { ...s.errors, overallRating: '' }
      }));
    },

    /**
     * Set value rating (1-10)
     */
    setValueRating: (value: number): void => {
      update((s) => ({
        ...s,
        valueRating: Math.max(0, Math.min(10, value)),
        errors: { ...s.errors, valueRating: '' }
      }));
    },

    /**
     * Set optional rating (0-5)
     */
    setOptionalRating: (type: OptionalRatingType, value: number): void => {
      const key = `${type}Rating` as keyof DrinkWineState;
      update((s) => ({
        ...s,
        [key]: Math.max(0, Math.min(5, value))
      }));
    },

    /**
     * Toggle the "More ratings" section
     */
    toggleMoreRatings: (): void => {
      update((s) => ({
        ...s,
        showMoreRatings: !s.showMoreRatings
      }));
    },

    /**
     * Set drink date (YYYY-MM-DD format)
     */
    setDrinkDate: (date: string): void => {
      update((s) => ({
        ...s,
        drinkDate: date
      }));
    },

    /**
     * Toggle buy again
     */
    toggleBuyAgain: (): void => {
      update((s) => ({
        ...s,
        buyAgain: !s.buyAgain
      }));
    },

    /**
     * Set tasting notes
     */
    setNotes: (notes: string): void => {
      update((s) => ({
        ...s,
        notes
      }));
    },

    /**
     * Validate required fields
     */
    validate: (): boolean => {
      const state = get({ subscribe });
      const errors: Record<string, string> = {};

      // Skip bottle validation in edit mode (bottle already determined)
      if (!state.isEditMode && !state.bottleID) {
        errors.bottleID = 'Please select a bottle';
      }

      if (state.overallRating < 1 || state.overallRating > 10) {
        errors.overallRating = 'Please rate the wine (1-10)';
      }

      if (state.valueRating < 1 || state.valueRating > 10) {
        errors.valueRating = 'Please rate the value (1-10)';
      }

      update((s) => ({ ...s, errors }));

      return Object.keys(errors).length === 0;
    },

    /**
     * Submit the rating (handles both new ratings and edits)
     */
    submit: async (): Promise<{ success: boolean; wineID?: number; isEdit?: boolean }> => {
      const state = get({ subscribe });
      const errors: Record<string, string> = {};

      // Validate required fields (skip bottleID in edit mode)
      if (!state.isEditMode && !state.bottleID) {
        errors.bottleID = 'Please select a bottle';
      }

      if (state.overallRating < 1 || state.overallRating > 10) {
        errors.overallRating = 'Please rate the wine (1-10)';
      }

      if (state.valueRating < 1 || state.valueRating > 10) {
        errors.valueRating = 'Please rate the value (1-10)';
      }

      // If validation fails, show error and return
      if (Object.keys(errors).length > 0) {
        update((s) => ({ ...s, errors }));
        const firstError = Object.values(errors)[0];
        if (firstError) {
          toasts.error(firstError);
        }
        return { success: false };
      }

      update((s) => ({ ...s, isSubmitting: true }));

      try {
        // Format date from YYYY-MM-DD to DD/MM/YYYY for PHP backend
        const [year, month, day] = state.drinkDate.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        // Common payload fields
        const basePayload = {
          wineID: state.wineID!,
          bottleID: state.bottleID!,
          overallRating: state.overallRating,
          valueRating: state.valueRating,
          drinkDate: formattedDate,
          buyAgain: state.buyAgain ? 1 : 0 as 0 | 1,
          notes: state.notes || undefined,
          // Optional ratings (only send if > 0)
          complexityRating: state.complexityRating > 0 ? state.complexityRating : undefined,
          drinkabilityRating: state.drinkabilityRating > 0 ? state.drinkabilityRating : undefined,
          surpriseRating: state.surpriseRating > 0 ? state.surpriseRating : undefined,
          foodPairingRating: state.foodPairingRating > 0 ? state.foodPairingRating : undefined
        };

        if (state.isEditMode) {
          // Update existing rating
          const updatePayload: UpdateRatingPayload = {
            ratingID: state.ratingID!,
            ...basePayload
          };
          await api.updateRating(updatePayload);
          toasts.success('Rating updated!');
        } else {
          // Create new rating
          const drinkPayload: DrinkBottlePayload = basePayload;
          await api.drinkBottle(drinkPayload);

          // Success message based on rating
          if (state.overallRating >= 8) {
            toasts.success('Cheers! Great wine!');
          } else if (state.overallRating >= 5) {
            toasts.success('Rating saved!');
          } else {
            toasts.success('Rating saved. Maybe try a different wine next time!');
          }
        }

        const wineID = state.wineID;
        const isEdit = state.isEditMode;
        update((s) => ({ ...s, isSubmitting: false }));

        return { success: true, wineID: wineID ?? undefined, isEdit };
      } catch (error) {
        console.error('Failed to submit rating:', error);
        toasts.error(state.isEditMode ? 'Failed to update rating.' : 'Failed to save rating. Please try again.');
        update((s) => ({ ...s, isSubmitting: false }));
        return { success: false };
      }
    },

    /**
     * Reset the store to initial state
     */
    reset: (): void => {
      set(getInitialState());
    }
  };
}

export const drinkWine = createDrinkWineStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Check if the form has any changes from initial state */
export const isDirty = derived(drinkWine, ($state) => {
  // In edit mode, compare against original values
  if ($state.isEditMode && $state.originalValues) {
    const orig = $state.originalValues;
    return (
      $state.overallRating !== orig.overallRating ||
      $state.valueRating !== orig.valueRating ||
      $state.complexityRating !== orig.complexityRating ||
      $state.drinkabilityRating !== orig.drinkabilityRating ||
      $state.surpriseRating !== orig.surpriseRating ||
      $state.foodPairingRating !== orig.foodPairingRating ||
      $state.drinkDate !== orig.drinkDate ||
      $state.buyAgain !== orig.buyAgain ||
      $state.notes !== orig.notes
    );
  }

  // In new rating mode, check if any fields have values
  return (
    $state.bottleID !== null ||
    $state.overallRating > 0 ||
    $state.valueRating > 0 ||
    $state.notes !== '' ||
    $state.complexityRating > 0 ||
    $state.drinkabilityRating > 0 ||
    $state.surpriseRating > 0 ||
    $state.foodPairingRating > 0
  );
});

/** Check if both required ratings are set */
export const canSubmit = derived(drinkWine, ($state) => {
  // In edit mode, bottleID is already set
  const hasBottle = $state.isEditMode || $state.bottleID !== null;
  return (
    hasBottle &&
    $state.overallRating >= 1 &&
    $state.overallRating <= 10 &&
    $state.valueRating >= 1 &&
    $state.valueRating <= 10 &&
    !$state.isSubmitting
  );
});

/** Get the selected bottle details */
export const selectedBottle = derived(drinkWine, ($state) => {
  if (!$state.bottleID) return null;
  return $state.availableBottles.find((b) => b.bottleID === $state.bottleID) || null;
});
