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

// Extend PHP execution time for multi-tier LLM escalation
// Default 30s is insufficient when making multiple API calls with thinking mode
set_time_limit(120);

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
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded']),
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
        default => 400,
    };

    $userMessages = [
        'timeout' => 'Our sommelier is taking longer than expected. Please try again.',
        'rate_limit' => 'Our sommelier is quite busy. Please wait a moment.',
        'limit_exceeded' => 'We\'ve reached our tasting limit for today.',
        'quality_check_failed' => 'That image is a bit unclear. Could you try a clearer photo?',
        'identification_error' => 'I couldn\'t quite identify that wine. Could you try again?',
        'enrichment_error' => 'I couldn\'t find additional details about this wine.',
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
            'retryable' => in_array($errorType, ['timeout', 'rate_limit', 'server_error', 'overloaded']),
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
