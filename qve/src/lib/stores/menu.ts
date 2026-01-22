/**
 * Menu store - manages slide-out navigation menu state
 */
import { writable } from 'svelte/store';

// Menu open state
export const menuOpen = writable<boolean>(false);

/**
 * Open the navigation menu
 */
export function openMenu(): void {
  menuOpen.set(true);
}

/**
 * Close the navigation menu
 */
export function closeMenu(): void {
  menuOpen.set(false);
}

/**
 * Toggle the navigation menu
 */
export function toggleMenu(): void {
  menuOpen.update(open => !open);
}
