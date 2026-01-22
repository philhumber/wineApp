/**
 * Scroll position store - tracks and restores scroll positions for back/forward navigation
 */
import { writable, get } from 'svelte/store';

// Store scroll positions keyed by pathname
const scrollPositions = writable<Record<string, number>>({});

/**
 * Save the current scroll position for a given path
 * @param path - The pathname to save scroll position for
 */
export function saveScrollPosition(path: string): void {
  if (typeof window === 'undefined') return;

  scrollPositions.update(positions => ({
    ...positions,
    [path]: window.scrollY
  }));
}

/**
 * Get the saved scroll position for a given path
 * @param path - The pathname to get scroll position for
 * @returns The saved scroll position, or 0 if not found
 */
export function getScrollPosition(path: string): number {
  return get(scrollPositions)[path] || 0;
}

/**
 * Clear all saved scroll positions
 */
export function clearScrollPositions(): void {
  scrollPositions.set({});
}
