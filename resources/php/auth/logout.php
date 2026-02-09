<?php
/**
 * Logout Endpoint (WIN-254)
 *
 * POST — Destroys session and deletes cookie. Idempotent.
 *
 * @package WineApp
 */

require_once __DIR__ . '/authCorsHeaders.php';
validateCsrf();

header('Content-Type: application/json');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

session_name('QVE_SESSION');

// Only start session if cookie exists (idempotent)
if (isset($_COOKIE['QVE_SESSION'])) {
    session_start();
    $_SESSION = [];
    session_destroy();
    error_log('[Auth] Session destroyed');
}

// Always delete cookie (handles stale cookies too)
setcookie('QVE_SESSION', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => '',
    'secure'   => isHttps(),
    'httponly'  => true,
    'samesite' => 'Strict'
]);

echo json_encode(['success' => true]);
