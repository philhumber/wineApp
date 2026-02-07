<?php
/**
 * Authentication Middleware (WIN-203)
 *
 * Extensible authentication layer for all PHP endpoints.
 * Currently implements API key authentication via X-API-Key header.
 *
 * Design: This function is the single authentication entry point.
 * When multi-user support launches (WIN-254+), the mechanism inside
 * can be swapped to session-based or JWT auth without changing any
 * endpoint code — only this file needs to change.
 *
 * Called from securityHeaders.php AFTER CORS/OPTIONS preflight handling
 * so that preflight requests work without authentication.
 *
 * @package WineApp
 */

// Layer 1: Prevent direct access
if (basename($_SERVER['PHP_SELF'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    die('Direct access forbidden');
}

/**
 * Authenticate the incoming request.
 *
 * Current implementation: API key in X-API-Key header compared against
 * API_AUTH_KEY constant defined in config.local.php.
 *
 * On failure: sends 401 JSON response and exits.
 * On success: returns void, endpoint logic continues.
 *
 * @return void
 */
function authenticate(): void
{
    // Ensure config is loaded (may already be loaded by databaseConnection.php,
    // but auth runs before DB connection in the request lifecycle)
    $configPath = __DIR__ . '/../../../wineapp-config/config.local.php';
    
    if (!defined('API_AUTH_KEY')) {
        if (!file_exists($configPath)) {
            error_log('[Auth] Config file not found: ' . $configPath);
            sendAuthError();
        }
        require_once $configPath;
    }

    // Verify the API_AUTH_KEY constant is defined and non-empty
    if (!defined('API_AUTH_KEY') || API_AUTH_KEY === '') {
        error_log('[Auth] API_AUTH_KEY not defined or empty in config');
        sendAuthError();
    }

    // Read the X-API-Key header
    // PHP normalizes headers: X-API-Key becomes HTTP_X_API_KEY
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';

    if ($apiKey === '' || !hash_equals(API_AUTH_KEY, $apiKey)) {
        // Use timing-safe comparison to prevent timing attacks
        error_log('[Auth] Invalid API key attempt from ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        sendAuthError();
    }

    // Authentication passed — continue to endpoint logic
}

/**
 * Send a 401 Unauthorized response and exit.
 *
 * Returns a generic message that does not reveal whether the key
 * was missing, wrong, or the config is misconfigured.
 *
 * @return never
 */
function sendAuthError(): void
{
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized. Please check your API key.',
    ], JSON_PRETTY_PRINT);
    exit;
}
