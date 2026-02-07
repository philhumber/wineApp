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

        // 5. Validate/Sanitize required fields
        if (empty($data['wineID'])) {
            throw new Exception('Wine ID is required');
        } else {
            $wineID = trim($data['wineID']);
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

        $params[':wineID'] = $wineID;
        $params[':bottleType'] = $bottleType;
        $params[':storageLocation'] = $storageLocation;
        $params[':bottleSource'] = $bottleSource;
        $params[':bottlePrice'] = $bottlePrice;
        $params[':bottleCurrency'] = $bottleCurrency;
        $params[':purchaseDate'] = $purchaseDate;

        // 7. Start transaction
        $pdo->beginTransaction();

        try {
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);

            // Get the new bottle ID
            $bottleID = $pdo->lastInsertId();

            // Log the insert
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

            // Commit transaction
            $pdo->commit();

            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Bottle added successfully!';
            $response['data'] = ['bottleID' => $bottleID];

            } catch (Exception $e) {
                // 13. Rollback on error
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
