<?php
/**
 * Shared Security Headers
 *
 * Centralized security header configuration for all PHP endpoints.
 * Include this file at the top of every endpoint BEFORE any output.
 *
 * Created by:
 *   WIN-216: CORS headers
 *   WIN-219: HTTP security headers (section below)
 *   WIN-203: API key authentication
 *   WIN-215: CSRF protection (Origin validation + custom header)
 *
 * @package WineApp
 */

// =============================================================================
// CORS Headers (WIN-216)
// =============================================================================

/**
 * Allowed origins for CORS requests.
 *
 * Production: Same-origin (http://10.0.0.16) — frontend and PHP on same server.
 * Development: Vite dev server (localhost:5173) and mobile testing via --host.
 */
$allowedOrigins = [
    'http://10.0.0.16',          // Production server (direct IP)
    'http://qve-wine.com',       // Production server (domain)
    'http://localhost:5173',      // Vite dev server
    'http://127.0.0.1:5173',     // Vite dev server (alternate)
];

/**
 * Check if the request origin is allowed.
 *
 * Matches against:
 *   1. Exact match in $allowedOrigins list
 *   2. Local network IPs on port 5173 (for mobile dev testing with --host)
 *      Pattern: http://10.x.x.x:5173 or http://192.168.x.x:5173
 */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = '';

if (in_array($origin, $allowedOrigins, true)) {
    $allowedOrigin = $origin;
} elseif (preg_match('#^http://(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$#', $origin)) {
    // Allow local network IPs on Vite dev port (mobile testing with --host)
    $allowedOrigin = $origin;
}

if ($allowedOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-API-Key, X-Request-Id');
    header('Access-Control-Max-Age: 86400');
    // Vary by Origin so caches don't serve wrong CORS headers
    header('Vary: Origin');
}

// Handle preflight OPTIONS requests — respond and exit early
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// =============================================================================
// Authentication (WIN-203)
// =============================================================================

require_once __DIR__ . '/authMiddleware.php';
authenticate();

// =============================================================================
// CSRF Protection (WIN-215)
// =============================================================================

/**
 * Defense-in-depth CSRF protection using Origin validation + custom header.
 *
 * 1. Origin validation: If Origin header is present, it must be in $allowedOrigins
 *    or match the local network pattern. Missing Origin is allowed (same-origin
 *    requests don't always include it).
 *
 * 2. X-Requested-With header: Required on all POST requests. Blocks cross-origin
 *    form submissions (browsers don't add custom headers to form POSTs).
 *    This covers the gap when Origin is absent.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // --- Origin validation ---
    // $origin is already set above in CORS section
    if ($origin !== '') {
        // Origin header is present — validate it
        $originAllowed = in_array($origin, $allowedOrigins, true)
            || preg_match('#^http://(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):5173$#', $origin);

        if (!$originAllowed) {
            error_log("CSRF: Rejected request from disallowed Origin: {$origin}");
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: Origin not allowed'
            ]);
            exit;
        }
    }
    // If Origin is absent, allow — same-origin assumed, covered by X-Requested-With below

    // --- Custom header validation ---
    $xRequestedWith = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    if ($xRequestedWith !== 'XMLHttpRequest') {
        error_log('CSRF: Rejected POST request missing X-Requested-With: XMLHttpRequest header');
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Forbidden: Missing required request header'
        ]);
        exit;
    }
}

// =============================================================================
// HTTP Security Headers (WIN-219)
// =============================================================================

// Prevent MIME-type sniffing — stops browsers from reinterpreting response content types
header('X-Content-Type-Options: nosniff');

// Prevent clickjacking — API endpoints should never be framed
header('X-Frame-Options: DENY');

// Enforce HTTPS for 1 year (including subdomains)
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

// Control referrer information sent with requests
header('Referrer-Policy: strict-origin-when-cross-origin');

// Disable legacy XSS filter — modern CSP replaces it, and the filter can introduce vulnerabilities
header('X-XSS-Protection: 0');

// Restrict browser features not needed by API endpoints
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

// Content Security Policy for API responses (JSON-only — no HTML rendering needed)
// default-src 'none' blocks all resource loading; frame-ancestors 'none' prevents framing
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
