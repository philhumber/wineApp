<?php
/**
 * LLM Provider Interface
 *
 * Contract that all LLM provider adapters must implement.
 * Provides a unified interface for text completion, vision, streaming, and capabilities.
 *
 * @package Agent\LLM\Interfaces
 */

namespace Agent\LLM\Interfaces;

use Agent\LLM\LLMResponse;
use Agent\LLM\LLMStreamingResponse;

interface LLMProviderInterface
{
    /**
     * Complete a prompt with the LLM
     *
     * @param string $prompt The prompt to complete
     * @param array $options Options like max_tokens, temperature, tools
     *   - max_tokens: Maximum output tokens
     *   - temperature: Sampling temperature (0-1)
     *   - json_response: Request JSON format response
     *   - tools: Array of tool definitions
     * @return LLMResponse
     */
    public function complete(string $prompt, array $options = []): LLMResponse;

    /**
     * Complete with an image (vision capability)
     *
     * @param string $prompt Text prompt
     * @param string $imageBase64 Base64-encoded image
     * @param string $mimeType Image MIME type (image/jpeg, image/png, etc.)
     * @param array $options Additional options
     * @return LLMResponse
     */
    public function completeWithImage(
        string $prompt,
        string $imageBase64,
        string $mimeType,
        array $options = []
    ): LLMResponse;

    /**
     * Check if provider supports a capability
     *
     * @param string $capability Capability to check (vision, tools, streaming)
     * @return bool True if capability is supported
     */
    public function supportsCapability(string $capability): bool;

    /**
     * Get provider name
     *
     * @return string Provider identifier (gemini, claude, openai)
     */
    public function getName(): string;

    /**
     * Get current model name
     *
     * @return string Model identifier
     */
    public function getModel(): string;

    /**
     * Check if provider is healthy and ready
     *
     * @return bool True if provider is configured and available
     */
    public function isHealthy(): bool;

    /**
     * Stream completion with callback for field updates (WIN-181)
     *
     * Streams the LLM response and calls onChunk callback for each detected field.
     * Returns a streaming response with TTFB and field timing metadata.
     *
     * @param string $prompt The prompt to complete
     * @param array $options Options like max_tokens, temperature
     * @param callable $onChunk Callback fn(string $field, mixed $value) for field events
     * @return LLMStreamingResponse
     */
    public function streamComplete(
        string $prompt,
        array $options,
        callable $onChunk
    ): LLMStreamingResponse;

    /**
     * Stream completion with image (vision streaming) (WIN-181)
     *
     * @param string $prompt Text prompt
     * @param string $imageBase64 Base64-encoded image
     * @param string $mimeType Image MIME type
     * @param array $options Additional options
     * @param callable $onChunk Callback fn(string $field, mixed $value) for field events
     * @return LLMStreamingResponse
     */
    public function streamCompleteWithImage(
        string $prompt,
        string $imageBase64,
        string $mimeType,
        array $options,
        callable $onChunk
    ): LLMStreamingResponse;
}
