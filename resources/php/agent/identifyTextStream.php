<?php
/**
 * Wine Text Identification Streaming Endpoint (WIN-181)
 *
 * POST /resources/php/agent/identifyTextStream.php
 *
 * Request:
 *   {"text": "2019 Chateau Margaux"}
 *
 * Response (SSE stream):
 *   event: field
 *   data: {"field": "producer", "value": "Chateau Margaux"}
 *
 *   event: field
 *   data: {"field": "wineName", "value": "Grand Vin"}
 *
 *   event: result
 *   data: {complete identification result}
 *
 *   event: escalating
 *   data: {"message": "Looking deeper..."}
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

// Validate required field
if (empty($input['text']) || !is_string($input['text'])) {
    agentError('Missing or invalid field: text (string required)');
}

// Check if streaming is enabled - fallback to non-streaming endpoint
$config = getAgentConfig();
if (!($config['streaming']['enabled'] ?? false)) {
    require __DIR__ . '/identifyText.php';
    exit;
}

// Initialize SSE
initSSE();

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();
    $service = getAgentIdentificationService($userId);

    error_log('IdentifyTextStream: Starting streaming identification for: ' . substr($input['text'], 0, 50));

    // Stream identification with field callback
    $result = $service->identifyStreaming($input, function ($field, $value) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
    });

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log('IdentifyTextStream: Error - ' . ($result['error'] ?? 'unknown'));

        sendSSE('error', [
            'type' => $errorType,
            'message' => $result['error'] ?? 'Identification failed',
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded']),
        ]);
        sendSSE('done', []);
        exit;
    }

    // Check if escalation is needed BEFORE emitting confidence
    $tier1Threshold = $config['confidence']['tier1_threshold'] ?? 85;
    $needsEscalation = $result['confidence'] < $tier1Threshold && ($config['streaming']['tier1_only'] ?? true);

    if ($needsEscalation) {
        // Don't emit Tier 1 confidence - we'll emit the escalated one instead
        sendSSE('escalating', ['message' => 'Looking deeper...']);

        // Do non-streaming escalation for better accuracy
        $escalatedResult = $service->identify($input);

        if ($escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']) {
            // Stream the escalated fields progressively for consistent UX
            $parsed = $escalatedResult['parsed'] ?? [];
            $fieldOrder = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];

            foreach ($fieldOrder as $field) {
                if (isset($parsed[$field]) && $parsed[$field] !== null) {
                    sendSSE('field', ['field' => $field, 'value' => $parsed[$field]]);
                    usleep(50000); // 50ms delay between fields for visual effect
                }
            }

            // Emit confidence LAST (after all wine fields)
            if (isset($escalatedResult['confidence'])) {
                sendSSE('field', ['field' => 'confidence', 'value' => $escalatedResult['confidence']]);
            }

            // Send the escalated result
            sendSSE('result', [
                'inputType' => $escalatedResult['inputType'] ?? 'text',
                'intent' => $escalatedResult['intent'] ?? 'add',
                'parsed' => $escalatedResult['parsed'],
                'confidence' => $escalatedResult['confidence'],
                'action' => $escalatedResult['action'],
                'candidates' => $escalatedResult['candidates'] ?? [],
                'usage' => $escalatedResult['usage'] ?? null,
                'escalation' => $escalatedResult['escalation'] ?? null,
                'inferences_applied' => $escalatedResult['inferences_applied'] ?? [],
                'streamed' => false,
                'escalated' => true,
            ]);
        } else {
            // Escalation didn't improve - emit Tier 1 confidence and result
            if (isset($result['confidence'])) {
                sendSSE('field', ['field' => 'confidence', 'value' => $result['confidence']]);
            }
            sendSSE('result', [
                'inputType' => $result['inputType'] ?? 'text',
                'intent' => $result['intent'] ?? 'add',
                'parsed' => $result['parsed'],
                'confidence' => $result['confidence'],
                'action' => $result['action'],
                'candidates' => $result['candidates'] ?? [],
                'usage' => $result['usage'] ?? null,
                'escalation' => $result['escalation'] ?? null,
                'inferences_applied' => $result['inferences_applied'] ?? [],
                'streamed' => $result['streamed'] ?? true,
            ]);
        }
    } else {
        // No escalation needed - emit Tier 1 confidence LAST and result
        if (isset($result['confidence'])) {
            sendSSE('field', ['field' => 'confidence', 'value' => $result['confidence']]);
        }
        sendSSE('result', [
            'inputType' => $result['inputType'] ?? 'text',
            'intent' => $result['intent'] ?? 'add',
            'parsed' => $result['parsed'],
            'confidence' => $result['confidence'],
            'action' => $result['action'],
            'candidates' => $result['candidates'] ?? [],
            'usage' => $result['usage'] ?? null,
            'escalation' => $result['escalation'] ?? null,
            'inferences_applied' => $result['inferences_applied'] ?? [],
            'streamed' => $result['streamed'] ?? true,
        ]);
    }

    // Log identification result for analytics (WIN-181)
    $llmClient = getAgentLLMClient($userId);
    $finalResult = $needsEscalation && isset($escalatedResult) && $escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']
        ? $escalatedResult
        : $result;
    try {
        $llmClient->logIdentificationResult($finalResult);
    } catch (\Exception $logEx) {
        error_log('Failed to log identification result: ' . $logEx->getMessage());
    }

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'identifyTextStream');
}
