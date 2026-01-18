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
		$wineID = $data['wineID'] ?? '%';

		$userID = $_SESSION['userID'] ?? null;

		

		$sqlQuery = "SELECT
						bottles.bottleID,
						bottles.bottleSize,
						bottles.source,
						bottles.price,
						bottles.currency,
						bottles.location,
						bottles.dateAdded
					FROM bottles
					WHERE bottles.wineID = :wineID AND bottles.bottleDrunk = 0";

		$params[':wineID'] = $wineID;

		try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);
            $bottleList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Bottles retrieved sucessfully!';
            $response['data'] = ['bottleList' =>  $bottleList];
        
		} catch (Exception $e) {                
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getBottles.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>