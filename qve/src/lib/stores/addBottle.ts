/**
 * Add Bottle Store
 * Manages form state for adding bottles to existing wines
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$api';
import { toasts } from './toast';
import { validateRequired, validateLength, validatePriceCurrency, FIELD_MAX_LENGTHS } from '$lib/utils/validation';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface AddBottleState {
	wineID: number | null;
	wineName: string;

	// Form fields
	bottleSize: string;
	storageLocation: string;
	source: string;
	price: string;
	currency: string;
	purchaseDate: string;
	quantity: number;

	// UI state
	isSubmitting: boolean;
	errors: Record<string, string>;
}

// ─────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────

// Storage locations remain hardcoded (user-specific, rarely change)
// Note: Bottle sizes and currencies are now DB-driven via currency.ts
export const storageOptions = [
	{ value: 'Wine Fridge', label: 'Wine Fridge' },
	{ value: 'Wine Cellar', label: 'Wine Cellar' },
	{ value: 'Spirit Cupboard', label: 'Spirit Cupboard' },
	{ value: 'Kitchen', label: 'Kitchen' },
	{ value: 'Other', label: 'Other' }
];

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

const initialState: AddBottleState = {
	wineID: null,
	wineName: '',
	bottleSize: '',
	storageLocation: '',
	source: '',
	price: '',
	currency: 'GBP',
	purchaseDate: '',
	quantity: 1,
	isSubmitting: false,
	errors: {}
};

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createAddBottleStore() {
	const { subscribe, set, update } = writable<AddBottleState>({ ...initialState });

	// Track initial values for dirty checking
	let initialValues = { ...initialState };

	return {
		subscribe,

		/**
		 * Initialize the store with wine context
		 */
		init(wineID: number, wineName: string): void {
			const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
			const newState: AddBottleState = {
				...initialState,
				wineID,
				wineName,
				purchaseDate: today
			};
			set(newState);
			initialValues = { ...newState };
		},

		/**
		 * Set a form field value
		 */
		setField<K extends keyof AddBottleState>(field: K, value: AddBottleState[K]): void {
			update((state) => {
				const newState = { ...state, [field]: value };
				// Clear error for this field when user changes it
				if (state.errors[field as string]) {
					const newErrors = { ...state.errors };
					delete newErrors[field as string];
					newState.errors = newErrors;
				}
				return newState;
			});
		},

		/**
		 * Validate field on blur
		 */
		validateFieldBlur(field: string, value: string): void {
			let error: string | null = null;
			switch (field) {
				case 'storageLocation':
					error = validateRequired(value, 'Storage location') ?? validateLength(value, FIELD_MAX_LENGTHS.storageLocation);
					break;
				case 'source':
					error = validateRequired(value, 'Source') ?? validateLength(value, FIELD_MAX_LENGTHS.source);
					break;
			}
			update((state) => {
				const newErrors = { ...state.errors };
				if (error) { newErrors[field] = error; }
				else { delete newErrors[field]; }
				return { ...state, errors: newErrors };
			});
		},

		/**
		 * Validate required fields
		 */
		validate(): boolean {
			const state = get({ subscribe });
			const errors: Record<string, string> = {};

			if (!state.bottleSize) {
				errors.bottleSize = 'Bottle size is required';
			}
			if (!state.storageLocation) {
				errors.storageLocation = 'Storage location is required';
			}
			if (!state.source.trim()) {
				errors.source = 'Source is required';
			}
			const priceCurrencyErrors = validatePriceCurrency(state.price, state.currency);
			if (priceCurrencyErrors.price) errors.price = priceCurrencyErrors.price;
			if (priceCurrencyErrors.currency) errors.currency = priceCurrencyErrors.currency;
			if (state.quantity < 1 || state.quantity > 24) {
				errors.quantity = 'Quantity must be between 1 and 24';
			}

			update((s) => ({ ...s, errors }));
			return Object.keys(errors).length === 0;
		},

		/**
		 * Submit the form - adds bottle(s) to the wine
		 * WIN-222: Single atomic request with quantity (no loop)
		 */
		async submit(): Promise<{ success: boolean; wineID: number | null; count: number }> {
			const state = get({ subscribe });

			if (!this.validate()) {
				return { success: false, wineID: null, count: 0 };
			}

			if (!state.wineID) {
				toasts.error('No wine selected');
				return { success: false, wineID: null, count: 0 };
			}

			update((s) => ({ ...s, isSubmitting: true }));

			try {
				const quantity = state.quantity || 1;

				// WIN-222: Single atomic API call with quantity
				// Backend handles batch insert in a single transaction
				await api.addBottle({
					wineID: state.wineID,
					bottleSize: state.bottleSize,
					bottleLocation: state.storageLocation,
					bottleSource: state.source.trim(),
					bottlePrice: state.price ? parseFloat(state.price) : undefined,
					bottleCurrency: state.currency || undefined,
					purchaseDate: state.purchaseDate || undefined,
					quantity
				});

				// Show success toast
				if (quantity > 1) {
					toasts.success(`${quantity} bottles added to ${state.wineName}`);
				} else {
					toasts.success(`Bottle added to ${state.wineName}`);
				}

				return { success: true, wineID: state.wineID, count: quantity };
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to add bottle';
				toasts.error(message);
				return { success: false, wineID: state.wineID, count: 0 };
			} finally {
				update((s) => ({ ...s, isSubmitting: false }));
			}
		},

		/**
		 * Reset the store to initial state
		 */
		reset(): void {
			set({ ...initialState });
			initialValues = { ...initialState };
		}
	};
}

export const addBottle = createAddBottleStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/**
 * Check if form has been modified from initial values
 */
export const isDirtyAddBottle = derived(addBottle, ($state) => {
	return (
		$state.bottleSize !== '' ||
		$state.storageLocation !== '' ||
		$state.source !== '' ||
		$state.price !== ''
	);
});

/**
 * Check if form can be submitted (required fields filled)
 */
export const canSubmitAddBottle = derived(addBottle, ($state) => {
	return (
		$state.wineID !== null &&
		$state.bottleSize !== '' &&
		$state.storageLocation !== '' &&
		$state.source.trim() !== '' &&
		(!$state.price || $state.price.trim() === '' || $state.currency !== '') &&
		$state.quantity >= 1 &&
		$state.quantity <= 24 &&
		!$state.isSubmitting
	);
});
