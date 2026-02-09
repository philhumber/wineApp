<?php
/**
 * AI Agent Bootstrap
 *
 * Initialize all agent components with proper dependency injection.
 * This file sets up autoloading and provides factory functions for
 * creating agent service instances.
 *
 * @package Agent
 */

// Security headers (CORS, etc.) - shared across all endpoints
require_once __DIR__ . '/../securityHeaders.php';

// Extend PHP execution time for multi-tier LLM escalation
// Default 30s is insufficient when making multiple API calls with thinking mode
set_time_limit(120);

// WIN-261: Stop execution when browser disconnects to avoid wasting server/API resources
// Without this, PHP continues running LLM calls even after the client aborts
ignore_user_abort(false);

// Autoloader for Agent namespace
spl_autoload_register(function ($class) {
    $prefix = 'Agent\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

/**
 * Get agent configuration
 *
 * @return array Configuration array
 */
function getAgentConfig(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config/agent.config.php';
    }
    return $config;
}

/**
 * Get the authenticated user ID (WIN-254)
 *
 * Server-authoritative user ID — never trust client-supplied values.
 * Currently hardcoded to user 1 (single-user app).
 *
 * When multi-user auth launches, replace the hardcoded return with
 * session/token-based lookup, e.g.:
 *   return getUserIdFromSession();
 *
 * @return int Authenticated user ID
 */
function getAgentUserId(): int
{
    // TODO [multi-user]: Replace with session/token-based user ID lookup.
    // e.g.: return $_SESSION['userId'] ?? throw new \RuntimeException('Not authenticated');
    return 1;
}

/**
 * Get database connection
 *
 * @return \PDO Database connection
 */
function getAgentDB(): \PDO
{
    require_once __DIR__ . '/../databaseConnection.php';
    return getDBConnection();
}

/**
 * Initialize LLM Client
 *
 * @param int $userId User ID for tracking
 * @return \Agent\LLM\LLMClient LLM client instance
 */
function getAgentLLMClient(int $userId = 1): \Agent\LLM\LLMClient
{
    static $clients = [];

    if (!isset($clients[$userId])) {
        $config = getAgentConfig();
        $pdo = getAgentDB();
        $clients[$userId] = new \Agent\LLM\LLMClient($config, $pdo, $userId);
    }

    return $clients[$userId];
}

/**
 * Initialize Identification Service
 *
 * @param int $userId User ID for tracking
 * @return \Agent\Identification\IdentificationService Identification service instance
 */
function getAgentIdentificationService(int $userId = 1): \Agent\Identification\IdentificationService
{
    $config = getAgentConfig();
    $pdo = getAgentDB();
    $llmClient = getAgentLLMClient($userId);

    return new \Agent\Identification\IdentificationService($llmClient, $pdo, $config);
}

/**
 * Initialize Enrichment Service
 *
 * @param int $userId User ID for tracking
 * @return \Agent\Enrichment\EnrichmentService Enrichment service instance
 */
function getAgentEnrichmentService(int $userId = 1): \Agent\Enrichment\EnrichmentService
{
    $config = getAgentConfig();
    $pdo = getAgentDB();
    $llmClient = getAgentLLMClient($userId);

    $cache = new \Agent\Enrichment\EnrichmentCache($pdo, $config);
    $enricher = new \Agent\Enrichment\WebSearchEnricher($llmClient, $config);
    $validator = new \Agent\Enrichment\ValidationService($config);
    $merger = new \Agent\Enrichment\EnrichmentMerger();
    $fallback = new \Agent\Enrichment\EnrichmentFallback($pdo);

    // WIN-162: Wire up canonical name resolver for multi-tier cache lookup
    $resolver = new \Agent\Enrichment\CanonicalNameResolver($pdo, $config);
    $cache->setResolver($resolver);

    return new \Agent\Enrichment\EnrichmentService(
        $cache, $enricher, $validator, $merger, $fallback, $config
    );
}

/**
 * Send JSON response and exit
 *
 * @param bool $success Success status
 * @param string $message Response message
 * @param array $data Response data
 * @param int $httpCode HTTP status code
 * @return void
 */
function agentResponse(bool $success, string $message, array $data = [], int $httpCode = 200): void
{
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send error response and exit
 *
 * @param string $message Error message
 * @param int $httpCode HTTP status code
 * @return void
 */
function agentError(string $message, int $httpCode = 400): void
{
    agentResponse(false, $message, [], $httpCode);
}

/**
 * Handle exception with context extraction
 *
 * Attempts to identify error type from exception message/previous exceptions.
 * Returns structured error response with user-friendly message and support reference.
 *
 * @param \Exception $e The exception to handle
 * @param string $endpoint The endpoint name for logging
 * @param int $defaultCode Default HTTP code if type cannot be determined
 * @return void
 */
function agentExceptionError(\Exception $e, string $endpoint, int $defaultCode = 500): void
{
    $message = $e->getMessage();
    $errorType = 'server_error';
    $httpCode = $defaultCode;

    // Check for LLM error types in exception message or previous exceptions
    $fullMessage = $message;
    $prev = $e->getPrevious();
    while ($prev) {
        $fullMessage .= ' ' . $prev->getMessage();
        $prev = $prev->getPrevious();
    }

    // Classify error type from exception chain
    if (stripos($fullMessage, 'timeout') !== false || stripos($fullMessage, 'timed out') !== false) {
        $errorType = 'timeout';
        $httpCode = 408;
    } elseif (stripos($fullMessage, 'rate limit') !== false || stripos($fullMessage, '429') !== false) {
        $errorType = 'rate_limit';
        $httpCode = 429;
    } elseif (stripos($fullMessage, 'token') !== false && stripos($fullMessage, 'limit') !== false) {
        $errorType = 'limit_exceeded';
        $httpCode = 429;
    } elseif (stripos($fullMessage, 'SSL') !== false || stripos($fullMessage, 'certificate') !== false || stripos($fullMessage, 'CA bundle') !== false) {
        // WIN-143: SSL/TLS connection errors (missing certs, verification failures)
        $errorType = 'ssl_error';
        $httpCode = 502;
    } elseif ($e instanceof \PDOException) {
        $errorType = 'database_error';
    }

    // User-friendly messages with sommelier personality
    $userMessages = [
        'timeout' => 'Our sommelier is taking longer than expected. Please try again or start over.',
        'rate_limit' => 'Our sommelier is quite busy at the moment. Please wait a moment and try again or start over.',
        'limit_exceeded' => 'We\'ve reached our tasting limit for today. Please try again tomorrow.',
        'server_error' => 'Something unexpected happened. Please try again in a moment or start over.',
        'overloaded' => 'Our sommelier is overwhelmed with requests. Please try again shortly or start over.',
        'database_error' => 'We\'re having trouble accessing our cellar records. Please try again or start over.',
        'ssl_error' => 'Our sommelier is having trouble making a secure connection. Please try again shortly or start over.',
    ];

    // Generate support reference
    $supportRef = 'ERR-' . strtoupper(substr(md5(time() . $errorType . $endpoint), 0, 8));

    // Log full context for debugging
    agentLogError("Exception in {$endpoint}", [
        'type' => $errorType,
        'message' => $message,
        'supportRef' => $supportRef,
        'trace' => $e->getTraceAsString()
    ]);

    // Return structured error
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $userMessages[$errorType] ?? $userMessages['server_error'],
        'error' => [
            'type' => $errorType,
            'userMessage' => $userMessages[$errorType] ?? $userMessages['server_error'],
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded', 'ssl_error']),
            'supportRef' => $supportRef,
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send structured error response for non-exception errors
 *
 * Used when service returns success=false with errorType.
 * Returns user-friendly message with sommelier personality.
 *
 * @param string $errorType Error type from service
 * @param string|null $fallbackMessage Fallback message if type unknown
 * @return void
 */
function agentStructuredError(string $errorType, ?string $fallbackMessage = null): void
{
    $httpCode = match ($errorType) {
        'limit_exceeded' => 429,
        'rate_limit' => 429,
        'timeout' => 408,
        'quality_check_failed' => 422,
        'ssl_error' => 502,
        default => 400,
    };

    $userMessages = [
        'timeout' => 'Our sommelier is taking longer than expected. Please try again.',
        'rate_limit' => 'Our sommelier is quite busy. Please wait a moment.',
        'limit_exceeded' => 'We\'ve reached our tasting limit for today.',
        'quality_check_failed' => 'That image is a bit unclear. Could you try a clearer photo?',
        'identification_error' => 'I couldn\'t quite identify that wine. Could you try again?',
        'enrichment_error' => 'I couldn\'t find additional details about this wine.',
        'clarification_error' => 'I couldn\'t help narrow down the choices. Please review the options yourself.',
        'ssl_error' => 'Our sommelier is having trouble making a secure connection. Please try again shortly.',
    ];

    $userMessage = $userMessages[$errorType] ?? $fallbackMessage ?? 'Something went wrong. Please try again.';

    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $userMessage,
        'error' => [
            'type' => $errorType,
            'userMessage' => $userMessage,
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded', 'ssl_error']),
            'supportRef' => null,
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Validate request method
 *
 * @param string|array $allowedMethods Allowed HTTP methods
 * @return void
 */
function agentRequireMethod($allowedMethods): void
{
    if (is_string($allowedMethods)) {
        $allowedMethods = [$allowedMethods];
    }

    if (!in_array($_SERVER['REQUEST_METHOD'], $allowedMethods)) {
        agentError('Method not allowed. Allowed: ' . implode(', ', $allowedMethods), 405);
    }
}

/**
 * Get JSON request body
 *
 * @return array Parsed JSON data
 */
function agentGetJsonBody(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        agentError('Invalid JSON body: ' . json_last_error_msg());
    }

    return $input ?? [];
}

/**
 * Require specific fields in request
 *
 * @param array $input Request data
 * @param array $requiredFields Required field names
 * @return void
 */
function agentRequireFields(array $input, array $requiredFields): void
{
    $missing = [];

    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || $input[$field] === '') {
            $missing[] = $field;
        }
    }

    if (!empty($missing)) {
        agentError('Missing required fields: ' . implode(', ', $missing));
    }
}

/**
 * Log agent error
 *
 * @param string $message Error message
 * @param array $context Additional context
 * @return void
 */
function agentLogError(string $message, array $context = []): void
{
    $logMessage = "[Agent Error] {$message}";

    if (!empty($context)) {
        $logMessage .= ' | Context: ' . json_encode($context);
    }

    error_log($logMessage);
}

/**
 * Log agent info
 *
 * @param string $message Info message
 * @param array $context Additional context
 * @return void
 */
function agentLogInfo(string $message, array $context = []): void
{
    $logMessage = "[Agent Info] {$message}";

    if (!empty($context)) {
        $logMessage .= ' | Context: ' . json_encode($context);
    }

    error_log($logMessage);
}

// ===========================================
// SSE (Server-Sent Events) Helpers (WIN-181)
// ===========================================

/**
 * Initialize SSE response headers
 *
 * Sets up headers for Server-Sent Events streaming.
 * Must be called before any output.
 *
 * @return void
 */
function initSSE(): void
{
    // Disable output buffering
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Set SSE headers
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Nginx

    // Enable implicit flush
    ob_implicit_flush(true);
}

/**
 * Send an SSE event
 *
 * @param string $event Event name (field, result, error, done)
 * @param array $data Event data (will be JSON encoded)
 * @return void
 */
function sendSSE(string $event, array $data): void
{
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";
    flush();
}

/**
 * Send an SSE error event and exit
 *
 * Classifies the exception and sends appropriate error event.
 *
 * @param \Exception $e The exception
 * @param string $endpoint Endpoint name for logging
 * @return void
 */
function sendSSEError(\Exception $e, string $endpoint = 'stream'): void
{
    $message = $e->getMessage();
    $errorType = 'server_error';

    // Check for error types in exception chain
    $fullMessage = $message;
    $prev = $e->getPrevious();
    while ($prev) {
        $fullMessage .= ' ' . $prev->getMessage();
        $prev = $prev->getPrevious();
    }

    // Classify error type
    if (stripos($fullMessage, 'timeout') !== false || stripos($fullMessage, 'timed out') !== false) {
        $errorType = 'timeout';
    } elseif (stripos($fullMessage, 'rate limit') !== false || stripos($fullMessage, '429') !== false) {
        $errorType = 'rate_limit';
    } elseif (stripos($fullMessage, 'token') !== false && stripos($fullMessage, 'limit') !== false) {
        $errorType = 'limit_exceeded';
    } elseif (stripos($fullMessage, 'SSL') !== false || stripos($fullMessage, 'certificate') !== false || stripos($fullMessage, 'CA bundle') !== false) {
        // WIN-143: SSL/TLS connection errors
        $errorType = 'ssl_error';
    } elseif ($e instanceof \PDOException) {
        $errorType = 'database_error';
    }

    // User-friendly messages
    $userMessages = [
        'timeout' => 'Our sommelier is taking longer than expected. Please try again.',
        'rate_limit' => 'Our sommelier is quite busy. Please wait a moment and try again.',
        'limit_exceeded' => 'We\'ve reached our tasting limit for today.',
        'server_error' => 'Something unexpected happened. Please try again.',
        'overloaded' => 'Our sommelier is overwhelmed with requests. Please try again shortly.',
        'database_error' => 'We\'re having trouble accessing our cellar records. Please try again.',
        'ssl_error' => 'Our sommelier is having trouble making a secure connection. Please try again shortly.',
    ];

    // Generate support reference
    $supportRef = 'ERR-' . strtoupper(substr(md5(time() . $errorType . $endpoint), 0, 8));

    // Log error
    agentLogError("SSE Exception in {$endpoint}", [
        'type' => $errorType,
        'message' => $message,
        'supportRef' => $supportRef,
        'trace' => $e->getTraceAsString()
    ]);

    // Send error event
    sendSSE('error', [
        'type' => $errorType,
        'message' => $userMessages[$errorType] ?? $userMessages['server_error'],
        'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded', 'ssl_error']),
        'supportRef' => $supportRef,
    ]);

    sendSSE('done', []);
    exit;
}

// ===========================================
// Request Cancellation Helpers (WIN-227)
// ===========================================

/**
 * Get the request ID from the X-Request-Id header.
 *
 * @return string|null Request ID or null if not provided
 */
function getRequestId(): ?string
{
    return $_SERVER['HTTP_X_REQUEST_ID'] ?? null;
}

/**
 * Get the cancel token file path for a request ID.
 *
 * @param string $requestId The request ID
 * @return string File path for the cancel token
 */
function getCancelTokenPath(string $requestId): string
{
    $safe = preg_replace('/[^a-zA-Z0-9_-]/', '', $requestId);
    return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'agent_cancel_' . $safe;
}

/**
 * Check if the current request has been cancelled via cancel token.
 * Call at key checkpoints (before escalation, between tiers, in curl loops).
 *
 * @return bool True if the request has been cancelled
 */
function isRequestCancelled(): bool
{
    $requestId = getRequestId();
    if (!$requestId) {
        return false;
    }
    return file_exists(getCancelTokenPath($requestId));
}

/**
 * Register shutdown function to clean up cancel token files.
 * Call early in each streaming endpoint.
 *
 * @return void
 */
function registerCancelCleanup(): void
{
    $requestId = getRequestId();
    if ($requestId) {
        $path = getCancelTokenPath($requestId);
        register_shutdown_function(function () use ($path) {
            if (file_exists($path)) {
                @unlink($path);
            }
        });
    }
}

/**
 * Check if streaming is enabled for a task
 *
 * @param string $taskType Task type (identify_text, identify_image, enrich)
 * @return bool True if streaming is enabled
 */
function isStreamingEnabled(string $taskType): bool
{
    $config = getAgentConfig();

    if (!($config['streaming']['enabled'] ?? false)) {
        return false;
    }

    $enabledTasks = $config['streaming']['tasks'] ?? [];
    return in_array($taskType, $enabledTasks);
}
