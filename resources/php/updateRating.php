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
      $ratingID = $inputData['ratingID'] ?? null;
      $wineID = $inputData['wineID'] ?? null;
      $bottleID = $inputData['bottleID'] ?? null;
      $drinkDate = $inputData['drinkDate'] ?? '';
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
      if (empty($ratingID)) {
          throw new Exception('Invalid rating ID');
      }
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

      // 5. Start transaction
      $pdo->beginTransaction();

      try {
          // 6. Get OLD data before update (for audit log)
          // Also verify the bottle hasn't been soft-deleted
          $stmt = $pdo->prepare("
              SELECT r.*
              FROM ratings r
              JOIN bottles b ON r.bottleID = b.bottleID
              WHERE r.ratingID = :ratingID AND b.deleted = 0
          ");
          $stmt->execute([':ratingID' => $ratingID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);

          if (!$oldData) {
              throw new Exception('Rating not found or bottle has been deleted');
          }

          // 7. Prepare UPDATE statement
          $sqlQuery = "UPDATE ratings SET
                          wineID = :wineID,
                          bottleID = :bottleID,
                          overallRating = :overallRating,
                          valueRating = :valueRating,
                          drinkDate = :drinkDate,
                          buyAgain = :buyAgain,
                          Notes = :notes,
                          complexityRating = :complexityRating,
                          drinkabilityRating = :drinkabilityRating,
                          surpriseRating = :surpriseRating,
                          foodPairingRating = :foodPairingRating
                       WHERE ratingID = :ratingID";

          $params = [
              ':ratingID' => $ratingID,
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

          // 8. Execute UPDATE
          $stmt = $pdo->prepare($sqlQuery);
          $stmt->execute($params);

          // 9. Log the update
          $newData = [
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
          ];

          logUpdate($pdo, 'ratings', $ratingID, $oldData, $newData, $userID);

          // 10. Commit transaction
          $pdo->commit();

          // 11. Set success response
          $response['success'] = true;
          $response['message'] = 'Rating updated successfully!';
          $response['data'] = ['ratingID' => $ratingID];

      } catch (Exception $e) {
          // 12. Rollback on error
          $pdo->rollBack();
          throw $e;
      }

  } catch (Exception $e) {
      // 13. Handle all errors (WIN-217: sanitize error messages)
      $response['success'] = false;
      $response['message'] = safeErrorMessage($e, 'updateRating');
  }

  // 14. Return JSON response
  header('Content-Type: application/json');
  echo json_encode($response);
?>
