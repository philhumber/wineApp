/**
 * Wines Store
 * Manages the wine collection state
 */

import { writable, derived } from 'svelte/store';
import type { Wine } from '$api/types';

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

/** Wines grouped by country */
export const winesByCountry = derived(wines, ($wines) => {
  const grouped = new Map<string, Wine[]>();
  for (const wine of $wines) {
    const country = wine.countryName;
    if (!grouped.has(country)) {
      grouped.set(country, []);
    }
    grouped.get(country)!.push(wine);
  }
  return grouped;
});

/** Wines grouped by type */
export const winesByType = derived(wines, ($wines) => {
  const grouped = new Map<string, Wine[]>();
  for (const wine of $wines) {
    const type = wine.wineType;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(wine);
  }
  return grouped;
});

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
