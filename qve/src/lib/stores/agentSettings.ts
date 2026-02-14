/**
 * Agent Settings Store
 *
 * Persists user preferences for the wine assistant:
 * - Personality selection
 *
 * Future enhancements:
 * - Language preference
 * - Verbosity level
 * - Notification preferences
 */

import { writable, get } from 'svelte/store';
import { Personality } from '$lib/agent/personalities';

// ===========================================
// Constants
// ===========================================

const STORAGE_KEY = 'qve-agent-settings';

// ===========================================
// Types
// ===========================================

export interface AgentSettings {
  /** Selected agent personality */
  personality: Personality;
}

const DEFAULT_SETTINGS: AgentSettings = {
  personality: Personality.SOMMELIER,
};

// ===========================================
// Store Implementation
// ===========================================

function createAgentSettingsStore() {
  /**
   * Load settings from localStorage.
   * Falls back to defaults if not found or invalid.
   */
  function loadSettings(): AgentSettings {
    if (typeof window === 'undefined') {
      return DEFAULT_SETTINGS;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AgentSettings>;

        // Validate personality value
        if (parsed.personality && Object.values(Personality).includes(parsed.personality)) {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
          };
        }
      }
    } catch (e) {
      // Failed to parse stored settings - using defaults
    }

    return DEFAULT_SETTINGS;
  }

  /**
   * Persist settings to localStorage.
   */
  function persistSettings(settings: AgentSettings): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // Failed to persist settings
    }
  }

  const { subscribe, set, update } = writable<AgentSettings>(loadSettings());

  return {
    subscribe,

    /**
     * Set the agent personality.
     * @param personality - The personality to use
     */
    setPersonality(personality: Personality): void {
      update((s) => {
        const updated = { ...s, personality };
        persistSettings(updated);
        return updated;
      });
    },

    /**
     * Reset to default settings.
     */
    reset(): void {
      set(DEFAULT_SETTINGS);
      persistSettings(DEFAULT_SETTINGS);
    },

    /**
     * Initialize the store.
     * Call this on app mount to ensure settings are loaded.
     */
    initialize(): void {
      const settings = loadSettings();
      set(settings);
    },
  };
}

export const agentSettings = createAgentSettingsStore();

// ===========================================
// Getters
// ===========================================

/**
 * Get current personality synchronously.
 */
export function getPersonality(): Personality {
  return get(agentSettings).personality;
}
