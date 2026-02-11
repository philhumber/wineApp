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

try {
    // WIN-254: Server-authoritative userId — ignore client-supplied value
    $service = getAgentEnrichmentService(getAgentUserId());

    $requestId = getRequestId() ?? '-';
    error_log("[Agent] enrich: request={$requestId} producer=\"{$body['producer']}\" wine=\"{$body['wineName']}\"");

    // Step 1: Check cache (fast path — no LLM needed)
    if (!$forceRefresh) {
        $cacheResult = $service->checkCache($identification, $confirmMatch);

        if ($cacheResult !== null) {
            $cacheArray = $cacheResult->toArray();

            // Pending confirmation (canonical name resolution)
            if ($cacheArray['pendingConfirmation'] ?? false) {
                sendSSE('confirmation_required', [
                    'matchType' => $cacheArray['matchType'] ?? 'unknown',
                    'searchedFor' => $cacheArray['searchedFor'] ?? null,
                    'matchedTo' => $cacheArray['matchedTo'] ?? null,
                    'confidence' => $cacheArray['confidence'] ?? 0,
                ]);
                sendSSE('done', []);
                exit;
            }

            // Cache hit — send complete result directly (no field-by-field delays)
            sendSSE('result', $cacheArray);
            $fieldCount = count(array_filter($cacheArray['data'] ?? [], fn($v) => $v !== null));
            error_log("[Agent] enrich: done fields={$fieldCount} cached=yes");
            sendSSE('done', []);
            exit;
        }
    }

    // Step 2: Cache miss — stream from LLM
    $enricher = $service->getEnricher();
    $enrichmentData = $enricher->enrichStreaming(
        $body['producer'],
        $body['wineName'],
        $body['vintage'] ?? null,
        function ($field, $value) {
            // WIN-227: Stop streaming if client cancelled
            if (isRequestCancelled()) {
                return;
            }
            sendSSE('field', ['field' => $field, 'value' => $value]);
        },
        function ($field, $textSoFar) {
            if (isRequestCancelled()) {
                return;
            }
            sendSSE('text_delta', ['field' => $field, 'text' => $textSoFar]);
        }
    );

    // WIN-227: Skip processing if cancelled during streaming
    if (isRequestCancelled()) {
        error_log("[Agent] enrich: CANCELLED after streaming");
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

    // Step 3: Post-process (validate, cache, merge)
    $result = $service->processEnrichmentResult($enrichmentData, $identification, $forceRefresh);
    $resultArray = $result->toArray();

    sendSSE('result', $resultArray);

    $data = $resultArray['data'] ?? [];
    $fieldCount = count(array_filter($data, fn($v) => $v !== null));
    error_log("[Agent] enrich: done fields={$fieldCount} cached=no");

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'agentEnrichStream');
}
