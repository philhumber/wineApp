/**
 * Settings Store
 * Manages user settings with database persistence
 * Falls back to localStorage if database unavailable
 *
 * WIN-126: Collection Name
 * WIN-127: Cellar Value
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { api } from '$lib/api';
import type { CellarValue } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'Our Wines';
const STORAGE_KEY = 'qve-collection-name-fallback';
const CELLAR_VALUE_CACHE_DURATION = 60000; // 1 minute

// ─────────────────────────────────────────────────────────
// COLLECTION NAME STORE (WIN-126)
// ─────────────────────────────────────────────────────────

function createCollectionNameStore() {
	const { subscribe, set } = writable<string>(DEFAULT_COLLECTION_NAME);
	const isInitialized = writable(false);
	const isSaving = writable(false);

	return {
		subscribe,
		isInitialized: { subscribe: isInitialized.subscribe },
		isSaving: { subscribe: isSaving.subscribe },

		/**
		 * Initialize from database on app mount
		 */
		initialize: async () => {
			if (get(isInitialized)) return;

			try {
				const settings = await api.getUserSettings();
				set(settings.collectionName || DEFAULT_COLLECTION_NAME);

				// Also cache in localStorage as fallback
				if (browser) {
					localStorage.setItem(STORAGE_KEY, settings.collectionName || DEFAULT_COLLECTION_NAME);
				}
			} catch (error) {
				console.error('Failed to load collection name:', error);
				// Try localStorage fallback
				if (browser) {
					const cached = localStorage.getItem(STORAGE_KEY);
					if (cached) set(cached);
				}
			} finally {
				isInitialized.set(true);
			}
		},

		/**
		 * Update collection name (persists to database)
		 */
		update: async (name: string) => {
			const trimmedName = name.trim() || DEFAULT_COLLECTION_NAME;

			// Optimistic update
			set(trimmedName);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, trimmedName);
			}

			isSaving.set(true);
			try {
				await api.updateUserSettings({ collectionName: trimmedName });
			} catch (error) {
				console.error('Failed to save collection name:', error);
				// Keep optimistic update - localStorage serves as fallback
				throw error;
			} finally {
				isSaving.set(false);
			}
		}
	};
}

export const collectionName = createCollectionNameStore();

// ─────────────────────────────────────────────────────────
// CELLAR VALUE STORE (WIN-127)
// ─────────────────────────────────────────────────────────

function createCellarValueStore() {
	const { subscribe, set } = writable<CellarValue | null>(null);
	const isLoading = writable(false);
	let lastFetched: number | null = null;

	return {
		subscribe,
		isLoading: { subscribe: isLoading.subscribe },

		/**
		 * Fetch cellar value (with caching)
		 */
		fetch: async (forceRefresh = false) => {
			const now = Date.now();

			// Return cached value if still valid
			if (!forceRefresh && lastFetched && now - lastFetched < CELLAR_VALUE_CACHE_DURATION) {
				return;
			}

			isLoading.set(true);
			try {
				const value = await api.getCellarValue();
				set(value);
				lastFetched = now;
			} catch (error) {
				console.error('Failed to fetch cellar value:', error);
				// Keep previous value on error
			} finally {
				isLoading.set(false);
			}
		},

		/**
		 * Invalidate cache (call after adding/removing bottles)
		 */
		invalidate: () => {
			lastFetched = null;
		}
	};
}

export const cellarValue = createCellarValueStore();
