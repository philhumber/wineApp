<?php
/**
 * Auth Endpoint Headers (WIN-254)
 *
 * CORS + security headers + CSRF validation for auth endpoints.
 * Duplicated from securityHeaders.php because auth endpoints cannot include
 * securityHeaders.php (which calls authenticate(), creating circular dependency
 * before session exists).
 *
 * MAINTENANCE: If CORS origins or headers change, update BOTH files.
 *
 * @package WineApp
 */

// Layer 1: Prevent direct access
if (basename($_SERVER['PHP_SELF'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    die('Direct access forbidden');
}

// =============================================================================
// CORS Headers (mirrored from securityHeaders.php)
// =============================================================================

$allowedOrigins = [
    'http://10.0.0.16',          // Production server (direct IP)
    'http://qve-wine.com',       // Production server (domain)
    'https://qve-wine.com',      // Production via Cloudflare Tunnel
    'http://localhost:5173',      // Vite dev server
    'http://127.0.0.1:5173',     // Vite dev server (alternate)
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = '';

if (in_array($origin, $allowedOrigins, true)) {
    $allowedOrigin = $origin;
} elseif (preg_match('#^http://(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$#', $origin)) {
    $allowedOrigin = $origin;
}

if ($allowedOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-API-Key');
    header('Access-Control-Max-Age: 86400');
    header('Vary: Origin');
}

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// =============================================================================
// HTTP Security Headers (mirrored from securityHeaders.php)
// =============================================================================

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-XSS-Protection: 0');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Check if the current request is over HTTPS.
 * Handles Cloudflare Tunnel (X-Forwarded-Proto) and direct HTTPS.
 */
function isHttps(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') return true;
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
    return false;
}

/**
 * Validate CSRF protection for POST requests.
 * Checks Origin header (if present) and X-Requested-With header.
 */
function validateCsrf(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;

    // Origin validation
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $allowedOrigins = [
            'http://10.0.0.16',
            'http://qve-wine.com',
            'https://qve-wine.com',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ];
        $originAllowed = in_array($origin, $allowedOrigins, true)
            || preg_match('#^http://(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$#', $origin);

        if (!$originAllowed) {
            error_log("CSRF: Rejected auth request from disallowed Origin: {$origin}");
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            exit;
        }
    }

    // X-Requested-With validation
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        error_log('CSRF: Rejected auth POST request missing X-Requested-With header');
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
}
