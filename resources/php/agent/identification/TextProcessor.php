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

class TextProcessor
{
    /** @var LLMClient LLM client */
    private LLMClient $llmClient;

    /** @var string Prompt template */
    private string $promptTemplate;

    /**
     * Create a new text processor
     *
     * @param LLMClient $llmClient LLM client instance
     */
    public function __construct(LLMClient $llmClient)
    {
        $this->llmClient = $llmClient;
        $this->loadPromptTemplate();
    }

    /**
     * Load prompt template from file
     *
     * @return void
     */
    private function loadPromptTemplate(): void
    {
        $promptPath = __DIR__ . '/../prompts/text_identify.txt';
        $this->promptTemplate = file_exists($promptPath)
            ? file_get_contents($promptPath)
            : $this->getDefaultPrompt();
    }

    /**
     * Get default prompt template
     *
     * @return string Default prompt
     */
    private function getDefaultPrompt(): string
    {
        return <<<'PROMPT'
You are a wine identification expert. Parse the following wine description and extract structured data.

Input: {input}

Extract the following fields (use null if not found or uncertain):
- producer: The winery or producer name
- wineName: The specific wine name (not the producer)
- vintage: The year (4 digits)
- region: Wine region or appellation
- country: Country of origin
- wineType: Red, White, Rosé, Sparkling, Dessert, or Fortified
- grapes: Array of grape varieties
- confidence: Your confidence in the overall identification (0-100)

Respond ONLY with valid JSON in this exact format:
{
  "producer": "string or null",
  "wineName": "string or null",
  "vintage": "string or null",
  "region": "string or null",
  "country": "string or null",
  "wineType": "string or null",
  "grapes": ["array"] or null,
  "confidence": number
}
PROMPT;
    }

    /**
     * Process text to extract wine data
     *
     * @param string $text Input text
     * @return array Processing result with success, parsed data, and usage
     */
    public function process(string $text): array
    {
        $prompt = str_replace('{input}', $text, $this->promptTemplate);

        $response = $this->llmClient->complete('identify_text', $prompt, [
            'json_response' => true,
            'temperature' => 0.3, // Lower temperature for more consistent parsing
            'max_tokens' => 500,
        ]);

        if (!$response->success) {
            return [
                'success' => false,
                'error' => $response->error,
                'errorType' => $response->errorType,
                'parsed' => null,
            ];
        }

        // Parse JSON response
        $parsed = $this->parseJsonResponse($response->content);

        if ($parsed === null) {
            return [
                'success' => false,
                'error' => 'Failed to parse LLM response as JSON',
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

    /**
     * Set custom prompt template
     *
     * @param string $template Prompt template
     * @return void
     */
    public function setPromptTemplate(string $template): void
    {
        $this->promptTemplate = $template;
    }
}
