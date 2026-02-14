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

// Validate and sanitize locked fields
$input['lockedFields'] = validateLockedFields($input);

// Extract escalation context (reason + original user text)
$input['escalationContext'] = is_array($input['escalationContext'] ?? null) ? $input['escalationContext'] : [];

// Determine input type
$isImageInput = !empty($input['image']);
$isTextInput = !empty($input['text']);

// Validate required fields based on input type
if (!$isImageInput && !$isTextInput) {
    agentError('Missing required field: text (string) or image (base64 string)');
}

// Test mode: return mock premium result
$textInput = $input['text'] ?? '';
if (str_starts_with($textInput, 'test:')) {
    handleTestPremiumResult($textInput);
    exit;
}

if (empty($input['priorResult']) || !is_array($input['priorResult'])) {
    agentError('Missing or invalid field: priorResult (object required)');
}

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $userId = getAgentUserId();
    $service = getAgentIdentificationService($userId);

    // Route to appropriate method based on input type
    if ($isImageInput) {
        // Image input - use identifyImageWithOpus
        $result = $service->identifyImageWithOpus(
            [
                'image' => $input['image'],
                'mimeType' => $input['mimeType'] ?? 'image/jpeg',
                'supplementaryText' => $input['supplementaryText'] ?? null,
                'lockedFields' => $input['lockedFields'],
                'escalationContext' => $input['escalationContext'],
            ],
            $input['priorResult']
        );
    } else {
        // Text input - use identifyWithOpus
        $result = $service->identifyWithOpus(
            [
                'text' => $input['text'],
                'lockedFields' => $input['lockedFields'],
                'escalationContext' => $input['escalationContext'],
            ],
            $input['priorResult']
        );
    }

    if (!$result['success']) {
        $errorType = $result['errorType'] ?? 'identification_error';
        agentStructuredError($errorType, $result['error'] ?? null);
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
    agentExceptionError($e, 'identifyWithOpus');
}

/**
 * Handle test: prefix with a mock premium identification result.
 * Supports the test:low → "Try Premium" → high-confidence result flow.
 */
function handleTestPremiumResult(string $textInput): void
{
    $parsed = [
        'producer' => 'Domaine de la Romanée-Conti',
        'wineName' => 'Romanée-Conti Grand Cru',
        'vintage' => 2018,
        'region' => 'Burgundy',
        'country' => 'France',
        'wineType' => 'Red',
        'grapes' => ['Pinot Noir'],
    ];

    agentResponse(true, 'Wine identified with premium model', [
        'inputType' => 'text',
        'intent' => 'add',
        'parsed' => $parsed,
        'confidence' => 91,
        'action' => 'auto_populate',
        'candidates' => [],
        'usage' => null,
        'escalation' => [
            'final_tier' => 'premium',
            'model' => 'claude-opus-4-5',
        ],
        'inferences_applied' => [],
    ]);
}
