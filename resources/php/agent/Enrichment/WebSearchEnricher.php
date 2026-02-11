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
     * Enrich wine with streaming — fields emitted as the LLM generates them.
     *
     * @param string $producer Producer name
     * @param string $wineName Wine name
     * @param string|null $vintage Vintage year
     * @param callable $onField fn(string $field, mixed $value)
     * @return EnrichmentData|null
     */
    public function enrichStreaming(
        string $producer,
        string $wineName,
        ?string $vintage,
        callable $onField
    ): ?EnrichmentData {
        $prompt = $this->buildStreamingPrompt($producer, $wineName, $vintage);

        $options = [
            'web_search' => true,
            'temperature' => 1.0,
            'max_tokens' => 10000,
            'json_response' => true,
            'timeout' => 90,
            'response_schema' => $this->getEnrichmentSchema(),
            'target_fields' => [
                'body', 'tannin', 'acidity', 'sweetness',         // Style fields (small, fast)
                'grapeVarieties', 'alcoholContent',                 // Structured data
                'drinkWindow', 'criticScores',                      // Complex objects
                'productionMethod', 'appellation',
                'overview', 'tastingNotes', 'pairingNotes',        // Narrative (last, longest)
            ],
        ];

        $response = $this->llmClient->streamComplete('enrich', $prompt, $onField, $options);

        if (!$response->success) {
            \error_log("WebSearchEnricher: Streaming LLM call failed - {$response->error}");
            return null;
        }

        return $this->parseStreamingResponse($response);
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

        // Strip citation markers [1], [2], etc.
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

    /**
     * Build a slim prompt for streaming enrichment.
     * ~500 chars vs ~1400 chars in the file-based prompt — fewer input tokens for faster TTFB.
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
     * Response schema for Gemini structured output.
     * Guarantees valid JSON without relying on prompt instructions.
     */
    private function getEnrichmentSchema(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'grapeVarieties' => [
                    'type' => 'ARRAY', 'nullable' => true,
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'grape' => ['type' => 'STRING'],
                            'percentage' => ['type' => 'INTEGER', 'nullable' => true],
                        ],
                    ],
                ],
                'appellation'      => ['type' => 'STRING', 'nullable' => true],
                'alcoholContent'   => ['type' => 'NUMBER', 'nullable' => true],
                'drinkWindow' => [
                    'type' => 'OBJECT', 'nullable' => true,
                    'properties' => [
                        'start' => ['type' => 'INTEGER'],
                        'end'   => ['type' => 'INTEGER'],
                        'maturity' => ['type' => 'STRING', 'nullable' => true,
                                       'enum' => ['young', 'ready', 'peak', 'declining']],
                    ],
                ],
                'criticScores' => [
                    'type' => 'ARRAY', 'nullable' => true,
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'critic' => ['type' => 'STRING'],
                            'score'  => ['type' => 'INTEGER'],
                            'year'   => ['type' => 'INTEGER', 'nullable' => true],
                        ],
                    ],
                ],
                'productionMethod' => ['type' => 'STRING', 'nullable' => true],
                'body'             => ['type' => 'STRING', 'nullable' => true],
                'tannin'           => ['type' => 'STRING', 'nullable' => true],
                'acidity'          => ['type' => 'STRING', 'nullable' => true],
                'sweetness'        => ['type' => 'STRING', 'nullable' => true],
                'overview'         => ['type' => 'STRING', 'nullable' => true],
                'tastingNotes'     => ['type' => 'STRING', 'nullable' => true],
                'pairingNotes'     => ['type' => 'STRING', 'nullable' => true],
            ],
        ];
    }

    /**
     * Parse streaming response into EnrichmentData.
     * Streaming responses don't include grounding metadata, so default confidence.
     */
    private function parseStreamingResponse(LLMStreamingResponse $response): ?EnrichmentData
    {
        $content = $this->cleanAndParseJSON($response->content);
        if (!$content) {
            \error_log("WebSearchEnricher: Failed to parse streaming response JSON");
            return null;
        }

        $data = EnrichmentData::fromArray($content);
        $data->sources = ['web_search'];

        // Streaming responses don't carry grounding metadata per-chunk,
        // so use a reasonable default for web_search results
        $data->confidence = 0.6;

        return $data;
    }
}
