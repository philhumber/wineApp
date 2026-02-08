<?php
/**
 * deleteItem.php - WIN-80 Soft Delete Endpoint
 *
 * Soft-deletes an entity and cascades DOWN to children.
 * Cascade direction: Region → Producer → Wine → Bottle
 *
 * Parents are NEVER affected by child deletions.
 */

// 1. Include dependencies
require_once 'databaseConnection.php';
require_once 'audit_log.php';

// Start session for userID
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

    $type = $inputData['type'] ?? null;
    $id = $inputData['id'] ?? null;
    $userId = $inputData['userId'] ?? $_SESSION['userID'] ?? 1;

    // Validate required fields
    if (empty($type)) {
        throw new Exception('Entity type is required');
    }
    if (empty($id) || !is_numeric($id)) {
        throw new Exception('Valid entity ID is required');
    }

    // Validate entity type
    $validTypes = ['wine', 'bottle', 'producer', 'region'];
    if (!in_array($type, $validTypes)) {
        throw new Exception('Invalid entity type. Must be: ' . implode(', ', $validTypes));
    }

    // Get current timestamp for all cascade items
    $now = date('Y-m-d H:i:s');

    // 5. Start transaction
    $pdo->beginTransaction();

    try {
        $cascadeCounts = [
            'regions' => 0,
            'producers' => 0,
            'wines' => 0,
            'bottles' => 0,
            'ratings' => 0
        ];
        $entityName = '';

        switch ($type) {
            case 'region':
                // Get region name
                $stmt = $pdo->prepare("SELECT regionName FROM region WHERE regionID = :id AND deleted = 0");
                $stmt->execute([':id' => $id]);
                $region = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$region) {
                    throw new Exception('Region not found or already deleted');
                }
                $entityName = $region['regionName'];

                // CASCADE: bottles of wines by producers in region
                $stmt = $pdo->prepare("
                    UPDATE bottles b
                    JOIN wine w ON b.wineID = w.wineID
                    JOIN producers p ON w.producerID = p.producerID
                    SET b.deleted = 1, b.deletedAt = :now, b.deletedBy = :userId
                    WHERE p.regionID = :regionId AND b.deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':regionId' => $id]);
                $cascadeCounts['bottles'] = $stmt->rowCount();

                // Count affected ratings (drunk bottles being deleted)
                $stmt = $pdo->prepare("
                    SELECT COUNT(DISTINCT r.ratingID) as cnt
                    FROM ratings r
                    JOIN bottles b ON r.bottleID = b.bottleID
                    JOIN wine w ON b.wineID = w.wineID
                    JOIN producers p ON w.producerID = p.producerID
                    WHERE p.regionID = :regionId AND b.deletedAt = :now
                ");
                $stmt->execute([':regionId' => $id, ':now' => $now]);
                $cascadeCounts['ratings'] = (int)$stmt->fetchColumn();

                // CASCADE: wines by producers in region
                $stmt = $pdo->prepare("
                    UPDATE wine w
                    JOIN producers p ON w.producerID = p.producerID
                    SET w.deleted = 1, w.deletedAt = :now, w.deletedBy = :userId
                    WHERE p.regionID = :regionId AND w.deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':regionId' => $id]);
                $cascadeCounts['wines'] = $stmt->rowCount();

                // CASCADE: producers in region
                $stmt = $pdo->prepare("
                    UPDATE producers
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE regionID = :regionId AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':regionId' => $id]);
                $cascadeCounts['producers'] = $stmt->rowCount();

                // Delete the region itself
                $stmt = $pdo->prepare("
                    UPDATE region
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE regionID = :id AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':id' => $id]);
                $cascadeCounts['regions'] = $stmt->rowCount();

                // Audit log
                logChange($pdo, 'region', $id, 'UPDATE', 'deleted', '0', '1', $userId);
                logChange($pdo, 'region', $id, 'UPDATE', 'deletedAt', null, $now, $userId);
                logChange($pdo, 'region', $id, 'UPDATE', 'deletedBy', null, $userId, $userId);
                break;

            case 'producer':
                // Get producer name
                $stmt = $pdo->prepare("SELECT producerName FROM producers WHERE producerID = :id AND deleted = 0");
                $stmt->execute([':id' => $id]);
                $producer = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$producer) {
                    throw new Exception('Producer not found or already deleted');
                }
                $entityName = $producer['producerName'];

                // CASCADE: bottles of wines by this producer
                $stmt = $pdo->prepare("
                    UPDATE bottles b
                    JOIN wine w ON b.wineID = w.wineID
                    SET b.deleted = 1, b.deletedAt = :now, b.deletedBy = :userId
                    WHERE w.producerID = :producerId AND b.deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':producerId' => $id]);
                $cascadeCounts['bottles'] = $stmt->rowCount();

                // Count affected ratings
                $stmt = $pdo->prepare("
                    SELECT COUNT(DISTINCT r.ratingID) as cnt
                    FROM ratings r
                    JOIN bottles b ON r.bottleID = b.bottleID
                    JOIN wine w ON b.wineID = w.wineID
                    WHERE w.producerID = :producerId AND b.deletedAt = :now
                ");
                $stmt->execute([':producerId' => $id, ':now' => $now]);
                $cascadeCounts['ratings'] = (int)$stmt->fetchColumn();

                // CASCADE: wines by this producer
                $stmt = $pdo->prepare("
                    UPDATE wine
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE producerID = :producerId AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':producerId' => $id]);
                $cascadeCounts['wines'] = $stmt->rowCount();

                // Delete the producer itself
                $stmt = $pdo->prepare("
                    UPDATE producers
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE producerID = :id AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':id' => $id]);
                $cascadeCounts['producers'] = $stmt->rowCount();

                // Audit log
                logChange($pdo, 'producers', $id, 'UPDATE', 'deleted', '0', '1', $userId);
                logChange($pdo, 'producers', $id, 'UPDATE', 'deletedAt', null, $now, $userId);
                logChange($pdo, 'producers', $id, 'UPDATE', 'deletedBy', null, $userId, $userId);
                break;

            case 'wine':
                // Get wine name with producer
                $stmt = $pdo->prepare("
                    SELECT w.wineName, w.year, p.producerName
                    FROM wine w
                    JOIN producers p ON w.producerID = p.producerID
                    WHERE w.wineID = :id AND w.deleted = 0
                ");
                $stmt->execute([':id' => $id]);
                $wine = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$wine) {
                    throw new Exception('Wine not found or already deleted');
                }
                $entityName = $wine['producerName'] . ' ' . $wine['wineName'];
                if ($wine['year']) {
                    $entityName .= ' ' . $wine['year'];
                }

                // CASCADE: bottles of this wine
                $stmt = $pdo->prepare("
                    UPDATE bottles
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE wineID = :wineId AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':wineId' => $id]);
                $cascadeCounts['bottles'] = $stmt->rowCount();

                // Count affected ratings
                $stmt = $pdo->prepare("
                    SELECT COUNT(DISTINCT r.ratingID) as cnt
                    FROM ratings r
                    JOIN bottles b ON r.bottleID = b.bottleID
                    WHERE b.wineID = :wineId AND b.deletedAt = :now
                ");
                $stmt->execute([':wineId' => $id, ':now' => $now]);
                $cascadeCounts['ratings'] = (int)$stmt->fetchColumn();

                // Delete the wine itself
                $stmt = $pdo->prepare("
                    UPDATE wine
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE wineID = :id AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':id' => $id]);
                $cascadeCounts['wines'] = $stmt->rowCount();

                // Audit log
                logChange($pdo, 'wine', $id, 'UPDATE', 'deleted', '0', '1', $userId);
                logChange($pdo, 'wine', $id, 'UPDATE', 'deletedAt', null, $now, $userId);
                logChange($pdo, 'wine', $id, 'UPDATE', 'deletedBy', null, $userId, $userId);
                break;

            case 'bottle':
                // Get bottle info
                $stmt = $pdo->prepare("
                    SELECT b.bottleSize, b.bottleID, w.wineName, p.producerName
                    FROM bottles b
                    JOIN wine w ON b.wineID = w.wineID
                    JOIN producers p ON w.producerID = p.producerID
                    WHERE b.bottleID = :id AND b.deleted = 0
                ");
                $stmt->execute([':id' => $id]);
                $bottle = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$bottle) {
                    throw new Exception('Bottle not found or already deleted');
                }
                $entityName = $bottle['bottleSize'] . ' - ' . $bottle['producerName'] . ' ' . $bottle['wineName'];

                // Count affected ratings (if this bottle has been drunk)
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) as cnt FROM ratings WHERE bottleID = :bottleId
                ");
                $stmt->execute([':bottleId' => $id]);
                $cascadeCounts['ratings'] = (int)$stmt->fetchColumn();

                // Delete just the bottle (no cascade - bottle is leaf node)
                $stmt = $pdo->prepare("
                    UPDATE bottles
                    SET deleted = 1, deletedAt = :now, deletedBy = :userId
                    WHERE bottleID = :id AND deleted = 0
                ");
                $stmt->execute([':now' => $now, ':userId' => $userId, ':id' => $id]);
                $cascadeCounts['bottles'] = $stmt->rowCount();

                // Audit log
                logChange($pdo, 'bottles', $id, 'UPDATE', 'deleted', '0', '1', $userId);
                logChange($pdo, 'bottles', $id, 'UPDATE', 'deletedAt', null, $now, $userId);
                logChange($pdo, 'bottles', $id, 'UPDATE', 'deletedBy', null, $userId, $userId);
                break;
        }

        // Commit transaction
        $pdo->commit();

        // Build response
        $response['success'] = true;
        $response['message'] = ucfirst($type) . ' deleted successfully';
        $response['data'] = [
            'deleted' => [
                'type' => $type,
                'id' => (int)$id,
                'name' => $entityName,
                'cascaded' => array_filter($cascadeCounts, fn($v) => $v > 0)
            ]
        ];

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    error_log("Error in deleteItem.php: " . $e->getMessage());
}

// Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
