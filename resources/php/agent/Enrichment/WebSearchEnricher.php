<?php
/**
 * Web Search Enricher
 *
 * Uses LLM web search to gather wine enrichment data from
 * reputable wine sources (Wine Spectator, Robert Parker, etc.)
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

use Agent\LLM\LLMClient;
use Agent\LLM\LLMResponse;
use Agent\LLM\LLMStreamingResponse;

class WebSearchEnricher
{
    private LLMClient $llmClient;
    private array $config;

    public function __construct(LLMClient $llmClient, array $config)
    {
        $this->llmClient = $llmClient;
        $this->config = $config;
    }

    public function enrich(string $producer, string $wineName, ?string $vintage): ?EnrichmentData
    {
        $prompt = $this->buildPrompt($producer, $wineName, $vintage);

        // Use web_search option flag for Google Search grounding
        // Gemini 3 requires temperature=1.0, higher tokens for grounding output
        // Increased to 10000 to accommodate narrative content (overview, tasting, pairing)
        $options = [
            'web_search' => true,
            'temperature' => 1.0,
            'max_tokens' => 10000,
            'json_response' => true,
            'timeout' => 90,  // Web search grounding needs longer timeout
        ];

        $response = $this->llmClient->complete('enrich', $prompt, $options);

        if (!$response->success) {
            \error_log("WebSearchEnricher: LLM call failed - {$response->error}");
            return null;
        }

        return $this->parseResponse($response);
    }

    /**
     * Enrich wine data using streaming LLM response.
     * Fields are emitted via $onField callback as the LLM generates them.
     *
     * @param string $producer Producer name
     * @param string $wineName Wine name
     * @param string|null $vintage Vintage year
     * @param callable $onField Callback fn(string $field, mixed $value)
     * @return EnrichmentData|null Parsed enrichment data, or null on failure
     */
    public function enrichStreaming(
        string $producer,
        string $wineName,
        ?string $vintage,
        callable $onField,
        ?callable $onTextDelta = null
    ): ?EnrichmentData {
        $prompt = $this->buildStreamingPrompt($producer, $wineName, $vintage);

        // Tested in AI Studio: streaming + googleSearch + responseSchema + thinking
        // works on gemini-3-flash-preview with MEDIUM thinking.
        $options = [
            'web_search' => true,
            'temperature' => 1.0,
            'max_tokens' => 10000,
            'timeout' => 90,
            'model' => 'gemini-3-flash-preview',
            'thinking_level' => 'MEDIUM',
            'response_schema' => $this->getEnrichmentSchema(),
            'target_fields' => [
                'body', 'tannin', 'acidity', 'sweetness',
                'grapeVarieties', 'appellation', 'alcoholContent',
                'drinkWindow', 'criticScores',
                'productionMethod',
                'overview', 'tastingNotes', 'pairingNotes',
            ],
            'text_stream_fields' => ['overview', 'tastingNotes', 'pairingNotes', 'productionMethod'],
            'on_text_delta' => $onTextDelta,
        ];

        $response = $this->llmClient->streamComplete('enrich', $prompt, $onField, $options);

        if (!$response->success) {
            \error_log("WebSearchEnricher: Streaming LLM call failed - {$response->error}");
            return null;
        }

        return $this->parseStreamingResponse($response);
    }

    /**
     * Build a slimmed prompt for streaming enrichment.
     * Shorter than the file-based prompt for faster TTFB.
     */
    private function buildStreamingPrompt(string $producer, string $wineName, ?string $vintage): string
    {
        $v = $vintage ?? 'NV';
        return <<<PROMPT
Search for wine data: {$producer} {$wineName} {$v}

Return JSON with:
- grapeVarieties: [{grape, percentage}] from sources
- appellation: AOC/AVA classification
- alcoholContent: ABV as number
- drinkWindow: {start, end, maturity} (maturity: young/ready/peak/declining)
- criticScores: [{critic, score, year}] — WS, RP, Decanter, JS only, 100-point scale
- productionMethod: notable methods (oak aging etc)
- body/tannin/acidity/sweetness: style descriptors
- overview: 3-4 sentences on character and reputation
- tastingNotes: 3-4 sentences on aromas, palate, finish
- pairingNotes: 3-4 sentences with specific food pairings

Use null for unverified fields. Only include data from reputable sources.
PROMPT;
    }

    /**
     * Get JSON response schema for enrichment structured output.
     * Used with Gemini's response_schema for guaranteed valid JSON.
     */
    private function getEnrichmentSchema(): array
    {
        // REST API (v1beta) uses lowercase types + "nullable: true" for optional fields.
        // propertyOrdering controls field output order for streaming field detection.
        // Validated in AI Studio with gemini-3-flash-preview + googleSearch + thinking.
        return [
            'type' => 'object',
            'properties' => [
                'grapeVarieties' => [
                    'type' => 'array', 'nullable' => true,
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'grape' => ['type' => 'string'],
                            'percentage' => ['type' => 'integer', 'nullable' => true],
                        ],
                        'propertyOrdering' => ['grape', 'percentage'],
                    ],
                ],
                'appellation'      => ['type' => 'string', 'nullable' => true],
                'alcoholContent'   => ['type' => 'number', 'nullable' => true],
                'drinkWindow' => [
                    'type' => 'object', 'nullable' => true,
                    'properties' => [
                        'start' => ['type' => 'integer'],
                        'end'   => ['type' => 'integer'],
                        'maturity' => ['type' => 'string', 'nullable' => true,
                                       'enum' => ['young', 'ready', 'peak', 'declining']],
                    ],
                    'propertyOrdering' => ['start', 'end', 'maturity'],
                ],
                'criticScores' => [
                    'type' => 'array', 'nullable' => true,
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'critic' => ['type' => 'string'],
                            'score'  => ['type' => 'integer'],
                            'year'   => ['type' => 'integer', 'nullable' => true],
                        ],
                        'propertyOrdering' => ['critic', 'score', 'year'],
                    ],
                ],
                'productionMethod' => ['type' => 'string', 'nullable' => true],
                'body'             => ['type' => 'string', 'nullable' => true],
                'tannin'           => ['type' => 'string', 'nullable' => true],
                'acidity'          => ['type' => 'string', 'nullable' => true],
                'sweetness'        => ['type' => 'string', 'nullable' => true],
                'overview'         => ['type' => 'string', 'nullable' => true],
                'tastingNotes'     => ['type' => 'string', 'nullable' => true],
                'pairingNotes'     => ['type' => 'string', 'nullable' => true],
            ],
            'propertyOrdering' => [
                'body', 'tannin', 'acidity', 'sweetness',
                'grapeVarieties', 'appellation', 'alcoholContent',
                'drinkWindow', 'criticScores',
                'productionMethod',
                'overview', 'tastingNotes', 'pairingNotes',
            ],
        ];
    }

    /**
     * Parse a streaming LLM response into EnrichmentData.
     * Uses accumulated JSON from StreamingFieldDetector.
     * Sets fixed confidence since responseSchema + web_search loses grounding metadata.
     */
    private function parseStreamingResponse(LLMStreamingResponse $response): ?EnrichmentData
    {
        $content = $this->cleanAndParseJSON($response->content);
        if (!$content) {
            \error_log("WebSearchEnricher: Failed to parse JSON from streaming response");
            return null;
        }

        $data = EnrichmentData::fromArray($content);
        $data->sources = ['web_search'];

        // responseSchema + web_search combination produces empty grounding metadata,
        // so we use a fixed confidence for web-grounded streaming responses
        $data->confidence = 0.7;

        return $data;
    }

    /**
     * Get the last LLM usage for tracking
     */
    public function getLastUsage(?LLMResponse $response): ?array
    {
        if (!$response) {
            return null;
        }

        return [
            'tokens' => [
                'input' => $response->inputTokens,
                'output' => $response->outputTokens,
            ],
            'cost' => $response->costUSD,
            'latencyMs' => $response->latencyMs,
        ];
    }

    private function buildPrompt(string $producer, string $wineName, ?string $vintage): string
    {
        $promptFile = __DIR__ . '/../prompts/enrichment_search.txt';

        if (file_exists($promptFile)) {
            $template = file_get_contents($promptFile);
            return str_replace(
                ['{producer}', '{wine}', '{vintage}'],
                [$producer, $wineName, $vintage ?? 'NV'],
                $template
            );
        }

        // Fallback inline prompt if file not found
        return "Search for detailed wine information about: {$producer} {$wineName} " . ($vintage ?? 'NV') . "

Find and extract from reliable wine sources:
1. Grape varieties with percentages
2. Official appellation or AVA classification
3. Alcohol content (ABV %)
4. Recommended drink window (start year to end year)
5. Critic scores from: Wine Spectator (WS), Robert Parker/Wine Advocate (RP), Decanter, James Suckling (JS)
6. Production method notes (if notable)
7. Style profile: body, tannin level, acidity, sweetness

Return as JSON with keys: grapeVarieties, appellation, alcoholContent, drinkWindow, criticScores, productionMethod, body, tannin, acidity, sweetness.
Use null for any field you cannot verify from sources.";
    }

    private function parseResponse(LLMResponse $response): ?EnrichmentData
    {
        $content = $this->cleanAndParseJSON($response->content);
        if (!$content) {
            \error_log("WebSearchEnricher: Failed to parse JSON from response");
            return null;
        }

        $data = EnrichmentData::fromArray($content);
        $data->sources = ['web_search'];

        // Extract confidence from grounding metadata if available
        if ($response->groundingMetadata) {
            $data->confidence = $this->calculateConfidence($response->groundingMetadata);
        } else {
            $data->confidence = 0.5;  // Default for ungrounded responses
        }

        return $data;
    }

    private function cleanAndParseJSON(string $content): ?array
    {
        // Remove markdown fences
        $content = preg_replace('/^```(?:json)?\s*/m', '', $content);
        $content = preg_replace('/```\s*$/m', '', $content);

        // Strip citation markers: [1], [2], and grounding markdown links [[1](url...)]
        $content = preg_replace('/\[\[\d+\]\([^\)]*\)\]/', '', $content);
        $content = preg_replace('/\[\d+\]/', '', $content);

        $decoded = json_decode(trim($content), true);
        return is_array($decoded) ? $decoded : null;
    }

    private function calculateConfidence(?array $groundingMetadata): float
    {
        if (!$groundingMetadata) {
            return 0.5;
        }

        // Use grounding support score if available
        $support = $groundingMetadata['groundingSupport'] ?? [];
        if (!empty($support)) {
            $scores = array_column($support, 'confidenceScore');
            if (!empty($scores)) {
                return array_sum($scores) / count($scores);
            }
        }

        // Fallback: has search results = decent confidence
        $chunks = $groundingMetadata['groundingChunks'] ?? [];
        return count($chunks) > 0 ? 0.7 : 0.4;
    }
}
