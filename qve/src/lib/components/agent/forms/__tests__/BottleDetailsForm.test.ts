import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import BottleDetailsForm from '../BottleDetailsForm.svelte';

// Mock the API
vi.mock('$lib/api', () => ({
	api: {
		getCurrencies: vi.fn().mockResolvedValue({
			bottleSizes: [
				{ sizeCode: 'standard', sizeName: 'Standard', volumeLitres: 0.75 },
				{ sizeCode: 'magnum', sizeName: 'Magnum', volumeLitres: 1.5 },
			],
			currencies: [
				{ currencyCode: 'GBP', currencyName: 'British Pound' },
				{ currencyCode: 'USD', currencyName: 'US Dollar' },
			],
		}),
	},
}));

describe('BottleDetailsForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	describe('double-click protection (WIN-228)', () => {
		// Note: Event dispatching tests skipped due to Svelte 5 createEventDispatcher
		// API changes. We test behavior via button disabled state instead.

		it('should disable submit button after first click to prevent double-submit', async () => {
			render(BottleDetailsForm, {
				props: {
					part: 2,
					initialData: {
						size: 'standard',
						location: 'Cellar',
						source: 'Wine Shop',
					},
				},
			});

			// Wait for form to load
			await vi.waitFor(() => {
				expect(screen.getByRole('button', { name: /Add to Cellar/i })).toBeInTheDocument();
			});

			const submitButton = screen.getByRole('button', { name: /Add to Cellar/i });

			// Button should be enabled initially
			expect(submitButton).not.toBeDisabled();

			// First click
			await fireEvent.click(submitButton);

			// Button should now be disabled to prevent double-click
			expect(submitButton).toBeDisabled();
		});

		it('should disable next button after first click to prevent double-click', async () => {
			render(BottleDetailsForm, {
				props: {
					part: 1,
					initialData: {
						size: 'standard',
						location: 'Cellar',
						source: 'Wine Shop',
					},
				},
			});

			// Wait for form to load
			await vi.waitFor(() => {
				expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
			});

			const nextButton = screen.getByRole('button', { name: /Next/i });

			// Button should be enabled initially
			expect(nextButton).not.toBeDisabled();

			// First click
			await fireEvent.click(nextButton);

			// Button should now be disabled to prevent double-click
			expect(nextButton).toBeDisabled();
		});
	});
});
