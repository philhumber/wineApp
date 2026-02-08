<?php
/**
 * Normalization endpoint for country/wineType validation
 * Used by agent add wine flow to validate user input
 */
require_once __DIR__ . '/securityHeaders.php';
require_once __DIR__ . '/agent/Identification/InferenceEngine.php';
require_once __DIR__ . '/databaseConnection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);

if (!isset($body['field']) || !isset($body['value'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing field or value']);
    exit;
}

$allowedFields = ['country', 'wineType'];
if (!in_array($body['field'], $allowedFields)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid field. Must be: ' . implode(', ', $allowedFields)]);
    exit;
}

try {
    $pdo = getDBConnection();
    $engine = new InferenceEngine($pdo);
    $normalized = $engine->normalize($body['field'], $body['value']);

    echo json_encode([
        'success' => true,
        'data' => [
            'original' => $body['value'],
            'normalized' => $normalized,
            'matched' => $normalized !== null
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Normalization failed']);
}
