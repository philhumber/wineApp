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
		$countryName = $data['countryName'] ?? null;
		$typeName = $data['typeName'] ?? null;
		$producerName = $data['producerName'] ?? null;
		$year = $data['year'] ?? null;

		$sqlQuery = "SELECT
						region.regionName,
						COUNT(bottles.bottleID) AS bottleCount
					FROM region
					LEFT JOIN producers ON producers.regionID = region.regionID
					LEFT JOIN wine ON wine.producerID = producers.producerID
					LEFT JOIN bottles ON wine.wineID = bottles.wineID AND bottles.bottleDrunk = 0";

		// Add JOINs for context-aware filtering
		if ($countryName) {
			$sqlQuery .= " LEFT JOIN country ON region.countryID = country.countryID";
		}
		if ($typeName) {
			$sqlQuery .= " LEFT JOIN winetype ON wine.wineTypeID = winetype.wineTypeID";
		}

		// Add WHERE clauses for context-aware filtering
		if ($countryName) {
			$where[] = "country.countryName = :countryName";
			$params[':countryName'] = $countryName;
		}
		if ($typeName) {
			$where[] = "winetype.wineType = :typeName";
			$params[':typeName'] = $typeName;
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

		$sqlQuery .= " GROUP BY region.regionName";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		} else {
			// Even in "All Wines" mode, only show regions that have at least 1 wine
			$having[] = "COUNT(DISTINCT wine.wineID) >= 1";
		}

		// Always add HAVING clause since we always have at least one condition
		$sqlQuery .= " HAVING " . implode(' AND ', $having);

		$sqlQuery .= " ORDER BY regionName ASC";


		try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);
            $regionList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Regions retrieved sucessfully!';
            $response['data'] = ['wineList' =>  $regionList];

		} catch (Exception $e) {
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getRegions');
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
