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

        // SSL configuration for Windows compatibility
        $certPath = $this->getCertPath();
        if ($certPath) {
            $options[CURLOPT_SSL_VERIFYPEER] = true;
            $options[CURLOPT_SSL_VERIFYHOST] = 2;
            $options[CURLOPT_CAINFO] = $certPath;
        } else {
            // Dev fallback: disable SSL verification if no cert found
            $options[CURLOPT_SSL_VERIFYPEER] = false;
            $options[CURLOPT_SSL_VERIFYHOST] = 0;
        }

        \curl_setopt_array($ch, $options);

        $response = \curl_exec($ch);
        $httpCode = \curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = \curl_error($ch);
        \curl_close($ch);

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
     * Get SSL certificate path for curl
     *
     * @return string|null Path to CA certificate bundle
     */
    private function getCertPath(): ?string
    {
        // Try common locations for cacert.pem
        $paths = [
            __DIR__ . '/../../../../../wineapp-config/cacert.pem',
            'C:/php/extras/ssl/cacert.pem',
            'C:/Program Files/php/extras/ssl/cacert.pem',
            \ini_get('curl.cainfo'),
            \ini_get('openssl.cafile'),
        ];

        foreach ($paths as $path) {
            if ($path && \file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * {@inheritdoc}
     */
    public function isHealthy(): bool
    {
        return !empty($this->apiKey);
    }
}
