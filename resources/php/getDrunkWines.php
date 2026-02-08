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

		// WIN-205: Pagination params
		$page = max(1, intval($data['page'] ?? 1));
		$limit = max(1, min(200, intval($data['limit'] ?? 50)));
		$offset = ($page - 1) * $limit;

		// WIN-205: Sort params with whitelist (prevents SQL injection)
		$sortKeyInput = $data['sortKey'] ?? 'drinkDate';
		$sortDirInput = strtolower($data['sortDir'] ?? 'desc');
		$sortDir = ($sortDirInput === 'asc') ? 'ASC' : 'DESC';

		$sortMap = [
			'drinkDate'     => 'ratings.drinkDate',
			'rating'        => '((ratings.overallRating + ratings.valueRating) / 2)',
			'overallRating' => 'ratings.overallRating',
			'valueRating'   => 'ratings.valueRating',
			'wineName'      => 'wine.wineName',
			'wineType'      => 'winetype.wineType',
			'country'       => 'country.countryName',
			'producer'      => 'producers.producerName',
			'region'        => 'region.regionName',
			'year'          => 'wine.year',
			'price'         => 'priceEUR',
			'buyAgain'      => 'ratings.buyAgain',
		];

		$sortColumn = $sortMap[$sortKeyInput] ?? 'ratings.drinkDate';

		// WIN-205: Filter params
		$filterCountry  = $data['countryDropdown'] ?? null;
		$filterType     = $data['typesDropdown'] ?? null;
		$filterRegion   = $data['regionDropdown'] ?? null;
		$filterProducer = $data['producerDropdown'] ?? null;
		$filterYear     = $data['yearDropdown'] ?? null;

		// ── Base query fragments ──
		$selectFields = "
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
			ratings.ratingID,
			ratings.avgRating,
			ratings.Notes AS notes,
			ratings.drinkDate,
			ratings.overallRating,
			ratings.valueRating,
			ratings.buyAgain,
			ratings.complexityRating,
			ratings.drinkabilityRating,
			ratings.surpriseRating,
			ratings.foodPairingRating,
			CASE WHEN bottles.price IS NOT NULL AND bottles.price > 0
				THEN bottles.price / COALESCE(NULLIF(c.rateToEUR, 0), 1)
				ELSE NULL END AS priceEUR";

		$fromClause = "
		FROM wine
		JOIN producers ON wine.producerID = producers.producerID AND producers.deleted = 0
		JOIN region ON producers.regionID = region.regionID AND region.deleted = 0
		JOIN country ON region.countryID = country.countryID
		JOIN winetype ON wine.wineTypeID = winetype.wineTypeID
		JOIN bottles ON bottles.wineID = wine.wineID AND bottles.bottleDrunk >= 1 AND bottles.deleted = 0
		LEFT JOIN ratings ON ratings.bottleID = bottles.bottleID
		LEFT JOIN currencies c ON bottles.currency = c.currencyCode";

		// ── Build WHERE clause ──
		$where = ["wine.deleted = 0"];
		$params = [];

		if (!empty($filterCountry)) {
			$where[] = "country.countryName = :filterCountry";
			$params[':filterCountry'] = $filterCountry;
		}
		if (!empty($filterType)) {
			$where[] = "winetype.wineType = :filterType";
			$params[':filterType'] = $filterType;
		}
		if (!empty($filterRegion)) {
			$where[] = "region.regionName = :filterRegion";
			$params[':filterRegion'] = $filterRegion;
		}
		if (!empty($filterProducer)) {
			$where[] = "producers.producerName = :filterProducer";
			$params[':filterProducer'] = $filterProducer;
		}
		if (!empty($filterYear)) {
			$where[] = "wine.year = :filterYear";
			$params[':filterYear'] = $filterYear;
		}

		$whereClause = " WHERE " . implode(' AND ', $where);

		// ── Build base WHERE (no filters, for unfiltered total) ──
		$baseWhere = " WHERE wine.deleted = 0";

		// ── ORDER BY with NULLs last ──
		$orderBy = " ORDER BY $sortColumn IS NULL, $sortColumn $sortDir";

		try {
			// ── 1. Data query ──
			$dataSQL = "SELECT $selectFields $fromClause $whereClause $orderBy LIMIT :limit OFFSET :offset";
			$stmt = $pdo->prepare($dataSQL);
			foreach ($params as $key => $val) {
				$stmt->bindValue($key, $val);
			}
			$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
			$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
			$stmt->execute();
			$wineList = $stmt->fetchAll(PDO::FETCH_ASSOC);

			// ── 2. Count query (filtered total) ──
			$countSQL = "SELECT COUNT(*) as total $fromClause $whereClause";
			$stmt = $pdo->prepare($countSQL);
			foreach ($params as $key => $val) {
				$stmt->bindValue($key, $val);
			}
			$stmt->execute();
			$total = (int)$stmt->fetchColumn();

			// ── 3. Unfiltered total ──
			$unfilteredSQL = "SELECT COUNT(*) as total $fromClause $baseWhere";
			$stmt = $pdo->prepare($unfilteredSQL);
			$stmt->execute();
			$unfilteredTotal = (int)$stmt->fetchColumn();

			// ── 4. Pagination meta (clamp page) ──
			$totalPages = max(1, ceil($total / $limit));
			if ($page > $totalPages && $total > 0) {
				// Re-fetch on last page
				$page = $totalPages;
				$offset = ($page - 1) * $limit;
				$stmt = $pdo->prepare($dataSQL);
				foreach ($params as $key => $val) {
					$stmt->bindValue($key, $val);
				}
				$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
				$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
				$stmt->execute();
				$wineList = $stmt->fetchAll(PDO::FETCH_ASSOC);
			}

			// ── 5. Cascading filter options ──
			// Each dimension excludes itself from the WHERE clause
			$filterDefs = [
				'countries' => [
					'select' => 'country.countryName AS value, COUNT(*) AS count',
					'group'  => 'country.countryName',
					'exclude' => 'filterCountry'
				],
				'types' => [
					'select' => 'winetype.wineType AS value, COUNT(*) AS count',
					'group'  => 'winetype.wineType',
					'exclude' => 'filterType'
				],
				'regions' => [
					'select' => 'region.regionName AS value, COUNT(*) AS count',
					'group'  => 'region.regionName',
					'exclude' => 'filterRegion'
				],
				'producers' => [
					'select' => 'producers.producerName AS value, COUNT(*) AS count',
					'group'  => 'producers.producerName',
					'exclude' => 'filterProducer'
				],
				'years' => [
					'select' => 'wine.year AS value, COUNT(*) AS count',
					'group'  => 'wine.year',
					'exclude' => 'filterYear'
				],
			];

			$filterParamMap = [
				'filterCountry'  => ['clause' => "country.countryName = :filterCountry",  'value' => $filterCountry],
				'filterType'     => ['clause' => "winetype.wineType = :filterType",        'value' => $filterType],
				'filterRegion'   => ['clause' => "region.regionName = :filterRegion",      'value' => $filterRegion],
				'filterProducer' => ['clause' => "producers.producerName = :filterProducer", 'value' => $filterProducer],
				'filterYear'     => ['clause' => "wine.year = :filterYear",                'value' => $filterYear],
			];

			$filterOptions = [];
			foreach ($filterDefs as $key => $def) {
				$optWhere = ["wine.deleted = 0"];
				$optParams = [];

				foreach ($filterParamMap as $paramName => $info) {
					if ($paramName === $def['exclude']) continue;
					if (!empty($info['value'])) {
						$optWhere[] = $info['clause'];
						$optParams[':' . $paramName] = $info['value'];
					}
				}

				$optWhereClause = " WHERE " . implode(' AND ', $optWhere);
				$optSQL = "SELECT {$def['select']} $fromClause $optWhereClause GROUP BY {$def['group']} ORDER BY {$def['group']} ASC";

				$stmt = $pdo->prepare($optSQL);
				foreach ($optParams as $pKey => $pVal) {
					$stmt->bindValue($pKey, $pVal);
				}
				$stmt->execute();
				$filterOptions[$key] = $stmt->fetchAll(PDO::FETCH_ASSOC);

				// Cast count to int
				foreach ($filterOptions[$key] as &$opt) {
					$opt['count'] = (int)$opt['count'];
				}
				unset($opt);
			}

			// 12. Set success response
			$response['success'] = true;
			$response['message'] = 'Drunk wines retrieved successfully!';
			$response['data'] = [
				'wineList' => $wineList,
				'pagination' => [
					'page' => $page,
					'limit' => $limit,
					'total' => $total,
					'totalPages' => $totalPages
				],
				'unfilteredTotal' => $unfilteredTotal,
				'filterOptions' => $filterOptions
			];

		} catch (Exception $e) {
			throw $e;
		}

	} catch (Exception $e) {
		// 14. Handle all errors (WIN-217: sanitize error messages)
		$response['success'] = false;
		$response['message'] = safeErrorMessage($e, 'getDrunkWines');
	}
	// 15. Return JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
?>
