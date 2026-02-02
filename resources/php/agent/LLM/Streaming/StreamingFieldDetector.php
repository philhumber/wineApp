<?php
/**
 * Streaming Field Detector
 *
 * Detects complete JSON fields as they stream in from the LLM.
 * Accumulates partial JSON and emits field values when they're complete.
 *
 * @package Agent\LLM\Streaming
 */

namespace Agent\LLM\Streaming;

class StreamingFieldDetector
{
    /** @var array Fields that have been fully detected */
    private array $completedFields = [];

    /** @var string Accumulated partial JSON text */
    private string $partialJson = '';

    /** @var array Fields we're looking for (in expected order) */
    // Note: confidence is NOT included here - it's emitted explicitly at the end
    // to ensure it appears last in the streaming UI
    private array $targetFields = [
        'producer',
        'wineName',
        'vintage',
        'region',
        'country',
        'wineType',
        'grapes',
    ];

    /**
     * Set custom target fields
     *
     * @param array $fields Field names to detect
     */
    public function setTargetFields(array $fields): void
    {
        $this->targetFields = $fields;
    }

    /**
     * Process a JSON text chunk, detect newly completed fields
     *
     * @param string $jsonChunk Text chunk from LLM response
     * @param callable $onField Callback fn(string $field, mixed $value)
     */
    public function processChunk(string $jsonChunk, callable $onField): void
    {
        $this->partialJson .= $jsonChunk;

        // Try to extract complete field values
        foreach ($this->targetFields as $field) {
            if (isset($this->completedFields[$field])) {
                continue; // Already detected
            }

            $value = $this->extractFieldValue($field);
            if ($value !== null) {
                $this->completedFields[$field] = $value;
                $onField($field, $value);
            }
        }
    }

    /**
     * Extract a field value from partial JSON
     *
     * Handles various JSON patterns:
     * - "field": "value"
     * - "field": 123
     * - "field": ["a", "b"]
     * - "field": null
     *
     * @param string $field Field name to extract
     * @return mixed|null Field value or null if not complete
     */
    private function extractFieldValue(string $field): mixed
    {
        // Pattern to match "field": followed by value
        // We need to detect when the value is complete

        // Look for the field
        $fieldPattern = '/"' . preg_quote($field, '/') . '"\s*:\s*/';
        if (!preg_match($fieldPattern, $this->partialJson, $matches, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        $valueStart = $matches[0][1] + strlen($matches[0][0]);
        $remaining = substr($this->partialJson, $valueStart);

        if (empty($remaining)) {
            return null;
        }

        // Determine value type and extract
        $firstChar = $remaining[0];

        switch ($firstChar) {
            case '"':
                return $this->extractStringValue($remaining);

            case '[':
                return $this->extractArrayValue($remaining);

            case '{':
                return $this->extractObjectValue($remaining);

            case 'n':
                // null
                if (str_starts_with($remaining, 'null')) {
                    // Check if null is complete (followed by , or } or whitespace)
                    if (strlen($remaining) > 4) {
                        $afterNull = $remaining[4];
                        if (in_array($afterNull, [',', '}', ' ', "\n", "\r", "\t"])) {
                            return null; // Return PHP null
                        }
                    }
                }
                return null; // Not complete

            case 't':
            case 'f':
                // boolean
                return $this->extractBooleanValue($remaining);

            default:
                // Number
                if (is_numeric($firstChar) || $firstChar === '-') {
                    return $this->extractNumberValue($remaining);
                }
                return null;
        }
    }

    /**
     * Extract a complete string value
     *
     * @param string $json JSON starting with "
     * @return string|null Extracted string or null if incomplete
     */
    private function extractStringValue(string $json): ?string
    {
        // Find the closing quote, handling escapes
        $len = strlen($json);
        $inEscape = false;

        for ($i = 1; $i < $len; $i++) {
            $char = $json[$i];

            if ($inEscape) {
                $inEscape = false;
                continue;
            }

            if ($char === '\\') {
                $inEscape = true;
                continue;
            }

            if ($char === '"') {
                // Found closing quote - extract the value
                $jsonValue = substr($json, 0, $i + 1);
                $decoded = json_decode($jsonValue);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $decoded;
                }
                return null;
            }
        }

        return null; // String not complete
    }

    /**
     * Extract a complete array value
     *
     * @param string $json JSON starting with [
     * @return array|null Extracted array or null if incomplete
     */
    private function extractArrayValue(string $json): ?array
    {
        $depth = 0;
        $inString = false;
        $inEscape = false;
        $len = strlen($json);

        for ($i = 0; $i < $len; $i++) {
            $char = $json[$i];

            if ($inEscape) {
                $inEscape = false;
                continue;
            }

            if ($char === '\\' && $inString) {
                $inEscape = true;
                continue;
            }

            if ($char === '"' && !$inEscape) {
                $inString = !$inString;
                continue;
            }

            if (!$inString) {
                if ($char === '[') {
                    $depth++;
                } elseif ($char === ']') {
                    $depth--;
                    if ($depth === 0) {
                        // Found closing bracket
                        $jsonValue = substr($json, 0, $i + 1);
                        $decoded = json_decode($jsonValue, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            return $decoded;
                        }
                        return null;
                    }
                }
            }
        }

        return null; // Array not complete
    }

    /**
     * Extract a complete object value
     *
     * @param string $json JSON starting with {
     * @return array|null Extracted object or null if incomplete
     */
    private function extractObjectValue(string $json): ?array
    {
        $depth = 0;
        $inString = false;
        $inEscape = false;
        $len = strlen($json);

        for ($i = 0; $i < $len; $i++) {
            $char = $json[$i];

            if ($inEscape) {
                $inEscape = false;
                continue;
            }

            if ($char === '\\' && $inString) {
                $inEscape = true;
                continue;
            }

            if ($char === '"' && !$inEscape) {
                $inString = !$inString;
                continue;
            }

            if (!$inString) {
                if ($char === '{') {
                    $depth++;
                } elseif ($char === '}') {
                    $depth--;
                    if ($depth === 0) {
                        // Found closing brace
                        $jsonValue = substr($json, 0, $i + 1);
                        $decoded = json_decode($jsonValue, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            return $decoded;
                        }
                        return null;
                    }
                }
            }
        }

        return null; // Object not complete
    }

    /**
     * Extract a complete number value
     *
     * @param string $json JSON starting with digit or -
     * @return int|float|null Extracted number or null if incomplete
     */
    private function extractNumberValue(string $json): int|float|null
    {
        // Match number pattern
        if (preg_match('/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/', $json, $matches)) {
            $numberStr = $matches[1];
            // Check if followed by terminator
            $afterNumber = substr($json, strlen($numberStr), 1);
            if ($afterNumber !== '' && !in_array($afterNumber, [',', '}', ']', ' ', "\n", "\r", "\t"])) {
                return null; // Number might still be streaming
            }
            return is_numeric($numberStr) ? (str_contains($numberStr, '.') ? (float)$numberStr : (int)$numberStr) : null;
        }
        return null;
    }

    /**
     * Extract a boolean value
     *
     * @param string $json JSON starting with t or f
     * @return bool|null Extracted boolean or null if incomplete
     */
    private function extractBooleanValue(string $json): ?bool
    {
        if (str_starts_with($json, 'true')) {
            if (strlen($json) > 4) {
                $afterBool = $json[4];
                if (in_array($afterBool, [',', '}', ']', ' ', "\n", "\r", "\t"])) {
                    return true;
                }
            }
        } elseif (str_starts_with($json, 'false')) {
            if (strlen($json) > 5) {
                $afterBool = $json[5];
                if (in_array($afterBool, [',', '}', ']', ' ', "\n", "\r", "\t"])) {
                    return false;
                }
            }
        }
        return null;
    }

    /**
     * Get all completed fields
     *
     * @return array Map of field => value
     */
    public function getCompletedFields(): array
    {
        return $this->completedFields;
    }

    /**
     * Check if a specific field has been detected
     *
     * @param string $field Field name
     * @return bool True if field is complete
     */
    public function hasField(string $field): bool
    {
        return isset($this->completedFields[$field]);
    }

    /**
     * Get accumulated partial JSON
     *
     * @return string Partial JSON text
     */
    public function getPartialJson(): string
    {
        return $this->partialJson;
    }

    /**
     * Try to parse the complete JSON from accumulated text
     *
     * @return array|null Parsed JSON or null if incomplete/invalid
     */
    public function tryParseComplete(): ?array
    {
        $decoded = json_decode($this->partialJson, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }
        return null;
    }

    /**
     * Reset the detector state
     */
    public function reset(): void
    {
        $this->completedFields = [];
        $this->partialJson = '';
    }
}
