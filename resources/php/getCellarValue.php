<?php
/**
 * Get Cellar Value
 * Calculates total value of all non-drunk bottles in the cellar
 * WIN-127: Cellar Value Display feature
 *
 * Returns value in EUR (frontend handles currency conversion)
 */

// 1. Include dependencies
require_once 'securityHeaders.php';
require_once 'databaseConnection.php';

// 2. Initialize response
$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Calculate cellar value with price completeness metrics
    $sql = "SELECT
                COALESCE(SUM(
                    CASE
                        WHEN b.price IS NOT NULL AND b.price > 0
                        THEN b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)
                        ELSE 0
                    END
                ), 0) AS totalValueEUR,
                COUNT(*) AS bottleCount,
                SUM(CASE WHEN b.price IS NOT NULL AND b.price > 0 THEN 1 ELSE 0 END) AS bottlesWithPrice,
                SUM(CASE WHEN b.price IS NULL OR b.price = 0 THEN 1 ELSE 0 END) AS bottlesWithoutPrice
            FROM bottles b
            LEFT JOIN currencies c ON b.currency = c.currencyCode
            WHERE b.bottleDrunk = 0 AND b.deleted = 0";

    $stmt = $pdo->query($sql);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // 5. Parse results
    $totalValueEUR = floatval($result['totalValueEUR'] ?? 0);
    $bottleCount = intval($result['bottleCount'] ?? 0);
    $bottlesWithPrice = intval($result['bottlesWithPrice'] ?? 0);
    $bottlesWithoutPrice = intval($result['bottlesWithoutPrice'] ?? 0);
    $hasIncompleteData = $bottlesWithoutPrice > 0;

    // 6. Set success response
    $response['success'] = true;
    $response['message'] = 'Cellar value calculated successfully';
    $response['data'] = [
        'totalValueEUR' => round($totalValueEUR, 2),
        'bottleCount' => $bottleCount,
        'bottlesWithPrice' => $bottlesWithPrice,
        'bottlesWithoutPrice' => $bottlesWithoutPrice,
        'hasIncompleteData' => $hasIncompleteData
    ];

} catch (Exception $e) {
    // 7. Handle errors - return zero values on failure
    $response['success'] = true;
    $response['message'] = 'Using default values';
    $response['data'] = [
        'totalValueEUR' => 0,
        'bottleCount' => 0,
        'bottlesWithPrice' => 0,
        'bottlesWithoutPrice' => 0,
        'hasIncompleteData' => false
    ];
    error_log("Error in getCellarValue.php: " . $e->getMessage());
}

// 8. Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
?>
