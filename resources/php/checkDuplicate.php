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

require_once 'databaseConnection.php';

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
    $response['message'] = $e->getMessage();
    error_log("Error in checkDuplicate.php: " . $e->getMessage());
}

header('Content-Type: application/json');
echo json_encode($response);

/**
 * Normalize accented characters for comparison
 * Converts é→e, ü→u, ñ→n, etc.
 */
function normalizeAccents($string) {
    // Use transliterator if available (more accurate)
    if (class_exists('Transliterator')) {
        $transliterator = Transliterator::createFromRules(
            ':: NFD; :: [:Nonspacing Mark:] Remove; :: NFC;'
        );
        if ($transliterator) {
            return $transliterator->transliterate($string);
        }
    }

    // Fallback: iconv transliteration
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $string);
    return $normalized !== false ? $normalized : $string;
}

/**
 * Check if two strings are similar using Levenshtein distance
 * Returns true if the distance is within acceptable threshold
 */
function isFuzzyMatch($input, $candidate, $threshold = null) {
    $inputNorm = strtolower(normalizeAccents($input));
    $candidateNorm = strtolower(normalizeAccents($candidate));

    // Skip if strings are too different in length
    $lenDiff = abs(strlen($inputNorm) - strlen($candidateNorm));
    if ($lenDiff > 5) {
        return false;
    }

    // Calculate Levenshtein distance
    $distance = levenshtein($inputNorm, $candidateNorm);

    // Dynamic threshold based on string length
    // Shorter strings need stricter matching
    if ($threshold === null) {
        $avgLen = (strlen($inputNorm) + strlen($candidateNorm)) / 2;
        if ($avgLen <= 5) {
            $threshold = 1;  // 1 char difference for short names
        } elseif ($avgLen <= 10) {
            $threshold = 2;  // 2 char difference for medium names
        } else {
            $threshold = 3;  // 3 char difference for long names
        }
    }

    return $distance <= $threshold;
}

/**
 * Check if input is a substring match (either direction)
 */
function isSubstringMatch($input, $candidate) {
    $inputNorm = strtolower(normalizeAccents($input));
    $candidateNorm = strtolower(normalizeAccents($candidate));

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

    // Get all regions for fuzzy matching (exclude soft-deleted)
    $stmt = $pdo->prepare("SELECT regionID, regionName FROM region WHERE deleted = 0 ORDER BY regionName");
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

    // Get all producers for fuzzy matching (exclude soft-deleted)
    $stmt = $pdo->prepare("
        SELECT p.producerID, p.producerName, p.regionID, r.regionName
        FROM producers p
        LEFT JOIN region r ON p.regionID = r.regionID AND r.deleted = 0
        WHERE p.deleted = 0
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
        $producerFilter = " WHERE w.producerID = :producerId AND w.deleted = 0";
        $params[':producerId'] = $producerId;
    } elseif ($producerName) {
        $producerFilter = " WHERE p.producerName COLLATE utf8mb4_unicode_ci = :producerName AND w.deleted = 0 AND p.deleted = 0";
        $params[':producerName'] = $producerName;
    } else {
        $producerFilter = " WHERE w.deleted = 0";
    }

    // Get wines (filtered by producer if specified) for fuzzy matching (exclude soft-deleted)
    $stmt = $pdo->prepare("
        SELECT w.wineID, w.wineName, w.year, w.isNonVintage, p.producerName, p.producerID,
               (SELECT COUNT(*) FROM bottles b WHERE b.wineID = w.wineID AND b.bottleDrunk = 0 AND b.deleted = 0) as bottleCount
        FROM wine w
        LEFT JOIN producers p ON w.producerID = p.producerID AND p.deleted = 0
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
