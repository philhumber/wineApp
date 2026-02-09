<?php
/**
 * Get Cellar Value History
 * Reconstructs historical cellar value from bottle events (add, drink, delete)
 * WIN-127 Phase 2: Historical Cellar Value Graph
 *
 * Returns running totals in EUR (frontend handles currency conversion)
 */

// 1. Include dependencies
require_once 'securityHeaders.php';
require_once 'databaseConnection.php';
require_once 'errorHandler.php';

// 2. Initialize response
$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Query daily aggregate events using CTEs
    $sql = "
    WITH events AS (
      -- Add events: every bottle that was ever added to the cellar
      -- (regardless of current deleted/drunk status — those are tracked as separate events)
      SELECT
        b.dateAdded AS event_date,
        CASE WHEN b.price IS NOT NULL AND b.price > 0
          THEN b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)
          ELSE 0
        END AS value_delta,
        1 AS count_delta
      FROM bottles b
      LEFT JOIN currencies c ON b.currency = c.currencyCode

      UNION ALL

      -- Drink events: bottles removed by drinking
      -- (regardless of current deleted status — deletion is tracked separately)
      SELECT
        r.drinkDate AS event_date,
        -CASE WHEN b.price IS NOT NULL AND b.price > 0
          THEN b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)
          ELSE 0
        END AS value_delta,
        -1 AS count_delta
      FROM ratings r
      JOIN bottles b ON r.bottleID = b.bottleID
      LEFT JOIN currencies c ON b.currency = c.currencyCode

      UNION ALL

      -- Delete events: soft-deleted bottles that were NOT drunk
      -- (drunk+deleted bottles are already subtracted by drink events above)
      SELECT
        DATE(b.deletedAt) AS event_date,
        -CASE WHEN b.price IS NOT NULL AND b.price > 0
          THEN b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)
          ELSE 0
        END AS value_delta,
        -1 AS count_delta
      FROM bottles b
      LEFT JOIN currencies c ON b.currency = c.currencyCode
      WHERE b.deleted = 1
        AND b.deletedAt IS NOT NULL
        AND b.bottleDrunk = 0
    ),
    daily_aggregates AS (
      SELECT
        event_date,
        SUM(value_delta) AS daily_value_change,
        SUM(count_delta) AS daily_count_change
      FROM events
      WHERE event_date IS NOT NULL
      GROUP BY event_date
      ORDER BY event_date ASC
    )
    SELECT * FROM daily_aggregates
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Build running totals
    $runningValue = 0;
    $runningCount = 0;
    $history = [];

    foreach ($rows as $row) {
        $runningValue += (float)$row['daily_value_change'];
        $runningCount += (int)$row['daily_count_change'];
        $history[] = [
            'date' => $row['event_date'],
            'totalValueEUR' => round($runningValue, 2),
            'bottleCount' => (int)$runningCount
        ];
    }

    // 6. Set success response
    $response['success'] = true;
    $response['message'] = 'Cellar value history retrieved successfully';
    $response['data'] = $history;

} catch (Exception $e) {
    http_response_code(500);
    $response['success'] = false;
    $response['message'] = safeErrorMessage($e, 'getCellarValueHistory');
}

// 7. Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
?>
