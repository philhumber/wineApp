/**
 * Drink Wine Store
 * Manages the drink/rate modal state
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api/client';
import { toasts } from './toast';
import type { Wine, Bottle, DrinkBottlePayload } from '$lib/api/types';

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
    errors: {}
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

      if (!state.bottleID) {
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
     * Submit the rating
     */
    submit: async (): Promise<{ success: boolean; wineID?: number }> => {
      const state = get({ subscribe });
      const errors: Record<string, string> = {};

      // Validate required fields
      if (!state.bottleID) {
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

        const payload: DrinkBottlePayload = {
          wineID: state.wineID!,
          bottleID: state.bottleID!,
          overallRating: state.overallRating,
          valueRating: state.valueRating,
          drinkDate: formattedDate,
          buyAgain: state.buyAgain,
          notes: state.notes || undefined,
          // Optional ratings (only send if > 0)
          complexityRating: state.complexityRating > 0 ? state.complexityRating : undefined,
          drinkabilityRating: state.drinkabilityRating > 0 ? state.drinkabilityRating : undefined,
          surpriseRating: state.surpriseRating > 0 ? state.surpriseRating : undefined,
          foodPairingRating: state.foodPairingRating > 0 ? state.foodPairingRating : undefined
        };

        await api.drinkBottle(payload);

        // Success message based on rating
        if (state.overallRating >= 8) {
          toasts.success('Cheers! Great wine!');
        } else if (state.overallRating >= 5) {
          toasts.success('Rating saved!');
        } else {
          toasts.success('Rating saved. Maybe try a different wine next time!');
        }

        const wineID = state.wineID;
        update((s) => ({ ...s, isSubmitting: false }));

        return { success: true, wineID: wineID ?? undefined };
      } catch (error) {
        console.error('Failed to submit rating:', error);
        toasts.error('Failed to save rating. Please try again.');
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
  return (
    $state.bottleID !== null &&
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
