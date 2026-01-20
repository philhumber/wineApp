/**
 * History Store
 * Manages the drunk wines history state
 */

import { writable, derived } from 'svelte/store';
import type { DrunkWine } from '$api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type HistorySortKey = 'drinkDate' | 'overallRating' | 'valueRating' | 'wineName' | 'wineType';
export type HistorySortDir = 'asc' | 'desc';

export interface HistoryFilters {
  countryDropdown?: string;
  typesDropdown?: string;
  yearDropdown?: string;
}

// ─────────────────────────────────────────────────────────
// MAIN STORES
// ─────────────────────────────────────────────────────────

/** Drunk wines array */
export const drunkWines = writable<DrunkWine[]>([]);

/** Loading state */
export const historyLoading = writable<boolean>(false);

/** Error state */
export const historyError = writable<string | null>(null);

/** Sort configuration */
export const historySortKey = writable<HistorySortKey>('drinkDate');
export const historySortDir = writable<HistorySortDir>('desc');

/** Active filters */
export const historyFilters = writable<HistoryFilters>({});

/** Currently expanded history card key (wineID-bottleID) */
export const expandedHistoryKey = writable<string | null>(null);

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Check if any filters are active */
export const hasHistoryFilters = derived(historyFilters, ($filters) =>
  Object.values($filters).some((v) => v !== undefined && v !== '')
);

/** Count active filters */
export const activeHistoryFilterCount = derived(historyFilters, ($filters) =>
  Object.values($filters).filter((v) => v !== undefined && v !== '').length
);

/** Filtered and sorted drunk wines */
export const sortedDrunkWines = derived(
  [drunkWines, historySortKey, historySortDir, historyFilters],
  ([$drunkWines, $sortKey, $sortDir, $filters]) => {
    // Filter first
    let filtered = $drunkWines.filter((wine) => {
      if ($filters.countryDropdown && wine.countryName !== $filters.countryDropdown) return false;
      if ($filters.typesDropdown && wine.wineType !== $filters.typesDropdown) return false;
      if ($filters.yearDropdown && wine.year !== $filters.yearDropdown) return false;
      return true;
    });

    // Then sort
    return [...filtered].sort((a, b) => {
      const direction = $sortDir === 'asc' ? 1 : -1;
      switch ($sortKey) {
        case 'drinkDate':
          // Handle null dates - put them at the end
          if (!a.drinkDate && !b.drinkDate) return 0;
          if (!a.drinkDate) return 1;
          if (!b.drinkDate) return -1;
          return direction * (new Date(a.drinkDate).getTime() - new Date(b.drinkDate).getTime());
        case 'overallRating':
          return direction * ((a.overallRating ?? 0) - (b.overallRating ?? 0));
        case 'valueRating':
          return direction * ((a.valueRating ?? 0) - (b.valueRating ?? 0));
        case 'wineName':
          return direction * a.wineName.localeCompare(b.wineName);
        case 'wineType':
          return direction * a.wineType.localeCompare(b.wineType);
        default:
          return 0;
      }
    });
  }
);

/** Total count of drunk wines (all bottles) */
export const drunkWineCount = derived(drunkWines, ($wines) => $wines.length);

/** Count of filtered wines */
export const filteredDrunkWineCount = derived(sortedDrunkWines, ($wines) => $wines.length);

// ─────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────

/**
 * Set sort key and optionally direction
 */
export function setHistorySort(key: HistorySortKey, dir?: HistorySortDir): void {
  historySortKey.set(key);
  if (dir) historySortDir.set(dir);
}

/**
 * Toggle sort direction
 */
export function toggleHistorySortDir(): void {
  historySortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
}

/**
 * Set a filter value
 */
export function setHistoryFilter(key: keyof HistoryFilters, value: string | undefined): void {
  historyFilters.update((f) => ({ ...f, [key]: value || undefined }));
}

/**
 * Clear all filters
 */
export function clearHistoryFilters(): void {
  historyFilters.set({});
}

/**
 * Generate unique key for a drunk wine entry
 */
export function getDrunkWineKey(wine: DrunkWine): string {
  return `${wine.wineID}-${wine.bottleID}`;
}
