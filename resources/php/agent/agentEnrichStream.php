<?php
/**
 * AI Agent Enrichment Streaming Endpoint (WIN-181)
 *
 * Streams wine enrichment data (grapes, critics, drink window) via SSE.
 *
 * POST /resources/php/agent/agentEnrichStream.php
 *
 * Request body:
 * {
 *   "producer": "Chateau Margaux",
 *   "wineName": "Chateau Margaux",
 *   "vintage": "2015",
 *   "wineType": "Red",
 *   "region": "Margaux"
 * }
 *
 * Response (SSE stream):
 *   event: field
 *   data: {"field": "grapes", "value": ["Cabernet Sauvignon", "Merlot"]}
 *
 *   event: field
 *   data: {"field": "drinkWindow", "value": {"start": 2025, "end": 2055}}
 *
 *   event: result
 *   data: {complete enrichment result}
 *
 *   event: done
 *   data: {}
 *
 * @package Agent
 */

require_once __DIR__ . '/_bootstrap.php';

agentRequireMethod('POST');
$body = agentGetJsonBody();
agentRequireFields($body, ['producer', 'wineName']);

// Check if streaming is enabled - fallback to non-streaming endpoint
$config = getAgentConfig();
if (!($config['streaming']['enabled'] ?? false)) {
    require __DIR__ . '/agentEnrich.php';
    exit;
}

// Initialize SSE
initSSE();
registerCancelCleanup();

$identification = [
    'parsed' => [
        'producer' => $body['producer'],
        'wineName' => $body['wineName'],
        'vintage' => $body['vintage'] ?? null,
        'wineType' => $body['wineType'] ?? null,
        'region' => $body['region'] ?? null,
    ]
];

$confirmMatch = filter_var($body['confirmMatch'] ?? false, FILTER_VALIDATE_BOOLEAN);
$forceRefresh = filter_var($body['forceRefresh'] ?? false, FILTER_VALIDATE_BOOLEAN);

// Field order for cache hit emission (style fields first for fast visual feedback)
$fieldOrder = [
    'body', 'tannin', 'acidity', 'sweetness',
    'grapeVarieties', 'alcoholContent',
    'drinkWindow', 'criticScores',
    'overview', 'tastingNotes', 'pairingNotes',
    'productionMethod', 'appellation',
];

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $service = getAgentEnrichmentService(getAgentUserId());

    $requestId = getRequestId() ?? '-';
    error_log("[Agent] enrich: request={$requestId} producer=\"{$body['producer']}\" wine=\"{$body['wineName']}\"");

    // ──────────────────────────────────────────────
    // Phase 6: Cache check first (fast path, no LLM)
    // ──────────────────────────────────────────────
    if (!$forceRefresh) {
        $cacheResult = $service->checkCache($identification, $confirmMatch);

        if ($cacheResult) {
            $resultArray = $cacheResult->toArray();

            // Pending confirmation (canonical name resolution)
            if ($cacheResult->pendingConfirmation) {
                sendSSE('confirmation_required', [
                    'matchType' => $resultArray['matchType'] ?? 'unknown',
                    'searchedFor' => $resultArray['searchedFor'] ?? null,
                    'matchedTo' => $resultArray['matchedTo'] ?? null,
                    'confidence' => $resultArray['confidence'] ?? 0,
                ]);
                sendSSE('done', []);
                exit;
            }

            // Cache hit — emit fields with delays (fast, no LLM needed)
            $data = $resultArray['data'] ?? [];
            foreach ($fieldOrder as $field) {
                if (isRequestCancelled()) break;
                if (isset($data[$field]) && $data[$field] !== null) {
                    sendSSE('field', ['field' => $field, 'value' => $data[$field]]);
                    usleep(50000); // 50ms
                }
            }

            sendSSE('result', $resultArray);
            error_log("[Agent] enrich: done (cache hit)");
            sendSSE('done', []);
            exit;
        }
    }

    // ──────────────────────────────────────────────
    // Phase 6: Cache miss — true LLM streaming
    // ──────────────────────────────────────────────
    $enrichmentData = $service->enrichStreaming($identification, function ($field, $value) {
        // WIN-227: Stop streaming if client cancelled
        if (isRequestCancelled()) {
            return;
        }
        sendSSE('field', ['field' => $field, 'value' => $value]);
    });

    // WIN-227: Skip post-processing if cancelled during streaming
    if (isRequestCancelled()) {
        error_log("[Agent] enrich: CANCELLED during streaming");
        sendSSE('done', []);
        exit;
    }

    if (!$enrichmentData) {
        sendSSE('error', [
            'type' => 'enrichment_error',
            'message' => 'Could not enrich wine data',
            'retryable' => true,
        ]);
        sendSSE('done', []);
        exit;
    }

    // Validate, cache, merge, and send final result
    $result = $service->processEnrichmentResult($enrichmentData, $identification, $forceRefresh);
    $resultArray = $result->toArray();

    sendSSE('result', $resultArray);

    $fieldCount = count(array_filter($resultArray['data'] ?? [], fn($v) => $v !== null));
    error_log("[Agent] enrich: done fields={$fieldCount} source={$result->source}");

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'agentEnrichStream');
}
