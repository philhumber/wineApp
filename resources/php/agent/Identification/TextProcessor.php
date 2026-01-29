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
     * @param array $options Optional overrides (temperature, max_tokens, detailed_prompt)
     * @return array Processing result with success, parsed data, and usage
     */
    public function process(string $text, array $options = []): array
    {
        // Allow using a more detailed prompt for escalation
        $template = $options['detailed_prompt'] ?? false
            ? $this->getDetailedPrompt()
            : $this->promptTemplate;

        $prompt = str_replace('{input}', $text, $template);

        // Append supplementary context from user if provided
        if (!empty($options['supplementary_text'])) {
            $parser = new InferenceEngine(null); // No DB needed for parse()
            $contextResult = $parser->parse($options['supplementary_text']);
            if (!empty($contextResult['promptSnippet'])) {
                $prompt .= "\n\n" . $contextResult['promptSnippet'];
            } else {
                // Fallback: append raw text if parser found no structured constraints
                $prompt .= "\n\nUSER CONTEXT: " . $options['supplementary_text'];
            }
        }

        // Append prior context for escalation attempts
        if (!empty($options['prior_context'])) {
            $prompt .= "\n\n" . $options['prior_context'];
        }

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
     * Get detailed prompt for escalated identification
     * More thorough instructions for difficult wines
     *
     * @return string Detailed prompt
     */
    private function getDetailedPrompt(): string
    {
        return <<<'PROMPT'
You are a master sommelier with expertise in wine identification. Analyze the following wine description thoroughly.

Input: {input}

Use your extensive knowledge to identify this wine. Consider:
- If the input is abbreviated, expand it (e.g., "Chx" = Château, "Dom" = Domaine)
- If the region is implied, deduce it from the wine name or producer
- For First Growth Bordeaux or prestigious estates, recognize them by name alone
- For New World wines, consider typical regional grape varieties
- For European wines, consider appellation rules to deduce grape varieties

CRITICAL - Confidence Scoring Rules:
- HIGH confidence (80-100): ONLY for wines you actually RECOGNIZE as real, existing wines
- MEDIUM confidence (50-79): You recognize the producer but not the specific wine, or input is ambiguous
- LOW confidence (0-49): The producer/wine is NOT a real wine you recognize

Do NOT give high confidence just because you can fill in fields with plausible regional data.
If the producer name doesn't match a real winery you know, confidence must be LOW (<50).
The wine must actually EXIST for high confidence - pattern matching alone is not enough.

Extract these fields (use null if the wine is not recognized):
- producer: The full winery/producer name (only if it's a REAL producer you recognize)
- wineName: The specific wine/cuvée name if different from producer
- vintage: The year (4 digits)
- region: The wine region or appellation (be specific - e.g., "Margaux" not just "Bordeaux")
- country: Country of origin
- wineType: Red, White, Rosé, Sparkling, Dessert, or Fortified
- grapes: Array of likely grape varieties (can infer from region/style if not stated)
- confidence: Your confidence score (0-100) that this is a REAL, IDENTIFIABLE wine

Respond ONLY with valid JSON:
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

        // For single-wine estates, wineName should equal producer
        // Only copy producer to wineName if this looks like a complete wine identification:
        // - Has vintage (specific wine year mentioned), OR
        // - LLM explicitly set wineName to same as producer
        // Do NOT copy for producer-only searches like "Burgundy from Domaine Leroy"
        $hasVintage = !empty($normalized['vintage']);
        $hasWineType = !empty($normalized['wineType']);

        if ($normalized['wineName'] === null && $normalized['producer'] !== null) {
            // Only treat producer as wine name if we have vintage (indicates specific wine)
            // Producers like Domaine Leroy make many wines, so don't assume producer = wine
            if ($hasVintage) {
                $normalized['wineName'] = $normalized['producer'];
            }
        }

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
