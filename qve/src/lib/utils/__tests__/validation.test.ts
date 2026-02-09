import { describe, it, expect } from 'vitest';
import {
	validateRequired,
	validateLength,
	validateRange,
	validatePriceCurrency,
	FIELD_MAX_LENGTHS
} from '../validation';

describe('validateRequired', () => {
	it('returns error for empty string', () => {
		expect(validateRequired('', 'Wine name')).toBe('Wine name is required');
	});

	it('returns error for whitespace-only string', () => {
		expect(validateRequired('   ', 'Wine name')).toBe('Wine name is required');
	});

	it('returns null for valid string', () => {
		expect(validateRequired('Margaux', 'Wine name')).toBeNull();
	});
});

describe('validateLength', () => {
	it('returns null when at limit', () => {
		expect(validateLength('a'.repeat(50), 50)).toBeNull();
	});

	it('returns error when over limit', () => {
		expect(validateLength('a'.repeat(51), 50)).toBe('Must be 50 characters or less');
	});

	it('returns null for empty string (length 0 is fine)', () => {
		expect(validateLength('', 50)).toBeNull();
	});
});

describe('validateRange', () => {
	it('returns null at min', () => {
		expect(validateRange(1, 1, 10, 'Rating')).toBeNull();
	});

	it('returns null at max', () => {
		expect(validateRange(10, 1, 10, 'Rating')).toBeNull();
	});

	it('returns error below min', () => {
		expect(validateRange(0, 1, 10, 'Rating')).toBe('Rating must be between 1 and 10');
	});

	it('returns error above max', () => {
		expect(validateRange(11, 1, 10, 'Rating')).toBe('Rating must be between 1 and 10');
	});
});

describe('validatePriceCurrency', () => {
	it('returns currency error when price set, no currency', () => {
		const result = validatePriceCurrency('25.00', '');
		expect(result.currency).toBe('Currency is required when price is set');
	});

	it('returns no errors when price and currency set', () => {
		const result = validatePriceCurrency('25.00', 'GBP');
		expect(result).toEqual({});
	});

	it('returns no errors when no price and no currency', () => {
		const result = validatePriceCurrency('', '');
		expect(result).toEqual({});
	});

	it('returns no errors when no price, currency set (allowed)', () => {
		const result = validatePriceCurrency('', 'GBP');
		expect(result).toEqual({});
	});

	it('returns price error for negative price', () => {
		const result = validatePriceCurrency('-5', 'GBP');
		expect(result.price).toBe('Price cannot be negative');
	});

	it('returns no errors when price is 0 (valid)', () => {
		const result = validatePriceCurrency('0', 'GBP');
		expect(result).toEqual({});
	});

	it('returns currency error when price is 0 but no currency', () => {
		const result = validatePriceCurrency('0', '');
		expect(result.currency).toBe('Currency is required when price is set');
	});
});

describe('FIELD_MAX_LENGTHS', () => {
	it('has expected keys and values', () => {
		expect(FIELD_MAX_LENGTHS.wineName).toBe(50);
		expect(FIELD_MAX_LENGTHS.regionName).toBe(50);
		expect(FIELD_MAX_LENGTHS.producerName).toBe(255);
		expect(FIELD_MAX_LENGTHS.storageLocation).toBe(50);
		expect(FIELD_MAX_LENGTHS.source).toBe(50);
		expect(FIELD_MAX_LENGTHS.bottleSize).toBe(50);
		expect(FIELD_MAX_LENGTHS.appellation).toBe(150);
	});
});
