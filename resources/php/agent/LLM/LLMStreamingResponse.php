<?php
/**
 * LLM Streaming Response Object
 *
 * Extended response object for streaming LLM responses.
 * Includes time-to-first-byte (TTFB), field timings, and streaming metadata.
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

class LLMStreamingResponse extends LLMResponse
{
    /** @var bool Whether the response was streamed */
    public bool $streamed;

    /** @var int Time to first byte in milliseconds */
    public int $ttfbMs;

    /** @var array Field arrival timings in ms ['producer' => 150, 'wineName' => 320] */
    public array $fieldTimings;

    /** @var array Raw chunks for debugging (optional) */
    public array $chunks;

    /**
     * Create a new streaming LLM response
     *
     * @param array $data Response data
     */
    public function __construct(array $data)
    {
        parent::__construct($data);

        $this->streamed = $data['streamed'] ?? true;
        $this->ttfbMs = $data['ttfbMs'] ?? 0;
        $this->fieldTimings = $data['fieldTimings'] ?? [];
        $this->chunks = $data['chunks'] ?? [];
    }

    /**
     * Create from an existing LLMResponse
     *
     * @param LLMResponse $response Base response
     * @param array $streamingData Streaming-specific data
     * @return self
     */
    public static function fromLLMResponse(LLMResponse $response, array $streamingData = []): self
    {
        return new self(array_merge($response->toArray(), $streamingData, [
            'streamed' => true,
        ]));
    }

    /**
     * Create a success streaming response
     *
     * @param string $content Response content
     * @param array $data Additional data including streaming metadata
     * @return self
     */
    public static function success(string $content, array $data = []): self
    {
        return new self(array_merge($data, [
            'success' => true,
            'content' => $content,
            'streamed' => true,
        ]));
    }

    /**
     * Create an error streaming response
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
            'streamed' => false,
        ]));
    }

    /**
     * Convert to array (includes streaming metadata)
     *
     * @return array Response as array
     */
    public function toArray(): array
    {
        return array_merge(parent::toArray(), [
            'streamed' => $this->streamed,
            'ttfbMs' => $this->ttfbMs,
            'fieldTimings' => $this->fieldTimings,
        ]);
    }

    /**
     * Get the time between TTFB and response completion
     *
     * @return int Streaming duration in milliseconds
     */
    public function getStreamingDuration(): int
    {
        return $this->latencyMs - $this->ttfbMs;
    }

    /**
     * Get ordered list of fields by arrival time
     *
     * @return array Field names ordered by arrival
     */
    public function getFieldOrder(): array
    {
        asort($this->fieldTimings);
        return array_keys($this->fieldTimings);
    }
}
