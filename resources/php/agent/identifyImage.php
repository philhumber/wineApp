<?php
/**
 * Wine Image Identification Endpoint
 *
 * POST /resources/php/agent/identifyImage.php
 *
 * Request:
 *   {
 *     "image": "base64-encoded-image-data",
 *     "mimeType": "image/jpeg",
 *     "supplementaryText": "optional user context for re-identification"
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

// Validate optional supplementary text (for re-identification with user context)
$supplementaryText = null;
if (isset($input['supplementaryText'])) {
    if (!is_string($input['supplementaryText'])) {
        agentError('Invalid field: supplementaryText (string expected)');
    }
    $supplementaryText = trim($input['supplementaryText']);
    if ($supplementaryText === '') {
        $supplementaryText = null;
    }
}

try {
    // Get user ID (default to 1 for now)
    $userId = $input['userId'] ?? 1;

    // Build identification input
    $identifyInput = [
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
    ];
    if ($supplementaryText !== null) {
        $identifyInput['supplementaryText'] = $supplementaryText;
    }

    // Run identification
    $service = getAgentIdentificationService($userId);
    $result = $service->identify($identifyInput);

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        agentStructuredError($errorType, $result['error'] ?? null);
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
    agentExceptionError($e, 'identifyImage');
}
