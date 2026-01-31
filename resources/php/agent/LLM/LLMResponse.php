<?php
/**
 * LLM Response Object
 *
 * Standardized response object for all LLM provider responses.
 * Contains success/failure status, content, token usage, and cost tracking.
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

class LLMResponse
{
    /** @var bool Whether the request was successful */
    public bool $success;

    /** @var string|null The response content */
    public ?string $content;

    /** @var string|null Error message if failed */
    public ?string $error;

    /** @var string|null Error type for categorization */
    public ?string $errorType;

    /** @var int Input token count */
    public int $inputTokens;

    /** @var int Output token count */
    public int $outputTokens;

    /** @var float Cost in USD */
    public float $costUSD;

    /** @var int Latency in milliseconds */
    public int $latencyMs;

    /** @var string Provider name (gemini, claude, openai) */
    public string $provider;

    /** @var string Model name */
    public string $model;

    /** @var array|null Tool calls if any */
    public ?array $toolCalls;

    /** @var array|null Grounding metadata from web search (internal use only) */
    public ?array $groundingMetadata;

    /** @var array Additional metadata */
    public array $metadata;

    /**
     * Create a new LLM response
     *
     * @param array $data Response data
     */
    public function __construct(array $data)
    {
        $this->success = $data['success'] ?? false;
        $this->content = $data['content'] ?? null;
        $this->error = $data['error'] ?? null;
        $this->errorType = $data['errorType'] ?? null;
        $this->inputTokens = $data['inputTokens'] ?? 0;
        $this->outputTokens = $data['outputTokens'] ?? 0;
        $this->costUSD = $data['costUSD'] ?? 0.0;
        $this->latencyMs = $data['latencyMs'] ?? 0;
        $this->provider = $data['provider'] ?? '';
        $this->model = $data['model'] ?? '';
        $this->toolCalls = $data['toolCalls'] ?? null;
        $this->groundingMetadata = $data['groundingMetadata'] ?? null;
        $this->metadata = $data['metadata'] ?? [];
    }

    /**
     * Get total token count
     *
     * @return int Total tokens (input + output)
     */
    public function getTotalTokens(): int
    {
        return $this->inputTokens + $this->outputTokens;
    }

    /**
     * Check if error is retryable
     *
     * @return bool True if the error type is retryable
     */
    public function isRetryable(): bool
    {
        return in_array($this->errorType, [
            'rate_limit',
            'timeout',
            'server_error',
            'overloaded',
            'network_error',
        ]);
    }

    /**
     * Convert to array
     *
     * @return array Response as array
     */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'content' => $this->content,
            'error' => $this->error,
            'errorType' => $this->errorType,
            'inputTokens' => $this->inputTokens,
            'outputTokens' => $this->outputTokens,
            'totalTokens' => $this->getTotalTokens(),
            'costUSD' => $this->costUSD,
            'latencyMs' => $this->latencyMs,
            'provider' => $this->provider,
            'model' => $this->model,
            'toolCalls' => $this->toolCalls,
            'groundingMetadata' => $this->groundingMetadata,
        ];
    }

    /**
     * Create a success response
     *
     * @param string $content Response content
     * @param array $data Additional data
     * @return self
     */
    public static function success(string $content, array $data = []): self
    {
        return new self(array_merge($data, [
            'success' => true,
            'content' => $content,
        ]));
    }

    /**
     * Create an error response
     *
     * @param string $error Error message
     * @param string $errorType Error type
     * @param array $data Additional data
     * @return self
     */
    public static function error(string $error, string $errorType, array $data = []): self
    {
        return new self(array_merge($data, [
            'success' => false,
            'error' => $error,
            'errorType' => $errorType,
        ]));
    }
}
