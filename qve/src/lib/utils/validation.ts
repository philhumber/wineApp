// Field length limits — single source of truth
export const FIELD_MAX_LENGTHS = {
  wineName: 50,
  regionName: 50,
  producerName: 255,
  storageLocation: 50,
  source: 50,
  bottleSize: 50,
  appellation: 150
} as const;

// Simple validators — return error message or null
export function validateRequired(value: string, fieldLabel: string): string | null {
  if (!value || !value.trim()) {
    return `${fieldLabel} is required`;
  }
  return null;
}

export function validateLength(value: string, maxLength: number): string | null {
  if (value && value.length > maxLength) {
    return `Must be ${maxLength} characters or less`;
  }
  return null;
}

export function validateRange(value: number, min: number, max: number, fieldLabel: string): string | null {
  if (value < min || value > max) {
    return `${fieldLabel} must be between ${min} and ${max}`;
  }
  return null;
}

// Cross-field validator
export function validatePriceCurrency(
  price: string | undefined,
  currency: string | undefined
): { price?: string; currency?: string } {
  const errors: { price?: string; currency?: string } = {};

  if (price && parseFloat(price) < 0) {
    errors.price = 'Price cannot be negative';
  }

  if (price && price.trim() !== '' && parseFloat(price) >= 0 && (!currency || !currency.trim())) {
    errors.currency = 'Currency is required when price is set';
  }

  return errors;
}
