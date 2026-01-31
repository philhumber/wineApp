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
}
