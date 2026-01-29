<?php
/**
 * Wine Identification with Opus (Tier 3) Endpoint
 *
 * User-triggered escalation to Claude Opus 4.5 for maximum accuracy.
 * Called when user clicks "Try harder" after a user_choice action.
 * Supports both text and image inputs.
 *
 * POST /resources/php/agent/identifyWithOpus.php
 *
 * Request (text):
 *   {
 *     "text": "Wine description or original input",
 *     "priorResult": {...}
 *   }
 *
 * Request (image):
 *   {
 *     "image": "base64-encoded-image",
 *     "mimeType": "image/jpeg",
 *     "supplementaryText": "optional context",
 *     "priorResult": {...}
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

// Determine input type
$isImageInput = !empty($input['image']);
$isTextInput = !empty($input['text']);

// Validate required fields based on input type
if (!$isImageInput && !$isTextInput) {
    agentError('Missing required field: text (string) or image (base64 string)');
}

if (empty($input['priorResult']) || !is_array($input['priorResult'])) {
    agentError('Missing or invalid field: priorResult (object required)');
}

try {
    // Get user ID (default to 1 for now)
    $userId = $input['userId'] ?? 1;
    $service = getAgentIdentificationService($userId);

    // Route to appropriate method based on input type
    if ($isImageInput) {
        // Image input - use identifyImageWithOpus
        $result = $service->identifyImageWithOpus(
            [
                'image' => $input['image'],
                'mimeType' => $input['mimeType'] ?? 'image/jpeg',
                'supplementaryText' => $input['supplementaryText'] ?? null,
            ],
            $input['priorResult']
        );
    } else {
        // Text input - use identifyWithOpus
        $result = $service->identifyWithOpus(
            ['text' => $input['text']],
            $input['priorResult']
        );
    }

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        $httpCode = match ($errorType) {
            'limit_exceeded', 'rate_limit' => 429,
            'provider_unavailable', 'circuit_open', 'overloaded' => 503,
            default => 400,
        };
        agentError($result['error'] ?? 'Premium identification failed', $httpCode);
    }

    // Success response
    agentResponse(true, 'Wine identified with premium model', [
        'inputType' => $result['inputType'] ?? 'text',
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
    // Log error
    error_log('Agent Opus identification error: ' . $e->getMessage());
    agentError('Internal server error', 500);
}
