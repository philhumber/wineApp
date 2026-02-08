import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the API module before importing the store
vi.mock('$lib/api', () => ({
	api: {
		getCountries: vi.fn(),
		getTypes: vi.fn(),
		getRegions: vi.fn(),
		getProducers: vi.fn(),
		getYears: vi.fn()
	}
}));

import { api } from '$lib/api';
import { filterOptions } from '../filterOptions';

const mockCountries = [
	{ countryName: 'France', code: 'fr', bottleCount: 10 },
	{ countryName: 'Italy', code: 'it', bottleCount: 5 }
];

const mockTypes = [
	{ wineTypeName: 'Red', bottleCount: 8 },
	{ wineTypeName: 'White', bottleCount: 4 }
];

beforeEach(() => {
	vi.clearAllMocks();
	filterOptions.invalidate();
	(api.getCountries as ReturnType<typeof vi.fn>).mockResolvedValue(mockCountries);
	(api.getTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockTypes);
});

describe('filterOptions store', () => {
	describe('unfiltered caching (existing behavior)', () => {
		it('should cache unfiltered results and not re-fetch', async () => {
			await filterOptions.fetchCountries('ourWines');
			await filterOptions.fetchCountries('ourWines');

			expect(api.getCountries).toHaveBeenCalledTimes(1);
		});

		it('should cache separately per view mode', async () => {
			await filterOptions.fetchCountries('ourWines');
			await filterOptions.fetchCountries('allWines');

			expect(api.getCountries).toHaveBeenCalledTimes(2);
		});
	});

	describe('filtered caching (WIN-238 bug fix)', () => {
		it('should cache filtered results and not re-fetch for same filter combination', async () => {
			// First call with type=Red filter
			await filterOptions.fetchCountries('ourWines', 'Red');
			// Second call with same filter - should use cache
			await filterOptions.fetchCountries('ourWines', 'Red');

			expect(api.getCountries).toHaveBeenCalledTimes(1);
		});

		it('should fetch again when filter combination changes', async () => {
			await filterOptions.fetchCountries('ourWines', 'Red');
			await filterOptions.fetchCountries('ourWines', 'White');

			expect(api.getCountries).toHaveBeenCalledTimes(2);
		});

		it('should cache multi-filter combinations independently', async () => {
			// Call with type=Red, region=Burgundy
			await filterOptions.fetchCountries('ourWines', 'Red', 'Burgundy');
			// Same combo - should hit cache
			await filterOptions.fetchCountries('ourWines', 'Red', 'Burgundy');
			// Different combo - should miss cache
			await filterOptions.fetchCountries('ourWines', 'Red', 'Bordeaux');

			expect(api.getCountries).toHaveBeenCalledTimes(2);
		});

		it('should treat unfiltered and filtered as separate cache entries', async () => {
			await filterOptions.fetchCountries('ourWines');
			await filterOptions.fetchCountries('ourWines', 'Red');

			expect(api.getCountries).toHaveBeenCalledTimes(2);
		});

		it('should invalidate all cached entries including filtered ones', async () => {
			await filterOptions.fetchCountries('ourWines');
			await filterOptions.fetchCountries('ourWines', 'Red');

			filterOptions.invalidate('countries');

			await filterOptions.fetchCountries('ourWines');
			await filterOptions.fetchCountries('ourWines', 'Red');

			expect(api.getCountries).toHaveBeenCalledTimes(4);
		});

		it('should work for fetchTypes with filters', async () => {
			await filterOptions.fetchTypes('ourWines', 'France');
			await filterOptions.fetchTypes('ourWines', 'France');

			expect(api.getTypes).toHaveBeenCalledTimes(1);
		});
	});
});
