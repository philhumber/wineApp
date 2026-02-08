<?php
/**
 * AI Agent Enrichment Endpoint
 *
 * Enriches wine data with grape varieties, critic scores, drink windows,
 * and style profiles via LLM web search.
 *
 * WIN-162: Added canonical name resolution with user confirmation for non-exact matches.
 *
 * POST /resources/php/agent/agentEnrich.php
 *
 * Request body:
 * {
 *   "producer": "Chateau Margaux",
 *   "wineName": "Chateau Margaux",
 *   "vintage": "2015",
 *   "wineType": "Red",          // optional
 *   "region": "Margaux",        // optional
 *   "confirmMatch": false,      // optional - confirm non-exact cache match
 *   "forceRefresh": false       // optional - skip cache, do fresh search
 * }
 *
 * Response (normal):
 * {
 *   "success": true,
 *   "message": "Enrichment completed",
 *   "data": {
 *     "success": true,
 *     "data": { ... },
 *     "source": "web_search",
 *     "warnings": [],
 *     "fieldSources": {...}
 *   }
 * }
 *
 * Response (pending confirmation - WIN-162):
 * {
 *   "success": true,
 *   "message": "Enrichment completed",
 *   "data": {
 *     "success": true,
 *     "pendingConfirmation": true,
 *     "matchType": "abbreviation",
 *     "searchedFor": {"producer": "Ch. Margaux", "wineName": "Margaux", "vintage": "2015"},
 *     "matchedTo": {"producer": "Chateau Margaux", "wineName": "Margaux", "vintage": "2015"},
 *     "confidence": 0.95,
 *     "data": null,
 *     "source": "cache"
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

// WIN-162: New parameters for canonical resolution confirmation
// Use filter_var to properly handle string "false" as boolean false
$confirmMatch = filter_var($body['confirmMatch'] ?? false, FILTER_VALIDATE_BOOLEAN);
$forceRefresh = filter_var($body['forceRefresh'] ?? false, FILTER_VALIDATE_BOOLEAN);

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $service = getAgentEnrichmentService(getAgentUserId());
    $result = $service->enrich($identification, $confirmMatch, $forceRefresh);

    agentResponse(true, 'Enrichment completed', $result->toArray());
} catch (\Exception $e) {
    agentExceptionError($e, 'agentEnrich');
}
