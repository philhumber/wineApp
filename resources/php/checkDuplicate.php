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
 *
 * WIN-229: Uses SQL pre-filtering instead of loading all records.
 * 1. Exact match via SQL collation (accent+case insensitive)
 * 2. Fuzzy candidates via token-based LIKE + SOUNDEX, with LIMIT
 * 3. PHP fuzzy matching on reduced candidate set only
 */
function checkRegionDuplicates($pdo, $name, $normalizedName) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // 1. Exact match via SQL (accent+case insensitive via collation)
    $stmt = $pdo->prepare("
        SELECT regionID, regionName
        FROM region
        WHERE deleted = 0
          AND regionName COLLATE utf8mb4_unicode_ci = :name
        LIMIT 1
    ");
    $stmt->execute([':name' => $name]);
    $exact = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($exact) {
        $result['exactMatch'] = [
            'id' => (int)$exact['regionID'],
            'name' => $exact['regionName']
        ];
    }

    // 2. Pre-filtered fuzzy candidates
    $tokens = FuzzyMatcher::extractSearchTokens($name);
    [$filterSQL, $filterParams] = FuzzyMatcher::buildCandidateFilter('regionName', $tokens, $name);

    $stmt = $pdo->prepare("
        SELECT regionID, regionName
        FROM region
        WHERE deleted = 0 AND $filterSQL
        ORDER BY regionName
        LIMIT 50
    ");
    $stmt->execute($filterParams);
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. PHP fuzzy match on candidates only
    foreach ($candidates as $row) {
        // Skip exact match (already reported above)
        if ($result['exactMatch'] && (int)$row['regionID'] === $result['exactMatch']['id']) {
            continue;
        }

        if (count($result['similarMatches']) >= 5) break;

        if (isSubstringMatch($name, $row['regionName']) || isFuzzyMatch($name, $row['regionName'])) {
            $result['similarMatches'][] = [
                'id' => (int)$row['regionID'],
                'name' => $row['regionName']
            ];
        }
    }

    return $result;
}

/**
 * Check for duplicate producers
 *
 * WIN-229: Uses SQL pre-filtering instead of loading all records.
 * Exact matches with wrong region context are excluded from similarMatches
 * (preserving original behavior).
 */
function checkProducerDuplicates($pdo, $name, $normalizedName, $regionId = null, $regionName = null) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // 1. Exact match via SQL (all name matches, then filter by region in PHP)
    $stmt = $pdo->prepare("
        SELECT p.producerID, p.producerName, p.regionID, r.regionName
        FROM producers p
        LEFT JOIN region r ON p.regionID = r.regionID AND r.deleted = 0
        WHERE p.deleted = 0
          AND p.producerName COLLATE utf8mb4_unicode_ci = :name
    ");
    $stmt->execute([':name' => $name]);
    $exactRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Collect all exact-name IDs (to exclude from fuzzy matches, even if region doesn't match)
    $exactIds = array_map(fn($r) => (int)$r['producerID'], $exactRows);

    foreach ($exactRows as $row) {
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
                'name' => $row['producerName'],
                'meta' => $row['regionName']
            ];
            break;
        }
    }

    // 2. Pre-filtered fuzzy candidates
    $tokens = FuzzyMatcher::extractSearchTokens($name);
    [$filterSQL, $filterParams] = FuzzyMatcher::buildCandidateFilter('p.producerName', $tokens, $name);

    $stmt = $pdo->prepare("
        SELECT p.producerID, p.producerName, p.regionID, r.regionName
        FROM producers p
        LEFT JOIN region r ON p.regionID = r.regionID AND r.deleted = 0
        WHERE p.deleted = 0 AND $filterSQL
        ORDER BY p.producerName
        LIMIT 50
    ");
    $stmt->execute($filterParams);
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. PHP fuzzy match on candidates only
    foreach ($candidates as $row) {
        // Skip all exact-name matches (regardless of region context)
        if (in_array((int)$row['producerID'], $exactIds)) {
            continue;
        }

        if (count($result['similarMatches']) >= 5) break;

        if (isSubstringMatch($name, $row['producerName']) || isFuzzyMatch($name, $row['producerName'])) {
            $result['similarMatches'][] = [
                'id' => (int)$row['producerID'],
                'name' => $row['producerName'],
                'meta' => $row['regionName']
            ];
        }
    }

    return $result;
}

/**
 * Check for duplicate wines
 *
 * WIN-229: Uses SQL pre-filtering instead of loading all records.
 * Preserves WIN-176 year-aware duplicate detection and Add Bottle redirect logic.
 */
function checkWineDuplicates($pdo, $name, $normalizedName, $producerId = null, $producerName = null, $year = null) {
    $result = [
        'exactMatch' => null,
        'similarMatches' => [],
        'existingBottles' => 0,
        'existingWineId' => null
    ];

    // Build producer filter (shared by both exact and fuzzy queries)
    $producerWhere = "";
    $producerParams = [];

    if ($producerId) {
        $producerWhere = " AND w.producerID = :producerId";
        $producerParams[':producerId'] = $producerId;
    } elseif ($producerName) {
        $producerWhere = " AND p.producerName COLLATE utf8mb4_unicode_ci = :producerName AND p.deleted = 0";
        $producerParams[':producerName'] = $producerName;
    }

    // 1. Exact match via SQL (may return multiple rows for different vintages)
    $stmt = $pdo->prepare("
        SELECT w.wineID, w.wineName, w.year, w.isNonVintage, p.producerName, p.producerID,
               (SELECT COUNT(*) FROM bottles b WHERE b.wineID = w.wineID AND b.bottleDrunk = 0 AND b.deleted = 0) as bottleCount
        FROM wine w
        LEFT JOIN producers p ON w.producerID = p.producerID AND p.deleted = 0
        WHERE w.deleted = 0
          AND w.wineName COLLATE utf8mb4_unicode_ci = :name
          $producerWhere
    ");
    $stmt->execute(array_merge([':name' => $name], $producerParams));
    $exactRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Collect all exact-name IDs (to exclude from fuzzy matches)
    $exactIds = array_map(fn($r) => (int)$r['wineID'], $exactRows);

    foreach ($exactRows as $row) {
        $bottleCount = (int)$row['bottleCount'];

        if (!$result['exactMatch']) {
            $result['exactMatch'] = [
                'id' => (int)$row['wineID'],
                'name' => $row['wineName'],
                'meta' => $row['year'] ? $row['producerName'] . ' ' . $row['year'] : $row['producerName']
            ];
        }

        // WIN-176: Year-aware duplicate detection
        $inputIsNV = ($year === null || strtoupper($year ?? '') === 'NV');
        $rowIsNV = ($row['year'] === null || $row['isNonVintage']);

        $yearMatches = false;
        if ($inputIsNV && $rowIsNV) {
            $yearMatches = true;
        } else if (!$inputIsNV && !$rowIsNV) {
            $yearMatches = ((int)$row['year'] === (int)$year);
        }

        if ($yearMatches && $bottleCount > 0) {
            $result['existingBottles'] = $bottleCount;
            $result['existingWineId'] = (int)$row['wineID'];
        }
    }

    // 2. Pre-filtered fuzzy candidates
    $tokens = FuzzyMatcher::extractSearchTokens($name);
    [$filterSQL, $filterParams] = FuzzyMatcher::buildCandidateFilter('w.wineName', $tokens, $name);

    $stmt = $pdo->prepare("
        SELECT w.wineID, w.wineName, w.year, w.isNonVintage, p.producerName, p.producerID,
               (SELECT COUNT(*) FROM bottles b WHERE b.wineID = w.wineID AND b.bottleDrunk = 0 AND b.deleted = 0) as bottleCount
        FROM wine w
        LEFT JOIN producers p ON w.producerID = p.producerID AND p.deleted = 0
        WHERE w.deleted = 0
          $producerWhere
          AND $filterSQL
        ORDER BY w.wineName
        LIMIT 50
    ");
    $stmt->execute(array_merge($producerParams, $filterParams));
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. PHP fuzzy match on candidates only
    foreach ($candidates as $row) {
        // Skip all exact-name matches (already handled above)
        if (in_array((int)$row['wineID'], $exactIds)) {
            continue;
        }

        if (count($result['similarMatches']) >= 5) break;

        if (isSubstringMatch($name, $row['wineName']) || isFuzzyMatch($name, $row['wineName'])) {
            $result['similarMatches'][] = [
                'id' => (int)$row['wineID'],
                'name' => $row['wineName'],
                'meta' => $row['year'] ? $row['producerName'] . ' ' . $row['year'] : $row['producerName'],
                'bottleCount' => (int)$row['bottleCount']
            ];
        }
    }

    return $result;
}
?>
