<?php
/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to protect against cascading failures.
 * Tracks failures and opens the circuit when threshold is exceeded, preventing
 * further requests until recovery timeout passes.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, requests immediately rejected
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

class CircuitBreaker
{
    /** Circuit is closed - normal operation */
    private const STATE_CLOSED = 'closed';

    /** Circuit is open - failing, reject requests */
    private const STATE_OPEN = 'open';

    /** Circuit is half-open - testing recovery */
    private const STATE_HALF_OPEN = 'half_open';

    /** @var string Provider name */
    private string $provider;

    /** @var array Configuration */
    private array $config;

    /** @var \PDO Database connection */
    private \PDO $pdo;

    /** @var string Current state */
    private string $state = self::STATE_CLOSED;

    /** @var int Failure count in current window */
    private int $failureCount = 0;

    /** @var int|null Timestamp of last failure */
    private ?int $lastFailureTime = null;

    /** @var int Success count in half-open state */
    private int $successCount = 0;

    /**
     * Create a new circuit breaker
     *
     * @param string $provider Provider name
     * @param array $config Circuit breaker configuration
     * @param \PDO $pdo Database connection
     */
    public function __construct(string $provider, array $config, \PDO $pdo)
    {
        $this->provider = $provider;
        $this->config = $config;
        $this->pdo = $pdo;
        $this->loadState();
    }

    /**
     * Load state from recent usage logs
     *
     * @return void
     */
    private function loadState(): void
    {
        $window = $this->config['sample_window'] ?? 120;

        try {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as failures, MAX(UNIX_TIMESTAMP(createdAt)) as lastFailure
                FROM agentUsageLog
                WHERE provider = ?
                AND success = 0
                AND createdAt > DATE_SUB(NOW(), INTERVAL ? SECOND)
            ");
            $stmt->execute([$this->provider, $window]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);

            $this->failureCount = (int)($row['failures'] ?? 0);
            $this->lastFailureTime = $row['lastFailure'] ? (int)$row['lastFailure'] : null;
        } catch (\PDOException $e) {
            // If we can't read state, assume closed
            $this->failureCount = 0;
            $this->lastFailureTime = null;
        }

        $this->updateState();
    }

    /**
     * Update circuit state based on failure count and timing
     *
     * @return void
     */
    private function updateState(): void
    {
        $threshold = $this->config['failure_threshold'] ?? 5;
        $recovery = $this->config['recovery_timeout'] ?? 60;

        if ($this->failureCount >= $threshold) {
            // Check if recovery period has passed
            if ($this->lastFailureTime && (time() - $this->lastFailureTime) >= $recovery) {
                $this->state = self::STATE_HALF_OPEN;
                $this->successCount = 0;
            } else {
                $this->state = self::STATE_OPEN;
            }
        } else {
            $this->state = self::STATE_CLOSED;
        }
    }

    /**
     * Check if the circuit allows requests
     *
     * @return bool True if requests are allowed
     */
    public function isAvailable(): bool
    {
        $this->updateState();
        return $this->state !== self::STATE_OPEN;
    }

    /**
     * Record a successful request
     *
     * @return void
     */
    public function recordSuccess(): void
    {
        if ($this->state === self::STATE_HALF_OPEN) {
            $this->successCount++;
            $successThreshold = $this->config['success_threshold'] ?? 2;

            if ($this->successCount >= $successThreshold) {
                $this->state = self::STATE_CLOSED;
                $this->failureCount = 0;
            }
        }
    }

    /**
     * Record a failed request
     *
     * @return void
     */
    public function recordFailure(): void
    {
        $this->failureCount++;
        $this->lastFailureTime = time();
        $this->updateState();
    }

    /**
     * Get current circuit state
     *
     * @return string State (closed, open, half_open)
     */
    public function getState(): string
    {
        return $this->state;
    }

    /**
     * Get current failure count
     *
     * @return int Failure count
     */
    public function getFailureCount(): int
    {
        return $this->failureCount;
    }

    /**
     * Get time until recovery (if open)
     *
     * @return int|null Seconds until recovery, null if not open
     */
    public function getTimeUntilRecovery(): ?int
    {
        if ($this->state !== self::STATE_OPEN || !$this->lastFailureTime) {
            return null;
        }

        $recovery = $this->config['recovery_timeout'] ?? 60;
        $elapsed = time() - $this->lastFailureTime;
        $remaining = $recovery - $elapsed;

        return max(0, $remaining);
    }

    /**
     * Force the circuit to a specific state (for testing)
     *
     * @param string $state State to set
     * @return void
     */
    public function forceState(string $state): void
    {
        if (in_array($state, [self::STATE_CLOSED, self::STATE_OPEN, self::STATE_HALF_OPEN])) {
            $this->state = $state;
            if ($state === self::STATE_CLOSED) {
                $this->failureCount = 0;
            }
        }
    }

    /**
     * Get circuit breaker info for debugging
     *
     * @return array Circuit breaker info
     */
    public function getInfo(): array
    {
        return [
            'provider' => $this->provider,
            'state' => $this->state,
            'failureCount' => $this->failureCount,
            'lastFailureTime' => $this->lastFailureTime,
            'successCount' => $this->successCount,
            'timeUntilRecovery' => $this->getTimeUntilRecovery(),
            'config' => [
                'failureThreshold' => $this->config['failure_threshold'] ?? 5,
                'recoveryTimeout' => $this->config['recovery_timeout'] ?? 60,
                'successThreshold' => $this->config['success_threshold'] ?? 2,
            ],
        ];
    }
}
