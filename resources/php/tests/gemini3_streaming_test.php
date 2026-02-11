<?php
/**
 * Gemini 3 API Compatibility Tests
 *
 * Tests three combinations needed for Phase 6 enrichment streaming:
 * 1. web_search + generateContent (non-streaming, baseline)
 * 2. web_search + streamGenerateContent (streaming)
 * 3. web_search + streamGenerateContent + responseSchema (streaming + schema)
 *
 * Usage: php resources/php/tests/gemini3_streaming_test.php
 */

// Load API key
$configPath = __DIR__ . '/../../wineapp-config/config.local.php';
if (!file_exists($configPath)) {
    // Try alternate path (from project root)
    $configPath = __DIR__ . '/../../../wineapp-config/config.local.php';
}
if (file_exists($configPath)) {
    require_once $configPath;
}

if (!defined('GEMINI_API_KEY')) {
    echo "ERROR: GEMINI_API_KEY not found. Check config path.\n";
    exit(1);
}

$apiKey = GEMINI_API_KEY;
$baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
$model = 'gemini-3-pro-preview';

// Simple wine enrichment prompt for all tests
$prompt = "Search for wine data: Château Margaux Grand Vin 2015\nReturn JSON with: grapeVarieties, alcoholContent, body, criticScores. Use null for unverified fields.";

// Simple schema for structured output test
$schema = [
    'type' => 'OBJECT',
    'properties' => [
        'grapeVarieties' => [
            'type' => 'ARRAY', 'nullable' => true,
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'grape' => ['type' => 'STRING'],
                    'percentage' => ['type' => 'INTEGER', 'nullable' => true],
                ],
            ],
        ],
        'alcoholContent' => ['type' => 'NUMBER', 'nullable' => true],
        'body' => ['type' => 'STRING', 'nullable' => true],
        'criticScores' => [
            'type' => 'ARRAY', 'nullable' => true,
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'critic' => ['type' => 'STRING'],
                    'score'  => ['type' => 'INTEGER'],
                ],
            ],
        ],
    ],
];

// SSL config
$sslOpts = [];
$caBundlePaths = [
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/pki/tls/certs/ca-bundle.crt',
    '/usr/share/ca-certificates',
];
foreach ($caBundlePaths as $path) {
    if (file_exists($path)) {
        if (is_dir($path)) {
            $sslOpts[CURLOPT_CAPATH] = $path;
        } else {
            $sslOpts[CURLOPT_CAINFO] = $path;
        }
        break;
    }
}

echo "=== Gemini 3 API Compatibility Tests ===\n";
echo "Model: {$model}\n";
echo "Prompt: " . strlen($prompt) . " chars\n\n";

// ─── Test 1: web_search + generateContent (non-streaming baseline) ───

echo "--- Test 1: web_search + generateContent (non-streaming) ---\n";
$payload1 = [
    'contents' => [['parts' => [['text' => $prompt]]]],
    'generationConfig' => [
        'maxOutputTokens' => 2000,
        'temperature' => 1.0,
        'responseMimeType' => 'application/json',
    ],
    'tools' => [['google_search' => new \stdClass()]],
];

$result1 = makeRequest("{$baseUrl}/models/{$model}:generateContent", $payload1, $apiKey, $sslOpts);
reportResult($result1, 'non-streaming');

// ─── Test 2: web_search + streamGenerateContent (streaming, no schema) ───

echo "\n--- Test 2: web_search + streamGenerateContent (streaming, no schema) ---\n";
$payload2 = [
    'contents' => [['parts' => [['text' => $prompt]]]],
    'generationConfig' => [
        'maxOutputTokens' => 2000,
        'temperature' => 1.0,
        'responseMimeType' => 'application/json',
    ],
    'tools' => [['google_search' => new \stdClass()]],
];

$result2 = makeStreamingRequest("{$baseUrl}/models/{$model}:streamGenerateContent?alt=sse", $payload2, $apiKey, $sslOpts);
reportResult($result2, 'streaming');

// ─── Test 3: web_search + streamGenerateContent + responseSchema ───

echo "\n--- Test 3: web_search + streamGenerateContent + responseSchema ---\n";
$payload3 = [
    'contents' => [['parts' => [['text' => $prompt]]]],
    'generationConfig' => [
        'maxOutputTokens' => 2000,
        'temperature' => 1.0,
        'responseMimeType' => 'application/json',
        'responseSchema' => $schema,
    ],
    'tools' => [['google_search' => new \stdClass()]],
];

$result3 = makeStreamingRequest("{$baseUrl}/models/{$model}:streamGenerateContent?alt=sse", $payload3, $apiKey, $sslOpts);
reportResult($result3, 'streaming+schema');

// ─── Test 4: web_search + generateContent + responseSchema (non-streaming + schema) ───

echo "\n--- Test 4: web_search + generateContent + responseSchema (non-streaming + schema) ---\n";
$payload4 = [
    'contents' => [['parts' => [['text' => $prompt]]]],
    'generationConfig' => [
        'maxOutputTokens' => 2000,
        'temperature' => 1.0,
        'responseMimeType' => 'application/json',
        'responseSchema' => $schema,
    ],
    'tools' => [['google_search' => new \stdClass()]],
];

$result4 = makeRequest("{$baseUrl}/models/{$model}:generateContent", $payload4, $apiKey, $sslOpts);
reportResult($result4, 'non-streaming+schema');

echo "\n=== Summary ===\n";
echo "Test 1 (web_search + non-streaming):          " . ($result1['success'] ? 'PASS' : 'FAIL') . "\n";
echo "Test 2 (web_search + streaming):               " . ($result2['success'] ? 'PASS' : 'FAIL') . "\n";
echo "Test 3 (web_search + streaming + schema):      " . ($result3['success'] ? 'PASS' : 'FAIL') . "\n";
echo "Test 4 (web_search + non-streaming + schema):  " . ($result4['success'] ? 'PASS' : 'FAIL') . "\n";

// ─── Helpers ───

function makeRequest(string $url, array $payload, string $apiKey, array $sslOpts): array
{
    $start = microtime(true);
    $ch = curl_init($url);
    $opts = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
    ];
    $opts += $sslOpts;
    curl_setopt_array($ch, $opts);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $latency = (int)((microtime(true) - $start) * 1000);

    if ($error) {
        return ['success' => false, 'error' => "curl: {$error}", 'httpCode' => 0, 'latencyMs' => $latency, 'content' => null, 'ttfbMs' => null];
    }

    $data = json_decode($response, true);
    if ($httpCode !== 200) {
        $errMsg = $data['error']['message'] ?? 'Unknown error';
        return ['success' => false, 'error' => "HTTP {$httpCode}: {$errMsg}", 'httpCode' => $httpCode, 'latencyMs' => $latency, 'content' => null, 'ttfbMs' => null];
    }

    $content = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
    $hasGrounding = isset($data['candidates'][0]['groundingMetadata']);

    return ['success' => true, 'httpCode' => $httpCode, 'latencyMs' => $latency, 'content' => $content, 'hasGrounding' => $hasGrounding, 'ttfbMs' => null, 'error' => null];
}

function makeStreamingRequest(string $url, array $payload, string $apiKey, array $sslOpts): array
{
    $start = microtime(true);
    $ttfb = null;
    $chunks = 0;
    $accumulatedText = '';
    $lastChunkData = null;

    $ch = curl_init($url);
    $opts = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ],
        CURLOPT_TIMEOUT => 90,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$ttfb, &$chunks, &$accumulatedText, &$lastChunkData, $start) {
            if ($ttfb === null) {
                $ttfb = (int)((microtime(true) - $start) * 1000);
            }

            // Parse SSE data lines
            $lines = explode("\n", $data);
            foreach ($lines as $line) {
                $line = trim($line);
                if (strpos($line, 'data: ') === 0) {
                    $jsonStr = substr($line, 6);
                    $json = json_decode($jsonStr, true);
                    if ($json) {
                        $chunks++;
                        $lastChunkData = $json;
                        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
                        if ($text) {
                            $accumulatedText .= $text;
                        }
                    }
                }
            }

            return strlen($data);
        },
    ];
    $opts += $sslOpts;
    curl_setopt_array($ch, $opts);

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $latency = (int)((microtime(true) - $start) * 1000);

    if ($error) {
        return ['success' => false, 'error' => "curl: {$error}", 'httpCode' => 0, 'latencyMs' => $latency, 'content' => null, 'ttfbMs' => $ttfb, 'chunks' => $chunks];
    }

    if ($httpCode !== 200) {
        return ['success' => false, 'error' => "HTTP {$httpCode}", 'httpCode' => $httpCode, 'latencyMs' => $latency, 'content' => $accumulatedText, 'ttfbMs' => $ttfb, 'chunks' => $chunks];
    }

    $hasGrounding = isset($lastChunkData['candidates'][0]['groundingMetadata']);

    return ['success' => true, 'httpCode' => $httpCode, 'latencyMs' => $latency, 'content' => $accumulatedText, 'hasGrounding' => $hasGrounding, 'ttfbMs' => $ttfb, 'chunks' => $chunks, 'error' => null];
}

function reportResult(array $result, string $label): void
{
    if (!$result['success']) {
        echo "  RESULT: FAIL\n";
        echo "  Error: {$result['error']}\n";
        echo "  Latency: {$result['latencyMs']}ms\n";
        return;
    }

    echo "  RESULT: PASS\n";
    echo "  HTTP: {$result['httpCode']}\n";
    echo "  Latency: {$result['latencyMs']}ms\n";
    if (isset($result['ttfbMs']) && $result['ttfbMs'] !== null) {
        echo "  TTFB: {$result['ttfbMs']}ms\n";
    }
    if (isset($result['chunks'])) {
        echo "  Chunks: {$result['chunks']}\n";
    }
    echo "  Grounding: " . (($result['hasGrounding'] ?? false) ? 'yes' : 'no') . "\n";

    // Check if content is valid JSON
    $content = $result['content'];
    if ($content) {
        // Clean markdown fences
        $clean = preg_replace('/^```(?:json)?\s*/m', '', $content);
        $clean = preg_replace('/```\s*$/m', '', $clean);
        $clean = preg_replace('/\[\d+\]/', '', $clean);

        $parsed = json_decode(trim($clean), true);
        if ($parsed !== null) {
            echo "  JSON: valid\n";
            $fields = array_keys($parsed);
            echo "  Fields: " . implode(', ', $fields) . "\n";
        } else {
            echo "  JSON: INVALID (first 200 chars: " . substr($content, 0, 200) . ")\n";
        }
    } else {
        echo "  Content: empty\n";
    }
}
