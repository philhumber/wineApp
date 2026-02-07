/**
 * Filters Store
 * Manages active filter state for wine list
 */

import { writable, derived } from 'svelte/store';
import type { WineFilters } from '$api/types';

// ─────────────────────────────────────────────────────────
// MAIN STORE
// ─────────────────────────────────────────────────────────

/** Active filter values */
export const filters = writable<WineFilters>({});

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Check if any filters are active (excluding bottleCount which is view mode) */
export const hasActiveFilters = derived(filters, ($filters) => {
  const { bottleCount, searchQuery, ...otherFilters } = $filters;
  const hasSearch = !!searchQuery && searchQuery.length >= 3;
  const hasOthers = Object.values(otherFilters).some((v) => v !== undefined && v !== '');
  return hasSearch || hasOthers;
});

/** Count of active filters */
export const activeFilterCount = derived(filters, ($filters) => {
  const { bottleCount, ...otherFilters } = $filters;
  return Object.values(otherFilters).filter((v) => v !== undefined && v !== '').length;
});

/** Get active filter as readable list */
export const activeFilterList = derived(filters, ($filters) => {
  const list: Array<{ key: string; value: string }> = [];

  if ($filters.countryDropdown) {
    list.push({ key: 'Country', value: $filters.countryDropdown });
  }
  if ($filters.regionDropdown) {
    list.push({ key: 'Region', value: $filters.regionDropdown });
  }
  if ($filters.producerDropdown) {
    list.push({ key: 'Producer', value: $filters.producerDropdown });
  }
  if ($filters.typesDropdown) {
    list.push({ key: 'Type', value: $filters.typesDropdown });
  }
  if ($filters.yearDropdown) {
    list.push({ key: 'Year', value: $filters.yearDropdown });
  }
  if ($filters.searchQuery && $filters.searchQuery.length >= 3) {
    list.push({ key: 'Search', value: `"${$filters.searchQuery}"` });
  }

  return list;
});

/** Check if search is active (3+ chars) - WIN-24 */
export const hasSearchQuery = derived(filters, ($f) =>
  !!$f.searchQuery && $f.searchQuery.length >= 3
);

/** Current search query (for display) - WIN-24 */
export const searchQuery = derived(filters, ($f) => $f.searchQuery ?? '');

// ─────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────

/**
 * Set a single filter value
 */
export function setFilter(key: keyof WineFilters, value: string | undefined): void {
  filters.update((current) => ({
    ...current,
    [key]: value || undefined
  }));
}

/**
 * Set multiple filters at once
 */
export function setFilters(newFilters: Partial<WineFilters>): void {
  filters.update((current) => ({
    ...current,
    ...newFilters
  }));
}

/**
 * Clear a single filter
 */
export function clearFilter(key: keyof WineFilters): void {
  filters.update((current) => {
    const updated = { ...current };
    delete updated[key];
    return updated;
  });
}

/**
 * Clear all filters (except bottleCount)
 */
export function clearAllFilters(): void {
  filters.update((current) => ({
    bottleCount: current.bottleCount
  }));
}

/**
 * Reset filters completely
 */
export function resetFilters(): void {
  filters.set({});
}
