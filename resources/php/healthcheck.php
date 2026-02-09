<?php
/**
 * WIN-243: Health check endpoint
 * Returns system status for monitoring. No authentication required.
 */

header('Content-Type: application/json');
header('Cache-Control: no-store');

$health = [
    'status' => 'ok',
    'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
    'checks' => []
];

// Check database connectivity
try {
    require_once 'databaseConnection.php';
    $pdo = getDBConnection();
    $stmt = $pdo->query('SELECT 1');
    $health['checks']['database'] = ['status' => 'ok'];
} catch (Exception $e) {
    $health['status'] = 'degraded';
    $health['checks']['database'] = [
        'status' => 'error',
        'message' => 'Database connection failed'
    ];
}

// Check PHP version
$health['checks']['php'] = [
    'status' => 'ok',
    'version' => PHP_VERSION
];

http_response_code($health['status'] === 'ok' ? 200 : 503);
echo json_encode($health, JSON_PRETTY_PRINT);
