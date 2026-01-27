<?php
/**
 * Wine Image Identification Endpoint
 *
 * POST /resources/php/agent/identifyImage.php
 *
 * Request:
 *   {
 *     "image": "base64-encoded-image-data",
 *     "mimeType": "image/jpeg"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Wine identified from image",
 *     "data": {
 *       "intent": "add",
 *       "parsed": {...},
 *       "confidence": 85,
 *       "action": "auto_populate",
 *       "candidates": [],
 *       "quality": {...}
 *     }
 *   }
 *
 * @package Agent
 */

require_once __DIR__ . '/_bootstrap.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    agentError('Method not allowed', 405);
}

// Parse JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    agentError('Invalid JSON body');
}

// Validate required fields
if (empty($input['image']) || !is_string($input['image'])) {
    agentError('Missing or invalid field: image (base64 string required)');
}

if (empty($input['mimeType']) || !is_string($input['mimeType'])) {
    agentError('Missing or invalid field: mimeType (string required)');
}

try {
    // Get user ID (default to 1 for now)
    $userId = $input['userId'] ?? 1;

    // Run identification
    $service = getAgentIdentificationService($userId);
    $result = $service->identify([
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
    ]);

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        $httpCode = match ($errorType) {
            'limit_exceeded' => 429,
            'quality_check_failed' => 422,
            default => 400,
        };
        agentError($result['error'] ?? 'Image identification failed', $httpCode);
    }

    // Success response
    agentResponse(true, 'Wine identified from image', [
        'inputType' => 'image',
        'intent' => $result['intent'],
        'parsed' => $result['parsed'],
        'confidence' => $result['confidence'],
        'action' => $result['action'],
        'candidates' => $result['candidates'],
        'usage' => $result['usage'] ?? null,
        'quality' => $result['quality'] ?? null,
    ]);

} catch (\Exception $e) {
    // Log error
    error_log('Agent image identification error: ' . $e->getMessage());
    agentError('Internal server error', 500);
}
