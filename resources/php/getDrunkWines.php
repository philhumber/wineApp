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
		
		$sqlQuery = "SELECT
			wine.wineID,
			wine.wineName,
			wine.description,
			wine.pictureURL,
			wine.enrichment_status,
			country.countryName,
			wine.year,
			wine.tastingNotes,
			wine.pairing,
			region.regionName,
			producers.producerName,
			country.code,
			country.world_code,
			wine.rating,
			winetype.wineType,
			bottles.bottleID,
			bottles.bottleDrunk,
			bottles.bottleSize,
			bottles.price AS bottlePrice,
			bottles.currency AS bottleCurrency,
			ratings.avgRating,
			ratings.Notes AS notes,
			ratings.drinkDate,
			ratings.overallRating,
			ratings.valueRating,
			ratings.buyAgain,
			ratings.complexityRating,
			ratings.drinkabilityRating,
			ratings.surpriseRating,
			ratings.foodPairingRating
		FROM wine
		JOIN producers ON wine.producerID = producers.producerID AND producers.deleted = 0
		JOIN region ON producers.regionID = region.regionID AND region.deleted = 0
		JOIN country ON region.countryID = country.countryID
		JOIN winetype ON wine.wineTypeID = winetype.wineTypeID
		JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk >= 1 AND bottles.deleted = 0
		LEFT JOIN ratings ON ratings.bottleID = bottles.bottleID
		WHERE wine.deleted = 0
		ORDER BY ratings.drinkDate DESC;";
		
		try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute();
            $bottleList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Drunk wines retrieved sucessfully!';
            $response['data'] = ['wineList' =>  $bottleList];
        
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