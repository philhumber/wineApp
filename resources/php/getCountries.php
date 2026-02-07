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


		//No validation as it should return all bottles if no count specified.
		$bottleCount = $data['bottleCount'] ?? '0';
		$wineCount = $data['wineCount'] ?? '0';
		$drunkCount = $data['drunkCount'] ?? '0';

		// Context-aware filtering params
		$typeName = $data['typeName'] ?? null;
		$regionName = $data['regionName'] ?? null;
		$producerName = $data['producerName'] ?? null;
		$year = $data['year'] ?? null;

		$where = [];

		$sqlQuery = "SELECT
						country.countryName,
						COUNT(bottles.bottleID) AS bottleCount,
						LOWER(country.code) AS code
					FROM country
					LEFT JOIN region ON region.countryID = country.countryID
					LEFT JOIN producers ON producers.regionID = region.regionID
					LEFT JOIN wine ON wine.producerID = producers.producerID
					LEFT JOIN bottles ON wine.wineID = bottles.wineID AND bottles.bottleDrunk = 0";

		// Add winetype JOIN if filtering by type
		if ($typeName) {
			$sqlQuery .= " LEFT JOIN winetype ON wine.wineTypeID = winetype.wineTypeID";
		}

		// Context-aware WHERE clauses
		if ($typeName) {
			$where[] = "winetype.wineType = :typeName";
			$params[':typeName'] = $typeName;
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
			if ($year === 'No Year') {
				$where[] = "wine.year IS NULL";
			} else {
				$where[] = "wine.year = :year";
				$params[':year'] = $year;
			}
		}

		if (!empty($where)) {
			$sqlQuery .= " WHERE " . implode(' AND ', $where);
		}

		$sqlQuery .= " GROUP BY country.countryID";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		} else {
			// Even in "All Wines" mode, only show countries that have at least 1 wine
			$having[] = "COUNT(DISTINCT wine.wineID) >= 1";
		}
		if (!empty($wineCount) && $wineCount !== '0') {
			$having[] = "COUNT(wine.wineID) >= :wineCount";
			$params[':wineCount'] = $wineCount;
		}
		if (!empty($drunkCount) && $drunkCount !== '0') {
			$having[] = "COUNT(bottles.BottleDrunk) >= :drunkCount";
			$params[':drunkCount'] = $drunkCount;
		}
		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}

		$sqlQuery .= " ORDER BY countryName ASC";

		try{
			$stmt = $pdo->prepare($sqlQuery);
			$stmt->execute($params);
			$countryList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Countries retrieved sucessfully!';
            $response['data'] = ['wineList' =>  $countryList];

		} catch (Exception $e) {
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getCountries');
	}

	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
