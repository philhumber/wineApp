<?php
/**
 * Get User Settings
 * Fetches user settings from the database (collection name, etc.)
 * WIN-126: Collection Name feature
 */

// 1. Include dependencies
require_once 'securityHeaders.php';
require_once 'databaseConnection.php';

// 2. Initialize response
$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Fetch all settings as key-value pairs
    $sql = "SELECT settingKey, settingValue FROM user_settings";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Transform to object format
    $settings = [
        'collectionName' => 'Our Wines' // Default value
    ];

    foreach ($rows as $row) {
        $settings[$row['settingKey']] = $row['settingValue'];
    }

    // 6. Set success response
    $response['success'] = true;
    $response['message'] = 'Settings retrieved successfully';
    $response['data'] = $settings;

} catch (Exception $e) {
    // 7. Handle errors - return defaults on failure
    $response['success'] = true; // Still return success with defaults
    $response['message'] = 'Using default settings';
    $response['data'] = [
        'collectionName' => 'Our Wines'
    ];
    error_log("Error in getUserSettings.php: " . $e->getMessage());
}

// 8. Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
?>
