<?php
/**
 * Check for duplicate/similar entries when adding new wines
 *
 * Input: {
 *   type: 'region' | 'producer' | 'wine',
 *   name: string,
 *   producerId?: number,  // for wine type
 *   producerName?: string, // alternative to producerId
 *   regionId?: number,     // for producer type
 *   regionName?: string,   // alternative to regionId
 *   year?: string          // for wine type
 * }
 *
 * Output: {
 *   success: bool,
 *   data: {
 *     exactMatch: { id, name } | null,
 *     similarMatches: [{ id, name, meta? }],
 *     existingBottles: int,  // for wine type only
 *     existingWineId: int | null  // if exact wine+producer exists (for Add Bottle redirect)
 *   }
 * }
 */

require_once 'securityHeaders.php';
require_once 'databaseConnection.php';
require_once 'errorHandler.php';
require_once 'FuzzyMatcher.php';

$response = ['success' => false, 'message' => '', 'data' => null];

try {
    $pdo = getDBConnection();
    $data = json_decode(file_get_contents('php://input'), true);

    $type = $data['type'] ?? null;
    $name = trim($data['name'] ?? '');

    if (!$type || !$name) {
        throw new Exception('Missing required parameters: type and name');
    }

    if (!in_array($type, ['region', 'producer', 'wine'])) {
        throw new Exception('Invalid type. Must be: region, producer, or wine');
    }

    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // Normalize name for comparison (remove accents for PHP-side matching)
    $normalizedName = normalizeAccents($name);

    switch ($type) {
        case 'region':
            $result = checkRegionDuplicates($pdo, $name, $normalizedName);
            break;
        case 'producer':
            $regionId = $data['regionId'] ?? null;
            $regionName = $data['regionName'] ?? null;
            $result = checkProducerDuplicates($pdo, $name, $normalizedName, $regionId, $regionName);
            break;
        case 'wine':
            $producerId = $data['producerId'] ?? null;
            $producerName = $data['producerName'] ?? null;
            $year = $data['year'] ?? null;
            $result = checkWineDuplicates($pdo, $name, $normalizedName, $producerId, $producerName, $year);
            break;
    }

    $response['success'] = true;
    $response['message'] = 'Duplicate check completed';
    $response['data'] = $result;

} catch (Exception $e) {
    $response['success'] = false;
    // WIN-217: sanitize error messages
    $response['message'] = safeErrorMessage($e, 'checkDuplicate');
}

header('Content-Type: application/json');
echo json_encode($response);

/**
 * Normalize accented characters for comparison
 * Delegates to FuzzyMatcher for consistent normalization across codebase.
 *
 * @param string $string Input string
 * @return string Normalized string with accents removed
 */
function normalizeAccents($string) {
    return FuzzyMatcher::normalizeAccents($string);
}

/**
 * Check if two strings are similar using token-based fuzzy matching
 *
 * WIN-188: Uses FuzzyMatcher for improved matching:
 * - Multilingual article removal (Le, La, Les, El, Il, Der, The, etc.)
 * - Token-based Jaccard similarity (word order agnostic)
 * - Per-token Levenshtein for typo tolerance
 *
 * @param string $input Input string
 * @param string $candidate Candidate string
 * @param float|null $threshold Custom Jaccard threshold (default: 0.55)
 * @return bool True if fuzzy match
 */
function isFuzzyMatch($input, $candidate, $threshold = null) {
    return FuzzyMatcher::isFuzzyMatch($input, $candidate, $threshold);
}

/**
 * Check if input is a substring match (either direction)
 *
 * WIN-188: Now strips articles before comparison for consistency
 * with fuzzy matching. Handles cases like:
 * - "Les Clous" matches "Les Clous Naturé"
 * - "Margaux" matches "Château Margaux"
 */
function isSubstringMatch($input, $candidate) {
    // Strip articles and normalize for comparison
    $inputNorm = strtolower(FuzzyMatcher::stripArticles(normalizeAccents($input)));
    $candidateNorm = strtolower(FuzzyMatcher::stripArticles(normalizeAccents($candidate)));

    return strpos($candidateNorm, $inputNorm) !== false ||
           strpos($inputNorm, $candidateNorm) !== false;
}

/**
 * Check for duplicate regions
 */
function checkRegionDuplicates($pdo, $name, $normalizedName) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // Get all regions for fuzzy matching
    $stmt = $pdo->prepare("SELECT regionID, regionName FROM region ORDER BY regionName");
    $stmt->execute();
    $allRegions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($allRegions as $row) {
        $regionName = $row['regionName'];
        $inputNorm = strtolower(normalizeAccents($name));
        $candidateNorm = strtolower(normalizeAccents($regionName));

        // Exact match (case-insensitive, accent-insensitive)
        if ($inputNorm === $candidateNorm) {
            $result['exactMatch'] = [
                'id' => (int)$row['regionID'],
                'name' => $regionName
            ];
            continue;
        }

        // Skip if already have 5 similar matches
        if (count($result['similarMatches']) >= 5) {
            continue;
        }

        // Check substring or fuzzy match
        if (isSubstringMatch($name, $regionName) || isFuzzyMatch($name, $regionName)) {
            $result['similarMatches'][] = [
                'id' => (int)$row['regionID'],
                'name' => $regionName
            ];
        }
    }

    return $result;
}

/**
 * Check for duplicate producers
 */
function checkProducerDuplicates($pdo, $name, $normalizedName, $regionId = null, $regionName = null) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // Get all producers for fuzzy matching
    $stmt = $pdo->prepare("
        SELECT p.producerID, p.producerName, p.regionID, r.regionName
        FROM producers p
        LEFT JOIN region r ON p.regionID = r.regionID
        ORDER BY p.producerName
    ");
    $stmt->execute();
    $allProducers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($allProducers as $row) {
        $producerName = $row['producerName'];
        $inputNorm = strtolower(normalizeAccents($name));
        $candidateNorm = strtolower(normalizeAccents($producerName));

        // Exact match (case-insensitive, accent-insensitive)
        if ($inputNorm === $candidateNorm) {
            // Only set as exact if matching region context (or no context specified)
            $matchesRegion = true;
            if ($regionId && $row['regionID'] != $regionId) {
                $matchesRegion = false;
            }
            if ($regionName && strtolower($row['regionName'] ?? '') !== strtolower($regionName)) {
                $matchesRegion = false;
            }

            if ($matchesRegion && !$result['exactMatch']) {
                $result['exactMatch'] = [
                    'id' => (int)$row['producerID'],
                    'name' => $producerName,
                    'meta' => $row['regionName']
                ];
            }
            continue;
        }

        // Skip if already have 5 similar matches
        if (count($result['similarMatches']) >= 5) {
            continue;
        }

        // Check substring or fuzzy match
        if (isSubstringMatch($name, $producerName) || isFuzzyMatch($name, $producerName)) {
            $result['similarMatches'][] = [
                'id' => (int)$row['producerID'],
                'name' => $producerName,
                'meta' => $row['regionName']
            ];
        }
    }

    return $result;
}

/**
 * Check for duplicate wines
 */
function checkWineDuplicates($pdo, $name, $normalizedName, $producerId = null, $producerName = null, $year = null) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // Build producer filter for the query
    $producerFilter = "";
    $params = [];

    if ($producerId) {
        $producerFilter = " WHERE w.producerID = :producerId";
        $params[':producerId'] = $producerId;
    } elseif ($producerName) {
        $producerFilter = " WHERE p.producerName COLLATE utf8mb4_unicode_ci = :producerName";
        $params[':producerName'] = $producerName;
    }

    // Get wines (filtered by producer if specified) for fuzzy matching
    $stmt = $pdo->prepare("
        SELECT w.wineID, w.wineName, w.year, w.isNonVintage, p.producerName, p.producerID,
               (SELECT COUNT(*) FROM bottles b WHERE b.wineID = w.wineID AND b.bottleDrunk = 0) as bottleCount
        FROM wine w
        LEFT JOIN producers p ON w.producerID = p.producerID
        $producerFilter
        ORDER BY w.wineName
    ");
    $stmt->execute($params);
    $allWines = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($allWines as $row) {
        $wineName = $row['wineName'];
        $inputNorm = strtolower(normalizeAccents($name));
        $candidateNorm = strtolower(normalizeAccents($wineName));
        $bottleCount = (int)$row['bottleCount'];

        // Exact match (case-insensitive, accent-insensitive)
        if ($inputNorm === $candidateNorm) {
            // This is an exact wine name match for this producer
            // Set exactMatch for display purposes
            if (!$result['exactMatch']) {
                $result['exactMatch'] = [
                    'id' => (int)$row['wineID'],
                    'name' => $wineName,
                    'meta' => $row['year'] ? $row['producerName'] . ' ' . $row['year'] : $row['producerName']
                ];
            }

            // WIN-176: Year-aware duplicate detection
            // Only set existingWineId if name + producer + year all match
            $inputIsNV = ($year === null || strtoupper($year ?? '') === 'NV');
            $rowIsNV = ($row['year'] === null || $row['isNonVintage']);

            $yearMatches = false;
            if ($inputIsNV && $rowIsNV) {
                $yearMatches = true;  // Both NV
            } else if (!$inputIsNV && !$rowIsNV) {
                $yearMatches = ((int)$row['year'] === (int)$year);  // Both have years, compare
            }
            // If one is NV and other isn't, yearMatches stays false

            // Only redirect to "Add Bottle" if exact match including year
            if ($yearMatches && $bottleCount > 0) {
                $result['existingBottles'] = $bottleCount;
                $result['existingWineId'] = (int)$row['wineID'];
            }
            continue;
        }

        // Skip if already have 5 similar matches
        if (count($result['similarMatches']) >= 5) {
            continue;
        }

        // Check substring or fuzzy match
        if (isSubstringMatch($name, $wineName) || isFuzzyMatch($name, $wineName)) {
            $result['similarMatches'][] = [
                'id' => (int)$row['wineID'],
                'name' => $wineName,
                'meta' => $row['year'] ? $row['producerName'] . ' ' . $row['year'] : $row['producerName'],
                'bottleCount' => $bottleCount
            ];
        }
    }

    return $result;
}
?>
