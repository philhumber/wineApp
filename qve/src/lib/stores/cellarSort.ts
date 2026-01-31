/**
 * Cellar Sort Store
 * Manages sort configuration for the cellar/home wine list
 */

import { writable } from 'svelte/store';
import type { Wine } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type CellarSortKey =
  | 'producer'
  | 'wineName'
  | 'country'
  | 'region'
  | 'year'
  | 'type'
  | 'rating'
  | 'bottles'
  | 'price'
  | 'priceBottle';

export type CellarSortDir = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────
// STORES
// ─────────────────────────────────────────────────────────

export const cellarSortKey = writable<CellarSortKey>('producer');
export const cellarSortDir = writable<CellarSortDir>('asc');

// ─────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────

export function setCellarSort(key: CellarSortKey, dir?: CellarSortDir): void {
  cellarSortKey.set(key);
  if (dir) cellarSortDir.set(dir);
}

export function toggleCellarSortDir(): void {
  cellarSortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
}

// ─────────────────────────────────────────────────────────
// CLIENT-SIDE SORTING FUNCTION
// ─────────────────────────────────────────────────────────

export function sortWines(wines: Wine[], sortKey: CellarSortKey, sortDir: CellarSortDir): Wine[] {
  const direction = sortDir === 'asc' ? 1 : -1;

  return [...wines].sort((a, b) => {
    switch (sortKey) {
      case 'producer':
        return direction * a.producerName.localeCompare(b.producerName);
      case 'wineName':
        return direction * a.wineName.localeCompare(b.wineName);
      case 'country':
        return direction * a.countryName.localeCompare(b.countryName);
      case 'region':
        return direction * a.regionName.localeCompare(b.regionName);
      case 'year': {
        // Handle null/empty years - put at end
        const yearA = a.year || '';
        const yearB = b.year || '';
        if (!yearA && !yearB) return 0;
        if (!yearA) return 1;
        if (!yearB) return -1;
        return direction * yearA.localeCompare(yearB);
      }
      case 'type':
        return direction * a.wineType.localeCompare(b.wineType);
      case 'rating': {
        // Handle null ratings - put at end
        const ratingA = a.avgRating ?? -1;
        const ratingB = b.avgRating ?? -1;
        if (ratingA === -1 && ratingB === -1) return 0;
        if (ratingA === -1) return 1;
        if (ratingB === -1) return -1;
        return direction * (ratingA - ratingB);
      }
      case 'bottles':
        return direction * (a.bottleCount - b.bottleCount);
      case 'price': {
        // Use avgPricePerLiterEUR for comparison (value per liter)
        const priceA = parseFloat(a.avgPricePerLiterEUR || '0') || 0;
        const priceB = parseFloat(b.avgPricePerLiterEUR || '0') || 0;
        if (priceA === 0 && priceB === 0) return 0;
        if (priceA === 0) return 1;
        if (priceB === 0) return -1;
        return direction * (priceA - priceB);
      }
      case 'priceBottle': {
        // Use median bottle price in EUR for comparison (absolute price)
        const priceA = parseFloat(a.avgBottlePriceEUR || '0') || 0;
        const priceB = parseFloat(b.avgBottlePriceEUR || '0') || 0;
        if (priceA === 0 && priceB === 0) return 0;
        if (priceA === 0) return 1;
        if (priceB === 0) return -1;
        return direction * (priceA - priceB);
      }
      default:
        return 0;
    }
  });
}
