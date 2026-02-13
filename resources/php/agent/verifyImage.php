<?php
/**
 * Wine Image Verification Endpoint
 *
 * User-triggered escalation to Tier 1.5+ with Google Search grounding.
 * Called when user clicks "Verify" chip after a fast Tier 1 image identification.
 *
 * POST /resources/php/agent/verifyImage.php
 *
 * Request:
 *   {
 *     "image": "base64-encoded-image",
 *     "mimeType": "image/jpeg",
 *     "supplementaryText": "optional context",
 *     "priorResult": { "parsed": {...}, "confidence": 45 }
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

if (empty($input['priorResult']) || !is_array($input['priorResult'])) {
    agentError('Missing or invalid field: priorResult (object required)');
}

// Validate and sanitize locked fields
$input['lockedFields'] = validateLockedFields($input);

try {
    // WIN-254: Server-authoritative userId
    $userId = getAgentUserId();
    $service = getAgentIdentificationService($userId);

    $identifyInput = [
        'image' => $input['image'],
        'mimeType' => $input['mimeType'],
        'lockedFields' => $input['lockedFields'],
    ];
    if (!empty($input['supplementaryText']) && is_string($input['supplementaryText'])) {
        $identifyInput['supplementaryText'] = trim($input['supplementaryText']);
    }

    $requestId = getRequestId() ?? '-';
    $priorConf = $input['priorResult']['confidence'] ?? '?';
    error_log("[Agent] verifyImage: request={$requestId} priorConfidence={$priorConf}");

    // Run escalation from Tier 1.5 onward (grounded + HIGH thinking)
    $result = $service->identifyEscalateOnly($identifyInput, $input['priorResult'], 'image');

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        error_log("[Agent] verifyImage: error type={$errorType} msg=" . ($result['error'] ?? 'unknown'));
        agentStructuredError($errorType, $result['error'] ?? null);
    }

    // Log result for analytics
    $llmClient = getAgentLLMClient($userId);
    $producer = $result['parsed']['producer'] ?? '?';
    $wine = $result['parsed']['wineName'] ?? '?';
    $conf = $result['confidence'] ?? 0;
    $tier = $result['escalation']['final_tier'] ?? 'verified';
    error_log("[Agent] verifyImage: done producer=\"{$producer}\" wine=\"{$wine}\" confidence={$conf} tier={$tier}");

    try {
        $llmClient->logIdentificationResult($result);
    } catch (\Exception $logEx) {
        error_log("[Agent] verifyImage: failed to log result — " . $logEx->getMessage());
    }

    agentResponse(true, 'Wine verified with web search', [
        'inputType' => $result['inputType'] ?? 'image',
        'intent' => $result['intent'] ?? 'add',
        'parsed' => $result['parsed'],
        'confidence' => $result['confidence'],
        'action' => $result['action'],
        'candidates' => $result['candidates'] ?? [],
        'usage' => $result['usage'] ?? null,
        'escalation' => $result['escalation'] ?? null,
        'inferences_applied' => $result['inferences_applied'] ?? [],
    ]);

} catch (\Exception $e) {
    agentExceptionError($e, 'verifyImage');
}
