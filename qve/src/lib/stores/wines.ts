/**
 * Wines Store
 * Manages the wine collection state
 */

import { writable, derived, get } from 'svelte/store';
import type { Wine, WineFilters } from '$api/types';
import { api } from '$api';

// ─────────────────────────────────────────────────────────
// MAIN STORES
// ─────────────────────────────────────────────────────────

/** Main wines array */
export const wines = writable<Wine[]>([]);

/** Loading state for wine list */
export const winesLoading = writable<boolean>(false);

/** Error state for wine list */
export const winesError = writable<string | null>(null);

/** Target wine ID to scroll to after operations */
export const targetWineID = writable<number | null>(null);

/** Set of currently expanded wine card IDs (allows multiple cards expanded) */
export const expandedWineIDs = writable<Set<number>>(new Set());

/** Toggle expansion state for a wine card */
export function toggleWineExpanded(id: number): void {
  expandedWineIDs.update(($ids) => {
    const newSet = new Set($ids);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return newSet;
  });
}

/** Collapse a specific wine card */
export function collapseWine(id: number): void {
  expandedWineIDs.update(($ids) => {
    const newSet = new Set($ids);
    newSet.delete(id);
    return newSet;
  });
}

/** Collapse all expanded wine cards */
export function collapseAllWines(): void {
  expandedWineIDs.set(new Set());
}

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Total bottle count across all wines */
export const totalBottles = derived(wines, ($wines) =>
  $wines.reduce((sum, wine) => sum + wine.bottleCount, 0)
);

/** Total wine count */
export const wineCount = derived(wines, ($wines) => $wines.length);


// ─────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Find wine by ID in the wine list
 */
export function getWineById(wineList: Wine[], id: number): Wine | undefined {
  return wineList.find((w) => w.wineID === id);
}

/**
 * Update a single wine in the list
 */
export function updateWineInList(id: number, updates: Partial<Wine>): void {
  wines.update(($wines) =>
    $wines.map((wine) => (wine.wineID === id ? { ...wine, ...updates } : wine))
  );
}

/**
 * Remove a wine from the list
 */
export function removeWineFromList(id: number): void {
  wines.update(($wines) => $wines.filter((wine) => wine.wineID !== id));
}

/**
 * Decrement bottle count for a wine
 */
export function decrementBottleCount(id: number): void {
  wines.update(($wines) =>
    $wines.map((wine) =>
      wine.wineID === id ? { ...wine, bottleCount: Math.max(0, wine.bottleCount - 1) } : wine
    )
  );
}

/**
 * Increment bottle count for a wine (after adding bottles)
 */
export function incrementBottleCount(id: number, count: number = 1): void {
  wines.update(($wines) =>
    $wines.map((wine) =>
      wine.wineID === id ? { ...wine, bottleCount: wine.bottleCount + count } : wine
    )
  );
}

/**
 * Set target wine and clear after scroll
 */
export function scrollToWine(id: number): void {
  targetWineID.set(id);
  // Clear after a delay to allow scroll animation
  setTimeout(() => targetWineID.set(null), 2500);
}

// ─────────────────────────────────────────────────────────
// FETCH ACTION (WIN-206)
// ─────────────────────────────────────────────────────────

/** Race condition guard */
let fetchCounter = 0;

/** AbortController for in-flight request */
let activeController: AbortController | null = null;

/** Debounce timer */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce delay in ms */
const DEBOUNCE_MS = 300;

/**
 * Fetch wines from server with given filters.
 * Debounces rapid calls (300ms), aborts in-flight requests, and guards against stale responses.
 * @param filterValues Filters to apply
 * @param immediate Skip debounce (used for initial load)
 */
export function fetchWines(filterValues: WineFilters = {}, immediate = false): void {
  // Clear any pending debounce
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const doFetch = () => {
    // Abort any in-flight request
    if (activeController) {
      activeController.abort();
    }

    const controller = new AbortController();
    activeController = controller;
    const thisRequest = ++fetchCounter;

    winesLoading.set(true);
    winesError.set(null);

    api
      .getWines(filterValues, controller.signal)
      .then((wineList) => {
        // Discard stale responses
        if (thisRequest !== fetchCounter) return;
        wines.set(wineList);
      })
      .catch((e) => {
        // Ignore aborted requests
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (thisRequest !== fetchCounter) return;
        winesError.set(e instanceof Error ? e.message : 'Failed to connect to API');
        console.error('API Error:', e);
      })
      .finally(() => {
        if (thisRequest === fetchCounter) {
          winesLoading.set(false);
          if (activeController === controller) {
            activeController = null;
          }
        }
      });
  };

  if (immediate) {
    doFetch();
  } else {
    debounceTimer = setTimeout(doFetch, DEBOUNCE_MS);
  }
}

/** Exposed for testing: cancel pending debounce and abort in-flight request */
export function cancelFetchWines(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}
