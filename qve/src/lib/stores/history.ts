/**
 * History Store
 * Manages the drunk wines history state
 */

import { writable, derived } from 'svelte/store';
import type { DrunkWine } from '$api/types';
import { availableCurrencies, getCurrencyByCode, convertToEUR } from './currency';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type HistorySortKey =
  | 'drinkDate'
  | 'rating'
  | 'overallRating'
  | 'valueRating'
  | 'wineName'
  | 'wineType'
  | 'country'
  | 'producer'
  | 'region'
  | 'year'
  | 'price'
  | 'buyAgain';
export type HistorySortDir = 'asc' | 'desc';

export interface HistoryFilters {
  countryDropdown?: string;
  typesDropdown?: string;
  regionDropdown?: string;
  producerDropdown?: string;
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
  [drunkWines, historySortKey, historySortDir, historyFilters, availableCurrencies],
  ([$drunkWines, $sortKey, $sortDir, $filters, $currencies]) => {
    // Filter first
    let filtered = $drunkWines.filter((wine) => {
      if ($filters.countryDropdown && wine.countryName !== $filters.countryDropdown) return false;
      if ($filters.typesDropdown && wine.wineType !== $filters.typesDropdown) return false;
      if ($filters.regionDropdown && wine.regionName !== $filters.regionDropdown) return false;
      if ($filters.producerDropdown && wine.producerName !== $filters.producerDropdown) return false;
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
        case 'rating': {
          // Combined rating: (overall + value) / 2
          const ratingA = (a.overallRating != null && a.valueRating != null)
            ? (a.overallRating + a.valueRating) / 2
            : a.overallRating ?? a.valueRating ?? -1;
          const ratingB = (b.overallRating != null && b.valueRating != null)
            ? (b.overallRating + b.valueRating) / 2
            : b.overallRating ?? b.valueRating ?? -1;
          if (ratingA === -1 && ratingB === -1) return 0;
          if (ratingA === -1) return 1;
          if (ratingB === -1) return -1;
          return direction * (ratingA - ratingB);
        }
        case 'overallRating': {
          const ratingA = a.overallRating ?? -1;
          const ratingB = b.overallRating ?? -1;
          if (ratingA === -1 && ratingB === -1) return 0;
          if (ratingA === -1) return 1;
          if (ratingB === -1) return -1;
          return direction * (ratingA - ratingB);
        }
        case 'valueRating': {
          const ratingA = a.valueRating ?? -1;
          const ratingB = b.valueRating ?? -1;
          if (ratingA === -1 && ratingB === -1) return 0;
          if (ratingA === -1) return 1;
          if (ratingB === -1) return -1;
          return direction * (ratingA - ratingB);
        }
        case 'wineName':
          return direction * a.wineName.localeCompare(b.wineName);
        case 'wineType':
          return direction * a.wineType.localeCompare(b.wineType);
        case 'country':
          return direction * a.countryName.localeCompare(b.countryName);
        case 'producer':
          return direction * a.producerName.localeCompare(b.producerName);
        case 'region':
          return direction * a.regionName.localeCompare(b.regionName);
        case 'year': {
          const yearA = a.year || '';
          const yearB = b.year || '';
          if (!yearA && !yearB) return 0;
          if (!yearA) return 1;
          if (!yearB) return -1;
          return direction * yearA.localeCompare(yearB);
        }
        case 'price': {
          const rawPriceA = parseFloat(String(a.bottlePrice || '0')) || 0;
          const rawPriceB = parseFloat(String(b.bottlePrice || '0')) || 0;

          // Convert to EUR for fair comparison - default to EUR if currency null
          const currencyA = getCurrencyByCode(a.bottleCurrency || 'EUR', $currencies);
          const currencyB = getCurrencyByCode(b.bottleCurrency || 'EUR', $currencies);

          // If currency not in list (store not loaded), fall back to raw comparison
          const priceA = currencyA ? convertToEUR(rawPriceA, currencyA) : rawPriceA;
          const priceB = currencyB ? convertToEUR(rawPriceB, currencyB) : rawPriceB;

          if (priceA === 0 && priceB === 0) return 0;
          if (priceA === 0) return 1;
          if (priceB === 0) return -1;
          return direction * (priceA - priceB);
        }
        case 'buyAgain':
          return direction * ((a.buyAgain ?? 0) - (b.buyAgain ?? 0));
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
