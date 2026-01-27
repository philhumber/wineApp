<?php
/**
 * Vision Processor
 *
 * Processes image input through the LLM vision model to extract structured wine data.
 * Uses a prompt template to guide the LLM's response format.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

use Agent\LLM\LLMClient;

class VisionProcessor
{
    /** @var LLMClient LLM client */
    private LLMClient $llmClient;

    /** @var ImageQualityAssessor Quality assessor */
    private ImageQualityAssessor $qualityAssessor;

    /** @var string Prompt template */
    private string $promptTemplate;

    /**
     * Create a new vision processor
     *
     * @param LLMClient $llmClient LLM client instance
     */
    public function __construct(LLMClient $llmClient)
    {
        $this->llmClient = $llmClient;
        $this->qualityAssessor = new ImageQualityAssessor();
        $this->loadPromptTemplate();
    }

    /**
     * Load prompt template from file
     *
     * @return void
     */
    private function loadPromptTemplate(): void
    {
        $promptPath = __DIR__ . '/../prompts/vision_identify.txt';
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
You are a wine label identification expert. Analyze this wine label image and extract structured data.

Extract these fields (use null if not found or uncertain):
- producer: The winery or producer name
- wineName: The specific wine name (not the producer)
- vintage: The year (4 digits)
- region: Wine region or appellation
- country: Country of origin
- wineType: Red, White, Rosé, Sparkling, Dessert, or Fortified
- grapes: Array of grape varieties
- confidence: Your confidence in the overall identification (0-100)

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
     * Process image to extract wine data
     *
     * @param string $imageData Base64-encoded image data
     * @param string $mimeType Image MIME type
     * @param array $options Optional overrides (temperature, max_tokens, detailed_prompt)
     * @return array Processing result with success, parsed data, and usage
     */
    public function process(string $imageData, string $mimeType, array $options = []): array
    {
        // Step 1: Quality assessment
        $quality = $this->qualityAssessor->assess($imageData, $mimeType);
        if (!$quality['valid']) {
            return [
                'success' => false,
                'error' => 'Image quality check failed: ' . implode('; ', $quality['issues']),
                'errorType' => 'quality_check_failed',
                'quality' => $quality,
                'parsed' => null,
            ];
        }

        // Log quality issues as warnings but continue
        if (!empty($quality['issues'])) {
            agentLogInfo('Vision processing quality warnings', [
                'issues' => $quality['issues'],
                'score' => $quality['score'],
            ]);
        }

        // Allow using a more detailed prompt for escalation
        $prompt = $options['detailed_prompt'] ?? false
            ? $this->getDetailedPrompt()
            : $this->promptTemplate;

        // Step 2: Call LLM with vision
        $response = $this->llmClient->completeWithImage(
            'identify_image',
            $prompt,
            $imageData,
            $mimeType,
            [
                'json_response' => true,
                'temperature' => $options['temperature'] ?? 0.3,
                'max_tokens' => $options['max_tokens'] ?? 500,
            ]
        );

        if (!$response->success) {
            return [
                'success' => false,
                'error' => $response->error,
                'errorType' => $response->errorType,
                'parsed' => null,
            ];
        }

        // Step 3: Parse JSON response
        $parsed = $this->parseJsonResponse($response->content);

        if ($parsed === null) {
            return [
                'success' => false,
                'error' => 'Failed to parse LLM response as JSON',
                'parsed' => null,
                'raw' => $response->content,
            ];
        }

        // Step 4: Normalize and validate
        $parsed = $this->normalizeOutput($parsed);

        // Adjust confidence based on image quality
        if ($quality['score'] < 70) {
            $qualityPenalty = (70 - $quality['score']) / 2;
            $parsed['confidence'] = max(0, $parsed['confidence'] - $qualityPenalty);
        }

        return [
            'success' => true,
            'parsed' => $parsed,
            'tokens' => [
                'input' => $response->inputTokens,
                'output' => $response->outputTokens,
            ],
            'cost' => $response->costUSD,
            'latencyMs' => $response->latencyMs,
            'quality' => $quality,
        ];
    }

    /**
     * Get detailed prompt for escalated identification
     * More thorough instructions for difficult wine labels
     *
     * @return string Detailed prompt
     */
    private function getDetailedPrompt(): string
    {
        return <<<'PROMPT'
You are a master sommelier with expertise in wine label identification. Examine this wine label image with great care.

Use your extensive knowledge to identify this wine:
- Look closely at all text, even small or stylized fonts
- Consider the label design style to help identify the region
- For European wines, look for appellation markers (AOC, DOCG, etc.)
- For premium wines, recognize estate names and classify growths
- Examine any medallions, awards, or certifications
- Look for alcohol percentage which can indicate wine style
- Consider bottle shape if visible (Burgundy, Bordeaux, Alsace, etc.)

Extract these fields (use null only if truly uncertain after careful examination):
- producer: The full winery/producer name (expand abbreviations like Chx = Château)
- wineName: The specific wine/cuvée name if different from producer
- vintage: The year (4 digits) - look carefully, sometimes in small print
- region: The wine region or appellation (be specific)
- country: Country of origin
- wineType: Red, White, Rosé, Sparkling, Dessert, or Fortified
- grapes: Array of likely grape varieties (infer from appellation if not stated)
- confidence: Your confidence score (0-100). Be confident when label is clear.

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

    /**
     * Get the quality assessor
     *
     * @return ImageQualityAssessor
     */
    public function getQualityAssessor(): ImageQualityAssessor
    {
        return $this->qualityAssessor;
    }
}
