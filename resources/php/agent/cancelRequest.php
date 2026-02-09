<?php
/**
 * Cancel Agent Request Endpoint (WIN-227)
 *
 * Creates a cancel token file that streaming endpoints check via isRequestCancelled().
 * Called by the frontend when the user cancels an in-flight request.
 *
 * POST /resources/php/agent/cancelRequest.php
 *
 * Request body:
 *   {"requestId": "uuid-string"}
 *
 * Response:
 *   {"success": true, "cancelled": true}
 *
 * @package Agent
 */

require_once __DIR__ . '/_bootstrap.php';

agentRequireMethod('POST');
$body = agentGetJsonBody();
agentRequireFields($body, ['requestId']);

$path = getCancelTokenPath($body['requestId']);
@touch($path);

error_log("[Agent] cancel: requestId={$body['requestId']}");

header('Content-Type: application/json');
echo json_encode(['success' => true, 'cancelled' => true]);
