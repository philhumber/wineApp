-- =====================================================
-- WIN-181: Identification Analytics
-- Track confidence scores and tier escalation for model analysis
-- =====================================================

-- New table to track identification-level results (not per-LLM-call)
CREATE TABLE IF NOT EXISTS agentIdentificationResults (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL DEFAULT 1,
    sessionId INT NULL,

    -- Input metadata
    inputType ENUM('text', 'image') NOT NULL,
    inputHash VARCHAR(64) NULL COMMENT 'Hash of input for dedup analysis',

    -- Final result
    finalConfidence INT NOT NULL COMMENT '0-100 confidence score',
    finalAction VARCHAR(30) NOT NULL COMMENT 'auto_populate, suggest, user_choice, disambiguate',
    finalTier VARCHAR(20) NOT NULL COMMENT 'tier1, tier1_5, tier2, tier3, user_choice',

    -- Per-tier confidence (NULL if tier not reached)
    tier1Confidence INT NULL COMMENT 'Gemini Flash (low thinking)',
    tier1_5Confidence INT NULL COMMENT 'Gemini Flash (high thinking)',
    tier2Confidence INT NULL COMMENT 'Claude Sonnet',
    tier3Confidence INT NULL COMMENT 'Claude Opus (user-triggered)',

    -- Models used
    tier1Model VARCHAR(50) NULL,
    tier1_5Model VARCHAR(50) NULL,
    tier2Model VARCHAR(50) NULL,
    tier3Model VARCHAR(50) NULL,

    -- Cost breakdown
    totalCostUSD DECIMAL(10,6) NOT NULL DEFAULT 0,
    totalLatencyMs INT NULL,

    -- Wine identification (for quality analysis)
    identifiedProducer VARCHAR(255) NULL,
    identifiedWineName VARCHAR(255) NULL,
    identifiedVintage INT NULL,
    identifiedRegion VARCHAR(100) NULL,

    -- User feedback (for accuracy tracking - future)
    userAccepted BOOLEAN NULL COMMENT 'Did user confirm this identification?',
    userCorrected BOOLEAN NULL COMMENT 'Did user make corrections?',

    -- Inference tracking
    inferencesApplied JSON NULL COMMENT 'Array of inference types applied',

    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_userId_date (userId, createdAt),
    INDEX idx_finalTier (finalTier, createdAt),
    INDEX idx_confidence (finalConfidence),
    INDEX idx_action (finalAction),
    INDEX idx_inputType (inputType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add helpful view for quick analysis
CREATE OR REPLACE VIEW vw_model_confidence_stats AS
SELECT
    finalTier,
    inputType,
    COUNT(*) as total_identifications,
    ROUND(AVG(finalConfidence), 1) as avg_confidence,
    ROUND(MIN(finalConfidence)) as min_confidence,
    ROUND(MAX(finalConfidence)) as max_confidence,
    SUM(CASE WHEN finalAction = 'auto_populate' THEN 1 ELSE 0 END) as auto_populate_count,
    SUM(CASE WHEN finalAction = 'suggest' THEN 1 ELSE 0 END) as suggest_count,
    SUM(CASE WHEN finalAction = 'user_choice' THEN 1 ELSE 0 END) as user_choice_count,
    ROUND(AVG(totalCostUSD), 6) as avg_cost,
    ROUND(AVG(totalLatencyMs)) as avg_latency_ms
FROM agentIdentificationResults
GROUP BY finalTier, inputType;

-- View for tier escalation analysis
CREATE OR REPLACE VIEW vw_tier_escalation_analysis AS
SELECT
    DATE(createdAt) as date,
    COUNT(*) as total,
    SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) as resolved_tier1,
    SUM(CASE WHEN finalTier = 'tier1_5' THEN 1 ELSE 0 END) as resolved_tier1_5,
    SUM(CASE WHEN finalTier = 'tier2' THEN 1 ELSE 0 END) as resolved_tier2,
    SUM(CASE WHEN finalTier = 'tier3' THEN 1 ELSE 0 END) as resolved_tier3,
    SUM(CASE WHEN finalTier = 'user_choice' THEN 1 ELSE 0 END) as user_choice,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_tier1,
    ROUND(100.0 * SUM(CASE WHEN finalAction = 'auto_populate' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_auto_populate,
    ROUND(AVG(finalConfidence), 1) as avg_confidence,
    ROUND(SUM(totalCostUSD), 4) as total_cost
FROM agentIdentificationResults
GROUP BY DATE(createdAt)
ORDER BY date DESC;

-- View for model comparison (which model performs best?)
CREATE OR REPLACE VIEW vw_model_comparison AS
SELECT
    'tier1' as tier,
    tier1Model as model,
    COUNT(*) as times_used,
    ROUND(AVG(tier1Confidence), 1) as avg_confidence,
    SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) as times_was_final,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_resolved
FROM agentIdentificationResults
WHERE tier1Confidence IS NOT NULL
GROUP BY tier1Model

UNION ALL

SELECT
    'tier1_5' as tier,
    tier1_5Model as model,
    COUNT(*) as times_used,
    ROUND(AVG(tier1_5Confidence), 1) as avg_confidence,
    SUM(CASE WHEN finalTier = 'tier1_5' THEN 1 ELSE 0 END) as times_was_final,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier1_5' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_resolved
FROM agentIdentificationResults
WHERE tier1_5Confidence IS NOT NULL
GROUP BY tier1_5Model

UNION ALL

SELECT
    'tier2' as tier,
    tier2Model as model,
    COUNT(*) as times_used,
    ROUND(AVG(tier2Confidence), 1) as avg_confidence,
    SUM(CASE WHEN finalTier = 'tier2' THEN 1 ELSE 0 END) as times_was_final,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier2' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_resolved
FROM agentIdentificationResults
WHERE tier2Confidence IS NOT NULL
GROUP BY tier2Model

UNION ALL

SELECT
    'tier3' as tier,
    tier3Model as model,
    COUNT(*) as times_used,
    ROUND(AVG(tier3Confidence), 1) as avg_confidence,
    SUM(CASE WHEN finalTier = 'tier3' THEN 1 ELSE 0 END) as times_was_final,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier3' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_resolved
FROM agentIdentificationResults
WHERE tier3Confidence IS NOT NULL
GROUP BY tier3Model;
