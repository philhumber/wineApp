<?php
/**
 * Cost Tracker
 *
 * Tracks LLM usage and costs. Logs each request to agentUsageLog
 * and maintains daily aggregates in agentUsageDaily.
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

class CostTracker
{
    /** @var \PDO Database connection */
    private \PDO $pdo;

    /** @var int User ID */
    private int $userId;

    /** @var int|null Session ID */
    private ?int $sessionId;

    /**
     * Create a new cost tracker
     *
     * @param \PDO $pdo Database connection
     * @param int $userId User ID for tracking
     * @param int|null $sessionId Optional session ID
     */
    public function __construct(\PDO $pdo, int $userId = 1, ?int $sessionId = null)
    {
        $this->pdo = $pdo;
        $this->userId = $userId;
        $this->sessionId = $sessionId;
    }

    /**
     * Log an LLM response
     *
     * @param LLMResponse $response The LLM response to log
     * @param string $taskType The type of task (identify_text, enrich, pair, etc.)
     * @return int The inserted log ID
     */
    public function log(LLMResponse $response, string $taskType): int
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO agentUsageLog
            (userId, sessionId, provider, model, taskType, inputTokens, outputTokens,
             costUSD, latencyMs, success, errorType, errorMessage, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");

        $stmt->execute([
            $this->userId,
            $this->sessionId,
            $response->provider,
            $response->model,
            $taskType,
            $response->inputTokens,
            $response->outputTokens,
            $response->costUSD,
            $response->latencyMs,
            $response->success ? 1 : 0,
            $response->errorType,
            $response->error,
        ]);

        $logId = (int)$this->pdo->lastInsertId();

        // Update daily aggregates
        $this->updateDailyAggregate($response);

        return $logId;
    }

    /**
     * Update daily usage aggregates
     *
     * @param LLMResponse $response The LLM response
     * @return void
     */
    private function updateDailyAggregate(LLMResponse $response): void
    {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO agentUsageDaily
                (userId, date, provider, requestCount, successCount, failureCount,
                 totalInputTokens, totalOutputTokens, totalCostUSD, avgLatencyMs)
                VALUES (?, CURDATE(), ?, 1, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    requestCount = requestCount + 1,
                    successCount = successCount + VALUES(successCount),
                    failureCount = failureCount + VALUES(failureCount),
                    totalInputTokens = totalInputTokens + VALUES(totalInputTokens),
                    totalOutputTokens = totalOutputTokens + VALUES(totalOutputTokens),
                    totalCostUSD = totalCostUSD + VALUES(totalCostUSD),
                    avgLatencyMs = ((avgLatencyMs * requestCount) + VALUES(avgLatencyMs)) / (requestCount + 1),
                    updatedAt = NOW()
            ");

            $stmt->execute([
                $this->userId,
                $response->provider,
                $response->success ? 1 : 0,
                $response->success ? 0 : 1,
                $response->inputTokens,
                $response->outputTokens,
                $response->costUSD,
                $response->latencyMs,
            ]);
        } catch (\PDOException $e) {
            // Log but don't fail if aggregate update fails
            error_log("Failed to update daily aggregate: " . $e->getMessage());
        }
    }

    /**
     * Get daily usage for current user
     *
     * @return array Usage data with requests and cost
     */
    public function getDailyUsage(): array
    {
        $stmt = $this->pdo->prepare("
            SELECT
                COALESCE(SUM(requestCount), 0) as requests,
                COALESCE(SUM(totalCostUSD), 0) as cost
            FROM agentUsageDaily
            WHERE userId = ? AND date = CURDATE()
        ");
        $stmt->execute([$this->userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        return [
            'requests' => (int)($row['requests'] ?? 0),
            'cost' => (float)($row['cost'] ?? 0),
        ];
    }

    /**
     * Check if usage is within limits
     *
     * @param array $limits Limits configuration
     * @return array Array of limit errors (empty if within limits)
     */
    public function checkLimits(array $limits): array
    {
        $usage = $this->getDailyUsage();
        $errors = [];

        if ($usage['requests'] >= ($limits['daily_requests'] ?? 100)) {
            $errors[] = 'Daily request limit reached';
        }

        if ($usage['cost'] >= ($limits['daily_cost_usd'] ?? 5.00)) {
            $errors[] = 'Daily cost limit reached';
        }

        return $errors;
    }

    /**
     * Get detailed usage statistics
     *
     * @param int $days Number of days to include
     * @return array Detailed usage statistics
     */
    public function getDetailedStats(int $days = 7): array
    {
        $stmt = $this->pdo->prepare("
            SELECT
                date,
                provider,
                SUM(requestCount) as requests,
                SUM(successCount) as successes,
                SUM(failureCount) as failures,
                SUM(totalInputTokens) as inputTokens,
                SUM(totalOutputTokens) as outputTokens,
                SUM(totalCostUSD) as cost,
                AVG(avgLatencyMs) as avgLatency
            FROM agentUsageDaily
            WHERE userId = ?
            AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY date, provider
            ORDER BY date DESC, provider
        ");
        $stmt->execute([$this->userId, $days]);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Get recent requests for debugging
     *
     * @param int $limit Number of requests to return
     * @return array Recent requests
     */
    public function getRecentRequests(int $limit = 10): array
    {
        $stmt = $this->pdo->prepare("
            SELECT
                id, provider, model, taskType,
                inputTokens, outputTokens, costUSD,
                latencyMs, success, errorType, createdAt
            FROM agentUsageLog
            WHERE userId = ?
            ORDER BY createdAt DESC
            LIMIT ?
        ");
        $stmt->execute([$this->userId, $limit]);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Set session ID for tracking
     *
     * @param int|null $sessionId Session ID
     * @return void
     */
    public function setSessionId(?int $sessionId): void
    {
        $this->sessionId = $sessionId;
    }

    /**
     * Get cost summary for a date range
     *
     * @param string $startDate Start date (Y-m-d)
     * @param string $endDate End date (Y-m-d)
     * @return array Cost summary by provider
     */
    public function getCostSummary(string $startDate, string $endDate): array
    {
        $stmt = $this->pdo->prepare("
            SELECT
                provider,
                SUM(requestCount) as requests,
                SUM(totalCostUSD) as totalCost,
                SUM(totalInputTokens) as inputTokens,
                SUM(totalOutputTokens) as outputTokens
            FROM agentUsageDaily
            WHERE userId = ?
            AND date BETWEEN ? AND ?
            GROUP BY provider
        ");
        $stmt->execute([$this->userId, $startDate, $endDate]);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Log an identification result for analytics
     *
     * Logs confidence scores and tier escalation data for analyzing
     * model performance across the tiered escalation system.
     *
     * @param array $result The identification result from IdentificationService
     * @return int The inserted log ID
     */
    public function logIdentificationResult(array $result): int
    {
        // Extract escalation data
        $escalation = $result['escalation'] ?? [];
        $tiers = $escalation['tiers'] ?? [];
        $parsed = $result['parsed'] ?? [];

        $stmt = $this->pdo->prepare("
            INSERT INTO agentIdentificationResults
            (userId, sessionId, inputType, inputHash,
             finalConfidence, finalAction, finalTier,
             tier1Confidence, tier1_5Confidence, tier2Confidence, tier3Confidence,
             tier1Model, tier1_5Model, tier2Model, tier3Model,
             totalCostUSD, totalLatencyMs,
             identifiedProducer, identifiedWineName, identifiedVintage, identifiedRegion,
             inferencesApplied, createdAt)
            VALUES (?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?, ?,
                    ?, NOW())
        ");

        $stmt->execute([
            $this->userId,
            $this->sessionId,
            $result['inputType'] ?? 'text',
            null, // inputHash - could be added later for dedup

            $result['confidence'] ?? 0,
            $result['action'] ?? 'unknown',
            $escalation['final_tier'] ?? 'unknown',

            $tiers['tier1']['confidence'] ?? null,
            $tiers['tier1_5']['confidence'] ?? null,
            $tiers['tier2']['confidence'] ?? null,
            $tiers['tier3']['confidence'] ?? null,

            $tiers['tier1']['model'] ?? null,
            $tiers['tier1_5']['model'] ?? null,
            $tiers['tier2']['model'] ?? null,
            $tiers['tier3']['model'] ?? null,

            $escalation['total_cost'] ?? 0,
            $result['usage']['latencyMs'] ?? null,

            $parsed['producer'] ?? null,
            $parsed['wineName'] ?? null,
            $parsed['vintage'] ?? null,
            $parsed['region'] ?? null,

            !empty($result['inferences_applied']) ? json_encode($result['inferences_applied']) : null,
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    /**
     * Get identification analytics summary
     *
     * @param int $days Number of days to analyze
     * @return array Analytics data
     */
    public function getIdentificationAnalytics(int $days = 7): array
    {
        // Tier resolution stats
        $tierStats = $this->pdo->prepare("
            SELECT
                finalTier,
                COUNT(*) as count,
                ROUND(AVG(finalConfidence), 1) as avgConfidence,
                ROUND(SUM(totalCostUSD), 4) as totalCost
            FROM agentIdentificationResults
            WHERE userId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY finalTier
            ORDER BY count DESC
        ");
        $tierStats->execute([$this->userId, $days]);

        // Model performance
        $modelStats = $this->pdo->prepare("
            SELECT * FROM vw_model_comparison
        ");
        $modelStats->execute();

        // Daily trends
        $dailyTrends = $this->pdo->prepare("
            SELECT * FROM vw_tier_escalation_analysis
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ");
        $dailyTrends->execute([$days]);

        return [
            'tierStats' => $tierStats->fetchAll(\PDO::FETCH_ASSOC),
            'modelStats' => $modelStats->fetchAll(\PDO::FETCH_ASSOC),
            'dailyTrends' => $dailyTrends->fetchAll(\PDO::FETCH_ASSOC),
        ];
    }
}
