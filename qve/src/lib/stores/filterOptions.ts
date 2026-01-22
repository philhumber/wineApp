/**
 * Filter Options Store
 * Caches dropdown options for Country, Type, Region, Producer, and Year filters
 * Options are cached per view mode (ourWines vs allWines)
 */

import { writable, get } from 'svelte/store';
import { api } from '$lib/api';
import type { ViewMode } from './view';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  meta?: string;
}

interface CachedOptions {
  ourWines: FilterOption[] | null;
  allWines: FilterOption[] | null;
}

interface FilterOptionsState {
  countries: CachedOptions;
  types: CachedOptions;
  regions: CachedOptions;
  producers: CachedOptions;
  years: CachedOptions;
  loading: {
    countries: boolean;
    types: boolean;
    regions: boolean;
    producers: boolean;
    years: boolean;
  };
}

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

const initialState: FilterOptionsState = {
  countries: { ourWines: null, allWines: null },
  types: { ourWines: null, allWines: null },
  regions: { ourWines: null, allWines: null },
  producers: { ourWines: null, allWines: null },
  years: { ourWines: null, allWines: null },
  loading: {
    countries: false,
    types: false,
    regions: false,
    producers: false,
    years: false
  }
};

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

/**
 * Convert 2-letter country code to flag emoji (e.g., "fr" → "🇫🇷")
 */
function countryCodeToEmoji(code: string): string {
  if (!code || code.length !== 2) return '';
  const codePoints = [...code.toUpperCase()].map(
    (char) => 0x1f1e6 - 65 + char.charCodeAt(0)
  );
  return String.fromCodePoint(...codePoints);
}

function createFilterOptionsStore() {
  const { subscribe, update } = writable<FilterOptionsState>(initialState);

  return {
    subscribe,

    /**
     * Fetch country options for dropdown
     * Context-aware: filters by typeName, regionName, producerName, and/or year
     * Only caches when no filters are active (full list)
     * Includes flag emoji in label
     */
    async fetchCountries(
      viewMode: ViewMode,
      typeName?: string,
      regionName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });

      // Only use cache if no filters (full list)
      if (!typeName && !regionName && !producerName && !year) {
        const cached = state.countries[viewMode];
        if (cached !== null) {
          return cached;
        }
      }

      // Set loading
      update((s) => ({
        ...s,
        loading: { ...s.loading, countries: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const countries = await api.getCountries({
          withBottleCount,
          typeName,
          regionName,
          producerName,
          year
        });

        // Map to FilterOption format with flag emoji in label
        const options: FilterOption[] = countries.map((c) => {
          const flag = countryCodeToEmoji(c.code);
          return {
            value: c.countryName,
            label: flag ? `${flag} ${c.countryName}` : c.countryName,
            count: c.bottleCount
          };
        });

        // Only cache if no filters (full list)
        if (!typeName && !regionName && !producerName && !year) {
          update((s) => ({
            ...s,
            countries: { ...s.countries, [viewMode]: options },
            loading: { ...s.loading, countries: false }
          }));
        } else {
          update((s) => ({
            ...s,
            loading: { ...s.loading, countries: false }
          }));
        }

        return options;
      } catch (error) {
        console.error('Failed to fetch countries:', error);
        update((s) => ({
          ...s,
          loading: { ...s.loading, countries: false }
        }));
        return [];
      }
    },

    /**
     * Fetch wine type options for dropdown
     * Context-aware: filters by countryName, regionName, producerName, and/or year
     * Only caches when no filters are active (full list)
     */
    async fetchTypes(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });

      // Only use cache if no filters (full list)
      if (!countryName && !regionName && !producerName && !year) {
        const cached = state.types[viewMode];
        if (cached !== null) {
          return cached;
        }
      }

      // Set loading
      update((s) => ({
        ...s,
        loading: { ...s.loading, types: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const types = await api.getTypes({ withBottleCount, countryName, regionName, producerName, year });

        // Map to FilterOption format
        const options: FilterOption[] = types.map((t) => ({
          value: t.wineTypeName,
          label: t.wineTypeName,
          count: t.bottleCount
        }));

        // Only cache if no filters (full list)
        if (!countryName && !regionName && !producerName && !year) {
          update((s) => ({
            ...s,
            types: { ...s.types, [viewMode]: options },
            loading: { ...s.loading, types: false }
          }));
        } else {
          update((s) => ({
            ...s,
            loading: { ...s.loading, types: false }
          }));
        }

        return options;
      } catch (error) {
        console.error('Failed to fetch types:', error);
        update((s) => ({
          ...s,
          loading: { ...s.loading, types: false }
        }));
        return [];
      }
    },

    /**
     * Fetch region options for dropdown
     * Context-aware: filters by countryName, typeName, producerName, and/or year
     * Only caches when no filters are active (full list)
     */
    async fetchRegions(
      viewMode: ViewMode,
      countryName?: string,
      typeName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });

      // Only use cache if no filters (full list)
      if (!countryName && !typeName && !producerName && !year) {
        const cached = state.regions[viewMode];
        if (cached !== null) {
          return cached;
        }
      }

      // Set loading
      update((s) => ({
        ...s,
        loading: { ...s.loading, regions: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const regions = await api.getRegions({ withBottleCount, countryName, typeName, producerName, year });

        // Map to FilterOption format
        const options: FilterOption[] = regions.map((r) => ({
          value: r.regionName,
          label: r.regionName,
          count: r.bottleCount
        }));

        // Only cache if no filters (full list)
        if (!countryName && !typeName && !producerName && !year) {
          update((s) => ({
            ...s,
            regions: { ...s.regions, [viewMode]: options },
            loading: { ...s.loading, regions: false }
          }));
        } else {
          update((s) => ({
            ...s,
            loading: { ...s.loading, regions: false }
          }));
        }

        return options;
      } catch (error) {
        console.error('Failed to fetch regions:', error);
        update((s) => ({
          ...s,
          loading: { ...s.loading, regions: false }
        }));
        return [];
      }
    },

    /**
     * Fetch producer options for dropdown
     * Context-aware: filters by countryName, regionName, typeName, and/or year
     * Only caches when no filters are active (full list)
     */
    async fetchProducers(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      typeName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });

      // Only use cache if no filters (full list)
      if (!countryName && !regionName && !typeName && !year) {
        const cached = state.producers[viewMode];
        if (cached !== null) {
          return cached;
        }
      }

      // Set loading
      update((s) => ({
        ...s,
        loading: { ...s.loading, producers: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const producers = await api.getProducers({ withBottleCount, countryName, regionName, typeName, year });

        // Map to FilterOption format (include region as meta)
        const options: FilterOption[] = producers.map((p) => ({
          value: p.producerName,
          label: p.producerName,
          count: p.bottleCount,
          meta: p.regionName || undefined
        }));

        // Only cache if no filters (full list)
        if (!countryName && !regionName && !typeName && !year) {
          update((s) => ({
            ...s,
            producers: { ...s.producers, [viewMode]: options },
            loading: { ...s.loading, producers: false }
          }));
        } else {
          update((s) => ({
            ...s,
            loading: { ...s.loading, producers: false }
          }));
        }

        return options;
      } catch (error) {
        console.error('Failed to fetch producers:', error);
        update((s) => ({
          ...s,
          loading: { ...s.loading, producers: false }
        }));
        return [];
      }
    },

    /**
     * Fetch year options for dropdown
     * Context-aware: filters by countryName, regionName, producerName, and/or typeName
     * Only caches when no filters are active (full list)
     */
    async fetchYears(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      producerName?: string,
      typeName?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });

      // Only use cache if no filters (full list)
      if (!countryName && !regionName && !producerName && !typeName) {
        const cached = state.years[viewMode];
        if (cached !== null) {
          return cached;
        }
      }

      // Set loading
      update((s) => ({
        ...s,
        loading: { ...s.loading, years: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const years = await api.getYears({ withBottleCount, countryName, regionName, producerName, typeName });

        // Map to FilterOption format
        const options: FilterOption[] = years.map((y) => ({
          value: y.wineYear,
          label: y.wineYear,
          count: y.bottleCount
        }));

        // Only cache if no filters (full list)
        if (!countryName && !regionName && !producerName && !typeName) {
          update((s) => ({
            ...s,
            years: { ...s.years, [viewMode]: options },
            loading: { ...s.loading, years: false }
          }));
        } else {
          update((s) => ({
            ...s,
            loading: { ...s.loading, years: false }
          }));
        }

        return options;
      } catch (error) {
        console.error('Failed to fetch years:', error);
        update((s) => ({
          ...s,
          loading: { ...s.loading, years: false }
        }));
        return [];
      }
    },

    /**
     * Get cached options for a filter type (no fetch)
     */
    getCached(
      type: 'countries' | 'types' | 'regions' | 'producers' | 'years',
      viewMode: ViewMode
    ): FilterOption[] | null {
      const state = get({ subscribe });
      return state[type][viewMode];
    },

    /**
     * Check if a filter type is loading
     */
    isLoading(type: 'countries' | 'types' | 'regions' | 'producers' | 'years'): boolean {
      const state = get({ subscribe });
      return state.loading[type];
    },

    /**
     * Invalidate cache for a specific type or all
     */
    invalidate(type?: 'countries' | 'types' | 'regions' | 'producers' | 'years') {
      if (type) {
        update((s) => ({
          ...s,
          [type]: { ourWines: null, allWines: null }
        }));
      } else {
        update(() => initialState);
      }
    }
  };
}

export const filterOptions = createFilterOptionsStore();
