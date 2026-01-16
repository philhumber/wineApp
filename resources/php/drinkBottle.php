<?php
  // 1. Include dependencies at the top
  require_once 'databaseConnection.php';
  require_once 'audit_log.php';
  
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
      $inputData = json_decode(file_get_contents('php://input'), true);


      // Get all input data with validation
      $wineID = $inputData['wineID'] ?? null;
      $bottleID = $inputData['bottleID'] ?? null;
      $overallRating = $inputData['overallRating'] ?? null;
      $valueRating = $inputData['valueRating'] ?? null;
      $drinkDate = $inputData['drinkDate'] ?? '';  // FIX: Actually get drinkDate from input!
      $buyAgain = $inputData['buyAgain'] ?? 0;
      $notes = $inputData['notes'] ?? '';

      // Validate required fields
      if (empty($wineID)) {
          throw new Exception('Invalid wine ID');
      }
      if (empty($bottleID)) {
          throw new Exception('Invalid bottle ID');
      }

      // Process date
      if (!empty($drinkDate)) {
          $date = DateTime::createFromFormat('d/m/Y', $drinkDate);
          if ($date) {
              $drinkDate = $date->format('Y-m-d');
          } else {
              $drinkDate = date('Y-m-d');
          }
      } else {
          $drinkDate = date('Y-m-d');
      }

        $userID = $_SESSION['userID'] ?? null;

      //6. Prepare Statement
      $sqlQuery = "INSERT INTO `ratings`(
                          `wineID`,
                          `bottleID`,
                          `overallRating`,
                          `valueRating`,
                          `drinkDate`,
                          `buyAgain`,
                          `Notes`)
                      VALUES (
                          :wineID,
                          :bottleID,
                          :overallRating,
                          :valueRating,
                          :drinkDate,
                          :buyAgain,
                          :notes)";

      // Build parameters array
      $params = [
          ':wineID' => $wineID,
          ':bottleID' => $bottleID,
          ':overallRating' => $overallRating,
          ':valueRating' => $valueRating,
          ':drinkDate' => $drinkDate,
          ':buyAgain' => $buyAgain,
          ':notes' => $notes
      ];

      // 7. Start transaction
      $pdo->beginTransaction();

      try {
          // 8. Perform database operation
          $stmt = $pdo->prepare($sqlQuery);
          $stmt->execute($params);

          // Get the new bottle ID
          $ratingID = $pdo->lastInsertId();
          
          // Log the insert
          logInsert($pdo, 'ratings', $ratingID, [                
            ':wineID' => $wineID,
            ':bottleID' => $bottleID,
            ':overallRating' => $overallRating,
            ':valueRating' => $valueRating,
            ':drinkDate' => $drinkDate,
            ':buyAgain' => $buyAgain,
            ':notes' => $notes
          ], $userID);


          // 8. Get OLD data before update (for audit log)
          $stmt = $pdo->prepare("SELECT bottleDrunk FROM bottles WHERE bottleID = :bottleID");
          $stmt->execute([':bottleID' => $bottleID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);            
          if (!$oldData) {
              throw new Exception('Bottle not found');
          }

          $newData = [
              'bottleDrunk' => 1
          ];

          logUpdate($pdo, 'bottles', $wineID, $oldData, $newData, $userID);


          $stmt = $pdo->prepare("UPDATE bottles SET bottleDrunk = 1 WHERE bottleID = :bottleID");
          $stmt->execute([':bottleID' => $bottleID]);

            // 8. Get OLD data before update (for audit log)
          $stmt = $pdo->prepare("SELECT bottlesDrunk FROM wine WHERE wineID = :wineID");
          $stmt->execute([':wineID' => $wineID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);            
          if (!$oldData) {
              throw new Exception('Wine not found');
          }

          $newData = [
              'bottlesDrunk' => $oldData['bottlesDrunk'] + 1
          ];

          logUpdate($pdo, 'wine', $wineID, $oldData, $newData, $userID);

          $stmt = $pdo->prepare("UPDATE wine SET bottlesDrunk = COALESCE(bottlesDrunk, 0) + 1 WHERE wineID = :wineID");
          $stmt->execute([':wineID' => $wineID]);

          // 11. Commit transaction
          $pdo->commit();
          
          // 12. Set success response
          $response['success'] = true;
          $response['message'] = 'Wine drunk successfully!';
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
      error_log("Error in drinkBottle.php: " . $e->getMessage());
  }

  // 15. Return JSON response
  header('Content-Type: application/json');
  echo json_encode($response);
?>