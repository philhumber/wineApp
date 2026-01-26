<?php
/**
 * Wine Text Identification Endpoint
 *
 * POST /resources/php/agent/identifyText.php
 *
 * Request:
 *   {"text": "2019 Château Margaux"}
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Wine identified successfully",
 *     "data": {
 *       "intent": "add",
 *       "parsed": {...},
 *       "confidence": 95,
 *       "action": "auto_populate",
 *       "candidates": []
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

// Validate required field and type
if (empty($input['text']) || !is_string($input['text'])) {
    agentError('Missing or invalid field: text (string required)');
}

try {
    // Get user ID (default to 1 for now)
    $userId = $input['userId'] ?? 1;

    // Run identification
    $service = getAgentIdentificationService($userId);
    $result = $service->identify($input);

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        $httpCode = $errorType === 'limit_exceeded' ? 429 : 400;
        agentError($result['error'] ?? 'Identification failed', $httpCode);
    }

    // Success response
    agentResponse(true, 'Wine identified successfully', [
        'intent' => $result['intent'],
        'parsed' => $result['parsed'],
        'confidence' => $result['confidence'],
        'action' => $result['action'],
        'candidates' => $result['candidates'],
        'usage' => $result['usage'] ?? null,
    ]);

} catch (\Exception $e) {
    // Log error
    error_log('Agent identification error: ' . $e->getMessage());
    agentError('Internal server error', 500);
}
