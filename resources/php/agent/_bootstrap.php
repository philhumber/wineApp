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
