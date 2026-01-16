<?php
	// 1. Include dependencies at the top
    require_once 'config/database.php';
    require_once 'functions/audit_log.php';

    // 2. Initialize response
    $response = [
        'success' => false,
        'message' => '',
        'data' => null
    ];

    try {
        // 3. Get database connection
        $pdo = getDBConnection();
        
        // 4. Get and validate input
        //$data = json_decode(file_get_contents('php://input'), true);

        // 5. Validate required fields
        // if (empty($data['wineId'])) {
        //     throw new Exception('Missing wine ID.');
        // }
        
        // 6. Sanitize/prepare data
        // $wineID = trim($data['wineId']);
        // $bottleType = trim($data['bottleType']);
        // $storageLocation = trim($data['storageLocation']);
        // $bottleSource = trim($data['bottleSource']);
        // $userID = $_SESSION['userID'] ?? null;

        // 7. Start transaction
        $pdo->beginTransaction();

        try {
            // 8. Perform database operation
            // Your code here...

             // 9. Get new ID
            $bottleID = $pdo->lastInsertId();

            // 10. Log the change
            logInsert($pdo, 'bottles', $bottleID, [
                'wineID' => $wineID,
                'bottleSize' => $bottleType,
                'location' => $storageLocation,
                'source' => $bottleSource,
                'dateAdded' => date('Y-m-d')
            ], $userID);// 11. Commit transaction
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
        // 14. Handle all errors
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        error_log("Error in add_bottle.php: " . $e->getMessage());
    }

    // 15. Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
?>