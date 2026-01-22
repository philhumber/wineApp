/**
 * Theme Store
 * Manages light/dark mode with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'qve-theme';

function createThemeStore() {
  /**
   * Get initial theme from localStorage or system preference
   */
  const getInitialTheme = (): Theme => {
    if (!browser) return 'light';

    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Fall back to system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  };

  const { subscribe, set, update } = writable<Theme>(getInitialTheme());

  /**
   * Apply theme to DOM
   */
  const applyTheme = (theme: Theme) => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', theme);
      // Update theme-color meta tag for PWA
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#0C0B0A' : '#FAF9F7');
      }
    }
  };

  return {
    subscribe,

    /**
     * Set theme explicitly
     */
    set: (value: Theme) => {
      if (browser) {
        localStorage.setItem(STORAGE_KEY, value);
      }
      applyTheme(value);
      set(value);
    },

    /**
     * Toggle between light and dark
     */
    toggle: () => {
      update((current) => {
        const next = current === 'light' ? 'dark' : 'light';
        if (browser) {
          localStorage.setItem(STORAGE_KEY, next);
        }
        applyTheme(next);
        return next;
      });
    },

    /**
     * Initialize theme on app mount
     * Call this in root layout's onMount
     */
    initialize: () => {
      if (browser) {
        const theme = getInitialTheme();
        applyTheme(theme);
        set(theme);

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          // Only auto-switch if user hasn't explicitly set a preference
          if (!localStorage.getItem(STORAGE_KEY)) {
            const newTheme = e.matches ? 'dark' : 'light';
            applyTheme(newTheme);
            set(newTheme);
          }
        });
      }
    }
  };
}

export const theme = createThemeStore();
