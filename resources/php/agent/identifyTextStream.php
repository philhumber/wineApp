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
registerCancelCleanup();

// Test mode: bypass LLM with canned responses
if (str_starts_with($input['text'], 'test:')) {
    handleTestScenario(substr($input['text'], 5));
    exit;
}

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();
    $service = getAgentIdentificationService($userId);

    $requestId = getRequestId() ?? '-';
    error_log("[Agent] identifyText: request={$requestId} text=\"" . substr($input['text'], 0, 50) . '"');

    // Stream identification with field callback
    $result = $service->identifyStreaming($input, function ($field, $value) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
    });

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log("[Agent] identifyText: error type={$errorType} msg=" . ($result['error'] ?? 'unknown'));

        sendSSE('error', [
            'type' => $errorType,
            'message' => $result['error'] ?? 'Identification failed',
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

    // Check if escalation is needed
    $tier1Threshold = $config['confidence']['tier1_threshold'] ?? 85;
    $needsEscalation = $result['confidence'] < $tier1Threshold && ($config['streaming']['tier1_only'] ?? true);

    if ($needsEscalation) {
        // WIN-227: Skip escalation if client cancelled
        if (isRequestCancelled()) {
            error_log("[Agent] identifyText: CANCELLED before escalation (confidence={$result['confidence']})");
            sendSSE('done', []);
            exit;
        }

        error_log("[Agent] identifyText: refining (streaming confidence={$result['confidence']}, threshold={$tier1Threshold})");
        sendSSE('refining', ['message' => 'Looking deeper...', 'tier1Confidence' => $result['confidence']]);

        // Run escalation starting from Tier 1.5 (skips redundant Tier 1)
        $escalatedResult = $service->identifyEscalateOnly($input, $result, 'text');

        if ($escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']) {
            // Emit only changed fields for progressive update
            $tier1Parsed = $result['parsed'] ?? [];
            $refinedParsed = $escalatedResult['parsed'] ?? [];
            $fieldOrder = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];

            foreach ($fieldOrder as $field) {
                if (isset($refinedParsed[$field]) && $refinedParsed[$field] !== null
                    && (!isset($tier1Parsed[$field]) || $tier1Parsed[$field] !== $refinedParsed[$field])) {
                    sendSSE('field', ['field' => $field, 'value' => $refinedParsed[$field]]);
                    usleep(50000);
                }
            }

            if ($escalatedResult['confidence'] !== $result['confidence']) {
                sendSSE('field', ['field' => 'confidence', 'value' => $escalatedResult['confidence']]);
            }

            sendSSE('refined', [
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
            // Escalation didn't improve — emit refined with same data
            sendSSE('refined', [
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
                'escalated' => false,
            ]);
        }
    }

    // Log identification result for analytics (WIN-181)
    $llmClient = getAgentLLMClient($userId);
    $finalResult = $needsEscalation && isset($escalatedResult) && $escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']
        ? $escalatedResult
        : $result;

    $producer = $finalResult['parsed']['producer'] ?? '?';
    $wine = $finalResult['parsed']['wineName'] ?? '?';
    $conf = $finalResult['confidence'] ?? 0;
    $tier = $finalResult['escalation']['final_tier'] ?? ($needsEscalation ? 'escalated' : 'tier1');
    error_log("[Agent] identifyText: done producer=\"{$producer}\" wine=\"{$wine}\" confidence={$conf} tier={$tier}");

    try {
        $llmClient->logIdentificationResult($finalResult);
    } catch (\Exception $logEx) {
        error_log("[Agent] identifyText: failed to log result — " . $logEx->getMessage());
    }

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'identifyTextStream');
}

/**
 * Handle test: prefix scenarios with canned SSE responses.
 * Bypasses all LLM calls for fast end-to-end flow testing.
 */
function handleTestScenario(string $scenario): void
{
    switch (trim($scenario)) {
        case 'high':
            handleTestHigh();
            break;
        case 'medium':
            handleTestMedium();
            break;
        case 'low':
            handleTestLow();
            break;
        case 'ambiguous':
            handleTestAmbiguous();
            break;
        default:
            sendSSE('error', [
                'type' => 'identification_error',
                'message' => "Unknown test scenario: {$scenario}. Use: high, medium, low, ambiguous",
                'retryable' => false,
            ]);
            sendSSE('done', []);
            break;
    }
}

function handleTestHigh(): void
{
    $fields = [
        ['producer', 'Château Margaux'],
        ['wineName', 'Grand Vin'],
        ['vintage', 2019],
        ['region', 'Bordeaux'],
        ['country', 'France'],
        ['wineType', 'Red'],
        ['grapes', ['Cabernet Sauvignon', 'Merlot', 'Petit Verdot', 'Cabernet Franc']],
        ['confidence', 92],
    ];

    foreach ($fields as [$field, $value]) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
        usleep(50000);
    }

    $parsed = [
        'producer' => 'Château Margaux',
        'wineName' => 'Grand Vin',
        'vintage' => 2019,
        'region' => 'Bordeaux',
        'country' => 'France',
        'wineType' => 'Red',
        'grapes' => ['Cabernet Sauvignon', 'Merlot', 'Petit Verdot', 'Cabernet Franc'],
    ];

    sendSSE('result', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $parsed,
        'confidence' => 92,
        'action' => 'auto_populate',
        'candidates' => [],
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => true,
    ]);

    sendSSE('done', []);
}

function handleTestMedium(): void
{
    // Tier 1 fields
    $fields = [
        ['producer', 'Cloudy Bay'],
        ['wineName', 'Sauvignon Blanc'],
        ['vintage', 2022],
        ['region', 'Marlborough'],
        ['country', 'New Zealand'],
        ['wineType', 'White'],
        ['grapes', ['Sauvignon Blanc']],
        ['confidence', 72],
    ];

    foreach ($fields as [$field, $value]) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
        usleep(50000);
    }

    $tier1Parsed = [
        'producer' => 'Cloudy Bay',
        'wineName' => 'Sauvignon Blanc',
        'vintage' => 2022,
        'region' => 'Marlborough',
        'country' => 'New Zealand',
        'wineType' => 'White',
        'grapes' => ['Sauvignon Blanc'],
    ];

    sendSSE('result', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $tier1Parsed,
        'confidence' => 72,
        'action' => 'suggest',
        'candidates' => [],
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => true,
    ]);

    // Escalation sequence
    sendSSE('refining', ['message' => 'Looking deeper...', 'tier1Confidence' => 72]);
    usleep(500000);

    // Updated fields from refinement
    sendSSE('field', ['field' => 'wineName', 'value' => 'Te Koko']);
    usleep(50000);
    sendSSE('field', ['field' => 'confidence', 'value' => 82]);

    $refinedParsed = [
        'producer' => 'Cloudy Bay',
        'wineName' => 'Te Koko',
        'vintage' => 2022,
        'region' => 'Marlborough',
        'country' => 'New Zealand',
        'wineType' => 'White',
        'grapes' => ['Sauvignon Blanc'],
    ];

    sendSSE('refined', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $refinedParsed,
        'confidence' => 82,
        'action' => 'suggest',
        'candidates' => [],
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1.5', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => false,
        'escalated' => true,
    ]);

    sendSSE('done', []);
}

function handleTestLow(): void
{
    // Sparse fields — low confidence
    $fields = [
        ['wineType', 'Red'],
        ['country', 'France'],
        ['confidence', 45],
    ];

    foreach ($fields as [$field, $value]) {
        sendSSE('field', ['field' => $field, 'value' => $value]);
        usleep(50000);
    }

    $parsed = [
        'producer' => null,
        'wineName' => null,
        'vintage' => null,
        'region' => null,
        'country' => 'France',
        'wineType' => 'Red',
        'grapes' => [],
    ];

    sendSSE('result', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $parsed,
        'confidence' => 45,
        'action' => 'user_choice',
        'candidates' => [],
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => true,
    ]);

    // Escalation attempt — fails to improve
    sendSSE('refining', ['message' => 'Looking deeper...', 'tier1Confidence' => 45]);
    usleep(500000);

    sendSSE('refined', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $parsed,
        'confidence' => 45,
        'action' => 'user_choice',
        'candidates' => [],
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1.5', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => true,
        'escalated' => false,
    ]);

    sendSSE('done', []);
}

function handleTestAmbiguous(): void
{
    sendSSE('field', ['field' => 'producer', 'value' => 'Penfolds']);
    usleep(50000);
    sendSSE('field', ['field' => 'confidence', 'value' => 38]);

    $parsed = [
        'producer' => 'Penfolds',
        'wineName' => null,
        'vintage' => null,
        'region' => null,
        'country' => 'Australia',
        'wineType' => 'Red',
        'grapes' => [],
    ];

    $candidates = [
        [
            'producer' => 'Penfolds',
            'wineName' => 'Grange',
            'vintage' => null,
            'region' => 'Barossa Valley',
            'country' => 'Australia',
            'wineType' => 'Red',
            'grapes' => ['Shiraz'],
            'matchScore' => 95,
        ],
        [
            'producer' => 'Penfolds',
            'wineName' => 'Bin 389',
            'vintage' => null,
            'region' => 'South Australia',
            'country' => 'Australia',
            'wineType' => 'Red',
            'grapes' => ['Cabernet Sauvignon', 'Shiraz'],
            'matchScore' => 80,
        ],
        [
            'producer' => 'Penfolds',
            'wineName' => 'RWT',
            'vintage' => null,
            'region' => 'Barossa Valley',
            'country' => 'Australia',
            'wineType' => 'Red',
            'grapes' => ['Shiraz'],
            'matchScore' => 65,
        ],
    ];

    sendSSE('result', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $parsed,
        'confidence' => 38,
        'action' => 'disambiguate',
        'candidates' => $candidates,
        'usage' => null,
        'escalation' => ['final_tier' => 'tier1', 'model' => 'test-mock'],
        'inferences_applied' => [],
        'streamed' => true,
    ]);

    sendSSE('done', []);
}
