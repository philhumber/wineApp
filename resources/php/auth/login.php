<?php
/**
 * Login Endpoint (WIN-254)
 *
 * POST — Validates password via bcrypt, starts session on success.
 * Includes brute force protection (5 attempts / 15 min lockout per IP).
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

// =============================================================================
// Brute Force Protection
// =============================================================================

$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ipHash = hash('sha256', $remoteAddr);
$attemptDir = sys_get_temp_dir() . '/qve_auth_attempts';

if (!is_dir($attemptDir)) {
    @mkdir($attemptDir, 0700, true);
}

// Fail-secure: if we can't track attempts, deny login
if (!is_dir($attemptDir) || !is_writable($attemptDir)) {
    error_log('[Auth] Attempt directory not writable: ' . $attemptDir);
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Authentication temporarily unavailable']);
    exit;
}

$attemptFile = $attemptDir . '/' . $ipHash;

// Cleanup stale file (older than 15 min)
if (file_exists($attemptFile) && (time() - filemtime($attemptFile)) > 900) {
    @unlink($attemptFile);
}

function readAttempts(string $path): int
{
    if (!file_exists($path)) return 0;
    $fp = fopen($path, 'r');
    if (!$fp) return 0;
    flock($fp, LOCK_SH);
    $count = (int) stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $count;
}

function writeAttempts(string $path, int $count): void
{
    $fp = fopen($path, 'c');
    if (!$fp) return;
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string) $count);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

$attempts = readAttempts($attemptFile);
if ($attempts >= 5) {
    error_log('[Auth] Brute force lockout for IP hash: ' . substr($ipHash, 0, 12) . '...');
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many attempts. Try again in 15 minutes.']);
    exit;
}

// =============================================================================
// Password Validation
// =============================================================================

try {
    // Load config
    $configPath = __DIR__ . '/../../../../wineapp-config/config.local.php';
    if (!file_exists($configPath)) {
        error_log('[Auth] Config file not found: ' . $configPath);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Server configuration error']);
        exit;
    }
    require_once $configPath;

    if (!defined('APP_PASSWORD_HASH') || APP_PASSWORD_HASH === '') {
        error_log('[Auth] APP_PASSWORD_HASH not defined or empty');
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Server configuration error']);
        exit;
    }

    // Parse request body
    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';

    if ($password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password is required']);
        exit;
    }

    // Verify password
    if (!password_verify($password, APP_PASSWORD_HASH)) {
        writeAttempts($attemptFile, $attempts + 1);
        error_log('[Auth] Failed login attempt from IP hash: ' . substr($ipHash, 0, 12) . '... (attempt ' . ($attempts + 1) . ')');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid password']);
        exit;
    }

    // =============================================================================
    // Success — Start Session
    // =============================================================================

    // Clear brute force tracking
    @unlink($attemptFile);

    session_name('QVE_SESSION');
    session_set_cookie_params([
        'lifetime' => 604800,     // 7 days
        'path'     => '/',
        'domain'   => '',
        'secure'   => isHttps(),
        'httponly'  => true,
        'samesite' => 'Strict'
    ]);
    ini_set('session.gc_maxlifetime', '604800');
    session_start();
    session_regenerate_id(true);

    $_SESSION['authenticated'] = true;
    $_SESSION['auth_time'] = time();

    error_log('[Auth] Successful login from IP hash: ' . substr($ipHash, 0, 12) . '...');
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    $supportRef = 'ERR-' . strtoupper(substr(md5(time() . 'login' . $e->getMessage()), 0, 8));
    error_log('[Auth] Unexpected error: ' . $e->getMessage() . ' | Ref: ' . $supportRef);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred (Ref: ' . $supportRef . ')']);
    exit;
}
