/**
 * View Stores
 * Manages view density (compact/medium) and view mode (ourWines/allWines)
 * Both persist to localStorage
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// ─────────────────────────────────────────────────────────
// VIEW DENSITY (compact/medium card layout)
// ─────────────────────────────────────────────────────────

export type ViewDensity = 'compact' | 'medium';

const DENSITY_KEY = 'qve-view-density';

function createViewDensityStore() {
  const getInitial = (): ViewDensity => {
    if (!browser) return 'medium';
    const stored = localStorage.getItem(DENSITY_KEY);
    return stored === 'compact' ? 'compact' : 'medium';
  };

  const { subscribe, set } = writable<ViewDensity>(getInitial());

  return {
    subscribe,
    set: (value: ViewDensity) => {
      if (browser) {
        localStorage.setItem(DENSITY_KEY, value);
      }
      set(value);
    },
    toggle: () => {
      const current = browser ? localStorage.getItem(DENSITY_KEY) : 'medium';
      const next: ViewDensity = current === 'compact' ? 'medium' : 'compact';
      if (browser) {
        localStorage.setItem(DENSITY_KEY, next);
      }
      set(next);
    }
  };
}

export const viewDensity = createViewDensityStore();

// ─────────────────────────────────────────────────────────
// VIEW MODE (ourWines = has bottles, allWines = all)
// ─────────────────────────────────────────────────────────

export type ViewMode = 'ourWines' | 'allWines';

const MODE_KEY = 'qve-view-mode';

function createViewModeStore() {
  const getInitial = (): ViewMode => {
    if (!browser) return 'ourWines';
    const stored = localStorage.getItem(MODE_KEY);
    return stored === 'allWines' ? 'allWines' : 'ourWines';
  };

  const { subscribe, set } = writable<ViewMode>(getInitial());

  return {
    subscribe,
    set: (value: ViewMode) => {
      if (browser) {
        localStorage.setItem(MODE_KEY, value);
      }
      set(value);
    },
    toggle: () => {
      const current = browser ? localStorage.getItem(MODE_KEY) : 'ourWines';
      const next: ViewMode = current === 'ourWines' ? 'allWines' : 'ourWines';
      if (browser) {
        localStorage.setItem(MODE_KEY, next);
      }
      set(next);
    }
  };
}

export const viewMode = createViewModeStore();

/**
 * Derived: bottleCount parameter for API calls
 * '1' = ourWines (wines with bottles)
 * '0' = allWines (all wines)
 */
export const bottleCountParam = derived(viewMode, ($viewMode) =>
  $viewMode === 'ourWines' ? '1' : '0'
) as { subscribe: (fn: (value: '0' | '1') => void) => () => void };
