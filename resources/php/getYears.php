<?php
	// 1. Include dependencies at the top
    require_once 'databaseConnection.php';
    require_once 'audit_log.php';

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
		$regionName = $data['regionName'] ?? null;
		$producerName = $data['producerName'] ?? null;
		$typeName = $data['typeName'] ?? null;

		$sqlQuery = "SELECT
									COALESCE(wine.year, 'No Year') AS wineYear,
									COUNT(bottles.bottleID) AS bottleCount
								FROM wine
								LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0 AND bottles.deleted = 0
							WHERE wine.deleted = 0";

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
		if ($producerName) {
			$where[] = "producers.producerName = :producerName";
			$params[':producerName'] = $producerName;
		}
		if ($typeName) {
			$where[] = "winetype.wineType = :typeName";
			$params[':typeName'] = $typeName;
		}

		if (!empty($where)) {
			$sqlQuery .= " AND " . implode(' AND ', $where);
		}

		$sqlQuery .= " GROUP BY wine.year";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		}

		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}

		$sqlQuery .= " ORDER BY wine.year";
		
		try {
				// 8. Perform database operation
				$stmt = $pdo->prepare($sqlQuery);
				$stmt->execute($params);
				$yearList = $stmt->fetchAll(PDO::FETCH_ASSOC);

				// 12. Set success response
				$response['success'] = true;
				$response['message'] = 'Years retrieved sucessfully!';
				$response['data'] = ['wineList' =>  $yearList];
        
		} catch (Exception $e) {                
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getProducers.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>