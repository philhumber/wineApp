<?php
/**
 * Claude LLM Adapter
 *
 * Adapter for Anthropic's Claude API.
 * Implements the LLMProviderInterface for unified access.
 * Supports both text completion and vision (image) requests.
 *
 * @package Agent\LLM\Adapters
 */

namespace Agent\LLM\Adapters;

use Agent\LLM\Interfaces\LLMProviderInterface;
use Agent\LLM\LLMResponse;
use Agent\LLM\LLMStreamingResponse;
use Agent\LLM\SSLConfig;

class ClaudeAdapter implements LLMProviderInterface
{
    /** @var string API key */
    private string $apiKey;

    /** @var string Current model */
    private string $model;

    /** @var string Base URL for API */
    private string $baseUrl;

    /** @var array Provider configuration */
    private array $config;

    /** @var string API version header */
    private const API_VERSION = '2023-06-01';

    /**
     * Create a new Claude adapter
     *
     * @param array $config Provider configuration
     */
    public function __construct(array $config)
    {
        $this->config = $config;
        $this->apiKey = $this->loadApiKey();
        $this->model = $config['default_model'] ?? 'claude-sonnet-4-5-20250929';
        $this->baseUrl = $config['base_url'] ?? 'https://api.anthropic.com/v1';
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

        if (!\defined('ANTHROPIC_API_KEY')) {
            throw new \RuntimeException('ANTHROPIC_API_KEY not configured');
        }

        return ANTHROPIC_API_KEY;
    }

    /**
     * {@inheritdoc}
     */
    public function complete(string $prompt, array $options = []): LLMResponse
    {
        $startTime = \microtime(true);
        $model = $options['model'] ?? $this->model;

        $payload = [
            'model' => $model,
            'max_tokens' => $options['max_tokens'] ?? 2000,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ],
        ];

        // Add temperature if specified
        if (isset($options['temperature'])) {
            $payload['temperature'] = $options['temperature'];
        }

        // Add system prompt if provided
        if (!empty($options['system'])) {
            $payload['system'] = $options['system'];
        }

        // Debug: Log context chain before LLM call
        $this->logContextChain('text', $model, $payload, $options);

        $response = $this->makeRequest('/messages', $payload);
        $latencyMs = (int)((\microtime(true) - $startTime) * 1000);

        if ($response['error']) {
            return LLMResponse::error(
                $response['error'],
                'network_error',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'claude',
                    'model' => $model,
                ]
            );
        }

        if ($response['httpCode'] !== 200) {
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
            'model' => $model,
            'max_tokens' => $options['max_tokens'] ?? 2000,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'image',
                            'source' => [
                                'type' => 'base64',
                                'media_type' => $mimeType,
                                'data' => $imageBase64,
                            ]
                        ],
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ]
                    ]
                ]
            ],
        ];

        // Add temperature if specified
        if (isset($options['temperature'])) {
            $payload['temperature'] = $options['temperature'];
        }

        // Add system prompt if provided
        if (!empty($options['system'])) {
            $payload['system'] = $options['system'];
        }

        // Debug: Log context chain before LLM call
        $this->logContextChain('vision', $model, $payload, $options);

        $response = $this->makeRequest('/messages', $payload, $this->config['timeout'] ?? 60);
        $latencyMs = (int)((\microtime(true) - $startTime) * 1000);

        if ($response['error']) {
            return LLMResponse::error(
                $response['error'],
                'network_error',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'claude',
                    'model' => $model,
                ]
            );
        }

        if ($response['httpCode'] !== 200) {
            return $this->handleError($response['data'], $response['httpCode'], $latencyMs, $model);
        }

        return $this->parseSuccessResponse($response['data'], $latencyMs, $model);
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
        $maxTokens = $payload['max_tokens'] ?? '?';
        $temp = $options['temperature'] ?? 'default';
        $hasSystem = !empty($payload['system']) ? ' system=' . \strlen($payload['system']) . 'ch' : '';

        // Summarise input size
        $promptLen = 0;
        $hasImage = false;
        foreach ($payload['messages'] as $message) {
            if (\is_string($message['content'])) {
                $promptLen += \strlen($message['content']);
            } elseif (\is_array($message['content'])) {
                foreach ($message['content'] as $part) {
                    if (($part['type'] ?? '') === 'text') {
                        $promptLen += \strlen($part['text'] ?? '');
                    } elseif (($part['type'] ?? '') === 'image') {
                        $hasImage = true;
                    }
                }
            }
        }
        $inputDesc = $hasImage ? "image+{$promptLen}ch" : "{$promptLen}ch";

        \error_log("[Agent] LLM request: provider=claude model={$model} type={$type}{$hasSystem} maxTokens={$maxTokens} temp={$temp} input={$inputDesc}");
    }

    /**
     * Make HTTP request to Claude API
     *
     * @param string $endpoint API endpoint
     * @param array $payload Request payload
     * @param int $timeout Request timeout
     * @return array Response with data, httpCode, and error
     */
    private function makeRequest(string $endpoint, array $payload, int $timeout = 30): array
    {
        $url = $this->baseUrl . $endpoint;
        $ch = \curl_init($url);

        $headers = [
            'Content-Type: application/json',
            'X-Api-Key: ' . $this->apiKey,
            'anthropic-version: ' . self::API_VERSION,
        ];

        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => \json_encode($payload),
            CURLOPT_HTTPHEADER => $headers,
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
                    \error_log('[Agent] LLM cancelled: provider=claude (curl_multi loop)');
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
        // Claude returns content as an array of content blocks
        $content = $this->extractContent($data);
        $inputTokens = $data['usage']['input_tokens'] ?? 0;
        $outputTokens = $data['usage']['output_tokens'] ?? 0;

        // Validate that we got actual content
        if ($content === null || $content === '') {
            return LLMResponse::error(
                'API returned empty or invalid response',
                'invalid_response',
                [
                    'latencyMs' => $latencyMs,
                    'provider' => 'claude',
                    'model' => $model,
                ]
            );
        }

        // Calculate cost
        $costConfig = $this->getCostConfig($model);
        $costUSD = ($inputTokens * $costConfig['input'] / 1000000) +
                   ($outputTokens * $costConfig['output'] / 1000000);

        \error_log("[Agent] LLM response: provider=claude model={$model} tokens={$inputTokens}+{$outputTokens} latency={$latencyMs}ms cost=\${$costUSD}");

        return new LLMResponse([
            'success' => true,
            'content' => $content,
            'inputTokens' => $inputTokens,
            'outputTokens' => $outputTokens,
            'costUSD' => $costUSD,
            'latencyMs' => $latencyMs,
            'provider' => 'claude',
            'model' => $model,
        ]);
    }

    /**
     * Extract text content from Claude response
     *
     * @param array $data Response data
     * @return string|null Extracted text content
     */
    private function extractContent(array $data): ?string
    {
        if (!isset($data['content']) || !is_array($data['content'])) {
            return null;
        }

        // Claude returns content blocks, find the text block
        foreach ($data['content'] as $block) {
            if (isset($block['type']) && $block['type'] === 'text') {
                return $block['text'] ?? null;
            }
        }

        return null;
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
            'provider' => 'claude',
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
        if ($httpCode === 529) return 'overloaded';
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
            'claude-sonnet-4-5-20250929' => ['input' => 3.00, 'output' => 15.00],
            'claude-opus-4-5-20251101' => ['input' => 5.00, 'output' => 25.00],
            'claude-haiku-4-20250514' => ['input' => 0.80, 'output' => 4.00],
        ];
        return $costs[$model] ?? ['input' => 3.00, 'output' => 15.00];
    }

    /**
     * {@inheritdoc}
     */
    public function supportsCapability(string $capability): bool
    {
        $modelConfig = $this->config['models'][$this->model] ?? [];
        return match ($capability) {
            'vision' => $modelConfig['supports_vision'] ?? true,
            'tools' => $modelConfig['supports_tools'] ?? true,
            'streaming' => true,
            default => false,
        };
    }

    /**
     * {@inheritdoc}
     */
    public function getName(): string
    {
        return 'claude';
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

    /**
     * Stream completion with callback (WIN-181)
     *
     * Note: Claude streaming support is planned for future implementation.
     * Currently falls back to non-streaming with all fields emitted at once.
     *
     * {@inheritdoc}
     */
    public function streamComplete(
        string $prompt,
        array $options,
        callable $onChunk
    ): LLMStreamingResponse {
        // Fall back to non-streaming
        $response = $this->complete($prompt, $options);

        // Emit the complete result as one chunk if successful
        if ($response->success && $response->content) {
            $parsed = \json_decode($response->content, true);
            if (\is_array($parsed)) {
                foreach ($parsed as $field => $value) {
                    $onChunk($field, $value);
                }
            }
        }

        return LLMStreamingResponse::fromLLMResponse($response, [
            'streamed' => false, // Actually buffered
            'ttfbMs' => $response->latencyMs,
            'fieldTimings' => [],
        ]);
    }

    /**
     * Stream completion with image (WIN-181)
     *
     * Note: Claude streaming support is planned for future implementation.
     * Currently falls back to non-streaming with all fields emitted at once.
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
        // Fall back to non-streaming
        $response = $this->completeWithImage($prompt, $imageBase64, $mimeType, $options);

        // Emit the complete result as one chunk if successful
        if ($response->success && $response->content) {
            $parsed = \json_decode($response->content, true);
            if (\is_array($parsed)) {
                foreach ($parsed as $field => $value) {
                    $onChunk($field, $value);
                }
            }
        }

        return LLMStreamingResponse::fromLLMResponse($response, [
            'streamed' => false, // Actually buffered
            'ttfbMs' => $response->latencyMs,
            'fieldTimings' => [],
        ]);
    }
}
