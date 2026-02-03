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
