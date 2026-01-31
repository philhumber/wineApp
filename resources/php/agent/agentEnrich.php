<?php
/**
 * AI Agent Enrichment Endpoint
 *
 * Enriches wine data with grape varieties, critic scores, drink windows,
 * and style profiles via LLM web search.
 *
 * POST /resources/php/agent/agentEnrich.php
 *
 * Request body:
 * {
 *   "producer": "Chateau Margaux",
 *   "wineName": "Chateau Margaux",
 *   "vintage": "2015",
 *   "wineType": "Red",     // optional
 *   "region": "Margaux"    // optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Enrichment completed",
 *   "data": {
 *     "success": true,
 *     "data": {
 *       "grapeVarieties": [...],
 *       "appellation": "Margaux AOC",
 *       "alcoholContent": 13.5,
 *       "drinkWindow": {"start": 2025, "end": 2055, "maturity": "young"},
 *       "criticScores": [...],
 *       ...
 *     },
 *     "source": "web_search",
 *     "warnings": [],
 *     "fieldSources": {...}
 *   }
 * }
 *
 * @package Agent
 */

require_once __DIR__ . '/_bootstrap.php';

agentRequireMethod('POST');
$body = agentGetJsonBody();
agentRequireFields($body, ['producer', 'wineName']);

$identification = [
    'parsed' => [
        'producer' => $body['producer'],
        'wineName' => $body['wineName'],
        'vintage' => $body['vintage'] ?? null,
        'wineType' => $body['wineType'] ?? null,
        'region' => $body['region'] ?? null,
    ]
];

try {
    $service = getAgentEnrichmentService($body['userId'] ?? 1);
    $result = $service->enrich($identification);

    agentResponse(true, 'Enrichment completed', $result->toArray());
} catch (\Exception $e) {
    agentLogError('Enrichment failed', ['error' => $e->getMessage()]);
    agentResponse(false, 'Enrichment failed: ' . $e->getMessage());
}
