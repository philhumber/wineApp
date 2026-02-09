<?php
/**
 * Authentication Middleware (WIN-203, WIN-254)
 *
 * Extensible authentication layer for all PHP endpoints.
 * Accepts EITHER API key (X-API-Key header) OR valid session cookie (QVE_SESSION).
 * API key is checked first (cheap — no session overhead).
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
 * 1. Check API key first (cheap — no session file I/O)
 * 2. If no valid API key, check session cookie (QVE_SESSION)
 * 3. session_write_close() immediately after validation to prevent lock contention
 *
 * On failure: sends 401 JSON response and exits.
 * On success: returns void, endpoint logic continues.
 *
 * @return void
 */
function authenticate(): void
{
    // Ensure config is loaded
    $configPath = __DIR__ . '/../../../wineapp-config/config.local.php';

    if (!defined('API_AUTH_KEY')) {
        if (!file_exists($configPath)) {
            error_log('[Auth] Config file not found: ' . $configPath);
            sendAuthError();
        }
        require_once $configPath;
    }

    // 1. Check API key first (cheap — no session overhead)
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($apiKey !== '' && defined('API_AUTH_KEY') && API_AUTH_KEY !== '' && hash_equals(API_AUTH_KEY, $apiKey)) {
        return; // API key valid
    }

    // 2. Check session cookie (only if cookie exists — avoids creating empty sessions)
    if (isset($_COOKIE['QVE_SESSION'])) {
        session_name('QVE_SESSION');
        $isSecure = (
            (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        );
        session_set_cookie_params([
            'lifetime' => 604800,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isSecure,
            'httponly'  => true,
            'samesite' => 'Strict'
        ]);

        if (@session_start() === false) {
            error_log('[Auth] session_start() failed');
            sendAuthError('Session error');
        }

        $valid = (
            isset($_SESSION['authenticated'])
            && $_SESSION['authenticated'] === true
            && isset($_SESSION['auth_time'])
            && is_int($_SESSION['auth_time'])
            && ($_SESSION['auth_time'] + 604800) > time()
        );

        session_write_close(); // Release lock immediately — critical for concurrent requests

        if ($valid) return;
    }

    // 3. Neither method passed
    sendAuthError();
}

/**
 * Send a 401 Unauthorized response and exit.
 *
 * Returns a generic message that does not reveal whether the key
 * was missing, wrong, or the config is misconfigured.
 *
 * @param string $message Optional custom message (for internal differentiation in logs)
 * @return never
 */
function sendAuthError(string $message = 'Authentication required'): void
{
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $message,
    ], JSON_PRETTY_PRINT);
    exit;
}
