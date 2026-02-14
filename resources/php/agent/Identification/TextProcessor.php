<?php
/**
 * Text Processor
 *
 * Processes text input through the LLM to extract structured wine data.
 * Uses a prompt template to guide the LLM's response format.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

use Agent\LLM\LLMClient;

require_once __DIR__ . '/../prompts/prompts.php';

class TextProcessor
{
    /** @var LLMClient LLM client */
    private LLMClient $llmClient;

    /**
     * Create a new text processor
     *
     * @param LLMClient $llmClient LLM client instance
     */
    public function __construct(LLMClient $llmClient)
    {
        $this->llmClient = $llmClient;
    }

    /**
     * Process text to extract wine data
     *
     * @param string $text Input text
     * @param array $options Optional overrides (temperature, max_tokens, detailed_prompt)
     * @return array Processing result with success, parsed data, and usage
     */
    public function process(string $text, array $options = []): array
    {
        // Allow using a more detailed prompt for escalation
        $prompt = $options['detailed_prompt'] ?? false
            ? \Prompts::textIdentifyDetailed($text)
            : \Prompts::textIdentify($text);

        $promptType = $options['detailed_prompt'] ?? false ? 'DETAILED' : 'STANDARD';

        // Debug: Log prompt construction
        error_log("╔══════════════════════════════════════════════════════════════════");
        error_log("║ 🔧 TEXT PROCESSOR - PROMPT CONSTRUCTION");
        error_log("╠══════════════════════════════════════════════════════════════════");
        error_log("║ Input Text: " . substr($text, 0, 200) . (strlen($text) > 200 ? '...' : ''));
        error_log("║ Prompt Type: {$promptType}");

        // Append supplementary context from user if provided
        if (!empty($options['supplementary_text'])) {
            $parser = new InferenceEngine(null); // No DB needed for parse()
            $contextResult = $parser->parse($options['supplementary_text']);
            if (!empty($contextResult['promptSnippet'])) {
                $prompt .= "\n\n" . $contextResult['promptSnippet'];
                error_log("║ + Supplementary (parsed): " . substr($contextResult['promptSnippet'], 0, 150));
            } else {
                // Fallback: append raw text if parser found no structured constraints
                $prompt .= "\n\nUSER CONTEXT: " . $options['supplementary_text'];
                error_log("║ + Supplementary (raw): " . substr($options['supplementary_text'], 0, 150));
            }
        }

        // Append prior context for escalation attempts
        if (!empty($options['prior_context'])) {
            $prompt .= "\n\n" . $options['prior_context'];
            error_log("║ + Prior Context: " . substr($options['prior_context'], 0, 150));
        }

        error_log("║ Provider: " . ($options['provider'] ?? 'default'));
        error_log("║ Model: " . ($options['model'] ?? 'default'));
        error_log("║ Final Prompt Length: " . strlen($prompt) . " chars");
        error_log("╚══════════════════════════════════════════════════════════════════");

        // Build LLM options
        $llmOptions = [
            'json_response' => true,
            'temperature' => $options['temperature'] ?? 0.3,
            'max_tokens' => $options['max_tokens'] ?? 1000,
        ];

        // Pass through provider/model for explicit tier selection
        if (!empty($options['provider'])) {
            $llmOptions['provider'] = $options['provider'];
        }
        if (!empty($options['model'])) {
            $llmOptions['model'] = $options['model'];
        }

        // Pass through thinking_level for Gemini 3 models
        if (!empty($options['thinking_level'])) {
            $llmOptions['thinking_level'] = $options['thinking_level'];
        }

        $response = $this->llmClient->complete('identify_text', $prompt, $llmOptions);

        if (!$response->success) {
            return [
                'success' => false,
                'error' => $response->error,
                'errorType' => $response->errorType,
                'parsed' => null,
            ];
        }

        // Debug log the raw response
        error_log('TextProcessor: Raw LLM response: ' . substr($response->content ?? 'null', 0, 500));

        // Parse JSON response
        $parsed = $this->parseJsonResponse($response->content);

        if ($parsed === null) {
            error_log('TextProcessor: JSON parse failed. Full response: ' . $response->content);
            return [
                'success' => false,
                'error' => 'Failed to parse LLM response as JSON',
                'errorType' => 'json_parse_error',
                'parsed' => null,
                'raw' => $response->content,
            ];
        }

        // Normalize and validate
        $parsed = $this->normalizeOutput($parsed);

        return [
            'success' => true,
            'parsed' => $parsed,
            'tokens' => [
                'input' => $response->inputTokens,
                'output' => $response->outputTokens,
            ],
            'cost' => $response->costUSD,
            'latencyMs' => $response->latencyMs,
        ];
    }

    /**
     * Parse JSON response from LLM
     *
     * @param string|null $content Response content
     * @return array|null Parsed data or null if parsing fails
     */
    private function parseJsonResponse(?string $content): ?array
    {
        if (empty($content)) {
            return null;
        }

        // Try direct JSON parse
        $parsed = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
            return $parsed;
        }

        // Try to extract JSON from markdown code blocks
        if (preg_match('/```(?:json)?\s*([\s\S]*?)\s*```/', $content, $matches)) {
            $parsed = json_decode($matches[1], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
                return $parsed;
            }
        }

        // Try to extract JSON object from response
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $parsed = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
                return $parsed;
            }
        }

        return null;
    }

    /**
     * Normalize output data
     *
     * @param array $data Raw parsed data
     * @return array Normalized data
     */
    private function normalizeOutput(array $data): array
    {
        // Ensure all expected fields exist
        $defaults = [
            'producer' => null,
            'wineName' => null,
            'vintage' => null,
            'region' => null,
            'country' => null,
            'wineType' => null,
            'grapes' => null,
            'confidence' => 0,
        ];

        $normalized = array_merge($defaults, $data);

        // Normalize producer - trim whitespace
        if ($normalized['producer']) {
            $normalized['producer'] = trim($normalized['producer']);
        }

        // Normalize wine name
        if ($normalized['wineName']) {
            $normalized['wineName'] = trim($normalized['wineName']);
        }

        // Normalize vintage - extract 4-digit year
        if ($normalized['vintage']) {
            if (preg_match('/(19|20)\d{2}/', (string)$normalized['vintage'], $matches)) {
                $normalized['vintage'] = $matches[0];
            }
        }

        // Normalize region
        if ($normalized['region']) {
            $normalized['region'] = trim($normalized['region']);
        }

        // Normalize country
        if ($normalized['country']) {
            $normalized['country'] = $this->normalizeCountry($normalized['country']);
        }

        // Normalize wineType
        if ($normalized['wineType']) {
            $normalized['wineType'] = $this->normalizeWineType($normalized['wineType']);
        }

        // Normalize grapes - ensure array
        if ($normalized['grapes'] && !is_array($normalized['grapes'])) {
            $normalized['grapes'] = [$normalized['grapes']];
        }
        if (is_array($normalized['grapes'])) {
            $normalized['grapes'] = array_map('trim', $normalized['grapes']);
            $normalized['grapes'] = array_filter($normalized['grapes']); // Remove empty values
            $normalized['grapes'] = array_values($normalized['grapes']); // Re-index
        }

        // Ensure confidence is numeric and in range
        $normalized['confidence'] = max(0, min(100, (int)($normalized['confidence'] ?? 0)));

        // NOTE: We no longer auto-fill wineName with producer.
        // The frontend now handles missing wine names by prompting the user
        // with options like "No Specific Name" or letting them type it in.
        // This gives the user explicit control rather than assuming producer = wine.

        return $normalized;
    }

    /**
     * Normalize wine type to standard values
     *
     * @param string|null $type Raw wine type
     * @return string|null Normalized wine type
     */
    private function normalizeWineType(?string $type): ?string
    {
        if (!$type) return null;

        $typeMap = [
            'red' => 'Red',
            'white' => 'White',
            'rose' => 'Rosé',
            'rosé' => 'Rosé',
            'pink' => 'Rosé',
            'sparkling' => 'Sparkling',
            'champagne' => 'Sparkling',
            'prosecco' => 'Sparkling',
            'cava' => 'Sparkling',
            'dessert' => 'Dessert',
            'sweet' => 'Dessert',
            'fortified' => 'Fortified',
            'port' => 'Fortified',
            'sherry' => 'Fortified',
            'madeira' => 'Fortified',
        ];

        $lower = strtolower(trim($type));
        return $typeMap[$lower] ?? ucfirst($type);
    }

    /**
     * Normalize country name
     *
     * @param string|null $country Raw country name
     * @return string|null Normalized country name
     */
    private function normalizeCountry(?string $country): ?string
    {
        if (!$country) return null;

        $countryMap = [
            'usa' => 'USA',
            'united states' => 'USA',
            'us' => 'USA',
            'america' => 'USA',
            'uk' => 'United Kingdom',
            'england' => 'United Kingdom',
            'nz' => 'New Zealand',
        ];

        $lower = strtolower(trim($country));
        return $countryMap[$lower] ?? ucwords(strtolower(trim($country)));
    }

}
