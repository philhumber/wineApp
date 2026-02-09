/**
 * History Store
 * Manages the drunk wines history state
 * WIN-205: Server-driven pagination, filtering, and sorting
 */

import { writable, derived, get } from 'svelte/store';
import type { DrunkWine, PaginationMeta, HistoryFilterOptions } from '$api/types';
import { api } from '$api';

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

/** Drunk wines array (current page from server) */
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

/** WIN-205: Pagination metadata from server */
export const historyPagination = writable<PaginationMeta>({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0
});

/** WIN-205: Server-provided cascading filter options */
export const historyFilterOptions = writable<HistoryFilterOptions>({
  countries: [],
  types: [],
  regions: [],
  producers: [],
  years: []
});

/** WIN-205: Unfiltered total (for empty state detection) */
export const unfilteredDrunkWineCount = writable<number>(0);

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

/** WIN-205: Server already sorts/filters — pass through */
export const sortedDrunkWines = derived(drunkWines, ($wines) => $wines);

/** Total count of drunk wines (unfiltered) */
export const drunkWineCount = derived(unfilteredDrunkWineCount, ($c) => $c);

/** Count of filtered wines (from pagination total) */
export const filteredDrunkWineCount = derived(historyPagination, ($p) => $p.total);

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

// ─────────────────────────────────────────────────────────
// FETCH ACTION (WIN-205, WIN-206: debounce + abort)
// ─────────────────────────────────────────────────────────

/** Race condition guard */
let fetchCounter = 0;

/** AbortController for in-flight request */
let activeHistoryController: AbortController | null = null;

/** Debounce timer */
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce delay in ms */
const HISTORY_DEBOUNCE_MS = 300;

/**
 * Fetch history from server with current filters, sort, and pagination.
 * Debounces rapid calls (300ms), aborts in-flight requests, and guards against stale responses.
 * @param page Page number (omit to stay on current page)
 * @param immediate Skip debounce (used for initial load)
 */
export function fetchHistory(page?: number, immediate = false): void {
  // Clear any pending debounce
  if (historyDebounceTimer !== null) {
    clearTimeout(historyDebounceTimer);
    historyDebounceTimer = null;
  }

  const doFetch = () => {
    // Abort any in-flight request
    if (activeHistoryController) {
      activeHistoryController.abort();
    }

    const controller = new AbortController();
    activeHistoryController = controller;
    const thisRequest = ++fetchCounter;

    const $filters = get(historyFilters);
    const $sortKey = get(historySortKey);
    const $sortDir = get(historySortDir);
    const $pagination = get(historyPagination);

    historyLoading.set(true);
    historyError.set(null);

    api
      .getDrunkWines(
        {
          page: page ?? $pagination.page,
          limit: $pagination.limit,
          sortKey: $sortKey,
          sortDir: $sortDir,
          ...($filters.countryDropdown && { countryDropdown: $filters.countryDropdown }),
          ...($filters.typesDropdown && { typesDropdown: $filters.typesDropdown }),
          ...($filters.regionDropdown && { regionDropdown: $filters.regionDropdown }),
          ...($filters.producerDropdown && { producerDropdown: $filters.producerDropdown }),
          ...($filters.yearDropdown && { yearDropdown: $filters.yearDropdown })
        },
        controller.signal
      )
      .then((result) => {
        if (thisRequest !== fetchCounter) return;
        drunkWines.set(result.wineList);
        historyPagination.set(result.pagination);
        historyFilterOptions.set(result.filterOptions);
        unfilteredDrunkWineCount.set(result.unfilteredTotal);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (thisRequest !== fetchCounter) return;
        historyError.set(e instanceof Error ? e.message : 'Failed to load history');
        console.error('History API Error:', e);
      })
      .finally(() => {
        if (thisRequest === fetchCounter) {
          historyLoading.set(false);
          if (activeHistoryController === controller) {
            activeHistoryController = null;
          }
        }
      });
  };

  if (immediate) {
    doFetch();
  } else {
    historyDebounceTimer = setTimeout(doFetch, HISTORY_DEBOUNCE_MS);
  }
}

/** Exposed for testing: cancel pending debounce and abort in-flight request */
export function cancelFetchHistory(): void {
  if (historyDebounceTimer !== null) {
    clearTimeout(historyDebounceTimer);
    historyDebounceTimer = null;
  }
  if (activeHistoryController) {
    activeHistoryController.abort();
    activeHistoryController = null;
  }
}
