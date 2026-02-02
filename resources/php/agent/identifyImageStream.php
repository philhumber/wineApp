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
 *   data: {"field": "producer", "value": "Château Margaux"}
 *
 *   event: result
 *   data: {complete identification result}
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

// Check if streaming is enabled - fallback to non-streaming endpoint
$config = getAgentConfig();
if (!($config['streaming']['enabled'] ?? false)) {
    require __DIR__ . '/identifyImage.php';
    exit;
}

// Initialize SSE
initSSE();

// Debug: Send initial test event
error_log('IdentifyImageStream: SSE initialized, sending test event');
sendSSE('debug', ['message' => 'SSE stream started', 'timestamp' => date('H:i:s')]);

try {
    $userId = $input['userId'] ?? 1;
    $service = getAgentIdentificationService($userId);

    // Build identification input
    $identifyInput = [
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
    ];
    if ($supplementaryText !== null) {
        $identifyInput['supplementaryText'] = $supplementaryText;
    }

    error_log('IdentifyImageStream: Starting streaming image identification');

    // Stream identification with field callback
    $result = $service->identifyStreamingImage($identifyInput, function ($field, $value) {
        error_log("IdentifyImageStream: Field received - {$field}");
        sendSSE('field', ['field' => $field, 'value' => $value]);
    });

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log('IdentifyImageStream: Error - ' . ($result['error'] ?? 'unknown'));

        sendSSE('error', [
            'type' => $errorType,
            'message' => $result['error'] ?? 'Image identification failed',
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

        // Do non-streaming escalation
        $escalatedResult = $service->identify($identifyInput);

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

            sendSSE('result', [
                'inputType' => 'image',
                'intent' => $escalatedResult['intent'] ?? 'add',
                'parsed' => $escalatedResult['parsed'],
                'confidence' => $escalatedResult['confidence'],
                'action' => $escalatedResult['action'],
                'candidates' => $escalatedResult['candidates'] ?? [],
                'usage' => $escalatedResult['usage'] ?? null,
                'quality' => $escalatedResult['quality'] ?? null,
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
        }
    } else {
        // No escalation needed - emit Tier 1 confidence LAST and result
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
    }

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'identifyImageStream');
}
