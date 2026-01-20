/**
 * Add Wine Store
 * Manages the 4-step wizard state for adding wines
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api/client';
import { toasts } from './toast';
import type { Region, Producer, Wine, Country, WineType, AddWinePayload } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4;
export type SelectionMode = 'search' | 'create';

export interface RegionFormData {
	regionName: string;
	country: string;
	countryID: number | null;
	drinkType: string;
	// AI fields (optional)
	description: string;
	climate: string;
	soil: string;
}

export interface ProducerFormData {
	producerName: string;
	// AI fields (optional)
	town: string;
	founded: string;
	ownership: string;
	description: string;
}

export interface WineFormData {
	wineName: string;
	wineYear: string;
	wineType: string;
	wineTypeID: number | null;
	// AI fields (optional)
	description: string;
	tastingNotes: string;
	pairing: string;
	// Image
	imageFile: File | null;
	imagePreview: string | null;
	uploadedFilename: string | null;
}

export interface BottleFormData {
	bottleSize: string;
	storageLocation: string;
	source: string;
	price: string;
	currency: string;
	purchaseDate: string;
}

export interface ValidationErrors {
	region: Record<string, string>;
	producer: Record<string, string>;
	wine: Record<string, string>;
	bottle: Record<string, string>;
}

export interface WizardState {
	currentStep: WizardStep;
	isSubmitting: boolean;
	isAILoading: boolean;
	aiLoadingStep: WizardStep | null;

	// Selection mode per step
	mode: {
		region: SelectionMode;
		producer: SelectionMode;
		wine: SelectionMode;
	};

	// Form data
	region: RegionFormData;
	producer: ProducerFormData;
	wine: WineFormData;
	bottle: BottleFormData;

	// Selected existing items
	selected: {
		region: Region | null;
		producer: Producer | null;
		wine: Wine | null;
	};

	// AI expanded sections visibility
	aiExpanded: {
		region: boolean;
		producer: boolean;
		wine: boolean;
	};

	// Validation errors
	errors: ValidationErrors;
}

// ─────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────

const initialState: WizardState = {
	currentStep: 1,
	isSubmitting: false,
	isAILoading: false,
	aiLoadingStep: null,

	mode: {
		region: 'search',
		producer: 'search',
		wine: 'search'
	},

	region: {
		regionName: '',
		country: '',
		countryID: null,
		drinkType: 'Wine',
		description: '',
		climate: '',
		soil: ''
	},

	producer: {
		producerName: '',
		town: '',
		founded: '',
		ownership: '',
		description: ''
	},

	wine: {
		wineName: '',
		wineYear: '',
		wineType: '',
		wineTypeID: null,
		description: '',
		tastingNotes: '',
		pairing: '',
		imageFile: null,
		imagePreview: null,
		uploadedFilename: null
	},

	bottle: {
		bottleSize: 'Standard (750ml)',
		storageLocation: '',
		source: '',
		price: '',
		currency: 'GBP',
		purchaseDate: ''
	},

	selected: {
		region: null,
		producer: null,
		wine: null
	},

	aiExpanded: {
		region: false,
		producer: false,
		wine: false
	},

	errors: {
		region: {},
		producer: {},
		wine: {},
		bottle: {}
	}
};

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createAddWineStore() {
	const { subscribe, set, update } = writable<WizardState>({ ...initialState });

	// ─────────────────────────────────────────────────────
	// NAVIGATION
	// ─────────────────────────────────────────────────────

	const nextStep = (): boolean => {
		const state = get({ subscribe });

		// Validate current step before advancing
		if (!validateStep(state.currentStep)) {
			return false;
		}

		if (state.currentStep < 4) {
			update((s) => ({ ...s, currentStep: (s.currentStep + 1) as WizardStep }));
			return true;
		}
		return false;
	};

	const prevStep = (): boolean => {
		const state = get({ subscribe });
		if (state.currentStep > 1) {
			update((s) => ({ ...s, currentStep: (s.currentStep - 1) as WizardStep }));
			return true;
		}
		return false;
	};

	const goToStep = (step: WizardStep): void => {
		update((s) => ({ ...s, currentStep: step }));
	};

	// ─────────────────────────────────────────────────────
	// MODE SWITCHING
	// ─────────────────────────────────────────────────────

	const setMode = (step: 'region' | 'producer' | 'wine', mode: SelectionMode): void => {
		update((s) => ({
			...s,
			mode: { ...s.mode, [step]: mode },
			// Clear selection when switching to create mode
			selected: mode === 'create' ? { ...s.selected, [step]: null } : s.selected
		}));
	};

	// ─────────────────────────────────────────────────────
	// FIELD UPDATES
	// ─────────────────────────────────────────────────────

	const updateRegion = (field: keyof RegionFormData, value: string | number | null): void => {
		update((s) => ({
			...s,
			region: { ...s.region, [field]: value },
			errors: { ...s.errors, region: { ...s.errors.region, [field]: '' } }
		}));
	};

	const updateProducer = (field: keyof ProducerFormData, value: string): void => {
		update((s) => ({
			...s,
			producer: { ...s.producer, [field]: value },
			errors: { ...s.errors, producer: { ...s.errors.producer, [field]: '' } }
		}));
	};

	const updateWine = (field: keyof WineFormData, value: string | number | File | null): void => {
		update((s) => ({
			...s,
			wine: { ...s.wine, [field]: value },
			errors: { ...s.errors, wine: { ...s.errors.wine, [field]: '' } }
		}));
	};

	const updateBottle = (field: keyof BottleFormData, value: string): void => {
		update((s) => ({
			...s,
			bottle: { ...s.bottle, [field]: value },
			errors: { ...s.errors, bottle: { ...s.errors.bottle, [field]: '' } }
		}));
	};

	// ─────────────────────────────────────────────────────
	// SELECTIONS
	// ─────────────────────────────────────────────────────

	const selectRegion = (region: Region): void => {
		update((s) => ({
			...s,
			selected: { ...s.selected, region },
			mode: { ...s.mode, region: 'search' },
			region: {
				...s.region,
				regionName: region.regionName,
				country: region.countryName || ''
			}
		}));
	};

	const selectProducer = (producer: Producer): void => {
		update((s) => ({
			...s,
			selected: { ...s.selected, producer },
			mode: { ...s.mode, producer: 'search' },
			producer: {
				...s.producer,
				producerName: producer.producerName
			}
		}));
	};

	const selectWine = (wine: Wine): void => {
		update((s) => ({
			...s,
			selected: { ...s.selected, wine },
			mode: { ...s.mode, wine: 'search' },
			wine: {
				...s.wine,
				wineName: wine.wineName,
				wineYear: wine.year || '',
				wineType: wine.wineType
			}
		}));
	};

	const clearSelection = (step: 'region' | 'producer' | 'wine'): void => {
		update((s) => ({
			...s,
			selected: { ...s.selected, [step]: null },
			mode: { ...s.mode, [step]: 'search' }
		}));
	};

	// ─────────────────────────────────────────────────────
	// AI EXPANDED SECTIONS
	// ─────────────────────────────────────────────────────

	const toggleAIExpanded = (step: 'region' | 'producer' | 'wine'): void => {
		update((s) => ({
			...s,
			aiExpanded: { ...s.aiExpanded, [step]: !s.aiExpanded[step] }
		}));
	};

	const setAIExpanded = (step: 'region' | 'producer' | 'wine', expanded: boolean): void => {
		update((s) => ({
			...s,
			aiExpanded: { ...s.aiExpanded, [step]: expanded }
		}));
	};

	// ─────────────────────────────────────────────────────
	// AI GENERATION
	// ─────────────────────────────────────────────────────

	const generateRegionAI = async (): Promise<boolean> => {
		const state = get({ subscribe });
		const { regionName, country, drinkType } = state.region;

		if (!regionName || !country) {
			toasts.error('Please enter region name and country first');
			return false;
		}

		update((s) => ({ ...s, isAILoading: true, aiLoadingStep: 1 }));

		try {
			const data = await api.getAIRegionData(regionName, country);

			if (!data || Object.keys(data).length === 0) {
				toasts.error('No AI data received');
				update((s) => ({ ...s, isAILoading: false, aiLoadingStep: null }));
				return false;
			}

			update((s) => ({
				...s,
				region: {
					...s.region,
					description: data.description || '',
					climate: data.climate || '',
					soil: data.soil || ''
				},
				aiExpanded: { ...s.aiExpanded, region: true },
				isAILoading: false,
				aiLoadingStep: null
			}));
			return true;
		} catch (error) {
			console.error('AI Region Error:', error);
			toasts.error('Failed to generate region information');
			update((s) => ({ ...s, isAILoading: false, aiLoadingStep: null }));
			return false;
		}
	};

	const generateProducerAI = async (): Promise<boolean> => {
		const state = get({ subscribe });
		const { producerName } = state.producer;
		const regionName = state.selected.region?.regionName || state.region.regionName;

		if (!producerName) {
			toasts.error('Please enter producer name first');
			return false;
		}

		update((s) => ({ ...s, isAILoading: true, aiLoadingStep: 2 }));

		try {
			const data = await api.getAIProducerData(producerName, regionName);
			update((s) => ({
				...s,
				producer: {
					...s.producer,
					description: data.description || '',
					founded: data.founded?.toString() || '',
					ownership: data.ownership || '',
					town: data.town || ''
				},
				aiExpanded: { ...s.aiExpanded, producer: true },
				isAILoading: false,
				aiLoadingStep: null
			}));
			return true;
		} catch (error) {
			toasts.error('Failed to generate producer information');
			update((s) => ({ ...s, isAILoading: false, aiLoadingStep: null }));
			return false;
		}
	};

	const generateWineAI = async (): Promise<boolean> => {
		const state = get({ subscribe });
		const { wineName, wineYear } = state.wine;
		const producerName = state.selected.producer?.producerName || state.producer.producerName;

		if (!wineName) {
			toasts.error('Please enter wine name first');
			return false;
		}

		update((s) => ({ ...s, isAILoading: true, aiLoadingStep: 3 }));

		try {
			const data = await api.getAIWineData(wineName, producerName, wineYear);
			update((s) => ({
				...s,
				wine: {
					...s.wine,
					description: data.description || '',
					tastingNotes: data.tasting || '',
					pairing: data.pairing || ''
				},
				aiExpanded: { ...s.aiExpanded, wine: true },
				isAILoading: false,
				aiLoadingStep: null
			}));
			return true;
		} catch (error) {
			toasts.error('Failed to generate wine information');
			update((s) => ({ ...s, isAILoading: false, aiLoadingStep: null }));
			return false;
		}
	};

	const cancelAI = (): void => {
		update((s) => ({ ...s, isAILoading: false, aiLoadingStep: null }));
	};

	// ─────────────────────────────────────────────────────
	// IMAGE UPLOAD
	// ─────────────────────────────────────────────────────

	const setImageFile = (file: File | null): void => {
		if (file) {
			const preview = URL.createObjectURL(file);
			update((s) => ({
				...s,
				wine: {
					...s.wine,
					imageFile: file,
					imagePreview: preview,
					uploadedFilename: null
				}
			}));
		} else {
			update((s) => ({
				...s,
				wine: {
					...s.wine,
					imageFile: null,
					imagePreview: null,
					uploadedFilename: null
				}
			}));
		}
	};

	// ─────────────────────────────────────────────────────
	// VALIDATION
	// ─────────────────────────────────────────────────────

	const validateStep = (step: WizardStep): boolean => {
		const state = get({ subscribe });
		const errors: Record<string, string> = {};

		switch (step) {
			case 1: // Region
				if (state.mode.region === 'create') {
					if (!state.region.regionName.trim()) {
						errors.regionName = 'Region name is required';
					}
					if (!state.region.country) {
						errors.country = 'Country is required';
					}
					if (!state.region.drinkType) {
						errors.drinkType = 'Drink type is required';
					}
				} else if (!state.selected.region) {
					errors.regionName = 'Please select or create a region';
				}
				update((s) => ({ ...s, errors: { ...s.errors, region: errors } }));
				break;

			case 2: // Producer
				if (state.mode.producer === 'create') {
					if (!state.producer.producerName.trim()) {
						errors.producerName = 'Producer name is required';
					}
				} else if (!state.selected.producer) {
					errors.producerName = 'Please select or create a producer';
				}
				update((s) => ({ ...s, errors: { ...s.errors, producer: errors } }));
				break;

			case 3: // Wine
				if (state.mode.wine === 'create') {
					if (!state.wine.wineName.trim()) {
						errors.wineName = 'Wine name is required';
					}
					if (!state.wine.wineType) {
						errors.wineType = 'Wine type is required';
					}
				} else if (!state.selected.wine) {
					errors.wineName = 'Please select or create a wine';
				}
				update((s) => ({ ...s, errors: { ...s.errors, wine: errors } }));
				break;

			case 4: // Bottle
				if (!state.bottle.bottleSize) {
					errors.bottleSize = 'Bottle size is required';
				}
				if (!state.bottle.storageLocation) {
					errors.storageLocation = 'Storage location is required';
				}
				if (!state.bottle.source.trim()) {
					errors.source = 'Source is required';
				}
				update((s) => ({ ...s, errors: { ...s.errors, bottle: errors } }));
				break;
		}

		return Object.keys(errors).length === 0;
	};

	// ─────────────────────────────────────────────────────
	// SUBMIT
	// ─────────────────────────────────────────────────────

	const submit = async (): Promise<{ success: boolean; wineID?: number; bottleID?: number }> => {
		// Step names for toast messages
		const stepNames: Record<WizardStep, string> = {
			1: 'Region',
			2: 'Producer',
			3: 'Wine',
			4: 'Bottle'
		};

		// Validate all steps
		for (let step = 1; step <= 4; step++) {
			if (!validateStep(step as WizardStep)) {
				goToStep(step as WizardStep);
				toasts.error(`Please complete the ${stepNames[step as WizardStep]} section`);
				return { success: false };
			}
		}

		const state = get({ subscribe });
		update((s) => ({ ...s, isSubmitting: true }));

		try {
			// Upload image if present
			let uploadedFilename = state.wine.uploadedFilename;
			if (state.wine.imageFile && !uploadedFilename) {
				try {
					uploadedFilename = await api.uploadImage(state.wine.imageFile);
					update((s) => ({
						...s,
						wine: { ...s.wine, uploadedFilename }
					}));
				} catch (error) {
					toasts.error('Failed to upload image');
					update((s) => ({ ...s, isSubmitting: false }));
					return { success: false };
				}
			}

			// Build form data using PHP expected field names
			// See addWine.php for field name reference
			const formData: AddWinePayload = {
				// Region - either existing (findRegion) or new (regionName + details)
				findRegion: state.selected.region?.regionName || '',
				regionName: state.mode.region === 'create' ? state.region.regionName : '',
				regionCountry: state.mode.region === 'create' ? state.region.country : '',
				regionDescription: state.region.description || '',
				regionClimate: state.region.climate || '',
				regionSoil: state.region.soil || '',
				regionMap: '', // Not currently captured

				// Producer - either existing (findProducer) or new (producerName + details)
				findProducer: state.selected.producer?.producerName || '',
				producerName: state.mode.producer === 'create' ? state.producer.producerName : '',
				producerTown: state.producer.town || '',
				producerFounded: state.producer.founded || '',
				producerOwnership: state.producer.ownership || '',
				producerDescription: state.producer.description || '',

				// Wine - either existing (findWine) or new (wineName + details)
				findWine: state.selected.wine?.wineName || '',
				wineName: state.mode.wine === 'create' ? state.wine.wineName : '',
				wineYear: state.wine.wineYear || '',
				wineType: state.wine.wineType || '',
				wineDescription: state.wine.description || '',
				wineTasting: state.wine.tastingNotes || '',
				winePairing: state.wine.pairing || '',
				winePicture: uploadedFilename || 'images/wines/placeBottle.png',

				// Bottle
				bottleType: state.bottle.bottleSize || '',
				storageLocation: state.bottle.storageLocation || '',
				bottleSource: state.bottle.source || '',
				bottlePrice: state.bottle.price || '',
				bottleCurrency: state.bottle.currency || '',
				bottlePurchaseDate: state.bottle.purchaseDate || ''
			};

			const result = await api.addWine(formData);
			update((s) => ({ ...s, isSubmitting: false }));

			// api.addWine returns { wineID, bottleID } directly (throws on error)
			toasts.success('Wine added successfully!');
			return {
				success: true,
				wineID: result.wineID,
				bottleID: result.bottleID
			};
		} catch (error) {
			console.error('Submit error:', error);
			toasts.error('Failed to add wine');
			update((s) => ({ ...s, isSubmitting: false }));
			return { success: false };
		}
	};

	// ─────────────────────────────────────────────────────
	// RESET
	// ─────────────────────────────────────────────────────

	const reset = (): void => {
		set({ ...initialState });
	};

	return {
		subscribe,
		// Navigation
		nextStep,
		prevStep,
		goToStep,
		// Mode
		setMode,
		// Updates
		updateRegion,
		updateProducer,
		updateWine,
		updateBottle,
		// Selections
		selectRegion,
		selectProducer,
		selectWine,
		clearSelection,
		// AI
		toggleAIExpanded,
		setAIExpanded,
		generateRegionAI,
		generateProducerAI,
		generateWineAI,
		cancelAI,
		// Image
		setImageFile,
		// Validation
		validateStep,
		// Submit
		submit,
		// Reset
		reset
	};
}

export const addWineStore = createAddWineStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Current step number */
export const currentStep = derived(addWineStore, ($s) => $s.currentStep);

/** Whether the wizard is currently submitting */
export const isSubmitting = derived(addWineStore, ($s) => $s.isSubmitting);

/** Whether AI is loading */
export const isAILoading = derived(addWineStore, ($s) => $s.isAILoading);

/** Check if current step can proceed */
export const canProceed = derived(addWineStore, ($s) => {
	// Basic check - more detailed validation happens on nextStep()
	switch ($s.currentStep) {
		case 1:
			return $s.selected.region !== null || $s.region.regionName.trim() !== '';
		case 2:
			return $s.selected.producer !== null || $s.producer.producerName.trim() !== '';
		case 3:
			return $s.selected.wine !== null || $s.wine.wineName.trim() !== '';
		case 4:
			return $s.bottle.bottleSize !== '' && $s.bottle.storageLocation !== '' && $s.bottle.source.trim() !== '';
		default:
			return false;
	}
});

// ─────────────────────────────────────────────────────────
// AI LOADING MESSAGES
// ─────────────────────────────────────────────────────────

export const aiLoadingMessages = [
	'Searching the cellars...',
	'Consulting the sommelier...',
	'Uncorking knowledge...',
	'Decanting wisdom...',
	'Swirling through vineyards...',
	'Tasting the data...',
	'Aerating information...',
	'Checking the vintage...',
	'Reading the terroir...',
	'Studying the appellation...'
];
