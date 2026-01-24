/**
 * Currency Store
 * Manages display currency preference with localStorage persistence
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { api } from '$lib/api';
import type { Currency, BottleSize } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type CurrencyCode =
	| 'GBP'
	| 'EUR'
	| 'USD'
	| 'AUD'
	| 'NZD'
	| 'CHF'
	| 'DKK'
	| 'NOK'
	| 'SEK'
	| 'JPY'
	| 'HKD';

const STORAGE_KEY = 'qve-currency';
const DEFAULT_CURRENCY: CurrencyCode = 'GBP';

// Fallback currencies if API fails
const FALLBACK_CURRENCIES: Currency[] = [
	{ currencyCode: 'GBP', currencyName: 'British Pound', symbol: '£', rateToEUR: 0.8547 },
	{ currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', rateToEUR: 1.0 },
	{ currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', rateToEUR: 1.087 }
];

// ─────────────────────────────────────────────────────────
// STORES
// ─────────────────────────────────────────────────────────

// Available currencies (fetched from API on init)
export const availableCurrencies = writable<Currency[]>(FALLBACK_CURRENCIES);

// Available bottle sizes (fetched from API on init)
export const availableBottleSizes = writable<BottleSize[]>([]);

// Track initialization state
const isInitialized = writable(false);

// ─────────────────────────────────────────────────────────
// DISPLAY CURRENCY STORE
// ─────────────────────────────────────────────────────────

function createCurrencyStore() {
	/**
	 * Get initial currency from localStorage or default
	 */
	const getInitialCurrency = (): CurrencyCode => {
		if (!browser) return DEFAULT_CURRENCY;

		const stored = localStorage.getItem(STORAGE_KEY);
		// Validate stored value is a valid currency code
		if (stored && isValidCurrencyCode(stored)) {
			return stored as CurrencyCode;
		}
		return DEFAULT_CURRENCY;
	};

	/**
	 * Check if a string is a valid currency code
	 */
	function isValidCurrencyCode(code: string): boolean {
		const validCodes: CurrencyCode[] = [
			'GBP',
			'EUR',
			'USD',
			'AUD',
			'NZD',
			'CHF',
			'DKK',
			'NOK',
			'SEK',
			'JPY',
			'HKD'
		];
		return validCodes.includes(code as CurrencyCode);
	}

	const { subscribe, set } = writable<CurrencyCode>(getInitialCurrency());

	return {
		subscribe,

		/**
		 * Set currency explicitly and persist to localStorage
		 */
		set: (value: CurrencyCode) => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, value);
			}
			set(value);
		},

		/**
		 * Initialize currency store on app mount
		 * Fetches currencies from API and applies stored preference
		 */
		initialize: async () => {
			if (get(isInitialized)) return;

			try {
				// Fetch currencies and bottle sizes from API
				const data = await api.getCurrencies();

				if (data.currencies && data.currencies.length > 0) {
					// Convert rateToEUR from string to number if needed
					const currencies = data.currencies.map((c) => ({
						...c,
						rateToEUR: typeof c.rateToEUR === 'string' ? parseFloat(c.rateToEUR) : c.rateToEUR
					}));
					availableCurrencies.set(currencies);
				}

				if (data.bottleSizes && data.bottleSizes.length > 0) {
					// Convert volumeLitres from string to number if needed
					const sizes = data.bottleSizes.map((s) => ({
						...s,
						volumeLitres:
							typeof s.volumeLitres === 'string' ? parseFloat(s.volumeLitres) : s.volumeLitres
					}));
					availableBottleSizes.set(sizes);
				}

				// Apply stored preference (or default)
				const stored = getInitialCurrency();
				set(stored);

				isInitialized.set(true);
			} catch (error) {
				console.error('Failed to load currencies:', error);
				// Keep using fallback currencies
				set(DEFAULT_CURRENCY);
				isInitialized.set(true);
			}
		}
	};
}

export const displayCurrency = createCurrencyStore();

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/**
 * Current currency object (derived from selected code and available currencies)
 */
export const currentCurrency = derived(
	[displayCurrency, availableCurrencies],
	([$code, $currencies]) => {
		return (
			$currencies.find((c) => c.currencyCode === $code) ||
			FALLBACK_CURRENCIES.find((c) => c.currencyCode === $code) ||
			FALLBACK_CURRENCIES[0]
		);
	}
);

// ─────────────────────────────────────────────────────────
// CURRENCY CONVERSION UTILITIES
// ─────────────────────────────────────────────────────────

/**
 * Convert price from EUR to target currency
 * @param priceEUR - Price in EUR
 * @param targetCurrency - Target currency object
 * @returns Converted price
 */
export function convertFromEUR(priceEUR: number, targetCurrency: Currency): number {
	return priceEUR * targetCurrency.rateToEUR;
}

/**
 * Convert price from original currency to EUR
 * @param price - Price in original currency
 * @param originalCurrency - Original currency object
 * @returns Price in EUR
 */
export function convertToEUR(price: number, originalCurrency: Currency): number {
	// Prevent division by zero - if rate is 0 or invalid, return original price
	if (!originalCurrency.rateToEUR || originalCurrency.rateToEUR === 0) {
		return price;
	}
	return price / originalCurrency.rateToEUR;
}

/**
 * Convert price from one currency to another
 * @param price - Price in original currency
 * @param fromCurrency - Original currency object
 * @param toCurrency - Target currency object
 * @returns Converted price
 */
export function convertCurrency(
	price: number,
	fromCurrency: Currency,
	toCurrency: Currency
): number {
	const priceEUR = convertToEUR(price, fromCurrency);
	return convertFromEUR(priceEUR, toCurrency);
}

/**
 * Format price with currency symbol
 * @param price - Price amount
 * @param currency - Currency object
 * @returns Formatted price string (e.g., "£45.00")
 */
export function formatPrice(price: number | string | null, currency: Currency): string | null {
	if (price === null || price === '' || price === 0 || price === '0') return null;

	const numPrice = typeof price === 'string' ? parseFloat(price) : price;
	if (isNaN(numPrice) || numPrice === 0) return null;

	return `${currency.symbol}${numPrice.toFixed(2)}`;
}

/**
 * Convert price from EUR and format with currency symbol
 * @param priceEUR - Price in EUR
 * @param targetCurrency - Target currency object
 * @returns Formatted price string in target currency
 */
export function formatPriceFromEUR(
	priceEUR: number | string | null,
	targetCurrency: Currency
): string | null {
	if (priceEUR === null || priceEUR === '' || priceEUR === 0 || priceEUR === '0') return null;

	const numPrice = typeof priceEUR === 'string' ? parseFloat(priceEUR) : priceEUR;
	if (isNaN(numPrice) || numPrice === 0) return null;

	const converted = convertFromEUR(numPrice, targetCurrency);
	return `${targetCurrency.symbol}${converted.toFixed(2)}`;
}

/**
 * Get currency by code from available currencies
 * @param code - Currency code
 * @param currencies - Available currencies array
 * @returns Currency object or null
 */
export function getCurrencyByCode(code: string, currencies: Currency[]): Currency | null {
	return currencies.find((c) => c.currencyCode === code) || null;
}

/**
 * Convert price from original currency to display currency and format
 * Handles full conversion flow: validate -> lookup original currency -> convert -> format
 * @param price - Price in original currency
 * @param originalCurrencyCode - Original currency code (defaults to GBP)
 * @param currencies - Array of available currencies
 * @param targetCurrency - Target display currency
 * @returns Formatted price string in target currency, or null if invalid
 */
export function formatPriceConverted(
	price: number | string | null,
	originalCurrencyCode: string | null,
	currencies: Currency[],
	targetCurrency: Currency
): string | null {
	// Validate price
	if (price === null || price === '' || price === 0 || price === '0') return null;

	const numPrice = typeof price === 'string' ? parseFloat(price) : price;
	if (isNaN(numPrice) || numPrice === 0) return null;

	// Find original currency (default to GBP if not specified)
	const originalCurrency = currencies.find((c) => c.currencyCode === (originalCurrencyCode || 'GBP'));

	// If original currency not found, just format with target currency symbol
	if (!originalCurrency) {
		return formatPrice(numPrice, targetCurrency);
	}

	// Convert from original currency to display currency
	const convertedPrice = convertCurrency(numPrice, originalCurrency, targetCurrency);
	return formatPrice(convertedPrice, targetCurrency);
}
