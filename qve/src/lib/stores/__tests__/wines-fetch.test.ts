/**
 * Wines Store - fetchWines Tests (WIN-206)
 *
 * Tests for debounced fetching with AbortController and race condition guard.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$api', () => ({
	api: {
		getWines: vi.fn(),
	},
}));

import { api } from '$api';
import {
	wines,
	winesLoading,
	winesError,
	fetchWines,
	cancelFetchWines,
} from '../wines';

const mockedApi = vi.mocked(api);

describe('fetchWines (WIN-206)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		wines.set([]);
		winesLoading.set(false);
		winesError.set(null);
		cancelFetchWines();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('debounce', () => {
		it('should not fire API call immediately when debounce is active', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({});

			// API should NOT have been called yet (waiting for debounce)
			expect(mockedApi.getWines).not.toHaveBeenCalled();
		});

		it('should fire API call after 300ms debounce', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({});
			vi.advanceTimersByTime(300);

			expect(mockedApi.getWines).toHaveBeenCalledTimes(1);
		});

		it('should only fire once for rapid successive calls', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({ typesDropdown: 'Red' });
			vi.advanceTimersByTime(100);
			fetchWines({ typesDropdown: 'Red', countryDropdown: 'France' });
			vi.advanceTimersByTime(100);
			fetchWines({ typesDropdown: 'Red', countryDropdown: 'France', regionDropdown: 'Bordeaux' });
			vi.advanceTimersByTime(300);

			// Only the last call should have fired
			expect(mockedApi.getWines).toHaveBeenCalledTimes(1);
			expect(mockedApi.getWines).toHaveBeenCalledWith(
				{ typesDropdown: 'Red', countryDropdown: 'France', regionDropdown: 'Bordeaux' },
				expect.any(AbortSignal)
			);
		});

		it('should fire immediately when immediate=true', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({}, true);

			// Should fire immediately without waiting
			expect(mockedApi.getWines).toHaveBeenCalledTimes(1);
		});
	});

	describe('AbortController', () => {
		it('should pass AbortSignal to API call', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({}, true);

			expect(mockedApi.getWines).toHaveBeenCalledWith(
				expect.any(Object),
				expect.any(AbortSignal)
			);
		});

		it('should abort previous request when new one starts', async () => {
			const abortedSignals: AbortSignal[] = [];
			mockedApi.getWines.mockImplementation((_filters, signal) => {
				if (signal) abortedSignals.push(signal);
				return new Promise((resolve) => setTimeout(() => resolve([]), 1000));
			});

			// First call (immediate)
			fetchWines({ typesDropdown: 'Red' }, true);
			const firstSignal = abortedSignals[0];

			// Second call (immediate) — should abort the first
			fetchWines({ typesDropdown: 'White' }, true);

			expect(firstSignal.aborted).toBe(true);
			expect(abortedSignals[1].aborted).toBe(false);
		});

		it('should not set error when request is aborted', async () => {
			mockedApi.getWines.mockImplementation((_filters, signal) => {
				return new Promise((_, reject) => {
					signal?.addEventListener('abort', () => {
						reject(new DOMException('The operation was aborted.', 'AbortError'));
					});
				});
			});

			fetchWines({}, true);
			// Abort by firing a new request
			fetchWines({}, true);

			// Let promises settle
			await vi.advanceTimersByTimeAsync(0);

			expect(get(winesError)).toBeNull();
		});
	});

	describe('race condition guard (fetchCounter)', () => {
		it('should discard stale responses', async () => {
			const staleWines = [{ wineID: 1, wineName: 'Stale' }];
			const freshWines = [{ wineID: 2, wineName: 'Fresh' }];

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const resolvers: Array<(value: any) => void> = [];
			mockedApi.getWines.mockImplementation(() => {
				return new Promise((resolve) => {
					resolvers.push(resolve);
				});
			});

			// First call
			fetchWines({}, true);
			// Second call — first is now stale
			fetchWines({}, true);

			// Resolve first (stale) response
			resolvers[0](staleWines);
			await vi.advanceTimersByTimeAsync(0);

			// Stale response should be ignored
			expect(get(wines)).toEqual([]);

			// Resolve second (fresh) response
			resolvers[1](freshWines);
			await vi.advanceTimersByTimeAsync(0);

			expect(get(wines)).toEqual(freshWines);
		});
	});

	describe('loading state', () => {
		it('should set loading true when fetch starts', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({}, true);

			expect(get(winesLoading)).toBe(true);
		});

		it('should set loading false when fetch completes', async () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({}, true);
			await vi.advanceTimersByTimeAsync(0);

			expect(get(winesLoading)).toBe(false);
		});

		it('should set loading false on error', async () => {
			mockedApi.getWines.mockRejectedValue(new Error('Network error'));

			fetchWines({}, true);
			await vi.advanceTimersByTimeAsync(0);

			expect(get(winesLoading)).toBe(false);
			expect(get(winesError)).toBe('Network error');
		});
	});

	describe('cancelFetchWines', () => {
		it('should cancel pending debounce timer', () => {
			mockedApi.getWines.mockResolvedValue([]);

			fetchWines({});
			cancelFetchWines();
			vi.advanceTimersByTime(300);

			expect(mockedApi.getWines).not.toHaveBeenCalled();
		});
	});
});
