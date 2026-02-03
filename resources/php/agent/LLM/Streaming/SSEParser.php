<?php
/**
 * SSE Parser
 *
 * Parses Server-Sent Events data from streaming LLM responses.
 * Handles Gemini's SSE format: data: {json}\n\n
 *
 * @package Agent\LLM\Streaming
 */

namespace Agent\LLM\Streaming;

class SSEParser
{
    /** @var string Buffer for incomplete data */
    private string $buffer = '';

    /**
     * Parse incoming SSE data, return complete JSON payloads
     *
     * Handles Gemini's streaming format where each chunk contains:
     * data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
     *
     * @param string $chunk Raw chunk data from curl
     * @return array Array of parsed JSON objects
     */
    public function parse(string $chunk): array
    {
        $this->buffer .= $chunk;
        $payloads = [];

        // Split by double newline (SSE event separator)
        $events = explode("\n\n", $this->buffer);

        // Keep the last incomplete part in buffer
        $this->buffer = array_pop($events) ?? '';

        foreach ($events as $event) {
            $event = trim($event);
            if (empty($event)) {
                continue;
            }

            // Extract data from SSE format
            $data = $this->extractData($event);
            if ($data !== null) {
                $payloads[] = $data;
            }
        }

        return $payloads;
    }

    /**
     * Extract JSON data from an SSE event block
     *
     * @param string $event SSE event block
     * @return array|null Parsed JSON or null if invalid
     */
    private function extractData(string $event): ?array
    {
        $lines = explode("\n", $event);
        $data = '';

        foreach ($lines as $line) {
            // Handle "data: {json}" format
            if (str_starts_with($line, 'data: ')) {
                $data .= substr($line, 6);
            } elseif (str_starts_with($line, 'data:')) {
                $data .= substr($line, 5);
            }
        }

        if (empty($data)) {
            return null;
        }

        // Parse JSON
        $decoded = json_decode($data, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Log but don't fail - might be partial data
            return null;
        }

        return $decoded;
    }

    /**
     * Get any remaining data in the buffer
     *
     * Call this at the end of streaming to check for incomplete data.
     *
     * @return string Remaining buffer contents
     */
    public function getBuffer(): string
    {
        return $this->buffer;
    }

    /**
     * Check if there's data remaining in the buffer
     *
     * @return bool True if buffer has content
     */
    public function hasRemaining(): bool
    {
        return !empty(trim($this->buffer));
    }

    /**
     * Flush and parse any remaining buffer content
     *
     * @return array|null Final parsed payload or null
     */
    public function flush(): ?array
    {
        if (!$this->hasRemaining()) {
            return null;
        }

        $data = $this->extractData($this->buffer);
        $this->buffer = '';

        return $data;
    }

    /**
     * Reset the parser state
     */
    public function reset(): void
    {
        $this->buffer = '';
    }
}
