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

		//set up deafults here
		$producerName = '%';
		$wineYear = '%';

		$bottleCount = $data['bottleCount'] ?? '1';
		$producerName = $data['producerDropdown'] ?? '%';
		$countryName = $data['countryDropdown'] ?? '%';
		$wineType = $data['typesDropdown'] ?? '%';
		$regionName = $data['regionDropdown'] ?? '%';
		$bottleCount =  $data['bottleCount'] ?? '1';
		$wineYear = $data['yearDropdown'] ?? '%';
		$wineID = $data['wineID'] ?? '%';

		$sqlQuery = "SELECT
						wine.wineID,
						wine.wineName,
						wine.description,
						wine.pictureURL,
						wine.enrichment_status,
						country.countryName,
						wine.year,
						wine.isNonVintage,
						wine.tastingNotes,
						wine.pairing,
						region.regionName,
						winetype.wineType,
						producers.producerName,
						country.code,
						country.world_code,
						wine.rating,								
						(SELECT ROUND((AVG(overallRating) + AVG(valueRating)) / 2, 2) FROM ratings WHERE ratings.wineID = wine.wineID) AS avgRating,
						(SELECT ROUND(AVG(overallRating), 2) FROM ratings WHERE ratings.wineID = wine.wineID) AS avgOverallRating,
						(SELECT ROUND(AVG(valueRating), 2) FROM ratings WHERE ratings.wineID = wine.wineID) AS avgValueRating,
						(SELECT GROUP_CONCAT(Notes SEPARATOR '; ') FROM ratings WHERE ratings.wineID = wine.wineID) AS allNotes,
						(SELECT ROUND(AVG(normalized_price), 2)
						FROM (
							SELECT
								(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75) AS normalized_price,
								ROW_NUMBER() OVER (ORDER BY
									(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75)
								) AS rn,
								COUNT(*) OVER () AS cnt
							FROM bottles b
							LEFT JOIN currencies c ON b.currency = c.currencyCode
							LEFT JOIN bottle_sizes bs ON b.bottleSize = bs.sizeCode
							WHERE b.wineID = wine.wineID
								AND b.price IS NOT NULL
								AND b.price > 0
						) AS ranked
						WHERE rn IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2))) AS avgPricePerLiterEUR,
						(SELECT ROUND(AVG(normalized_price), 2)
						FROM (
							SELECT
								(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) AS normalized_price,
								ROW_NUMBER() OVER (ORDER BY
									(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1))
								) AS rn,
								COUNT(*) OVER () AS cnt
							FROM bottles b
							LEFT JOIN currencies c ON b.currency = c.currencyCode
							WHERE b.wineID = wine.wineID
								AND b.price IS NOT NULL
								AND b.price > 0
						) AS ranked
						WHERE rn IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2))) AS avgBottlePriceEUR,
						(SELECT ROUND(AVG(normalized_price), 2)
						FROM (
							SELECT
								(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75) AS normalized_price,
								ROW_NUMBER() OVER (ORDER BY
									(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75)
								) AS rn,
								COUNT(*) OVER () AS cnt
							FROM bottles b
							JOIN wine w2 ON b.wineID = w2.wineID
							LEFT JOIN currencies c ON b.currency = c.currencyCode
							LEFT JOIN bottle_sizes bs ON b.bottleSize = bs.sizeCode
							WHERE w2.wineTypeID = wine.wineTypeID
								AND b.price IS NOT NULL
								AND b.price > 0
						) AS ranked
						WHERE rn IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2))) AS typeAvgPricePerLiterEUR,
						(SELECT ROUND(AVG(b.price), 2)
						FROM bottles b
						WHERE b.wineID = wine.wineID
							AND b.bottleSize = 'Standard'
							AND b.price IS NOT NULL
							AND b.price > 0) AS standardPrice,
						(SELECT ROUND(AVG(b.price), 2)
						FROM bottles b
						WHERE b.wineID = wine.wineID
							AND b.bottleSize = 'Magnum'
							AND b.price IS NOT NULL
							AND b.price > 0) AS magnumPrice,
						(SELECT ROUND(AVG(b.price), 2)
						FROM bottles b
						WHERE b.wineID = wine.wineID
							AND b.bottleSize = 'Demi'
							AND b.price IS NOT NULL
							AND b.price > 0) AS demiPrice,
						(SELECT ROUND(AVG(b.price), 2)
						FROM bottles b
						WHERE b.wineID = wine.wineID
							AND b.bottleSize IN ('Piccolo', 'Quarter')
							AND b.price IS NOT NULL
							AND b.price > 0) AS smallPrice,
						(SELECT b.currency
						FROM bottles b
						WHERE b.wineID = wine.wineID
							AND b.price IS NOT NULL
						LIMIT 1) AS currency,
						(SELECT GROUP_CONCAT(
							CONCAT(source_name, CASE WHEN source_count > 1 THEN CONCAT(' (', source_count, ')') ELSE '' END)
							SEPARATOR ', ')
						FROM (
							SELECT b.source AS source_name, COUNT(*) AS source_count
							FROM bottles b
							WHERE b.wineID = wine.wineID
								AND b.bottleDrunk = 0
								AND b.source IS NOT NULL
								AND b.source != ''
							GROUP BY b.source
						) AS sources) AS bottleSources,
						(SELECT ROUND(
							(SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) * 100.0) /
							NULLIF(COUNT(r.ratingID), 0), 0)
						FROM ratings r
						WHERE r.wineID = wine.wineID) AS buyAgainPercent,
						(SELECT COUNT(r.ratingID)
						FROM ratings r
						WHERE r.wineID = wine.wineID) AS ratingCount,
						SUM(CASE WHEN bottles.bottleSize = 'Standard' THEN 1 ELSE 0 END) AS standardBottles,
						SUM(CASE WHEN bottles.bottleSize IN ('Piccolo', 'Quarter', 'Demi') THEN 1 ELSE 0 END) AS smallBottles,
						COUNT(bottles.bottleID) - 
							SUM(CASE WHEN bottles.bottleSize = 'Standard' THEN 1 ELSE 0 END) - 
							SUM(CASE WHEN bottles.bottleSize IN ('Piccolo', 'Quarter', 'Demi') THEN 1 ELSE 0 END) AS largeBottles,
						COUNT(bottles.bottleID) AS bottleCount
					FROM wine
					JOIN producers ON wine.producerID = producers.producerID
					JOIN region ON producers.regionID = region.regionID
					JOIN country ON region.countryID = country.countryID
					JOIN winetype ON wine.wineTypeID = winetype.wineTypeID
					LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0";

		$join = [];
		$where = [];
		$params = [];
		$groupBy = [];
		$orderBy = [];
		$having = [];

		if (!empty($producerName) && $producerName !== '%') {
			$where[] = "producers.producerName = :producerName";
			$params[':producerName'] = $producerName;
		}
		if (!empty($wineID) && $wineID !== '%') {
			$where[] = "wine.wineID = :wineID";
			$params[':wineID'] = $wineID;
		}
		if (!empty($countryName) && $countryName !== '%') {
			$where[] = "country.countryName = :countryName";
			$params[':countryName'] = $countryName;
		}
		if (!empty($wineType) && $wineType !== '%') {
			$where[] = "winetype.wineType = :wineType";
			$params[':wineType'] = $wineType;
		}
		if (!empty($regionName) && $regionName !== '%') {
			$where[] = "region.regionName = :regionName";
			$params[':regionName'] = $regionName;
		}
		if (!empty($wineYear) && $wineYear !== '%') {
			if ($wineYear == 'No Year') {
				$where[] = "wine.isNonVintage = 1";
			} else {
				$where[] = "wine.year = :wineYear";
				$params[':wineYear'] = $wineYear;
			}
		}
		if (!empty($where)) {
			$sqlQuery .= " WHERE " . implode(' AND ', $where);
		}
		
		$sqlQuery .= " GROUP BY wine.wineID";

		// Only apply bottle count filter when NOT fetching a specific wine by ID
		// This allows editing wines with 0 bottles
		if (empty($wineID) || $wineID === '%') {
			$having[] = "COUNT(bottles.bottleID) >= :bottleCount";
			$params[':bottleCount'] = $bottleCount;
		}

		if (!empty($having)) {
			$sqlQuery .= " HAVING " . implode(' AND ', $having);
		}
		$sqlQuery .= " ORDER BY producers.producerName ASC, wine.year ASC, wine.wineName ASC";	

		
		try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);
            $producerList = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Wines with bottle count >= ' . $bottleCount . ' retrieved sucessfully!';
            $response['data'] = ['wineList' =>  $producerList];
        
		} catch (Exception $e) {                
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors
		$response['success'] = false;
		$response['message'] = $e->getMessage();
		error_log("Error in getWines.php: " . $e->getMessage());
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>