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

    // For now, use non-streaming enrichment and emit fields progressively
    // Full streaming enrichment can be added to EnrichmentService later
    $result = $service->enrich($identification, $confirmMatch, $forceRefresh);
    $resultArray = $result->toArray();

    // WIN-227: Skip field emission if client cancelled during enrich()
    if (isRequestCancelled()) {
        error_log("[Agent] enrich: CANCELLED after enrich()");
        sendSSE('done', []);
        exit;
    }

    // Check for pending confirmation (canonical name resolution)
    if ($resultArray['pendingConfirmation'] ?? false) {
        sendSSE('confirmation_required', [
            'matchType' => $resultArray['matchType'] ?? 'unknown',
            'searchedFor' => $resultArray['searchedFor'] ?? null,
            'matchedTo' => $resultArray['matchedTo'] ?? null,
            'confidence' => $resultArray['confidence'] ?? 0,
        ]);
        sendSSE('done', []);
        exit;
    }

    if (!$resultArray['success']) {
        sendSSE('error', [
            'type' => 'enrichment_error',
            'message' => 'Could not enrich wine data',
            'retryable' => false,
        ]);
        sendSSE('done', []);
        exit;
    }

    // Emit enrichment fields progressively
    // WIN-181: Field names must match actual enrichment data structure
    $data = $resultArray['data'] ?? [];
    $fieldOrder = [
        // Style profile fields (shown first, quick visual feedback)
        'body',
        'tannin',
        'acidity',
        // Structured data fields
        'grapeVarieties',
        'alcoholContent',
        'drinkWindow',
        'criticScores',
        // Narrative fields (shown last, longer content)
        'overview',
        'tastingNotes',
        'pairingNotes',
        'productionMethod',
    ];

    foreach ($fieldOrder as $field) {
        // WIN-227: Stop emitting fields if client cancelled
        if (isRequestCancelled()) {
            error_log("[Agent] enrich: CANCELLED during field emission");
            break;
        }
        if (isset($data[$field]) && $data[$field] !== null) {
            sendSSE('field', ['field' => $field, 'value' => $data[$field]]);
            // Small delay to simulate streaming effect
            usleep(50000); // 50ms
        }
    }

    // Send the complete result
    sendSSE('result', $resultArray);

    $fieldCount = count(array_filter($data, fn($v) => $v !== null));
    error_log("[Agent] enrich: done fields={$fieldCount} cached=" . ($resultArray['cached'] ?? false ? 'yes' : 'no'));

    sendSSE('done', []);

} catch (\Exception $e) {
    sendSSEError($e, 'agentEnrichStream');
}
