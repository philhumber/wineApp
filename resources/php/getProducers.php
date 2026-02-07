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
		$having = [];
		$where = [];

		$bottleCount = $data['bottleCount'] ?? '0';
		$countryName = $data['countryName'] ?? null;
		$regionName = $data['regionName'] ?? null;
		$typeName = $data['typeName'] ?? null;
		$year = $data['year'] ?? null;

		$sqlQuery = "SELECT
						producers.producerID,
						producerName,
						region.regionName,
						count(bottles.bottleID) AS bottleCount
					FROM producers
					LEFT JOIN region on region.regionID = producers.regionID
					LEFT JOIN wine on wine.producerID = producers.producerID
					LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0";

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
		if ($regionName) {
			$where[] = "region.regionName = :regionName";
			$params[':regionName'] = $regionName;
		}
		if ($typeName) {
			$where[] = "winetype.wineType = :typeName";
			$params[':typeName'] = $typeName;
		}
		if ($year) {
			$where[] = "(wine.year = :year OR (:year = 'No Year' AND wine.year IS NULL))";
			$params[':year'] = $year;
		}

		if (!empty($where)) {
			$sqlQuery .= " WHERE " . implode(' AND ', $where);
		}

		$sqlQuery .= " GROUP BY producers.producerID, producerName, region.regionName";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		} else {
			// Even in "All Wines" mode, only show producers that have at least 1 wine
			$having[] = "COUNT(DISTINCT wine.wineID) >= 1";
		}

		// Always add HAVING clause since we always have at least one condition
		$sqlQuery .= " HAVING " . implode(' AND ', $having);

		$sqlQuery .= " ORDER BY producerName ASC";

		try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);
            $producerList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Producers retrieved sucessfully!';
            $response['data'] = ['wineList' =>  $producerList];

		} catch (Exception $e) {
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getProducers');
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
