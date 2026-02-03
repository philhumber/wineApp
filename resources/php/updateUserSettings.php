<?php
/**
 * Update User Settings
 * Updates user settings in the database
 * WIN-126: Collection Name feature
 */

// 1. Include dependencies
require_once 'databaseConnection.php';

// 2. Initialize response
$response = ['success' => false, 'message' => '', 'data' => null];

try {
    // 3. Get database connection
    $pdo = getDBConnection();

    // 4. Get POST data
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !is_array($input)) {
        throw new Exception('Invalid request body');
    }

    // 5. Prepare upsert statement
    $upsertSql = "INSERT INTO user_settings (settingKey, settingValue)
                  VALUES (:key, :value)
                  ON DUPLICATE KEY UPDATE settingValue = :value2, updatedAt = CURRENT_TIMESTAMP";
    $stmt = $pdo->prepare($upsertSql);

    // 6. Update each provided setting
    $updatedSettings = [];

    // Handle collectionName
    if (isset($input['collectionName'])) {
        $collectionName = trim($input['collectionName']);
        // Default to 'Our Wines' if empty
        if (empty($collectionName)) {
            $collectionName = 'Our Wines';
        }
        // Limit length to 50 characters
        $collectionName = substr($collectionName, 0, 50);

        $stmt->execute([
            ':key' => 'collectionName',
            ':value' => $collectionName,
            ':value2' => $collectionName
        ]);
        $updatedSettings['collectionName'] = $collectionName;
    }

    // 7. If no settings were updated, return error
    if (empty($updatedSettings)) {
        throw new Exception('No valid settings provided');
    }

    // 8. Set success response
    $response['success'] = true;
    $response['message'] = 'Settings updated successfully';
    $response['data'] = $updatedSettings;

} catch (Exception $e) {
    // 9. Handle errors
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    error_log("Error in updateUserSettings.php: " . $e->getMessage());
}

// 10. Return JSON response
header('Content-Type: application/json');
echo json_encode($response);
?>
