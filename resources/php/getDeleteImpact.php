<?php
/**
 * getDeleteImpact.php - WIN-80 Delete Impact Preview
 *
 * Returns a preview of what will be affected by deleting an entity.
 * Used by the DeleteConfirmModal to show cascade impact before confirmation.
 */

// 1. Include dependencies
require_once 'databaseConnection.php';

// 2. Initialize response
$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Get and validate input (supports both GET and POST)
    $type = $_GET['type'] ?? $_POST['type'] ?? null;
    $id = $_GET['id'] ?? $_POST['id'] ?? null;

    // Also check JSON body for POST requests
    if (empty($type) || empty($id)) {
        $inputData = json_decode(file_get_contents('php://input'), true);
        $type = $type ?? $inputData['type'] ?? null;
        $id = $id ?? $inputData['id'] ?? null;
    }

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

    $entity = null;
    $impact = [];

    switch ($type) {
        case 'region':
            // Get region info
            $stmt = $pdo->prepare("SELECT regionID, regionName FROM region WHERE regionID = :id AND deleted = 0");
            $stmt->execute([':id' => $id]);
            $region = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$region) {
                throw new Exception('Region not found or already deleted');
            }
            $entity = [
                'type' => 'region',
                'id' => (int)$region['regionID'],
                'name' => $region['regionName']
            ];

            // Count producers
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt, GROUP_CONCAT(producerName ORDER BY producerName SEPARATOR '||') as names
                FROM producers WHERE regionID = :id AND deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $producerNames = $row['names'] ? explode('||', $row['names']) : [];
            $impact['producers'] = [
                'count' => (int)$row['cnt'],
                'names' => array_slice($producerNames, 0, 5) // Limit to 5 for display
            ];

            // Count wines
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt
                FROM wine w
                JOIN producers p ON w.producerID = p.producerID
                WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['wines'] = ['count' => (int)$stmt->fetchColumn()];

            // Count bottles
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt
                FROM bottles b
                JOIN wine w ON b.wineID = w.wineID
                JOIN producers p ON w.producerID = p.producerID
                WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0 AND b.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['bottles'] = ['count' => (int)$stmt->fetchColumn()];

            // Count ratings
            $stmt = $pdo->prepare("
                SELECT COUNT(DISTINCT r.ratingID) as cnt
                FROM ratings r
                JOIN bottles b ON r.bottleID = b.bottleID
                JOIN wine w ON b.wineID = w.wineID
                JOIN producers p ON w.producerID = p.producerID
                WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0 AND b.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['ratings'] = ['count' => (int)$stmt->fetchColumn()];
            break;

        case 'producer':
            // Get producer info
            $stmt = $pdo->prepare("SELECT producerID, producerName FROM producers WHERE producerID = :id AND deleted = 0");
            $stmt->execute([':id' => $id]);
            $producer = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$producer) {
                throw new Exception('Producer not found or already deleted');
            }
            $entity = [
                'type' => 'producer',
                'id' => (int)$producer['producerID'],
                'name' => $producer['producerName']
            ];

            // Count wines
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt,
                       GROUP_CONCAT(CONCAT(wineName, COALESCE(CONCAT(' ', year), '')) ORDER BY year DESC SEPARATOR '||') as names
                FROM wine WHERE producerID = :id AND deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $wineNames = $row['names'] ? explode('||', $row['names']) : [];
            $impact['wines'] = [
                'count' => (int)$row['cnt'],
                'names' => array_slice($wineNames, 0, 5)
            ];

            // Count bottles
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt
                FROM bottles b
                JOIN wine w ON b.wineID = w.wineID
                WHERE w.producerID = :id AND w.deleted = 0 AND b.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['bottles'] = ['count' => (int)$stmt->fetchColumn()];

            // Count ratings
            $stmt = $pdo->prepare("
                SELECT COUNT(DISTINCT r.ratingID) as cnt
                FROM ratings r
                JOIN bottles b ON r.bottleID = b.bottleID
                JOIN wine w ON b.wineID = w.wineID
                WHERE w.producerID = :id AND w.deleted = 0 AND b.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['ratings'] = ['count' => (int)$stmt->fetchColumn()];
            break;

        case 'wine':
            // Get wine info with producer
            $stmt = $pdo->prepare("
                SELECT w.wineID, w.wineName, w.year, p.producerName
                FROM wine w
                JOIN producers p ON w.producerID = p.producerID
                WHERE w.wineID = :id AND w.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $wine = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$wine) {
                throw new Exception('Wine not found or already deleted');
            }
            $displayName = $wine['producerName'] . ' ' . $wine['wineName'];
            if ($wine['year']) {
                $displayName .= ' ' . $wine['year'];
            }
            $entity = [
                'type' => 'wine',
                'id' => (int)$wine['wineID'],
                'name' => $displayName
            ];

            // Count and list bottles
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as cnt,
                       GROUP_CONCAT(
                           CONCAT(bottleSize, COALESCE(CONCAT(' - ', DATE_FORMAT(purchaseDate, '%Y')), ''))
                           ORDER BY purchaseDate DESC SEPARATOR '||'
                       ) as names
                FROM bottles WHERE wineID = :id AND deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $bottleNames = $row['names'] ? explode('||', $row['names']) : [];
            $impact['bottles'] = [
                'count' => (int)$row['cnt'],
                'names' => array_slice($bottleNames, 0, 5)
            ];

            // Count ratings
            $stmt = $pdo->prepare("
                SELECT COUNT(DISTINCT r.ratingID) as cnt
                FROM ratings r
                JOIN bottles b ON r.bottleID = b.bottleID
                WHERE b.wineID = :id AND b.deleted = 0
            ");
            $stmt->execute([':id' => $id]);
            $impact['ratings'] = ['count' => (int)$stmt->fetchColumn()];
            break;

        case 'bottle':
            // Get bottle info
            $stmt = $pdo->prepare("
                SELECT b.bottleID, b.bottleSize, b.purchaseDate, w.wineName, p.producerName
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
            $displayName = $bottle['bottleSize'] . ' - ' . $bottle['producerName'] . ' ' . $bottle['wineName'];
            $entity = [
                'type' => 'bottle',
                'id' => (int)$bottle['bottleID'],
                'name' => $displayName
            ];

            // Bottles doesn't cascade, so just check if it has a rating
            $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM ratings WHERE bottleID = :id");
            $stmt->execute([':id' => $id]);
            $ratingCount = (int)$stmt->fetchColumn();

            $impact['bottles'] = ['count' => 1, 'names' => [$displayName]];
            $impact['ratings'] = ['count' => $ratingCount];
            break;
    }

    // Build response
    $response['success'] = true;
    $response['data'] = [
        'entity' => $entity,
        'impact' => $impact
    ];

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    error_log("Error in getDeleteImpact.php: " . $e->getMessage());
}

// Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
