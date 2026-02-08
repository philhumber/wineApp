<?php
/**
 * Shared validation functions for wine data
 * @package WineApp
 */

/**
 * Validate and normalize wine year input
 *
 * @param mixed $yearInput - Can be string, int, null, or empty
 * @return array{year: int|null, isNonVintage: bool}
 * @throws Exception if year is invalid
 */
function validateWineYear($yearInput): array {
    // Handle null/empty
    if ($yearInput === null || $yearInput === '') {
        return ['year' => null, 'isNonVintage' => false];
    }

    $yearStr = trim((string)$yearInput);

    // Check for explicit NV indicator
    if (strtoupper($yearStr) === 'NV') {
        return ['year' => null, 'isNonVintage' => true];
    }

    // Validate numeric year
    $year = (int)$yearStr;
    if ($year < 1901 || $year > 2155) {
        throw new Exception('Year must be between 1901 and 2155, or select Non-Vintage');
    }

    return ['year' => $year, 'isNonVintage' => false];
}

/**
 * Validate a string field (trim, required, max length)
 */
function validateStringField($value, string $fieldLabel, bool $required = true, int $maxLength = 0): ?string {
    $trimmed = trim((string)($value ?? ''));
    if ($required && $trimmed === '') {
        throw new Exception("{$fieldLabel} is required");
    }
    if ($trimmed === '') {
        return null;
    }
    if ($maxLength > 0 && mb_strlen($trimmed) > $maxLength) {
        throw new Exception("{$fieldLabel} must be {$maxLength} characters or less");
    }
    return $trimmed;
}

/**
 * Validate price and currency coupling
 */
function validatePriceCurrency($price, $currency): array {
    $priceStr = trim((string)($price ?? ''));
    $currencyStr = trim((string)($currency ?? ''));
    if ($priceStr === '') {
        return ['price' => null, 'currency' => $currencyStr !== '' ? $currencyStr : null];
    }
    $priceFloat = (float)$priceStr;
    if ($priceFloat < 0) {
        throw new Exception('Price cannot be negative');
    }
    if ($currencyStr === '') {
        throw new Exception('Currency is required when price is set');
    }
    return ['price' => $priceFloat, 'currency' => $currencyStr];
}

/**
 * Validate and normalize purchase date
 */
function validatePurchaseDate($dateInput): ?string {
    $dateStr = trim((string)($dateInput ?? ''));
    if ($dateStr === '') {
        return null;
    }
    $date = DateTime::createFromFormat('Y-m-d', $dateStr);
    if ($date && $date->format('Y-m-d') === $dateStr) {
        return $dateStr;
    }
    $date = DateTime::createFromFormat('d/m/Y', $dateStr);
    if ($date) {
        return $date->format('Y-m-d');
    }
    throw new Exception('Invalid date format');
}

/**
 * Validate a rating value
 */
function validateRating($value, string $fieldLabel, bool $required = true, int $min = 1, int $max = 10): ?int {
    if (!$required && ($value === null || $value === '' || $value === 0 || $value === '0')) {
        return null;
    }
    if ($required && ($value === null || $value === '' || $value === 0 || $value === '0')) {
        throw new Exception("{$fieldLabel} is required");
    }
    $intVal = (int)$value;
    if ($intVal < $min || $intVal > $max) {
        throw new Exception("Invalid {$fieldLabel} (must be {$min}-{$max})");
    }
    return $intVal;
}
