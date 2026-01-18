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
		$having = [];

		$bottleCount = $data['bottleCount'] ?? '0';
		$wineCount = $data['wineCount'] ?? '0';

		$sqlQuery = "SELECT
						wineType,
						COUNT(bottles.bottleID) AS bottleCount
				FROM winetype
				LEFT JOIN wine ON wine.wineTypeID = winetype.wineTypeID
				LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0
				GROUP BY winetype.wineTypeID";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;			
		}
		if (!empty($wineCount) && $wineCount !== '0') {
			$having[] = "COUNT(wine.wineID) >= :wineCount";
			$params[':wineCount'] = $wineCount;			
		}

		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}

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
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getTypes.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>