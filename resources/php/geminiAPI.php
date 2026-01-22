<?php
/**
 * Gemini AI API Proxy
 * Handles AI-powered data generation for wines, producers, and regions
 * Keeps API key secure on server side
 */

// Include config for API key
$configPath = __DIR__ . '/../../../wineapp-config/config.local.php';
if (!file_exists($configPath)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Config file not found']);
    exit;
}
require_once $configPath;

// Initialize response
$response = [
    'success' => false,
    'message' => '',
    'data' => null
];

try {
    // Check if API key is configured
    if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY)) {
        throw new Exception('Gemini API key not configured');
    }

    // Get and validate input
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['type'])) {
        throw new Exception('Missing request type');
    }
    if (empty($data['prompt'])) {
        throw new Exception('Missing prompt');
    }

    $type = $data['type'];
    $prompt = $data['prompt'];

    // Configure system instruction based on type
    $systemInstruction = getSystemInstruction($type);
    if (!$systemInstruction) {
        throw new Exception('Invalid request type');
    }

    // Build Gemini API request
    $model = 'gemini-2.5-pro';
    $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . GEMINI_API_KEY;

    $requestBody = [
        'systemInstruction' => [
            'role' => 'system',
            'parts' => [['text' => $systemInstruction]]
        ],
        'contents' => [[
            'role' => 'user',
            'parts' => [['text' => $prompt]]
        ]],
        'generationConfig' => [
            'temperature' => 0.25,
            'thinkingConfig' => ['thinkingBudget' => -1]
        ],
        'tools' => [['google_search' => new stdClass()]]
    ];

    // Make API call using file_get_contents (curl not always available)
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode($requestBody),
            'timeout' => 60,
            'ignore_errors' => true
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    // Check if allow_url_fopen is enabled
    if (!ini_get('allow_url_fopen')) {
        error_log("allow_url_fopen is disabled - cannot make HTTP requests with file_get_contents");
        throw new Exception('Server configuration error: allow_url_fopen is disabled');
    }

    // Check if openssl extension is loaded (required for HTTPS)
    if (!extension_loaded('openssl')) {
        error_log("OpenSSL extension not loaded - cannot make HTTPS requests");
        throw new Exception('Server configuration error: OpenSSL extension not loaded');
    }

    error_log("Making Gemini API request to: " . $model);

    $apiResponse = @file_get_contents($apiUrl, false, $context);

    if ($apiResponse === false) {
        $error = error_get_last();
        $errorMsg = $error ? json_encode($error) : 'No error details available';
        error_log("file_get_contents failed. Error details: " . $errorMsg);
        error_log("URL attempted: " . preg_replace('/key=.*$/', 'key=REDACTED', $apiUrl));
        throw new Exception('API request failed: ' . ($error['message'] ?? 'Network error - check PHP error log'));
    }

    error_log("Gemini API response received, length: " . strlen($apiResponse));

    // Check HTTP response code from headers
    $httpCode = 0;
    if (isset($http_response_header[0])) {
        preg_match('/HTTP\/\d+\.\d+\s+(\d+)/', $http_response_header[0], $matches);
        $httpCode = isset($matches[1]) ? (int)$matches[1] : 0;
    }

    if ($httpCode !== 200) {
        error_log("Gemini API error (HTTP $httpCode): " . $apiResponse);
        throw new Exception('Gemini API returned error: ' . $httpCode);
    }

    $apiData = json_decode($apiResponse, true);

    // Extract and parse response
    if (isset($apiData['candidates'][0]['content']['parts'])) {
        foreach ($apiData['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text'])) {
                $parsed = cleanAndParseJSON($part['text']);
                if ($parsed) {
                    $response['success'] = true;
                    $response['data'] = $parsed;
                    break;
                }
            }
        }
    }

    if (!$response['success']) {
        throw new Exception('Failed to parse AI response');
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    error_log("Error in geminiAPI.php: " . $e->getMessage());
}

// Return JSON response
header('Content-Type: application/json');
echo json_encode($response);

/**
 * Get system instruction for request type
 */
function getSystemInstruction($type) {
    switch ($type) {
        case 'region':
            return 'You are a helpful expert wine sommelier. When given the input of a type of drink and a region, gather comprehensive information about that region relevant to the production of the type of drink provided and provide information back to the user. Use reputable sources to verify data about the region. Each text response should be around 400 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. If you cannot find the information or don\'t know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this schema structure. Do not include the schema or the structure in the output. JSON Structure: {"description": "string - A detailed description of the region", "soil": "string - Details about the soil or geographical features", "climate": "string - Details about the climate"}';

        case 'producer':
            return 'You are a helpful expert wine sommelier. When given the input of a wine producer, gather comprehensive information about that wine producer and provide information back to the user. Use reputable sources to verify data about the wine producer. Each text response should be around 200 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. If you cannot find the information or don\'t know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this schema structure. Do not include the schema or the structure in the output. JSON Structure: {"description": "string - A detailed description of the producer", "ownership": "string - The ownership structure", "founded": "string - The year founded", "town": "string - The town the producer is based in"}';

        case 'wine':
            return 'You are a helpful expert wine sommelier. When given the input of a specific drink and the producer, gather comprehensive information about that drink and provide information back to the user. Use reputable sources to verify data about the producer. Each text response should be around 100 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not offer to provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. If you cannot find the information or don\'t know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include the schema or the structure in the output. JSON Structure: {"description": "string - A detailed description of the wine", "tasting": "string - A description of the nose and palate", "pairing": "string - Food pairing recommendations"}';

        default:
            return null;
    }
}

/**
 * Clean and parse JSON from AI response
 */
function cleanAndParseJSON($raw) {
    if (!is_string($raw)) {
        return $raw;
    }

    // Strip markdown fences and clean
    $cleaned = trim($raw);
    $cleaned = preg_replace('/^```(?:json)?\n?/', '', $cleaned);
    $cleaned = preg_replace('/```$/', '', $cleaned);
    $cleaned = preg_replace('/\s*\[\d+(\s*,\s*\d+)*\]/u', '', $cleaned); // Remove citation numbers

    try {
        $parsed = json_decode($cleaned, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $parsed;
        }
    } catch (Exception $e) {
        error_log("JSON parse error: " . $e->getMessage());
    }

    return null;
}
?>
