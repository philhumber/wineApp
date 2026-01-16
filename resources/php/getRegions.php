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

		$sqlQuery = "SELECT 
						region.regionName,
						COUNT(bottles.bottleID) AS bottleCount
					FROM region
					LEFT JOIN producers ON producers.regionID = region.regionID
					LEFT JOIN wine ON wine.producerID = producers.producerID
					LEFT JOIN bottles ON wine.wineID = bottles.wineID AND bottles.bottleDrunk = 0
					GROUP BY region.regionName";

		

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;			
		}

		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}

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
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getRegions.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>