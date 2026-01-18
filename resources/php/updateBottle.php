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

        // 5. Validate/Sanitize required fields
        if (empty($data['bottleID'])) {
            throw new Exception('Bottle ID is required');
        }

        // 6. Validate and sanitize all fields
        $bottleID = (int)trim($data['bottleID']);
        if ($bottleID <= 0) {
            throw new Exception('Invalid bottle ID');
        }

        // Get and validate other fields
        $bottleSize = trim($data['bottleSize'] ?? '');
        if (empty($bottleSize)) {
            throw new Exception('Bottle size is required');
        }

        $location = trim($data['location'] ?? '');
        if (empty($location)) {
            throw new Exception('Location is required');
        }

        $source = trim($data['bottleSource'] ?? '');
        if (empty($source)) {
            throw new Exception('Source is required');
        }
        $bottlePrice = trim($data['bottlePrice'] ?? null);
        $bottleCurrency = trim($data['bottleCurrency'] ?? null);

        $userID = $_SESSION['userID'] ?? null;

        //6. Prepare Statement
        $sqlQuery = "UPDATE bottles SET
                        bottleSize = :bottleSize,
                        location = :location,
                        source = :source,
                        price = :bottlePrice,
                        currency = :bottleCurrency
                    WHERE bottleID = :bottleID";

        $params[':bottleSize'] = $bottleSize;
        $params[':location'] = $location;
        $params[':source'] = $source;
        $params[':bottleID'] = $bottleID;
        $params[':bottlePrice'] = $bottlePrice;
        $params[':bottleCurrency'] = $bottleCurrency;

        // 7. Start transaction
        $pdo->beginTransaction();

        try {
            // 8. Get OLD data before update (for audit log)
            $stmt = $pdo->prepare("SELECT * FROM bottles WHERE bottleID = ?");
            $stmt->execute([$bottleID]);
            $oldData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$oldData) {
                throw new Exception('Bottle not found');
            }

            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);

             // 9. Get new ID
            //$bottleID = $pdo->lastInsertId(); //No Need as the ID is already there

            // 10. Log the change
            $newData = [
                'bottleSize' => $bottleSize,
                'location' => $location,
                'source' => $source,
                'price' => $bottlePrice,
                'currency' => $bottleCurrency
            ];

            logUpdate($pdo, 'bottles', $bottleID, $oldData, $newData, $userID);
            
            // 11. Commit transaction
            $pdo->commit();
            
            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Bottle updated successfully!';
            $response['data'] = ['bottleID' => $bottleID];
        
        } catch (Exception $e) {
            // 13. Rollback on error
            $pdo->rollBack();
            throw $e;
        }

    } catch (Exception $e) {
        // 14. Handle all errors
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        error_log("Error in updateBottle.php: " . $e->getMessage());
    }

    // 15. Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
?>