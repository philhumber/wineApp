<?php
	// 1. Include dependencies at the top
    require_once 'securityHeaders.php';
    require_once 'databaseConnection.php';
    require_once 'errorHandler.php';

    // 2. Initialize response
    $response = ['success' => false, 'message' => '', 'data' => null];

    try {
        // 3. Get database connection
        $pdo = getDBConnection();

		// 4. Fetch active currencies
		$currencySql = "SELECT
							currencyCode,
							currencyName,
							symbol,
							rateToEUR
						FROM currencies
						WHERE isActive = 1
						ORDER BY sortOrder ASC";

		$stmt = $pdo->query($currencySql);
		$currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);

		// 4b. Get latest rate update timestamp for freshness checks
		$lastUpdatedSql = "SELECT MAX(lastUpdated) as ratesLastUpdated FROM currencies WHERE isActive = 1";
		$stmt = $pdo->query($lastUpdatedSql);
		$ratesLastUpdated = $stmt->fetchColumn() ?: null;

		// 5. Fetch active bottle sizes
		$sizesSql = "SELECT
						sizeCode,
						sizeName,
						volumeLitres
					FROM bottle_sizes
					WHERE isActive = 1
					ORDER BY sortOrder ASC";

		$stmt = $pdo->query($sizesSql);
		$bottleSizes = $stmt->fetchAll(PDO::FETCH_ASSOC);

		// 6. Set success response
		$response['success'] = true;
		$response['message'] = 'Currencies and bottle sizes retrieved successfully';
		$response['data'] = [
			'currencies' => $currencies,
			'bottleSizes' => $bottleSizes,
			'ratesLastUpdated' => $ratesLastUpdated
		];

	} catch (Exception $e) {
		// 7. Handle errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getCurrencies');
	}

	// 8. Return JSON response with cache headers
	header('Content-Type: application/json');
	// Cache for 24 hours - currency data rarely changes
	header('Cache-Control: max-age=86400, public');
	echo json_encode($response);
?>
