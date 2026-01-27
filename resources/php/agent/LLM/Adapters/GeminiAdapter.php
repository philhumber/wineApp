<?php
/**
 * Gemini LLM Adapter
 *
 * Adapter for Google's Gemini API.
 * Implements the LLMProviderInterface for unified access.
 *
 * @package Agent\LLM\Adapters
 */

namespace Agent\LLM\Adapters;

use Agent\LLM\Interfaces\LLMProviderInterface;
use Agent\LLM\LLMResponse;

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
        $this->model = $config['default_model'] ?? 'gemini-2.0-flash';
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
                'maxOutputTokens' => $options['max_tokens'] ?? 2000,
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        // Add tools if provided
        if (!empty($options['tools'])) {
            $payload['tools'] = $this->formatTools($options['tools']);
        }

        // Add JSON response format if requested
        if ($options['json_response'] ?? false) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
        }

        $url = "{$this->baseUrl}/models/{$model}:generateContent?key={$this->apiKey}";

        $response = $this->makeRequest($url, $payload);
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
                'maxOutputTokens' => $options['max_tokens'] ?? 2000,
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        if ($options['json_response'] ?? false) {
            $payload['generationConfig']['responseMimeType'] = 'application/json';
        }

        $url = "{$this->baseUrl}/models/{$model}:generateContent?key={$this->apiKey}";

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
            return $this->handleError($response['data'], $response['httpCode'], $latencyMs, $model);
        }

        return $this->parseSuccessResponse($response['data'], $latencyMs, $model);
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
        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => \json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
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
            // TODO: Remove in production - configure curl.cainfo in php.ini instead
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
        $content = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        $inputTokens = $data['usageMetadata']['promptTokenCount'] ?? 0;
        $outputTokens = $data['usageMetadata']['candidatesTokenCount'] ?? 0;

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

        return new LLMResponse([
            'success' => true,
            'content' => $content,
            'inputTokens' => $inputTokens,
            'outputTokens' => $outputTokens,
            'costUSD' => $costUSD,
            'latencyMs' => $latencyMs,
            'provider' => 'gemini',
            'model' => $model,
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
            'gemini-2.0-flash' => ['input' => 0.10, 'output' => 0.40],
            'gemini-2.0-flash-lite' => ['input' => 0.075, 'output' => 0.30],
            'gemini-1.5-pro' => ['input' => 1.25, 'output' => 5.00],
            'gemini-1.5-flash' => ['input' => 0.075, 'output' => 0.30],
        ];
        return $costs[$model] ?? ['input' => 0.10, 'output' => 0.40];
    }

    /**
     * Format tools for Gemini API
     *
     * @param array $tools Tool definitions
     * @return array Formatted tools
     */
    private function formatTools(array $tools): array
    {
        return [['function_declarations' => $tools]];
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
