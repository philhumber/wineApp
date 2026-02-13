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

// Validate and sanitize locked fields
$validatedLockedFields = validateLockedFields($input);

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
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();

    // Build identification input
    $identifyInput = [
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
        'lockedFields' => $validatedLockedFields,
    ];
    if ($supplementaryText !== null) {
        $identifyInput['supplementaryText'] = $supplementaryText;
    }

    // Run identification
    $service = getAgentIdentificationService($userId);
    $llmClient = getAgentLLMClient($userId);
    $result = $service->identify($identifyInput);

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        agentStructuredError($errorType, $result['error'] ?? null);
    }

    // Log identification result for analytics (WIN-181)
    try {
        $llmClient->logIdentificationResult($result);
    } catch (\Exception $logEx) {
        error_log('Failed to log identification result: ' . $logEx->getMessage());
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
        'escalation' => $result['escalation'] ?? null,
        'inferences_applied' => $result['inferences_applied'] ?? [],
    ]);

} catch (\Exception $e) {
    agentExceptionError($e, 'identifyImage');
}
