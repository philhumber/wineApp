/**
 * Filter Options Store
 * Caches dropdown options for Country, Type, Region, Producer, and Year filters
 * Options are cached by composite key: viewMode + active filter values
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

type OptionsCache = Map<string, FilterOption[]>;

interface FilterOptionsState {
  countries: OptionsCache;
  types: OptionsCache;
  regions: OptionsCache;
  producers: OptionsCache;
  years: OptionsCache;
  loading: {
    countries: boolean;
    types: boolean;
    regions: boolean;
    producers: boolean;
    years: boolean;
  };
}

type FilterType = 'countries' | 'types' | 'regions' | 'producers' | 'years';

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function cacheKey(viewMode: ViewMode, ...filters: (string | undefined)[]): string {
  return viewMode + '|' + filters.map((f) => f ?? '').join('|');
}

function emptyCache(): OptionsCache {
  return new Map();
}

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

const initialState: FilterOptionsState = {
  countries: emptyCache(),
  types: emptyCache(),
  regions: emptyCache(),
  producers: emptyCache(),
  years: emptyCache(),
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
     */
    async fetchCountries(
      viewMode: ViewMode,
      typeName?: string,
      regionName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });
      const key = cacheKey(viewMode, typeName, regionName, producerName, year);

      const cached = state.countries.get(key);
      if (cached) return cached;

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

        const options: FilterOption[] = countries.map((c) => {
          const flag = countryCodeToEmoji(c.code);
          return {
            value: c.countryName,
            label: flag ? `${flag} ${c.countryName}` : c.countryName,
            count: c.bottleCount
          };
        });

        update((s) => {
          const next = new Map(s.countries);
          next.set(key, options);
          return { ...s, countries: next, loading: { ...s.loading, countries: false } };
        });

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
     */
    async fetchTypes(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });
      const key = cacheKey(viewMode, countryName, regionName, producerName, year);

      const cached = state.types.get(key);
      if (cached) return cached;

      update((s) => ({
        ...s,
        loading: { ...s.loading, types: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const types = await api.getTypes({ withBottleCount, countryName, regionName, producerName, year });

        const options: FilterOption[] = types.map((t) => ({
          value: t.wineTypeName,
          label: t.wineTypeName,
          count: t.bottleCount
        }));

        update((s) => {
          const next = new Map(s.types);
          next.set(key, options);
          return { ...s, types: next, loading: { ...s.loading, types: false } };
        });

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
     */
    async fetchRegions(
      viewMode: ViewMode,
      countryName?: string,
      typeName?: string,
      producerName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });
      const key = cacheKey(viewMode, countryName, typeName, producerName, year);

      const cached = state.regions.get(key);
      if (cached) return cached;

      update((s) => ({
        ...s,
        loading: { ...s.loading, regions: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const regions = await api.getRegions({ withBottleCount, countryName, typeName, producerName, year });

        const options: FilterOption[] = regions.map((r) => ({
          value: r.regionName,
          label: r.regionName,
          count: r.bottleCount
        }));

        update((s) => {
          const next = new Map(s.regions);
          next.set(key, options);
          return { ...s, regions: next, loading: { ...s.loading, regions: false } };
        });

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
     */
    async fetchProducers(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      typeName?: string,
      year?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });
      const key = cacheKey(viewMode, countryName, regionName, typeName, year);

      const cached = state.producers.get(key);
      if (cached) return cached;

      update((s) => ({
        ...s,
        loading: { ...s.loading, producers: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const producers = await api.getProducers({ withBottleCount, countryName, regionName, typeName, year });

        const options: FilterOption[] = producers.map((p) => ({
          value: p.producerName,
          label: p.producerName,
          count: p.bottleCount,
          meta: p.regionName || undefined
        }));

        update((s) => {
          const next = new Map(s.producers);
          next.set(key, options);
          return { ...s, producers: next, loading: { ...s.loading, producers: false } };
        });

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
     */
    async fetchYears(
      viewMode: ViewMode,
      countryName?: string,
      regionName?: string,
      producerName?: string,
      typeName?: string
    ): Promise<FilterOption[]> {
      const state = get({ subscribe });
      const key = cacheKey(viewMode, countryName, regionName, producerName, typeName);

      const cached = state.years.get(key);
      if (cached) return cached;

      update((s) => ({
        ...s,
        loading: { ...s.loading, years: true }
      }));

      try {
        const withBottleCount = viewMode === 'ourWines';
        const years = await api.getYears({ withBottleCount, countryName, regionName, producerName, typeName });

        const options: FilterOption[] = years.map((y) => ({
          value: y.wineYear,
          label: y.wineYear,
          count: y.bottleCount
        }));

        update((s) => {
          const next = new Map(s.years);
          next.set(key, options);
          return { ...s, years: next, loading: { ...s.loading, years: false } };
        });

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
     * Returns the unfiltered cache entry for the given view mode
     */
    getCached(
      type: FilterType,
      viewMode: ViewMode
    ): FilterOption[] | null {
      const state = get({ subscribe });
      return state[type].get(cacheKey(viewMode)) ?? null;
    },

    /**
     * Check if a filter type is loading
     */
    isLoading(type: FilterType): boolean {
      const state = get({ subscribe });
      return state.loading[type];
    },

    /**
     * Invalidate cache for a specific type or all
     */
    invalidate(type?: FilterType) {
      if (type) {
        update((s) => ({
          ...s,
          [type]: emptyCache()
        }));
      } else {
        update((s) => ({
          ...s,
          countries: emptyCache(),
          types: emptyCache(),
          regions: emptyCache(),
          producers: emptyCache(),
          years: emptyCache()
        }));
      }
    }
  };
}

export const filterOptions = createFilterOptionsStore();
