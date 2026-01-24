/**
 * Edit Wine Store
 * Manages form state for editing wine and bottle details
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$api';
import { toasts } from './toast';
import type { Wine, Bottle, WineType } from '$lib/api/types';

// Reuse options from addBottle store
import { bottleSizeOptions, storageOptions, currencyOptions } from './addBottle';
export { bottleSizeOptions, storageOptions, currencyOptions };

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface EditWineFormData {
	wineName: string;
	wineYear: string;
	wineType: string;
	wineDescription: string;
	wineTasting: string;
	winePairing: string;
	winePicture: string;
	picturePreview: string | null;
	pictureFile: File | null;
}

export interface EditBottleFormData {
	bottleSize: string;
	location: string;
	source: string;
	price: string;
	currency: string;
	purchaseDate: string;
}

export interface EditWineState {
	// Wine identification
	wineID: number | null;

	// Active tab
	activeTab: 'wine' | 'bottle';

	// Wine form data (Tab 1)
	wine: EditWineFormData;

	// Original wine data (for dirty checking)
	originalWine: EditWineFormData | null;

	// Bottles list (available for editing)
	bottles: Bottle[];

	// Selected bottle ID (Tab 2)
	selectedBottleID: number | null;

	// Bottle form data (Tab 2)
	bottle: EditBottleFormData;

	// Original bottle data (for dirty checking)
	originalBottle: EditBottleFormData | null;

	// Wine types for dropdown
	wineTypes: WineType[];

	// UI state
	isLoading: boolean;
	isSubmitting: boolean;
	errors: Record<string, string>;
}

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

const initialWineForm: EditWineFormData = {
	wineName: '',
	wineYear: '',
	wineType: '',
	wineDescription: '',
	wineTasting: '',
	winePairing: '',
	winePicture: '',
	picturePreview: null,
	pictureFile: null
};

const initialBottleForm: EditBottleFormData = {
	bottleSize: '',
	location: '',
	source: '',
	price: '',
	currency: 'GBP',
	purchaseDate: ''
};

const initialState: EditWineState = {
	wineID: null,
	activeTab: 'wine',
	wine: { ...initialWineForm },
	originalWine: null,
	bottles: [],
	selectedBottleID: null,
	bottle: { ...initialBottleForm },
	originalBottle: null,
	wineTypes: [],
	isLoading: false,
	isSubmitting: false,
	errors: {}
};

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createEditWineStore() {
	const { subscribe, set, update } = writable<EditWineState>({ ...initialState });

	return {
		subscribe,

		/**
		 * Initialize the store with wine data
		 */
		async init(wineID: number): Promise<boolean> {
			update((s) => ({ ...s, isLoading: true, wineID, errors: {} }));

			try {
				// Fetch wine, bottles, and wine types in parallel
				const [wine, bottles, wineTypes] = await Promise.all([
					api.getWine(wineID),
					api.getBottles(wineID),
					api.getTypes({ withBottleCount: false })
				]);

				if (!wine) {
					throw new Error('Wine not found');
				}

				// Map wine data to form
				const wineForm: EditWineFormData = {
					wineName: wine.wineName || '',
					wineYear: wine.year || '',
					wineType: wine.wineType || '',
					wineDescription: wine.description || '',
					wineTasting: wine.tastingNotes || '',
					winePairing: wine.pairing || '',
					winePicture: wine.pictureURL || '',
					picturePreview: wine.pictureURL ? `/${wine.pictureURL}` : null,
					pictureFile: null
				};

				// Set first bottle as selected if available
				let selectedBottleID: number | null = null;
				let bottleForm: EditBottleFormData = { ...initialBottleForm };

				if (bottles.length > 0) {
					const firstBottle = bottles[0];
					selectedBottleID = firstBottle.bottleID;
					bottleForm = mapBottleToForm(firstBottle);
				}

				update((s) => ({
					...s,
					wineID,
					wine: wineForm,
					originalWine: { ...wineForm },
					bottles,
					selectedBottleID,
					bottle: bottleForm,
					originalBottle: bottles.length > 0 ? { ...bottleForm } : null,
					wineTypes,
					isLoading: false
				}));

				return true;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to load wine';
				toasts.error(message);
				update((s) => ({ ...s, isLoading: false }));
				return false;
			}
		},

		/**
		 * Set active tab
		 */
		setTab(tab: 'wine' | 'bottle'): void {
			update((s) => ({ ...s, activeTab: tab }));
		},

		/**
		 * Set a wine form field
		 */
		setWineField<K extends keyof EditWineFormData>(field: K, value: EditWineFormData[K]): void {
			update((state) => {
				const newWine = { ...state.wine, [field]: value };
				// Clear error for this field
				const newErrors = { ...state.errors };
				delete newErrors[`wine.${field}`];
				return { ...state, wine: newWine, errors: newErrors };
			});
		},

		/**
		 * Set wine picture (file selected for upload)
		 */
		setWinePicture(file: File, preview: string): void {
			update((s) => ({
				...s,
				wine: {
					...s.wine,
					pictureFile: file,
					picturePreview: preview
				}
			}));
		},

		/**
		 * Clear wine picture
		 */
		clearWinePicture(): void {
			update((s) => ({
				...s,
				wine: {
					...s.wine,
					winePicture: '',
					pictureFile: null,
					picturePreview: null
				}
			}));
		},

		/**
		 * Select a bottle to edit
		 */
		selectBottle(bottleID: number): void {
			const state = get({ subscribe });
			const bottle = state.bottles.find((b) => b.bottleID === bottleID);

			if (bottle) {
				const bottleForm = mapBottleToForm(bottle);
				update((s) => ({
					...s,
					selectedBottleID: bottleID,
					bottle: bottleForm,
					originalBottle: { ...bottleForm }
				}));
			}
		},

		/**
		 * Set a bottle form field
		 */
		setBottleField<K extends keyof EditBottleFormData>(field: K, value: EditBottleFormData[K]): void {
			update((state) => {
				const newBottle = { ...state.bottle, [field]: value };
				// Clear error for this field
				const newErrors = { ...state.errors };
				delete newErrors[`bottle.${field}`];
				return { ...state, bottle: newBottle, errors: newErrors };
			});
		},

		/**
		 * Validate wine form
		 */
		validateWine(): boolean {
			const state = get({ subscribe });
			const errors: Record<string, string> = {};

			if (!state.wine.wineName.trim()) {
				errors['wine.wineName'] = 'Wine name is required';
			}
			if (!state.wine.wineType) {
				errors['wine.wineType'] = 'Wine type is required';
			}
			if (!state.wine.wineDescription.trim()) {
				errors['wine.wineDescription'] = 'Description is required';
			}
			if (!state.wine.wineTasting.trim()) {
				errors['wine.wineTasting'] = 'Tasting notes are required';
			}
			if (!state.wine.winePairing.trim()) {
				errors['wine.winePairing'] = 'Food pairing is required';
			}
			// Picture is required (either existing or new upload)
			if (!state.wine.winePicture && !state.wine.pictureFile) {
				errors['wine.winePicture'] = 'Wine image is required';
			}

			update((s) => ({ ...s, errors: { ...s.errors, ...errors } }));
			return Object.keys(errors).length === 0;
		},

		/**
		 * Validate bottle form
		 */
		validateBottle(): boolean {
			const state = get({ subscribe });
			const errors: Record<string, string> = {};

			if (!state.selectedBottleID) {
				errors['bottle.selection'] = 'Please select a bottle to edit';
				update((s) => ({ ...s, errors: { ...s.errors, ...errors } }));
				return false;
			}

			if (!state.bottle.bottleSize) {
				errors['bottle.bottleSize'] = 'Bottle size is required';
			}
			if (!state.bottle.location) {
				errors['bottle.location'] = 'Storage location is required';
			}
			if (!state.bottle.source.trim()) {
				errors['bottle.source'] = 'Source is required';
			}

			update((s) => ({ ...s, errors: { ...s.errors, ...errors } }));
			return Object.keys(errors).length === 0;
		},

		/**
		 * Submit wine changes
		 */
		async submitWine(): Promise<boolean> {
			if (!this.validateWine()) {
				return false;
			}

			const state = get({ subscribe });
			if (!state.wineID) {
				toasts.error('No wine ID');
				return false;
			}

			update((s) => ({ ...s, isSubmitting: true }));

			try {
				// Upload new image if changed
				let pictureFilename = state.wine.winePicture;
				if (state.wine.pictureFile) {
					pictureFilename = await api.uploadImage(state.wine.pictureFile);
				}

				// Submit wine update
				await api.updateWine({
					wineID: state.wineID,
					wineName: state.wine.wineName.trim(),
					wineType: state.wine.wineType,
					wineYear: state.wine.wineYear || undefined,
					wineDescription: state.wine.wineDescription.trim(),
					wineTasting: state.wine.wineTasting.trim(),
					winePairing: state.wine.winePairing.trim(),
					winePicture: pictureFilename
				});

				toasts.success('Wine updated successfully!');
				return true;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to update wine';
				toasts.error(message);
				return false;
			} finally {
				update((s) => ({ ...s, isSubmitting: false }));
			}
		},

		/**
		 * Submit bottle changes
		 */
		async submitBottle(): Promise<boolean> {
			if (!this.validateBottle()) {
				return false;
			}

			const state = get({ subscribe });
			if (!state.selectedBottleID) {
				toasts.error('No bottle selected');
				return false;
			}

			update((s) => ({ ...s, isSubmitting: true }));

			try {
				await api.updateBottle({
					bottleID: state.selectedBottleID,
					bottleSize: state.bottle.bottleSize,
					location: state.bottle.location,
					bottleSource: state.bottle.source.trim(),
					bottlePrice: state.bottle.price ? parseFloat(state.bottle.price) : undefined,
					bottleCurrency: state.bottle.currency || undefined,
					purchaseDate: state.bottle.purchaseDate || undefined
				});

				toasts.success('Bottle updated successfully!');
				return true;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to update bottle';
				toasts.error(message);
				return false;
			} finally {
				update((s) => ({ ...s, isSubmitting: false }));
			}
		},

		/**
		 * Reset the store
		 */
		reset(): void {
			set({ ...initialState });
		}
	};
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function mapBottleToForm(bottle: Bottle): EditBottleFormData {
	return {
		bottleSize: bottle.bottleSize || '',
		location: bottle.bottleLocation || '',
		source: bottle.bottleSource || '',
		price: bottle.bottlePrice != null ? String(bottle.bottlePrice) : '',
		currency: bottle.bottleCurrency || 'GBP',
		purchaseDate: bottle.purchaseDate || ''
	};
}

// ─────────────────────────────────────────────────────────
// STORE INSTANCE
// ─────────────────────────────────────────────────────────

export const editWine = createEditWineStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/**
 * Check if wine form has been modified
 */
export const isWineDirty = derived(editWine, ($state) => {
	if (!$state.originalWine) return false;
	const orig = $state.originalWine;
	const curr = $state.wine;
	return (
		curr.wineName !== orig.wineName ||
		curr.wineYear !== orig.wineYear ||
		curr.wineType !== orig.wineType ||
		curr.wineDescription !== orig.wineDescription ||
		curr.wineTasting !== orig.wineTasting ||
		curr.winePairing !== orig.winePairing ||
		curr.pictureFile !== null // New image selected
	);
});

/**
 * Check if bottle form has been modified
 */
export const isBottleDirty = derived(editWine, ($state) => {
	if (!$state.originalBottle) return false;
	const orig = $state.originalBottle;
	const curr = $state.bottle;
	return (
		curr.bottleSize !== orig.bottleSize ||
		curr.location !== orig.location ||
		curr.source !== orig.source ||
		curr.price !== orig.price ||
		curr.currency !== orig.currency ||
		curr.purchaseDate !== orig.purchaseDate
	);
});

/**
 * Check if any form is dirty
 */
export const isEditDirty = derived(
	[isWineDirty, isBottleDirty],
	([$wineDirty, $bottleDirty]) => $wineDirty || $bottleDirty
);

/**
 * Check if wine form can be submitted
 */
export const canSubmitWine = derived(editWine, ($state) => {
	return (
		$state.wineID !== null &&
		$state.wine.wineName.trim() !== '' &&
		$state.wine.wineType !== '' &&
		$state.wine.wineDescription.trim() !== '' &&
		$state.wine.wineTasting.trim() !== '' &&
		$state.wine.winePairing.trim() !== '' &&
		($state.wine.winePicture !== '' || $state.wine.pictureFile !== null) &&
		!$state.isSubmitting
	);
});

/**
 * Check if bottle form can be submitted
 */
export const canSubmitBottle = derived(editWine, ($state) => {
	return (
		$state.selectedBottleID !== null &&
		$state.bottle.bottleSize !== '' &&
		$state.bottle.location !== '' &&
		$state.bottle.source.trim() !== '' &&
		!$state.isSubmitting
	);
});

/**
 * Check if wine has bottles
 */
export const hasBottles = derived(editWine, ($state) => $state.bottles.length > 0);

/**
 * Wine type options for dropdown
 */
export const wineTypeOptions = derived(editWine, ($state) =>
	$state.wineTypes.map((t) => ({
		value: t.wineTypeName,
		label: t.wineTypeName
	}))
);
