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
		$searchQuery = trim($data['searchQuery'] ?? '');

		// WIN-204: Pre-aggregate rating stats per wine (replaces 6 correlated subqueries)
		$ctePrefix = "WITH rating_stats AS (
				SELECT
					r.wineID,
					ROUND((AVG(r.overallRating) + AVG(r.valueRating)) / 2, 2) AS avgRating,
					ROUND(AVG(r.overallRating), 2) AS avgOverallRating,
					ROUND(AVG(r.valueRating), 2) AS avgValueRating,
					GROUP_CONCAT(r.Notes SEPARATOR '; ') AS allNotes,
					ROUND(
						(SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) * 100.0) /
						NULLIF(COUNT(r.ratingID), 0), 0
					) AS buyAgainPercent,
					COUNT(r.ratingID) AS ratingCount
				FROM ratings r
				GROUP BY r.wineID
			),
			-- WIN-204: Rank bottle prices for median calculation (dual ROW_NUMBER)
			bottle_price_ranked AS (
				SELECT
					b.wineID,
					(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75) AS norm_ppl,
					(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) AS norm_bp,
					b.bottleSize,
					b.price,
					b.currency,
					ROW_NUMBER() OVER (PARTITION BY b.wineID ORDER BY
						(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75)
					) AS rn_ppl,
					ROW_NUMBER() OVER (PARTITION BY b.wineID ORDER BY
						(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1))
					) AS rn_bp,
					COUNT(*) OVER (PARTITION BY b.wineID) AS cnt
				FROM bottles b
				LEFT JOIN currencies c ON b.currency = c.currencyCode
				LEFT JOIN bottle_sizes bs ON b.bottleSize = bs.sizeCode
				WHERE b.deleted = 0
					AND b.price IS NOT NULL
					AND b.price > 0
			),
			-- WIN-204: Aggregate per-wine price stats from ranked data
			bottle_prices AS (
				SELECT
					wineID,
					ROUND(AVG(CASE WHEN rn_ppl IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2)) THEN norm_ppl END), 2) AS avgPricePerLiterEUR,
					ROUND(AVG(CASE WHEN rn_bp IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2)) THEN norm_bp END), 2) AS avgBottlePriceEUR,
					ROUND(AVG(CASE WHEN bottleSize = 'Standard' THEN price END), 2) AS standardPrice,
					ROUND(AVG(CASE WHEN bottleSize = 'Magnum' THEN price END), 2) AS magnumPrice,
					ROUND(AVG(CASE WHEN bottleSize = 'Demi' THEN price END), 2) AS demiPrice,
					ROUND(AVG(CASE WHEN bottleSize IN ('Piccolo', 'Quarter') THEN price END), 2) AS smallPrice,
					MIN(currency) AS currency
				FROM bottle_price_ranked
				GROUP BY wineID
			),
			-- WIN-204: Rank type-level prices for median (was O(N^2), now O(N))
			type_price_ranked AS (
				SELECT
					w2.wineTypeID,
					(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75) AS norm_ppl,
					ROW_NUMBER() OVER (PARTITION BY w2.wineTypeID ORDER BY
						(b.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)) / COALESCE(NULLIF(bs.volumeLitres, 0), 0.75)
					) AS rn,
					COUNT(*) OVER (PARTITION BY w2.wineTypeID) AS cnt
				FROM bottles b
				JOIN wine w2 ON b.wineID = w2.wineID
				LEFT JOIN currencies c ON b.currency = c.currencyCode
				LEFT JOIN bottle_sizes bs ON b.bottleSize = bs.sizeCode
				WHERE w2.deleted = 0
					AND b.deleted = 0
					AND b.price IS NOT NULL
					AND b.price > 0
			),
			type_prices AS (
				SELECT
					wineTypeID,
					ROUND(AVG(CASE WHEN rn IN (FLOOR((cnt + 1) / 2), CEILING((cnt + 1) / 2)) THEN norm_ppl END), 2) AS typeAvgPricePerLiterEUR
				FROM type_price_ranked
				GROUP BY wineTypeID
			),
			-- WIN-204: Aggregate bottle sources per wine
			bottle_sources AS (
				SELECT
					b.wineID,
					GROUP_CONCAT(
						CONCAT(b.source, CASE WHEN b.source_count > 1 THEN CONCAT(' (', b.source_count, ')') ELSE '' END)
						SEPARATOR ', '
					) AS bottleSources
				FROM (
					SELECT wineID, source, COUNT(*) AS source_count
					FROM bottles
					WHERE deleted = 0
						AND bottleDrunk = 0
						AND source IS NOT NULL
						AND source != ''
					GROUP BY wineID, source
				) b
				GROUP BY b.wineID
			) ";

		$sqlQuery = $ctePrefix . "SELECT
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
						rs.avgRating,
						rs.avgOverallRating,
						rs.avgValueRating,
						rs.allNotes,
						bp.avgPricePerLiterEUR,
						bp.avgBottlePriceEUR,
						tp.typeAvgPricePerLiterEUR,
						bp.standardPrice,
						bp.magnumPrice,
						bp.demiPrice,
						bp.smallPrice,
						bp.currency,
						bsrc.bottleSources,
						rs.buyAgainPercent,
						rs.ratingCount,
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
					LEFT JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk = 0 AND bottles.deleted = 0
					LEFT JOIN rating_stats rs ON rs.wineID = wine.wineID
					LEFT JOIN bottle_prices bp ON bp.wineID = wine.wineID
					LEFT JOIN type_prices tp ON tp.wineTypeID = wine.wineTypeID
					LEFT JOIN bottle_sources bsrc ON bsrc.wineID = wine.wineID";

		$join = [];
		$where = [];
		$params = [];
		$groupBy = [];
		$orderBy = [];
		$having = [];

		// WIN-80: Always filter out soft-deleted records
		$where[] = "wine.deleted = 0";
		$where[] = "producers.deleted = 0";
		$where[] = "region.deleted = 0";

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

		// Free text search across multiple fields (WIN-24)
		// Uses REGEXP with word-start boundary for prefix matching
		// e.g. "champan" matches "champagne", but "hampagne" does not
		// e.g. "aux" matches "Aux Bons Crus" but not "bordeaux"
		if (!empty($searchQuery) && mb_strlen($searchQuery, 'UTF-8') >= 3) {
			// Escape regex special characters for MySQL REGEXP
			$escapedSearch = preg_quote($searchQuery);
			// Word-start boundary: matches from beginning of words (prefix matching)
			$searchPattern = '\\b' . $escapedSearch;

			$searchConditions = [];
			$searchFields = [
				'wine.wineName', 'producers.producerName', 'region.regionName',
				'country.countryName', 'wine.appellation', 'wine.description',
				'wine.tastingNotes', 'wine.pairing', 'CAST(wine.year AS CHAR)'
			];

			foreach ($searchFields as $i => $field) {
				$searchConditions[] = "$field COLLATE utf8mb4_0900_ai_ci REGEXP :search_$i";
				$params[":search_$i"] = $searchPattern;
			}

			$where[] = '(' . implode(' OR ', $searchConditions) . ')';
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
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getWines');
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
