<?php
  // 1. Include dependencies at the top
  require_once 'securityHeaders.php';
  require_once 'databaseConnection.php';
  require_once 'audit_log.php';
  require_once 'validators.php';
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
      $inputData = json_decode(file_get_contents('php://input'), true);


      // Get all input data with validation
      $wineID = $inputData['wineID'] ?? null;
      $bottleID = $inputData['bottleID'] ?? null;
      $drinkDate = $inputData['drinkDate'] ?? '';  // FIX: Actually get drinkDate from input!
      $buyAgain = $inputData['buyAgain'] ?? 0;
      $notes = validateStringField($inputData['notes'] ?? null, 'Notes', false, 2000);

      // Required ratings (1-10)
      $overallRating = validateRating($inputData['overallRating'] ?? null, 'Overall rating', true, 1, 10);
      $valueRating = validateRating($inputData['valueRating'] ?? null, 'Value rating', true, 1, 10);

      // Optional sub-ratings (1-5, NULL = not rated)
      $complexityRating = validateRating($inputData['complexityRating'] ?? null, 'Complexity rating', false, 1, 5);
      $drinkabilityRating = validateRating($inputData['drinkabilityRating'] ?? null, 'Drinkability rating', false, 1, 5);
      $surpriseRating = validateRating($inputData['surpriseRating'] ?? null, 'Surprise rating', false, 1, 5);
      $foodPairingRating = validateRating($inputData['foodPairingRating'] ?? null, 'Food pairing rating', false, 1, 5);

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
                          `Notes`,
                          `complexityRating`,
                          `drinkabilityRating`,
                          `surpriseRating`,
                          `foodPairingRating`)
                      VALUES (
                          :wineID,
                          :bottleID,
                          :overallRating,
                          :valueRating,
                          :drinkDate,
                          :buyAgain,
                          :notes,
                          :complexityRating,
                          :drinkabilityRating,
                          :surpriseRating,
                          :foodPairingRating)";

      // Build parameters array
      $params = [
          ':wineID' => $wineID,
          ':bottleID' => $bottleID,
          ':overallRating' => $overallRating,
          ':valueRating' => $valueRating,
          ':drinkDate' => $drinkDate,
          ':buyAgain' => $buyAgain,
          ':notes' => $notes,
          ':complexityRating' => $complexityRating,
          ':drinkabilityRating' => $drinkabilityRating,
          ':surpriseRating' => $surpriseRating,
          ':foodPairingRating' => $foodPairingRating
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
            'wineID' => $wineID,
            'bottleID' => $bottleID,
            'overallRating' => $overallRating,
            'valueRating' => $valueRating,
            'drinkDate' => $drinkDate,
            'buyAgain' => $buyAgain,
            'Notes' => $notes,
            'complexityRating' => $complexityRating,
            'drinkabilityRating' => $drinkabilityRating,
            'surpriseRating' => $surpriseRating,
            'foodPairingRating' => $foodPairingRating
          ], $userID);


          // 8. Get OLD data before update (for audit log) - exclude soft-deleted
          $stmt = $pdo->prepare("SELECT bottleDrunk FROM bottles WHERE bottleID = :bottleID AND deleted = 0");
          $stmt->execute([':bottleID' => $bottleID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);
          if (!$oldData) {
              throw new Exception('Bottle not found or has been deleted');
          }

          $newData = [
              'bottleDrunk' => 1
          ];

          logUpdate($pdo, 'bottles', $bottleID, $oldData, $newData, $userID);


          $stmt = $pdo->prepare("UPDATE bottles SET bottleDrunk = 1 WHERE bottleID = :bottleID");
          $stmt->execute([':bottleID' => $bottleID]);

            // 8. Get OLD data before update (for audit log) - exclude soft-deleted
          $stmt = $pdo->prepare("SELECT bottlesDrunk FROM wine WHERE wineID = :wineID AND deleted = 0");
          $stmt->execute([':wineID' => $wineID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);
          if (!$oldData) {
              throw new Exception('Wine not found or has been deleted');
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
      // 14. Handle all errors (WIN-217: sanitize error messages)
      $response['success'] = false;
      $response['message'] = safeErrorMessage($e, 'drinkBottle');
  }

  // 15. Return JSON response
  header('Content-Type: application/json');
  echo json_encode($response);
?>
