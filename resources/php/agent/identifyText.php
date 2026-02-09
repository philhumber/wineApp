<?php
/**
 * Wine Text Identification Endpoint
 *
 * POST /resources/php/agent/identifyText.php
 *
 * Request:
 *   {"text": "2019 Chateau Margaux"}
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
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();

    // Run identification
    $service = getAgentIdentificationService($userId);
    $llmClient = getAgentLLMClient($userId);
    error_log('IdentifyText: Starting identification for: ' . substr($input['text'], 0, 50));
    $result = $service->identify($input);
    error_log('IdentifyText: Result success=' . ($result['success'] ? 'true' : 'false') . ', confidence=' . ($result['confidence'] ?? 'null'));

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log('IdentifyText: Error - ' . ($result['error'] ?? 'unknown') . ' (type: ' . $errorType . ', stage: ' . ($result['stage'] ?? 'unknown') . ')');
        agentStructuredError($errorType, $result['error'] ?? null);
    }

    // Log escalation for debugging (check PHP error log)
    if (isset($result['escalation'])) {
        error_log('Wine ID Escalation: ' . json_encode($result['escalation']));
    }

    // Log identification result for analytics (WIN-181)
    try {
        $llmClient->logIdentificationResult($result);
    } catch (\Exception $logEx) {
        error_log('Failed to log identification result: ' . $logEx->getMessage());
    }

    // Success response
    agentResponse(true, 'Wine identified successfully', [
        'inputType' => $result['inputType'] ?? 'text',
        'intent' => $result['intent'],
        'parsed' => $result['parsed'],
        'confidence' => $result['confidence'],
        'action' => $result['action'],
        'candidates' => $result['candidates'],
        'usage' => $result['usage'] ?? null,
        'escalation' => $result['escalation'] ?? null,
        'inferences_applied' => $result['inferences_applied'] ?? [],
    ]);

} catch (\Exception $e) {
    agentExceptionError($e, 'identifyText');
}
