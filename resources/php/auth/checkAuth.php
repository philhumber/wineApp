<?php
/**
 * Check Auth Endpoint (WIN-254)
 *
 * GET — Returns whether the current session is authenticated.
 * No CSRF check needed (GET, no state mutation).
 *
 * @package WineApp
 */

require_once __DIR__ . '/authCorsHeaders.php';

header('Content-Type: application/json');

session_name('QVE_SESSION');
$authenticated = false;

if (isset($_COOKIE['QVE_SESSION'])) {
    session_start();
    $authenticated = (
        isset($_SESSION['authenticated'])
        && $_SESSION['authenticated'] === true
        && isset($_SESSION['auth_time'])
        && is_int($_SESSION['auth_time'])
        && ($_SESSION['auth_time'] + 604800) > time()
    );
    session_write_close();
}

echo json_encode(['success' => true, 'data' => ['authenticated' => $authenticated]]);
