<?php
/**
 * Shared Error Handler for Non-Agent Endpoints
 * WIN-217: Prevent internal error details from leaking to clients
 *
 * Provides safe error message generation that:
 * - Returns generic messages for system/database errors
 * - Preserves developer-defined validation messages (safe to expose)
 * - Logs full error details server-side with support reference codes
 * - Follows the same pattern as agent/_bootstrap.php
 */

/**
 * Generate a safe error message for client response
 *
 * Distinguishes between validation errors (safe to expose) and
 * system errors (PDO, file system, API errors that leak internals).
 *
 * @param Exception $e The caught exception
 * @param string $endpoint Endpoint name for logging context
 * @return string Safe message for client response
 */
function safeErrorMessage(\Exception $e, string $endpoint): string
{
    $message = $e->getMessage();

    // Generate support reference for all errors
    $supportRef = 'ERR-' . strtoupper(substr(md5(time() . $endpoint . $message), 0, 8));

    // Check if this is a system error that could leak internals
    $isSystemError = isSystemError($e);

    if ($isSystemError) {
        // Log full details server-side
        error_log("[{$endpoint}] {$supportRef} | Exception: {$message} | File: {$e->getFile()}:{$e->getLine()} | Trace: {$e->getTraceAsString()}");

        // Return generic message to client
        return 'An unexpected error occurred. Please try again. (Ref: ' . $supportRef . ')';
    }

    // Validation error - safe to return as-is, but still log
    error_log("[{$endpoint}] Validation error: {$message}");
    return $message;
}

/**
 * Determine if an exception is a system error that could leak internals
 *
 * System errors include: PDO exceptions, file system errors, SQL errors,
 * and any message containing patterns that suggest internal details.
 *
 * @param Exception $e The exception to check
 * @return bool True if the error is a system error that should be hidden
 */
function isSystemError(\Exception $e): bool
{
    // PDOException is always a system error (contains SQL, table names, etc.)
    if ($e instanceof \PDOException) {
        return true;
    }

    // Check if a PDOException is wrapped as previous
    $prev = $e->getPrevious();
    while ($prev) {
        if ($prev instanceof \PDOException) {
            return true;
        }
        $prev = $prev->getPrevious();
    }

    $message = $e->getMessage();

    // Patterns that indicate internal details are leaking
    $systemPatterns = [
        '/SQLSTATE\[/',           // PDO SQL state codes
        '/\bSELECT\b.*\bFROM\b/i', // SQL queries
        '/\bINSERT\b.*\bINTO\b/i',
        '/\bUPDATE\b.*\bSET\b/i',
        '/\bDELETE\b.*\bFROM\b/i',
        '/\btable\b.*\bnot found\b/i',
        '/\bcolumn\b.*\bnot found\b/i',
        '/\.php\b/',              // File paths
        '/\bstack trace\b/i',
        '/\bfatal error\b/i',
        '/\balloc_size\b/i',
        '/\bsegmentation\b/i',
        '/\ballow_url_fopen\b/',  // Server config details
        '/\bextension\b.*\bnot loaded\b/i',
        '/\bOpenSSL\b/',
        '/\bconnection refused\b/i',
        '/\bAccess denied\b/i',   // Database credentials context
    ];

    foreach ($systemPatterns as $pattern) {
        if (preg_match($pattern, $message)) {
            return true;
        }
    }

    return false;
}
