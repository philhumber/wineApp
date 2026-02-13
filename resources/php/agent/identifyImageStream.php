<?php
/**
 * Wine Image Identification Streaming Endpoint (WIN-181)
 *
 * POST /resources/php/agent/identifyImageStream.php
 *
 * Request:
 *   {
 *     "image": "base64-encoded-image-data",
 *     "mimeType": "image/jpeg",
 *     "supplementaryText": "optional user context"
 *   }
 *
 * Response (SSE stream):
 *   event: field
 *   data: {"field": "producer", "value": "Chateau Margaux"}
 *
 *   event: result
 *   data: {complete Tier 1 identification result}
 *
 *   event: refining
 *   data: {"message": "Looking deeper...", "tier1Confidence": 65}
 *
 *   event: field (updated fields during refinement)
 *   data: {"field": "region", "value": "Bordeaux"}
 *
 *   event: refined
 *   data: {escalated identification result}
 *
 *   event: done
 *   data: {}
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

// Validate optional supplementary text
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

// Validate and sanitize locked fields
$validatedLockedFields = validateLockedFields($input);

// Check if streaming is enabled - fallback to non-streaming endpoint
$config = getAgentConfig();
if (!($config['streaming']['enabled'] ?? false)) {
    require __DIR__ . '/identifyImage.php';
    exit;
}

// Initialize SSE
initSSE();
registerCancelCleanup();

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();
    $service = getAgentIdentificationService($userId);

    // Build identification input
    $identifyInput = [
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
        'lockedFields' => $validatedLockedFields,
    ];
    if ($supplementaryText !== null) {
        $identifyInput['supplementaryText'] = $supplementaryText;
    }

    $requestId = getRequestId() ?? '-';
    error_log("[Agent] identifyImage: request={$requestId} mimeType={$input['mimeType']}" . ($supplementaryText ? " text=\"" . substr($supplementaryText, 0, 50) . '"' : ''));

    // Stream identification with field callback
    $result = $service->identifyStreamingImage($identifyInput, function ($field, $value) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
    });

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log("[Agent] identifyImage: error type={$errorType} msg=" . ($result['error'] ?? 'unknown'));

        sendSSE('error', [
            'type' => $errorType,
            'message' => $result['error'] ?? 'Image identification failed',
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded']),
        ]);
        sendSSE('done', []);
        exit;
    }

    // Always emit Tier 1 confidence and result first (non-blocking)
    if (isset($result['confidence'])) {
        sendSSE('field', ['field' => 'confidence', 'value' => $result['confidence']]);
    }
    sendSSE('result', [
        'inputType' => 'image',
        'intent' => $result['intent'] ?? 'add',
        'parsed' => $result['parsed'],
        'confidence' => $result['confidence'],
        'action' => $result['action'],
        'candidates' => $result['candidates'] ?? [],
        'usage' => $result['usage'] ?? null,
        'quality' => $result['quality'] ?? null,
        'escalation' => $result['escalation'] ?? null,
        'inferences_applied' => $result['inferences_applied'] ?? [],
        'streamed' => $result['streamed'] ?? true,
    ]);

    // No auto-escalation — user controls verification via "Verify" chip → verifyImage.php

    // Log identification result for analytics (WIN-181)
    $llmClient = getAgentLLMClient($userId);
    $finalResult = $result;

    $producer = $finalResult['parsed']['producer'] ?? '?';
    $wine = $finalResult['parsed']['wineName'] ?? '?';
    $conf = $finalResult['confidence'] ?? 0;
    $tier = $finalResult['escalation']['final_tier'] ?? 'tier1';
    error_log("[Agent] identifyImage: done producer=\"{$producer}\" wine=\"{$wine}\" confidence={$conf} tier={$tier}");

    try {
        $llmClient->logIdentificationResult($finalResult);
    } catch (\Exception $logEx) {
        error_log("[Agent] identifyImage: failed to log result — " . $logEx->getMessage());
    }

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'identifyImageStream');
}
