import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { addBottle, canSubmitAddBottle, isDirtyAddBottle } from '../addBottle';

// Mock the API module
vi.mock('$api', () => ({
	api: {
		addBottle: vi.fn(),
	},
}));

// Mock the toast module
vi.mock('../toast', () => ({
	toasts: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Import mocks after vi.mock
import { api } from '$api';
import { toasts } from '../toast';

const mockedApi = vi.mocked(api);
const mockedToasts = vi.mocked(toasts);

describe('addBottle store', () => {
	beforeEach(() => {
		addBottle.reset();
		vi.clearAllMocks();
	});

	describe('init', () => {
		it('should initialize with wine context', () => {
			addBottle.init(123, 'Test Wine');
			const state = get(addBottle);

			expect(state.wineID).toBe(123);
			expect(state.wineName).toBe('Test Wine');
			expect(state.quantity).toBe(1);
			expect(state.purchaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
		});

		it('should reset form fields', () => {
			addBottle.setField('bottleSize', '750ml');
			addBottle.init(456, 'Another Wine');
			const state = get(addBottle);

			expect(state.bottleSize).toBe('');
			expect(state.storageLocation).toBe('');
		});
	});

	describe('setField', () => {
		it('should update field value', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');

			expect(get(addBottle).bottleSize).toBe('750ml');
		});

		it('should clear error for field when changed', () => {
			addBottle.init(123, 'Test Wine');
			// Trigger validation to set errors
			addBottle.validate();
			expect(get(addBottle).errors.bottleSize).toBeDefined();

			// Set the field
			addBottle.setField('bottleSize', '750ml');
			expect(get(addBottle).errors.bottleSize).toBeUndefined();
		});
	});

	describe('validate', () => {
		it('should require bottleSize', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.validate();

			expect(get(addBottle).errors.bottleSize).toBe('Bottle size is required');
		});

		it('should require storageLocation', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.validate();

			expect(get(addBottle).errors.storageLocation).toBe('Storage location is required');
		});

		it('should require source', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.validate();

			expect(get(addBottle).errors.source).toBe('Source is required');
		});

		it('should validate quantity range (1-24)', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('quantity', 0);
			addBottle.validate();

			expect(get(addBottle).errors.quantity).toBe('Quantity must be between 1 and 24');

			addBottle.setField('quantity', 25);
			addBottle.validate();

			expect(get(addBottle).errors.quantity).toBe('Quantity must be between 1 and 24');
		});

		it('should pass with valid data', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('storageLocation', 'Wine Fridge');
			addBottle.setField('source', 'Wine Shop');
			addBottle.setField('quantity', 3);

			const isValid = addBottle.validate();
			expect(isValid).toBe(true);
			expect(Object.keys(get(addBottle).errors)).toHaveLength(0);
		});
	});

	describe('submit', () => {
		beforeEach(() => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('storageLocation', 'Wine Fridge');
			addBottle.setField('source', 'Wine Shop');
			addBottle.setField('price', '25.00');
			addBottle.setField('currency', 'GBP');
		});

		it('should fail if validation fails', async () => {
			addBottle.setField('bottleSize', ''); // Invalid

			const result = await addBottle.submit();

			expect(result.success).toBe(false);
			expect(mockedApi.addBottle).not.toHaveBeenCalled();
		});

		it('should fail if no wineID', async () => {
			addBottle.reset();
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('storageLocation', 'Wine Fridge');
			addBottle.setField('source', 'Wine Shop');

			const result = await addBottle.submit();

			expect(result.success).toBe(false);
			expect(mockedToasts.error).toHaveBeenCalledWith('No wine selected');
		});

		it('should call API with quantity=1 for single bottle', async () => {
			mockedApi.addBottle.mockResolvedValueOnce({ bottleID: 1 });
			addBottle.setField('quantity', 1);

			const result = await addBottle.submit();

			expect(result.success).toBe(true);
			expect(result.count).toBe(1);
			expect(mockedApi.addBottle).toHaveBeenCalledTimes(1);
			expect(mockedApi.addBottle).toHaveBeenCalledWith(
				expect.objectContaining({
					wineID: 123,
					bottleSize: '750ml',
					quantity: 1,
				})
			);
		});

		/**
		 * WIN-222: Atomicity test
		 * When adding multiple bottles (quantity > 1), the API should be called
		 * ONCE with the quantity parameter, NOT multiple times in a loop.
		 * This ensures atomicity - either all bottles are added or none are.
		 */
		it('should call API ONCE with quantity for multiple bottles (atomicity)', async () => {
			mockedApi.addBottle.mockResolvedValueOnce({ bottleIDs: [1, 2, 3, 4, 5] });
			addBottle.setField('quantity', 5);

			const result = await addBottle.submit();

			expect(result.success).toBe(true);
			expect(result.count).toBe(5);
			// Critical: API should be called exactly ONCE, not 5 times
			expect(mockedApi.addBottle).toHaveBeenCalledTimes(1);
			// Quantity should be passed to the API
			expect(mockedApi.addBottle).toHaveBeenCalledWith(
				expect.objectContaining({
					wineID: 123,
					quantity: 5,
				})
			);
		});

		it('should show success toast for single bottle', async () => {
			mockedApi.addBottle.mockResolvedValueOnce({ bottleID: 1 });
			addBottle.setField('quantity', 1);

			await addBottle.submit();

			expect(mockedToasts.success).toHaveBeenCalledWith('Bottle added to Test Wine');
		});

		it('should show success toast for multiple bottles', async () => {
			mockedApi.addBottle.mockResolvedValueOnce({ bottleIDs: [1, 2, 3] });
			addBottle.setField('quantity', 3);

			await addBottle.submit();

			expect(mockedToasts.success).toHaveBeenCalledWith('3 bottles added to Test Wine');
		});

		it('should handle API error', async () => {
			mockedApi.addBottle.mockRejectedValueOnce(new Error('Network error'));

			const result = await addBottle.submit();

			expect(result.success).toBe(false);
			expect(mockedToasts.error).toHaveBeenCalledWith('Network error');
		});

		it('should set isSubmitting during API call', async () => {
			let isSubmittingDuringCall = false;
			mockedApi.addBottle.mockImplementationOnce(async () => {
				isSubmittingDuringCall = get(addBottle).isSubmitting;
				return { bottleID: 1 };
			});

			await addBottle.submit();

			expect(isSubmittingDuringCall).toBe(true);
			expect(get(addBottle).isSubmitting).toBe(false);
		});

		it('should reset isSubmitting on error', async () => {
			mockedApi.addBottle.mockRejectedValueOnce(new Error('Fail'));

			await addBottle.submit();

			expect(get(addBottle).isSubmitting).toBe(false);
		});
	});

	describe('reset', () => {
		it('should reset to initial state', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('quantity', 5);
			addBottle.reset();

			const state = get(addBottle);
			expect(state.wineID).toBeNull();
			expect(state.wineName).toBe('');
			expect(state.bottleSize).toBe('');
			expect(state.quantity).toBe(1);
		});
	});

	describe('isDirtyAddBottle', () => {
		it('should be false initially', () => {
			addBottle.init(123, 'Test Wine');
			expect(get(isDirtyAddBottle)).toBe(false);
		});

		it('should be true when fields are modified', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			expect(get(isDirtyAddBottle)).toBe(true);
		});
	});

	describe('canSubmitAddBottle', () => {
		it('should be false without required fields', () => {
			addBottle.init(123, 'Test Wine');
			expect(get(canSubmitAddBottle)).toBe(false);
		});

		it('should be true with all required fields', () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('storageLocation', 'Wine Fridge');
			addBottle.setField('source', 'Wine Shop');

			expect(get(canSubmitAddBottle)).toBe(true);
		});

		it('should be false when submitting', async () => {
			addBottle.init(123, 'Test Wine');
			addBottle.setField('bottleSize', '750ml');
			addBottle.setField('storageLocation', 'Wine Fridge');
			addBottle.setField('source', 'Wine Shop');

			let canSubmitDuringCall = true;
			mockedApi.addBottle.mockImplementationOnce(async () => {
				canSubmitDuringCall = get(canSubmitAddBottle);
				return { bottleID: 1 };
			});

			await addBottle.submit();

			expect(canSubmitDuringCall).toBe(false);
		});
	});
});
