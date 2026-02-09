<?php
	// 1. Include dependencies at the top
    require_once 'securityHeaders.php';
    require_once 'databaseConnection.php';
    require_once 'audit_log.php';
    require_once 'errorHandler.php';

    // 2. Initialize response
    $response = ['success' => false, 'message' => '', 'data' => null];

    try {
        // 3. Get database connection
        $pdo = getDBConnection();

        // 4. Get and validate input
        $data = json_decode(file_get_contents('php://input'), true);

		$params = [];
		$where = [];
		$having = [];

		$bottleCount = $data['bottleCount'] ?? '0';
		$wineCount = $data['wineCount'] ?? '0';
		$countryName = $data['countryName'] ?? null;
		$regionName = $data['regionName'] ?? null;
		$producerName = $data['producerName'] ?? null;
		$year = $data['year'] ?? null;

		$sqlQuery = "SELECT
						wineType,
						COUNT(bottles.bottleID) AS bottleCount
				FROM winetype
				LEFT JOIN wine ON wine.wineTypeID = winetype.wineTypeID AND wine.deleted = 0
				LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0 AND bottles.deleted = 0";

		// Add JOINs for context-aware filtering
		if ($countryName || $regionName || $producerName) {
			$sqlQuery .= " LEFT JOIN producers ON wine.producerID = producers.producerID AND producers.deleted = 0";
		}
		if ($countryName || $regionName) {
			$sqlQuery .= " LEFT JOIN region ON producers.regionID = region.regionID AND region.deleted = 0";
		}
		if ($countryName) {
			$sqlQuery .= " LEFT JOIN country ON region.countryID = country.countryID";
		}

		// Add WHERE clauses for context-aware filtering
		if ($countryName) {
			$where[] = "country.countryName = :countryName";
			$params[':countryName'] = $countryName;
		}
		if ($regionName) {
			$where[] = "region.regionName = :regionName";
			$params[':regionName'] = $regionName;
		}
		if ($producerName) {
			$where[] = "producers.producerName = :producerName";
			$params[':producerName'] = $producerName;
		}
		if ($year) {
			$where[] = "(wine.year = :year OR (:year = 'No Year' AND wine.year IS NULL))";
			$params[':year'] = $year;
		}

		if (!empty($where)) {
			$sqlQuery .= " WHERE " . implode(' AND ', $where);
		}

		$sqlQuery .= " GROUP BY winetype.wineTypeID";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		} else {
			// Even in "All Wines" mode, only show types that have at least 1 wine
			$having[] = "COUNT(DISTINCT wine.wineID) >= 1";
		}
		if (!empty($wineCount) && $wineCount !== '0') {
			$having[] = "COUNT(wine.wineID) >= :wineCount";
			$params[':wineCount'] = $wineCount;
		}

		// Always add HAVING clause since we always have at least one condition
		$sqlQuery .= " HAVING " . implode(' AND ', $having);

		$sqlQuery .= " ORDER BY wineType ASC";

		try {
				// 8. Perform database operation
				$stmt = $pdo->prepare($sqlQuery);
				$stmt->execute($params);
				$typeList = $stmt->fetchAll(PDO::FETCH_ASSOC);

				// 12. Set success response
				$response['success'] = true;
				$response['message'] = 'Types retrieved sucessfully!';
				$response['data'] = ['wineList' =>  $typeList];

		} catch (Exception $e) {
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getTypes');
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
