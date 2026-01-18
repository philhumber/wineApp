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

        //No validation as it should return all bottles if no ID specified.
		$wineID = $inputData['wineID'] ?? '%';

		$userID = $_SESSION['userID'] ?? null;
	
		$params = [];
		$having = [];
		$where = [];	
		$bottleCount = $inputData['bottleCount'] ?? '0';		
		$regionName = $inputData['regionName'] ?? '%';

		$sqlQuery = "SELECT 
						producerName,
						count(bottles.bottleID) AS bottleCount
					FROM producers
					LEFT JOIN region on region.regionID = producers.regionID
					LEFT JOIN wine on wine.producerID = producers.producerID
					LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0";

		if (!empty($regionName) && $regionName !== '%') {
			$where[] = "region.regionName = :regionName";
			$params[':regionName'] = $regionName;
		}


		if (!empty($where)) {
			$sqlQuery .= " WHERE " . implode(' AND ', $where);
		}
		$sqlQuery .= " GROUP BY producerName";

		if (!empty($bottleCount) && $bottleCount !== '0') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;			
		}

		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}

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
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getProducers.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>