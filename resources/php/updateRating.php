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
      $ratingID = $inputData['ratingID'] ?? null;
      $wineID = $inputData['wineID'] ?? null;
      $bottleID = $inputData['bottleID'] ?? null;
      $overallRating = $inputData['overallRating'] ?? null;
      $valueRating = $inputData['valueRating'] ?? null;
      $drinkDate = $inputData['drinkDate'] ?? '';
      $buyAgain = $inputData['buyAgain'] ?? 0;
      $notes = $inputData['notes'] ?? '';

      // Optional ratings (0-5 scale, nullable)
      $complexityRating = isset($inputData['complexityRating']) && $inputData['complexityRating'] > 0
          ? (int)$inputData['complexityRating'] : null;
      $drinkabilityRating = isset($inputData['drinkabilityRating']) && $inputData['drinkabilityRating'] > 0
          ? (int)$inputData['drinkabilityRating'] : null;
      $surpriseRating = isset($inputData['surpriseRating']) && $inputData['surpriseRating'] > 0
          ? (int)$inputData['surpriseRating'] : null;
      $foodPairingRating = isset($inputData['foodPairingRating']) && $inputData['foodPairingRating'] > 0
          ? (int)$inputData['foodPairingRating'] : null;

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
      if (!isset($overallRating) || $overallRating < 1 || $overallRating > 10) {
          throw new Exception('Invalid overall rating (must be 1-10)');
      }
      if (!isset($valueRating) || $valueRating < 1 || $valueRating > 10) {
          throw new Exception('Invalid value rating (must be 1-10)');
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
          $stmt = $pdo->prepare("SELECT * FROM ratings WHERE ratingID = :ratingID");
          $stmt->execute([':ratingID' => $ratingID]);
          $oldData = $stmt->fetch(PDO::FETCH_ASSOC);

          if (!$oldData) {
              throw new Exception('Rating not found');
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
      // 13. Handle all errors
      $response['success'] = false;
      $response['message'] = $e->getMessage();
      error_log("Error in updateRating.php: " . $e->getMessage());
  }

  // 14. Return JSON response
  header('Content-Type: application/json');
  echo json_encode($response);
?>
