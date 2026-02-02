<?php
/**
 * LLM Client
 *
 * Main facade for LLM operations. Orchestrates providers, routing,
 * circuit breakers, retries, and cost tracking.
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

use Agent\LLM\Interfaces\LLMProviderInterface;
use Agent\LLM\Adapters\GeminiAdapter;
use Agent\LLM\Adapters\ClaudeAdapter;
use Agent\LLM\LLMStreamingResponse;

class LLMClient
{
    /** @var array Configuration */
    private array $config;

    /** @var \PDO Database connection */
    private \PDO $pdo;

    /** @var array<string, LLMProviderInterface> Provider instances */
    private array $providers = [];

    /** @var array<string, CircuitBreaker> Circuit breakers per provider */
    private array $circuitBreakers = [];

    /** @var CostTracker Cost tracker instance */
    private CostTracker $costTracker;

    /**
     * Create a new LLM client
     *
     * @param array $config Configuration
     * @param \PDO $pdo Database connection
     * @param int $userId User ID for tracking
     */
    public function __construct(array $config, \PDO $pdo, int $userId = 1)
    {
        $this->config = $config;
        $this->pdo = $pdo;
        $this->costTracker = new CostTracker($pdo, $userId);
        $this->initializeProviders();
    }

    /**
     * Initialize configured providers
     *
     * @return void
     */
    private function initializeProviders(): void
    {
        // Initialize Gemini (active)
        if ($this->config['providers']['gemini']['enabled'] ?? false) {
            try {
                $this->providers['gemini'] = new GeminiAdapter(
                    $this->config['providers']['gemini']
                );
                $this->circuitBreakers['gemini'] = new CircuitBreaker(
                    'gemini',
                    $this->config['circuit_breaker'],
                    $this->pdo
                );
            } catch (\Exception $e) {
                // Provider failed to initialize, will be unavailable
                error_log("Failed to initialize Gemini adapter: " . $e->getMessage());
            }
        }

        // Initialize Claude (for multi-tier escalation)
        if ($this->config['providers']['claude']['enabled'] ?? false) {
            try {
                $this->providers['claude'] = new ClaudeAdapter(
                    $this->config['providers']['claude']
                );
                $this->circuitBreakers['claude'] = new CircuitBreaker(
                    'claude',
                    $this->config['circuit_breaker'],
                    $this->pdo
                );
            } catch (\Exception $e) {
                // Provider failed to initialize, will be unavailable
                error_log("Failed to initialize Claude adapter: " . $e->getMessage());
            }
        }

        // OpenAI embedding adapter would be initialized here when enabled
    }

    /**
     * Complete a prompt for a specific task type
     *
     * @param string $taskType Task type (identify_text, enrich, pair, etc.)
     * @param string $prompt The prompt to complete
     * @param array $options Additional options
     * @return LLMResponse
     */
    public function complete(string $taskType, string $prompt, array $options = []): LLMResponse
    {
        // Check daily limits
        $limitErrors = $this->costTracker->checkLimits($this->config['limits']);
        if (!empty($limitErrors)) {
            return LLMResponse::error(
                implode('; ', $limitErrors),
                'limit_exceeded',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Get routing for task
        $routing = $this->config['task_routing'][$taskType] ?? null;
        if (!$routing) {
            return LLMResponse::error(
                "Unknown task type: {$taskType}",
                'invalid_request',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Allow provider override via options (for explicit escalation to specific providers)
        $providerName = $options['provider'] ?? $routing['primary']['provider'];
        $modelName = $options['model'] ?? $routing['primary']['model'] ?? null;

        \error_log("LLMClient: Using provider={$providerName}, model={$modelName} for task={$taskType}");

        // Try specified provider
        $response = $this->tryProvider(
            $providerName,
            $modelName,
            $prompt,
            $options
        );

        // Try fallback if primary failed and is retryable
        if (!$response->success && $response->isRetryable() && isset($routing['fallback'])) {
            $fallbackProvider = $routing['fallback']['provider'];
            $fallbackModel = $routing['fallback']['model'] ?? null;

            // Only try fallback if provider is available
            if (isset($this->providers[$fallbackProvider])) {
                $response = $this->tryProvider(
                    $fallbackProvider,
                    $fallbackModel,
                    $prompt,
                    $options
                );
            }
        }

        // Log usage
        $this->costTracker->log($response, $taskType);

        return $response;
    }

    /**
     * Try a specific provider
     *
     * @param string $providerName Provider name
     * @param string|null $model Model to use
     * @param string $prompt Prompt
     * @param array $options Options
     * @return LLMResponse
     */
    private function tryProvider(
        string $providerName,
        ?string $model,
        string $prompt,
        array $options
    ): LLMResponse {
        $provider = $this->providers[$providerName] ?? null;
        $breaker = $this->circuitBreakers[$providerName] ?? null;

        if (!$provider) {
            return LLMResponse::error(
                "Provider not available: {$providerName}",
                'provider_unavailable',
                ['provider' => $providerName, 'model' => $model ?? 'unknown']
            );
        }

        if ($breaker && !$breaker->isAvailable()) {
            return LLMResponse::error(
                "Circuit breaker open for: {$providerName}",
                'circuit_open',
                ['provider' => $providerName, 'model' => $model ?? 'unknown']
            );
        }

        // Set model if specified
        if ($model && method_exists($provider, 'setModel')) {
            $provider->setModel($model);
        }

        // Execute with retry
        $response = $this->executeWithRetry($provider, $prompt, $options);

        // Update circuit breaker
        if ($breaker) {
            if ($response->success) {
                $breaker->recordSuccess();
            } elseif ($response->isRetryable()) {
                $breaker->recordFailure();
            }
        }

        return $response;
    }

    /**
     * Execute request with retry logic
     *
     * @param LLMProviderInterface $provider Provider to use
     * @param string $prompt Prompt
     * @param array $options Options
     * @return LLMResponse
     */
    private function executeWithRetry(
        LLMProviderInterface $provider,
        string $prompt,
        array $options
    ): LLMResponse {
        $maxAttempts = $this->config['retry']['max_attempts'] ?? 3;
        $baseDelay = $this->config['retry']['base_delay_ms'] ?? 1000;
        $maxDelay = $this->config['retry']['max_delay_ms'] ?? 10000;
        $useJitter = $this->config['retry']['jitter'] ?? true;

        $lastResponse = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $response = $provider->complete($prompt, $options);

            if ($response->success || !$response->isRetryable()) {
                return $response;
            }

            $lastResponse = $response;

            if ($attempt < $maxAttempts) {
                $delay = min($baseDelay * pow(2, $attempt - 1), $maxDelay);
                if ($useJitter) {
                    $delay = $delay + random_int(0, (int)($delay * 0.1));
                }
                usleep($delay * 1000);
            }
        }

        return $lastResponse ?? LLMResponse::error(
            'Max retries exceeded',
            'retry_exhausted',
            ['provider' => $provider->getName(), 'model' => $provider->getModel()]
        );
    }

    /**
     * Complete with image (vision)
     *
     * @param string $taskType Task type
     * @param string $prompt Text prompt
     * @param string $imageBase64 Base64-encoded image
     * @param string $mimeType Image MIME type
     * @param array $options Additional options
     * @return LLMResponse
     */
    public function completeWithImage(
        string $taskType,
        string $prompt,
        string $imageBase64,
        string $mimeType,
        array $options = []
    ): LLMResponse {
        // Check daily limits
        $limitErrors = $this->costTracker->checkLimits($this->config['limits']);
        if (!empty($limitErrors)) {
            return LLMResponse::error(
                implode('; ', $limitErrors),
                'limit_exceeded',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Get routing for task
        $routing = $this->config['task_routing'][$taskType] ?? null;
        if (!$routing) {
            return LLMResponse::error(
                "Unknown task type: {$taskType}",
                'invalid_request',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Allow provider/model override via options (for explicit escalation)
        $providerName = $options['provider'] ?? $routing['primary']['provider'];
        $model = $options['model'] ?? $routing['primary']['model'] ?? null;
        $provider = $this->providers[$providerName] ?? null;

        \error_log("LLMClient: Vision using provider={$providerName}, model={$model} for task={$taskType}");

        if (!$provider) {
            return LLMResponse::error(
                "Provider not available: {$providerName}",
                'provider_unavailable',
                ['provider' => $providerName, 'model' => $model ?? 'unknown']
            );
        }

        if (!$provider->supportsCapability('vision')) {
            return LLMResponse::error(
                "Provider {$providerName} does not support vision",
                'unsupported_capability',
                ['provider' => $providerName, 'model' => $model ?? 'unknown']
            );
        }

        if ($model && method_exists($provider, 'setModel')) {
            $provider->setModel($model);
        }

        $response = $provider->completeWithImage($prompt, $imageBase64, $mimeType, $options);

        // Log usage
        $this->costTracker->log($response, $taskType);

        return $response;
    }

    /**
     * Stream a completion for a specific task type (WIN-181)
     *
     * Streams the LLM response and calls onChunk callback for each detected field.
     * No retry logic for streaming - too complex with partial data.
     *
     * @param string $taskType Task type (identify_text, identify_image, enrich)
     * @param string $prompt The prompt to complete
     * @param callable $onChunk Callback fn(string $field, mixed $value)
     * @param array $options Additional options
     * @return LLMStreamingResponse
     */
    public function streamComplete(
        string $taskType,
        string $prompt,
        callable $onChunk,
        array $options = []
    ): LLMStreamingResponse {
        // Check daily limits
        $limitErrors = $this->costTracker->checkLimits($this->config['limits']);
        if (!empty($limitErrors)) {
            return LLMStreamingResponse::error(
                implode('; ', $limitErrors),
                'limit_exceeded',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Get routing for task
        $routing = $this->config['task_routing'][$taskType] ?? null;
        if (!$routing) {
            return LLMStreamingResponse::error(
                "Unknown task type: {$taskType}",
                'invalid_request',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Allow provider override via options
        $providerName = $options['provider'] ?? $routing['primary']['provider'];
        $modelName = $options['model'] ?? $routing['primary']['model'] ?? null;

        \error_log("LLMClient: Streaming with provider={$providerName}, model={$modelName} for task={$taskType}");

        // Get provider
        $provider = $this->providers[$providerName] ?? null;
        $breaker = $this->circuitBreakers[$providerName] ?? null;

        if (!$provider) {
            return LLMStreamingResponse::error(
                "Provider not available: {$providerName}",
                'provider_unavailable',
                ['provider' => $providerName, 'model' => $modelName ?? 'unknown']
            );
        }

        if ($breaker && !$breaker->isAvailable()) {
            return LLMStreamingResponse::error(
                "Circuit breaker open for: {$providerName}",
                'circuit_open',
                ['provider' => $providerName, 'model' => $modelName ?? 'unknown']
            );
        }

        // Check streaming capability
        if (!$provider->supportsCapability('streaming')) {
            // Fall back to buffered response
            \error_log("LLMClient: Provider {$providerName} doesn't support streaming, falling back to buffered");
            return $this->fallbackToBuffered($taskType, $prompt, $onChunk, $options);
        }

        // Set model if specified
        if ($modelName && method_exists($provider, 'setModel')) {
            $provider->setModel($modelName);
        }

        // Execute streaming (no retry for streaming - too complex with partial data)
        $response = $provider->streamComplete($prompt, $options, $onChunk);

        // Update circuit breaker
        if ($breaker) {
            if ($response->success) {
                $breaker->recordSuccess();
            } elseif ($response->isRetryable()) {
                $breaker->recordFailure();
            }
        }

        // Log usage
        $this->costTracker->log($response, $taskType);

        return $response;
    }

    /**
     * Stream a completion with image (WIN-181)
     *
     * @param string $taskType Task type
     * @param string $prompt Text prompt
     * @param string $imageBase64 Base64-encoded image
     * @param string $mimeType Image MIME type
     * @param callable $onChunk Callback fn(string $field, mixed $value)
     * @param array $options Additional options
     * @return LLMStreamingResponse
     */
    public function streamCompleteWithImage(
        string $taskType,
        string $prompt,
        string $imageBase64,
        string $mimeType,
        callable $onChunk,
        array $options = []
    ): LLMStreamingResponse {
        // Check daily limits
        $limitErrors = $this->costTracker->checkLimits($this->config['limits']);
        if (!empty($limitErrors)) {
            return LLMStreamingResponse::error(
                implode('; ', $limitErrors),
                'limit_exceeded',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Get routing for task
        $routing = $this->config['task_routing'][$taskType] ?? null;
        if (!$routing) {
            return LLMStreamingResponse::error(
                "Unknown task type: {$taskType}",
                'invalid_request',
                ['provider' => 'none', 'model' => 'none']
            );
        }

        // Allow provider override via options
        $providerName = $options['provider'] ?? $routing['primary']['provider'];
        $modelName = $options['model'] ?? $routing['primary']['model'] ?? null;

        $provider = $this->providers[$providerName] ?? null;
        $breaker = $this->circuitBreakers[$providerName] ?? null;

        if (!$provider) {
            return LLMStreamingResponse::error(
                "Provider not available: {$providerName}",
                'provider_unavailable',
                ['provider' => $providerName, 'model' => $modelName ?? 'unknown']
            );
        }

        if ($breaker && !$breaker->isAvailable()) {
            return LLMStreamingResponse::error(
                "Circuit breaker open for: {$providerName}",
                'circuit_open',
                ['provider' => $providerName, 'model' => $modelName ?? 'unknown']
            );
        }

        if (!$provider->supportsCapability('vision')) {
            return LLMStreamingResponse::error(
                "Provider {$providerName} does not support vision",
                'unsupported_capability',
                ['provider' => $providerName, 'model' => $modelName ?? 'unknown']
            );
        }

        // Set model if specified
        if ($modelName && method_exists($provider, 'setModel')) {
            $provider->setModel($modelName);
        }

        // Execute streaming
        $response = $provider->streamCompleteWithImage($prompt, $imageBase64, $mimeType, $options, $onChunk);

        // Update circuit breaker
        if ($breaker) {
            if ($response->success) {
                $breaker->recordSuccess();
            } elseif ($response->isRetryable()) {
                $breaker->recordFailure();
            }
        }

        // Log usage
        $this->costTracker->log($response, $taskType);

        return $response;
    }

    /**
     * Fall back to buffered (non-streaming) response
     *
     * @param string $taskType Task type
     * @param string $prompt Prompt
     * @param callable $onChunk Chunk callback
     * @param array $options Options
     * @return LLMStreamingResponse
     */
    private function fallbackToBuffered(
        string $taskType,
        string $prompt,
        callable $onChunk,
        array $options
    ): LLMStreamingResponse {
        $response = $this->complete($taskType, $prompt, $options);

        // Emit all fields at once if successful
        if ($response->success && $response->content) {
            $parsed = \json_decode($response->content, true);
            if (\is_array($parsed)) {
                foreach ($parsed as $field => $value) {
                    $onChunk($field, $value);
                }
            }
        }

        return LLMStreamingResponse::fromLLMResponse($response, [
            'streamed' => false,
            'ttfbMs' => $response->latencyMs,
            'fieldTimings' => [],
        ]);
    }

    /**
     * Get usage statistics
     *
     * @return array Daily usage stats
     */
    public function getUsageStats(): array
    {
        return $this->costTracker->getDailyUsage();
    }

    /**
     * Get detailed usage statistics
     *
     * @param int $days Number of days
     * @return array Detailed stats
     */
    public function getDetailedStats(int $days = 7): array
    {
        return $this->costTracker->getDetailedStats($days);
    }

    /**
     * Get circuit breaker status for all providers
     *
     * @return array Circuit breaker info
     */
    public function getCircuitBreakerStatus(): array
    {
        $status = [];
        foreach ($this->circuitBreakers as $name => $breaker) {
            $status[$name] = $breaker->getInfo();
        }
        return $status;
    }

    /**
     * Get available providers
     *
     * @return array Provider names
     */
    public function getAvailableProviders(): array
    {
        return array_keys($this->providers);
    }

    /**
     * Check if a provider is available
     *
     * @param string $providerName Provider name
     * @return bool
     */
    public function isProviderAvailable(string $providerName): bool
    {
        $provider = $this->providers[$providerName] ?? null;
        $breaker = $this->circuitBreakers[$providerName] ?? null;

        if (!$provider || !$provider->isHealthy()) {
            return false;
        }

        if ($breaker && !$breaker->isAvailable()) {
            return false;
        }

        return true;
    }

    /**
     * Set session ID for tracking
     *
     * @param int|null $sessionId Session ID
     * @return void
     */
    public function setSessionId(?int $sessionId): void
    {
        $this->costTracker->setSessionId($sessionId);
    }
}
