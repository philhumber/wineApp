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

        // 6. Validate and sanitize all fields
        $wineID = (int)trim($data['wineID']);
        if ($wineID <= 0) {
            throw new Exception('Invalid wine ID');
        }
        $wineName = trim($data['wineName'] ?? '');
        if (empty($wineName)) {
            throw new Exception('Wine name is required');
        }
        $wineType = trim($data['wineType'] ?? '');
        if (empty($wineType)) {
            throw new Exception('Wine type is required');
        }

        $year = isset($data['wineYear']) ? trim($data['wineYear']) : null;

        if ($year === '' || $year === null) {
            $year =null; // allow null year
        } else {
            $year = (int)$year;
            if ($year <= 0) {
                throw new Exception('Invalid wine year');
            }
        }

        $description = trim($data['wineDescription'] ?? '');
        if (empty($description)) {
            throw new Exception('Wine description is required');
        }
        $tastingNotes = trim($data['wineTasting'] ?? '');
        if (empty($tastingNotes)) {
            throw new Exception('Tasting Notes is required');
        }
        $pairing = trim($data['winePairing'] ?? '');
        if (empty($pairing)) {
            throw new Exception('Pairing notes is required');
        }
        $pictureURL = trim($data['winePicture'] ?? '');
        if (empty($pictureURL)) {
            throw new Exception('Picture URL is required');
        }


        $userID = $_SESSION['userID'] ?? null;

        //6. Prepare Statement
        $sqlQuery = "UPDATE wine SET
                        wineName = :wineName,
                        wineTypeID = :wineTypeID,
                        year = :year,
                        description = :description,
                        tastingNotes = :tastingNotes,
                        pairing = :pairing,
                        pictureURL = :pictureURL
                    WHERE wineID = :wineID";

        $params[':wineName'] = $wineName;        
        $params[':year'] = $year;
        $params[':description'] = $description;
        $params[':tastingNotes'] = $tastingNotes;
        $params[':pairing'] = $pairing;
        $params[':pictureURL'] = $pictureURL;
        $params[':wineID'] = $wineID;
        // 7. Start transaction
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("SELECT wineTypeID FROM winetype WHERE wineType = ?");
            $stmt->execute([$wineType]);
            $wineTypeID = $stmt->fetch(PDO::FETCH_ASSOC);            
            if (!$wineTypeID) {
                throw new Exception("Wine type '{$wineType}' not found");
            }            
            $params[':wineTypeID'] = $wineTypeID['wineTypeID'];
            
            // 8. Get OLD data before update (for audit log)
            $stmt = $pdo->prepare("SELECT * FROM wine WHERE wineID = ?");
            $stmt->execute([$wineID]);
            $oldData = $stmt->fetch(PDO::FETCH_ASSOC);            
            if (!$oldData) {
                throw new Exception('Wine not found');
            }
            error_log('SQL: ' . $sql);
            error_log('Params: ' . print_r($params, true));
            
            // 8. Perform database operation
            $stmt = $pdo->prepare($sqlQuery);
            $stmt->execute($params);

             // 9. Get new ID
            //$bottleID = $pdo->lastInsertId(); //No Need as the ID is already there

            // 10. Log the change
            $newData = [
                'wineName' => $wineName,
                'wineTypeID' => $wineTypeID['wineTypeID'],
                'year' => $year,
                'description' => $description,
                'tastingNotes' => $tastingNotes,
                'pairing' => $pairing,
                'pictureURL' => $pictureURL
            ];

            logUpdate($pdo, 'wine', $wineID, $oldData, $newData, $userID);
            
            // 11. Commit transaction
            $pdo->commit();
            
            // 12. Set success response
            $response['success'] = true;
            $response['message'] = 'Wine updated successfully!';
            $response['data'] = ['wineID' => $wineID];
        
        } catch (Exception $e) {
            // 13. Rollback on error
            $pdo->rollBack();
            throw $e;
        }

    } catch (Exception $e) {
        // 14. Handle all errors
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        error_log("Error in updateWine.php: " . $e->getMessage());
    }

    // 15. Return JSON response
    header('Content-Type: application/json');
    echo json_encode($response);
?>