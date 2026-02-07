<?php
	// 1. Include dependencies at the top
    require_once 'securityHeaders.php';
    require_once 'databaseConnection.php';
    require_once 'audit_log.php';
    require_once 'errorHandler.php';

    // Start session if not already started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    // 2. Initialize response
    $response = ['success' => false, 'message' => '', 'data' => null];

    try {
        // 3. Get database connection
        $pdo = getDBConnection();

        // 4. Get and validate input
        $data = json_decode(file_get_contents('php://input'), true);

        // 5. Validate/Sanitize required fields
        if (empty($data['wineID'])) {
            throw new Exception('Wine ID is required');
        } else {
            $wineID = (int)trim($data['wineID']) ?? 0;;
        }
        if (empty($data['bottleType'])) {
            throw new Exception('Bottle Type is required');
        } else {
            $bottleType = trim($data['bottleType']);
        }
        if (empty($data['storageLocation'])) {
            throw new Exception('Bottle Location is required');
        } else {
            $storageLocation = trim($data['storageLocation']);
        }
        if (empty($data['bottleSource'])) {
            throw new Exception('Bottle Source is required');
        } else {
            $bottleSource = trim($data['bottleSource']);
        }

        $bottlePrice = trim($data['bottlePrice'] ?? '');
        $bottleCurrency = trim($data['bottleCurrency'] ?? '');
        $purchaseDate = !empty($data['purchaseDate']) ? trim($data['purchaseDate']) : null;

        // WIN-222: Quantity for atomic batch insert (default 1, max 24)
        $quantity = isset($data['quantity']) ? (int)$data['quantity'] : 1;
        if ($quantity < 1) $quantity = 1;
        if ($quantity > 24) $quantity = 24;

        $userID = $_SESSION['userID'] ?? null;

        //6. Prepare Statement
        $sqlQuery = "INSERT INTO bottles (
                            wineID,
                            bottleSize,
                            location,
                            source,
                            price,
                            currency,
                            purchaseDate,
                            dateAdded)
                        VALUES (
                            :wineID,
                            :bottleType,
                            :storageLocation,
                            :bottleSource,
                            :bottlePrice,
                            :bottleCurrency,
                            :purchaseDate,
                            CURDATE())";

        $params = [
            ':wineID' => $wineID,
            ':bottleType' => $bottleType,
            ':storageLocation' => $storageLocation,
            ':bottleSource' => $bottleSource,
            ':bottlePrice' => $bottlePrice,
            ':bottleCurrency' => $bottleCurrency,
            ':purchaseDate' => $purchaseDate
        ];

        // 7. Start transaction
        $pdo->beginTransaction();

        try {
            // 8. Prepare statement once, execute for each bottle
            $stmt = $pdo->prepare($sqlQuery);
            $bottleIDs = [];

            // WIN-222: Insert all bottles in a single atomic transaction
            for ($i = 0; $i < $quantity; $i++) {
                $stmt->execute($params);
                $bottleID = $pdo->lastInsertId();
                $bottleIDs[] = $bottleID;

                // Log each insert
                logInsert($pdo, 'bottles', $bottleID, [
                    'wineID' => $wineID,
                    'bottleSize' => $bottleType,
                    'location' => $storageLocation,
                    'source' => $bottleSource,
                    'price' => $bottlePrice,
                    'currency' => $bottleCurrency,
                    'purchaseDate' => $purchaseDate,
                    'dateAdded' => date('Y-m-d')
                ], $userID);
            }

            // Commit transaction - all bottles inserted atomically
            $pdo->commit();

            // 12. Set success response
            $response['success'] = true;
            if ($quantity === 1) {
                $response['message'] = 'Bottle added successfully!';
                $response['data'] = ['bottleID' => $bottleIDs[0]];
            } else {
                $response['message'] = $quantity . ' bottles added successfully!';
                $response['data'] = ['bottleIDs' => $bottleIDs];
            }

            } catch (Exception $e) {
                // 13. Rollback on error - NO bottles committed
                $pdo->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
        // 14. Handle all errors (WIN-217: sanitize error messages)
        $response['success'] = false;
        $response['message'] = safeErrorMessage($e, 'addBottle');
    }

    // 15. Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
?>
