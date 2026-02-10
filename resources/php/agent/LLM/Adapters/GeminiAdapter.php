<?php
/**
 * Gemini LLM Adapter
 *
 * Adapter for Google's Gemini API.
 * Implements the LLMProviderInterface for unified access.
 *
 * WIN-253: Uses x-goog-api-key header for authentication instead of URL query parameter
 * to prevent API key from appearing in server access logs.
 *
 * @package Agent\LLM\Adapters
 */

namespace Agent\LLM\Adapters;

use Agent\LLM\Interfaces\LLMProviderInterface;
use Agent\LLM\LLMResponse;
use Agent\LLM\LLMStreamingResponse;
use Agent\LLM\SSLConfig;
use Agent\LLM\Streaming\SSEParser;
use Agent\LLM\Streaming\StreamingFieldDetector;

class GeminiAdapter implements LLMProviderInterface
{
    /** @var string API key */
    private string $apiKey;

    /** @var string Current model */
    private string $model;

    /** @var string Base URL for API */
    private string $baseUrl;

    /** @var array Provider configuration */
    private array $config;

    /**
     * Create a new Gemini adapter
     *
     * @param array $config Provider configuration
     */
    public function __construct(array $config)
    {
        $this->config = $config;
        $this->apiKey = $this->loadApiKey();
        $this->model = $config['default_model'] ?? 'gemini-3-flash-preview';
        $this->baseUrl = $config['base_url'] ?? 'https://generativelanguage.googleapis.com/v1beta';
    }

    /**
     * Load API key from configuration
     *
     * @return string API key
     * @throws \RuntimeException If API key not found
     */
    private function loadApiKey(): string
    {
        // Try to load from wineapp-config (5 levels up from adapters/)
        $configPath = __DIR__ . '/../../../../../wineapp-config/config.local.php';
        if (\file_exists($configPath)) {
            require_once $configPath;
        }

        if (!\defined('GEMINI_API_KEY')) {
            throw new \RuntimeException('GEMINI_API_KEY not configured');
        }

        return GEMINI_API_KEY;
    }

    /**
     * {@inheritdoc}
     */
    public function complete(string $prompt, array $options = []): LLMResponse
    {
        $startTime = \microtime(true);
        $model = $options['model'] ?? $this->model;

        $payload = [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'generationConfig' => [
                'maxOutputTokens' => $options['max_tokens'] ?? 1000,
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        // Add thinking config for Gemini 3 models
        if (isset($options['thinking_level']) && $this->supportsThinking($model)) {
            $payload['generationConfig']['thinkingConfig'] = [
                'thinkingLevel' => $options['thinking_level']
            ];
        }

        // Add tools if provided
        if (!empty($options['tools'])) {
            $payload['tools'] = $this->formatTools($options['tools']);
        }

        // Handle web_search option (enables Google Search grounding)
        if ($options['web_search'] ?? false) {
            $payload['tools'] = [['google_search' => new \stdClass()]];
        }

        // Add JSON response format if requested
        if ($options['json_response'] ?? false) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
        }

        // Structured output schema (works with google_search on Gemini 3)
        if (!empty($options['response_schema'])) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
            $payload['generationConfig']['responseSchema'] = $options['response_schema'];
        }

        // Debug: Log context chain before LLM call
        $this->logContextChain('text', $model, $payload, $options);

        // WIN-253: API key sent via header, not URL query parameter
        $url = "{$this->baseUrl}/models/{$model}:generateContent";

        $timeout = $options['timeout'] ?? $this->config['timeout'] ?? 30;
        $response = $this->makeRequest($url, $payload, $timeout);
        $latencyMs = (int)((\microtime(true) - $startTime) * 1000);

        if ($response['error']) {
            return LLMResponse::error(
                $response['error'],
                'network_error',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'gemini',
                    'model' => $model,
                ]
            );
        }

        if ($response['httpCode'] !== 200) {
            // Check for model unavailability - attempt fallback
            if (($response['httpCode'] === 503 || $response['httpCode'] === 404) &&
                !($options['_is_fallback'] ?? false)) {
                $fallbackModel = $this->getFallbackModel($model);
                if ($fallbackModel) {
                    // Remove thinking_level for fallback models that don't support it
                    $fallbackOptions = $options;
                    if (!$this->supportsThinking($fallbackModel)) {
                        unset($fallbackOptions['thinking_level']);
                    }
                    $fallbackOptions['model'] = $fallbackModel;
                    $fallbackOptions['_is_fallback'] = true;

                    return $this->complete($prompt, $fallbackOptions);
                }
            }
            return $this->handleError($response['data'], $response['httpCode'], $latencyMs, $model);
        }

        return $this->parseSuccessResponse($response['data'], $latencyMs, $model);
    }

    /**
     * {@inheritdoc}
     */
    public function completeWithImage(
        string $prompt,
        string $imageBase64,
        string $mimeType,
        array $options = []
    ): LLMResponse {
        $startTime = \microtime(true);
        $model = $options['model'] ?? $this->model;

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType,
                                'data' => $imageBase64,
                            ]
                        ]
                    ]
                ]
            ],
            'generationConfig' => [
                'maxOutputTokens' => $options['max_tokens'] ?? 1000,
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        // Add thinking config for Gemini 3 models
        if (isset($options['thinking_level']) && $this->supportsThinking($model)) {
            $payload['generationConfig']['thinkingConfig'] = [
                'thinkingLevel' => $options['thinking_level']
            ];
        }

        if ($options['json_response'] ?? false) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
        }

        // Debug: Log context chain before LLM call
        $this->logContextChain('vision', $model, $payload, $options);

        // WIN-253: API key sent via header, not URL query parameter
        $url = "{$this->baseUrl}/models/{$model}:generateContent";

        $response = $this->makeRequest($url, $payload, $this->config['timeout'] ?? 60);
        $latencyMs = (int)((\microtime(true) - $startTime) * 1000);

        if ($response['error']) {
            return LLMResponse::error(
                $response['error'],
                'network_error',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'gemini',
                    'model' => $model,
                ]
            );
        }

        if ($response['httpCode'] !== 200) {
            // Check for model unavailability - attempt fallback
            if (($response['httpCode'] === 503 || $response['httpCode'] === 404) &&
                !($options['_is_fallback'] ?? false)) {
                $fallbackModel = $this->getFallbackModel($model);
                if ($fallbackModel) {
                    // Remove thinking_level for fallback models that don't support it
                    $fallbackOptions = $options;
                    if (!$this->supportsThinking($fallbackModel)) {
                        unset($fallbackOptions['thinking_level']);
                    }
                    $fallbackOptions['model'] = $fallbackModel;
                    $fallbackOptions['_is_fallback'] = true;

                    return $this->completeWithImage($prompt, $imageBase64, $mimeType, $fallbackOptions);
                }
            }
            return $this->handleError($response['data'], $response['httpCode'], $latencyMs, $model);
        }

        return $this->parseSuccessResponse($response['data'], $latencyMs, $model);
    }

    /**
     * Stream completion with callback for field updates (WIN-181)
     *
     * {@inheritdoc}
     */
    public function streamComplete(
        string $prompt,
        array $options,
        callable $onChunk
    ): LLMStreamingResponse {
        $startTime = \microtime(true);
        $model = $options['model'] ?? $this->model;

        $payload = $this->buildStreamingPayload($prompt, null, null, $options);

        // WIN-253: API key sent via header, not URL query parameter
        // Streaming URL: streamGenerateContent?alt=sse
        $url = "{$this->baseUrl}/models/{$model}:streamGenerateContent?alt=sse";

        return $this->executeStreaming($url, $payload, $options, $onChunk, $startTime, $model);
    }

    /**
     * Stream completion with image (WIN-181)
     *
     * {@inheritdoc}
     */
    public function streamCompleteWithImage(
        string $prompt,
        string $imageBase64,
        string $mimeType,
        array $options,
        callable $onChunk
    ): LLMStreamingResponse {
        $startTime = \microtime(true);
        $model = $options['model'] ?? $this->model;

        $payload = $this->buildStreamingPayload($prompt, $imageBase64, $mimeType, $options);

        // WIN-253: API key sent via header, not URL query parameter
        // Streaming URL: streamGenerateContent?alt=sse
        $url = "{$this->baseUrl}/models/{$model}:streamGenerateContent?alt=sse";

        return $this->executeStreaming($url, $payload, $options, $onChunk, $startTime, $model);
    }

    /**
     * Build payload for streaming requests
     *
     * @param string $prompt Text prompt
     * @param string|null $imageBase64 Optional image data
     * @param string|null $mimeType Optional image MIME type
     * @param array $options Request options
     * @return array Request payload
     */
    private function buildStreamingPayload(
        string $prompt,
        ?string $imageBase64,
        ?string $mimeType,
        array $options
    ): array {
        $parts = [['text' => $prompt]];

        // Add image if provided
        if ($imageBase64 && $mimeType) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $mimeType,
                    'data' => $imageBase64,
                ]
            ];
        }

        $payload = [
            'contents' => [['parts' => $parts]],
            'generationConfig' => [
                'maxOutputTokens' => $options['max_tokens'] ?? 1000,
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        // Add thinking config for Gemini 3 models
        $model = $options['model'] ?? $this->model;
        if (isset($options['thinking_level']) && $this->supportsThinking($model)) {
            $payload['generationConfig']['thinkingConfig'] = [
                'thinkingLevel' => $options['thinking_level']
            ];
        }

        // Add JSON response format if requested
        if ($options['json_response'] ?? false) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
        }

        // Structured output schema (overrides json_response when present)
        if (!empty($options['response_schema'])) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
            $payload['generationConfig']['responseSchema'] = $options['response_schema'];
        }

        return $payload;
    }

    /**
     * Execute streaming request with curl
     *
     * @param string $url Request URL
     * @param array $payload Request payload
     * @param array $options Request options
     * @param callable $onChunk Field callback
     * @param float $startTime Start timestamp
     * @param string $model Model name
     * @return LLMStreamingResponse
     */
    private function executeStreaming(
        string $url,
        array $payload,
        array $options,
        callable $onChunk,
        float $startTime,
        string $model
    ): LLMStreamingResponse {
        $parser = new SSEParser();
        $detector = new StreamingFieldDetector();
        $chunks = [];
        $ttfb = null;
        $fieldTimings = [];
        $accumulatedText = '';
        $error = null;
        $httpCode = 0;

        $ch = \curl_init($url);

        // WIN-253: API key sent via x-goog-api-key header instead of URL query parameter
        $curlOptions = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => \json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-goog-api-key: ' . $this->apiKey,
            ],
            CURLOPT_TIMEOUT => $options['timeout'] ?? 30,
            CURLOPT_WRITEFUNCTION => function ($ch, $data) use (
                $parser,
                $detector,
                $onChunk,
                &$chunks,
                &$ttfb,
                &$fieldTimings,
                &$accumulatedText,
                $startTime
            ) {
                // WIN-227: Abort if client cancelled (token file or connection_aborted)
                echo ": \n\n";
                @\flush();
                if (\connection_aborted() || isRequestCancelled()) {
                    \error_log('[Agent] LLM cancelled: provider=gemini (streaming WRITEFUNCTION)');
                    return 0;
                }

                // Track TTFB on first data
                if ($ttfb === null) {
                    $ttfb = (int)((\microtime(true) - $startTime) * 1000);
                }

                // Parse SSE chunks from Gemini
                $jsonPayloads = $parser->parse($data);

                foreach ($jsonPayloads as $json) {
                    $chunks[] = $json;

                    // Extract text from Gemini response structure
                    $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';

                    if ($text) {
                        $accumulatedText .= $text;

                        // Detect complete fields and emit
                        $detector->processChunk($text, function ($field, $value) use (
                            $onChunk,
                            &$fieldTimings,
                            $startTime
                        ) {
                            $fieldTimings[$field] = (int)((\microtime(true) - $startTime) * 1000);
                            $onChunk($field, $value);
                        });
                    }
                }

                return \strlen($data);
            },
        ];

        // WIN-143: SSL configuration via shared SSLConfig (cross-platform cert resolution)
        $curlOptions += SSLConfig::getCurlOptions();

        \curl_setopt_array($ch, $curlOptions);

        $result = \curl_exec($ch);
        $httpCode = \curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = \curl_error($ch);
        \curl_close($ch);

        $latencyMs = (int)((\microtime(true) - $startTime) * 1000);

        // Handle curl errors
        if ($curlError) {
            return LLMStreamingResponse::error(
                $curlError,
                'network_error',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'gemini',
                    'model' => $model,
                    'streamed' => false,
                ]
            );
        }

        // Handle HTTP errors
        if ($httpCode !== 200) {
            $errorType = $this->classifyError($httpCode, '');
            return LLMStreamingResponse::error(
                "Streaming request failed with HTTP {$httpCode}",
                $errorType,
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'gemini',
                    'model' => $model,
                    'streamed' => false,
                ]
            );
        }

        // Try to parse complete JSON from accumulated text
        $completeJson = $detector->tryParseComplete();
        $content = $completeJson ? \json_encode($completeJson) : $accumulatedText;

        // Calculate token counts from chunks (approximate)
        $inputTokens = 0;
        $outputTokens = 0;
        foreach ($chunks as $chunk) {
            $inputTokens = $chunk['usageMetadata']['promptTokenCount'] ?? $inputTokens;
            $outputTokens += $chunk['usageMetadata']['candidatesTokenCount'] ?? 0;
        }

        // Calculate cost
        $costConfig = $this->getCostConfig($model);
        $costUSD = ($inputTokens * $costConfig['input'] / 1000000) +
                   ($outputTokens * $costConfig['output'] / 1000000);

        return new LLMStreamingResponse([
            'success' => true,
            'content' => $content,
            'inputTokens' => $inputTokens,
            'outputTokens' => $outputTokens,
            'costUSD' => $costUSD,
            'latencyMs' => $latencyMs,
            'provider' => 'gemini',
            'model' => $model,
            'streamed' => true,
            'ttfbMs' => $ttfb ?? $latencyMs,
            'fieldTimings' => $fieldTimings,
            'chunks' => $chunks,
        ]);
    }

    /**
     * Log context chain for debugging
     *
     * @param string $type Request type (text or vision)
     * @param string $model Model being used
     * @param array $payload Request payload
     * @param array $options Original options
     * @return void
     */
    private function logContextChain(string $type, string $model, array $payload, array $options): void
    {
        $thinking = isset($payload['generationConfig']['thinkingConfig'])
            ? ' thinking=' . ($payload['generationConfig']['thinkingConfig']['thinkingLevel'] ?? '?')
            : '';
        $maxTokens = $payload['generationConfig']['maxOutputTokens'] ?? '?';
        $temp = $payload['generationConfig']['temperature'] ?? '?';

        // Summarise input size
        $promptLen = 0;
        $hasImage = false;
        foreach ($payload['contents'] as $content) {
            foreach ($content['parts'] as $part) {
                if (isset($part['text'])) {
                    $promptLen += \strlen($part['text']);
                } elseif (isset($part['inline_data'])) {
                    $hasImage = true;
                }
            }
        }
        $inputDesc = $hasImage ? "image+{$promptLen}ch" : "{$promptLen}ch";

        \error_log("[Agent] LLM request: provider=gemini model={$model} type={$type}{$thinking} maxTokens={$maxTokens} temp={$temp} input={$inputDesc}");
    }

    /**
     * Make HTTP request to Gemini API
     *
     * @param string $url Request URL
     * @param array $payload Request payload
     * @param int $timeout Request timeout
     * @return array Response with data, httpCode, and error
     */
    private function makeRequest(string $url, array $payload, int $timeout = 30): array
    {
        $ch = \curl_init($url);
        // WIN-253: API key sent via x-goog-api-key header instead of URL query parameter
        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => \json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-goog-api-key: ' . $this->apiKey,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
        ];

        // WIN-143: SSL configuration via shared SSLConfig (cross-platform cert resolution)
        $options += SSLConfig::getCurlOptions();

        \curl_setopt_array($ch, $options);

        // WIN-227: Use curl_multi for periodic abort detection during blocking requests.
        // PROGRESSFUNCTION doesn't reliably fire during the "waiting for response" phase,
        // so curl_multi gives PHP control back every second to probe the connection.
        $mh = \curl_multi_init();
        \curl_multi_add_handle($mh, $ch);

        do {
            $status = \curl_multi_exec($mh, $active);

            if ($active) {
                // WIN-227: Abort if client cancelled (token file or connection_aborted)
                if (\headers_sent()) {
                    echo ": \n\n";
                    @\flush();
                }
                if (\connection_aborted() || isRequestCancelled()) {
                    \error_log('[Agent] LLM cancelled: provider=gemini (curl_multi loop)');
                    \curl_multi_remove_handle($mh, $ch);
                    \curl_close($ch);
                    \curl_multi_close($mh);
                    return [
                        'data' => null,
                        'httpCode' => 0,
                        'error' => 'Client disconnected',
                    ];
                }

                // Wait up to 1 second for cURL activity
                \curl_multi_select($mh, 1.0);
            }
        } while ($active && $status === CURLM_OK);

        $response = \curl_multi_getcontent($ch);
        $httpCode = \curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = \curl_error($ch);

        \curl_multi_remove_handle($mh, $ch);
        \curl_close($ch);
        \curl_multi_close($mh);

        return [
            'data' => $response ? \json_decode($response, true) : null,
            'httpCode' => $httpCode,
            'error' => $error ?: null,
        ];
    }

    /**
     * Parse successful API response
     *
     * @param array $data Response data
     * @param int $latencyMs Request latency
     * @param string $model Model used
     * @return LLMResponse
     */
    private function parseSuccessResponse(array $data, int $latencyMs, string $model): LLMResponse
    {
        $parts = $data['candidates'][0]['content']['parts'] ?? [];
        $inputTokens = $data['usageMetadata']['promptTokenCount'] ?? 0;
        $outputTokens = $data['usageMetadata']['candidatesTokenCount'] ?? 0;
        $groundingMetadata = $data['candidates'][0]['groundingMetadata'] ?? null;

        // When thinking mode is enabled, Gemini returns multiple parts:
        // - First part(s): thinking text (may be empty or contain reasoning)
        // - Last part: the actual response
        // We want the last non-empty text part, or specifically the one with JSON when json_response is set
        $content = null;
        $thinkingContent = null;

        foreach ($parts as $index => $part) {
            $text = $part['text'] ?? null;

            if ($text !== null && $text !== '') {
                // Check if this looks like JSON (starts with { or [)
                $trimmed = \ltrim($text);
                if (\str_starts_with($trimmed, '{') || \str_starts_with($trimmed, '[')) {
                    // This is likely the JSON response
                    $content = $text;
                } elseif ($content === null) {
                    // Keep track of non-JSON content (thinking or fallback)
                    $thinkingContent = $text;
                }
            }
        }

        // If no JSON found, use the last non-empty content
        if ($content === null) {
            $content = $thinkingContent;
        }

        // Validate that we got actual content
        if ($content === null || $content === '') {
            return LLMResponse::error(
                'API returned empty or invalid response',
                'invalid_response',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'gemini',
                    'model' => $model,
                ]
            );
        }

        // Calculate cost
        $costConfig = $this->getCostConfig($model);
        $costUSD = ($inputTokens * $costConfig['input'] / 1000000) +
                   ($outputTokens * $costConfig['output'] / 1000000);

        \error_log("[Agent] LLM response: provider=gemini model={$model} tokens={$inputTokens}+{$outputTokens} latency={$latencyMs}ms cost=\${$costUSD}");

        return new LLMResponse([
            'success' => true,
            'content' => $content,
            'inputTokens' => $inputTokens,
            'outputTokens' => $outputTokens,
            'costUSD' => $costUSD,
            'latencyMs' => $latencyMs,
            'provider' => 'gemini',
            'model' => $model,
            'groundingMetadata' => $groundingMetadata,
        ]);
    }

    /**
     * Handle API error response
     *
     * @param array|null $data Response data
     * @param int $httpCode HTTP status code
     * @param int $latencyMs Request latency
     * @param string $model Model used
     * @return LLMResponse
     */
    private function handleError(?array $data, int $httpCode, int $latencyMs, string $model): LLMResponse
    {
        $errorMessage = $data['error']['message'] ?? 'Unknown error';
        $errorType = $this->classifyError($httpCode, $errorMessage);

        return new LLMResponse([
            'success' => false,
            'error' => $errorMessage,
            'errorType' => $errorType,
            'latencyMs' => $latencyMs,
            'provider' => 'gemini',
            'model' => $model,
        ]);
    }

    /**
     * Classify error type from HTTP code and message
     *
     * @param int $httpCode HTTP status code
     * @param string $message Error message
     * @return string Error type
     */
    private function classifyError(int $httpCode, string $message): string
    {
        if ($httpCode === 429) return 'rate_limit';
        if ($httpCode === 503) return 'overloaded';
        if ($httpCode >= 500) return 'server_error';
        if (\stripos($message, 'timeout') !== false) return 'timeout';
        if ($httpCode === 401) return 'auth_error';
        if ($httpCode === 400) return 'invalid_request';
        return 'unknown_error';
    }

    /**
     * Get cost configuration for model
     *
     * @param string $model Model name
     * @return array Cost per million tokens [input, output]
     */
    private function getCostConfig(string $model): array
    {
        $costs = [
            'gemini-3-flash-preview' => ['input' => 0.15, 'output' => 0.60],
            'gemini-3-pro-preview' => ['input' => 1.25, 'output' => 5.00],
            'gemini-2.0-flash' => ['input' => 0.10, 'output' => 0.40],
            'gemini-1.5-flash' => ['input' => 0.075, 'output' => 0.30],
        ];
        return $costs[$model] ?? ['input' => 0.15, 'output' => 0.60];
    }

    /**
     * Check if model supports thinking configuration
     *
     * @param string $model Model name
     * @return bool True if model supports thinking levels (LOW/HIGH)
     */
    private function supportsThinking(string $model): bool
    {
        // Gemini 3 models support thinking levels (LOW/HIGH)
        return strpos($model, 'gemini-3') === 0;
    }

    /**
     * Get fallback model for when primary fails
     *
     * @param string $model Current model
     * @return string|null Fallback model or null if none available
     */
    private function getFallbackModel(string $model): ?string
    {
        // Gemini 3 fallback chain: pro -> flash. No fallback to Gemini 2.
        $fallbacks = [
            'gemini-3-pro-preview' => 'gemini-3-flash-preview',
        ];
        return $fallbacks[$model] ?? null;
    }

    /**
     * Format tools for Gemini API
     *
     * Handles both function declarations and built-in tools like google_search.
     *
     * @param array $tools Tool definitions
     * @return array Formatted tools
     */
    private function formatTools(array $tools): array
    {
        $formatted = [];
        $functionDeclarations = [];

        foreach ($tools as $tool) {
            if (is_string($tool) && $tool === 'google_search') {
                // Built-in tool format (matches geminiAPI.php pattern)
                $formatted[] = ['google_search' => new \stdClass()];
            } else {
                // Collect function declarations
                $functionDeclarations[] = $tool;
            }
        }

        // Add function declarations at the end if any exist
        if (!empty($functionDeclarations)) {
            $formatted[] = ['function_declarations' => $functionDeclarations];
        }

        return $formatted;
    }

    /**
     * {@inheritdoc}
     */
    public function supportsCapability(string $capability): bool
    {
        $modelConfig = $this->config['models'][$this->model] ?? [];
        return match ($capability) {
            'vision' => $modelConfig['supports_vision'] ?? false,
            'tools' => $modelConfig['supports_tools'] ?? false,
            'streaming' => true,
            'grounding' => $modelConfig['supports_grounding'] ?? false,
            default => false,
        };
    }

    /**
     * {@inheritdoc}
     */
    public function getName(): string
    {
        return 'gemini';
    }

    /**
     * {@inheritdoc}
     */
    public function getModel(): string
    {
        return $this->model;
    }

    /**
     * Set the model to use
     *
     * @param string $model Model name
     * @return void
     */
    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    /**
     * {@inheritdoc}
     */
    public function isHealthy(): bool
    {
        return !empty($this->apiKey);
    }
}
