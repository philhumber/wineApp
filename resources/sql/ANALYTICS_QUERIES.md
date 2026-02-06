# Agent Identification Analytics Queries

Quick reference for analyzing wine identification performance.

## Pre-built Views

```sql
-- Quick stats by tier and input type
SELECT * FROM vw_model_confidence_stats;

-- Daily escalation trends
SELECT * FROM vw_tier_escalation_analysis;

-- Model comparison across tiers
SELECT * FROM vw_model_comparison;
```

## Useful Ad-Hoc Queries

### Overall Performance

```sql
-- Summary of all identifications
SELECT
    COUNT(*) as total,
    ROUND(AVG(finalConfidence), 1) as avg_confidence,
    SUM(CASE WHEN finalAction = 'auto_populate' THEN 1 ELSE 0 END) as high_confidence,
    SUM(CASE WHEN finalAction = 'suggest' THEN 1 ELSE 0 END) as medium_confidence,
    SUM(CASE WHEN finalAction = 'user_choice' THEN 1 ELSE 0 END) as low_confidence,
    ROUND(SUM(totalCostUSD), 4) as total_cost_usd
FROM agentIdentificationResults;
```

### Tier Escalation Analysis

```sql
-- How often does each tier resolve the identification?
SELECT
    finalTier,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM agentIdentificationResults), 1) as pct
FROM agentIdentificationResults
GROUP BY finalTier
ORDER BY count DESC;

-- What percentage escalates past tier 1?
SELECT
    ROUND(100.0 * SUM(CASE WHEN finalTier != 'tier1' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_escalated
FROM agentIdentificationResults;
```

### Confidence Distribution

```sql
-- Confidence distribution by tier
SELECT
    finalTier,
    COUNT(*) as count,
    MIN(finalConfidence) as min_conf,
    ROUND(AVG(finalConfidence), 1) as avg_conf,
    MAX(finalConfidence) as max_conf
FROM agentIdentificationResults
GROUP BY finalTier;

-- Confidence buckets
SELECT
    CASE
        WHEN finalConfidence >= 85 THEN '85-100 (auto)'
        WHEN finalConfidence >= 70 THEN '70-84 (suggest)'
        WHEN finalConfidence >= 60 THEN '60-69 (choice)'
        ELSE '0-59 (low)'
    END as confidence_bucket,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM agentIdentificationResults), 1) as pct
FROM agentIdentificationResults
GROUP BY confidence_bucket
ORDER BY MIN(finalConfidence) DESC;
```

### Escalation Effectiveness

```sql
-- Did escalation improve confidence?
SELECT
    finalTier,
    ROUND(AVG(tier1Confidence), 1) as avg_tier1,
    ROUND(AVG(tier1_5Confidence), 1) as avg_tier1_5,
    ROUND(AVG(tier2Confidence), 1) as avg_tier2,
    ROUND(AVG(finalConfidence), 1) as avg_final,
    COUNT(*) as count
FROM agentIdentificationResults
WHERE finalTier IN ('tier1_5', 'tier2')
GROUP BY finalTier;

-- Tier 1 → Tier 1.5 improvement
SELECT
    COUNT(*) as escalations,
    ROUND(AVG(tier1_5Confidence - tier1Confidence), 1) as avg_improvement,
    SUM(CASE WHEN tier1_5Confidence > tier1Confidence THEN 1 ELSE 0 END) as improved,
    SUM(CASE WHEN tier1_5Confidence <= tier1Confidence THEN 1 ELSE 0 END) as no_improvement
FROM agentIdentificationResults
WHERE tier1_5Confidence IS NOT NULL AND tier1Confidence IS NOT NULL;
```

### Cost Analysis

```sql
-- Cost by tier
SELECT
    finalTier,
    COUNT(*) as count,
    ROUND(AVG(totalCostUSD), 6) as avg_cost,
    ROUND(SUM(totalCostUSD), 4) as total_cost
FROM agentIdentificationResults
GROUP BY finalTier;

-- Daily cost trend
SELECT
    DATE(createdAt) as date,
    COUNT(*) as identifications,
    ROUND(SUM(totalCostUSD), 4) as total_cost,
    ROUND(AVG(totalCostUSD), 6) as avg_cost
FROM agentIdentificationResults
GROUP BY DATE(createdAt)
ORDER BY date DESC
LIMIT 14;
```

### Image vs Text Performance

```sql
-- Compare image and text identification
SELECT
    inputType,
    COUNT(*) as count,
    ROUND(AVG(finalConfidence), 1) as avg_confidence,
    SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) as tier1_resolved,
    ROUND(100.0 * SUM(CASE WHEN finalTier = 'tier1' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_tier1
FROM agentIdentificationResults
GROUP BY inputType;
```

### Recent Activity

```sql
-- Last 20 identifications
SELECT
    id,
    DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as time,
    inputType,
    finalTier,
    finalConfidence,
    finalAction,
    identifiedProducer,
    identifiedWineName
FROM agentIdentificationResults
ORDER BY id DESC
LIMIT 20;
```

### Decision: Is Tier 1 threshold too high?

```sql
-- If we lowered tier 1 threshold from 85 to 80, how many would auto-populate?
SELECT
    CASE WHEN tier1Confidence >= 85 THEN 'Would auto (85+)'
         WHEN tier1Confidence >= 80 THEN 'Would auto if 80+ threshold'
         ELSE 'Would still escalate'
    END as scenario,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM agentIdentificationResults), 1) as pct
FROM agentIdentificationResults
WHERE tier1Confidence IS NOT NULL
GROUP BY scenario;
```

## Database Connection

```bash
# Test database
mysql -h 10.0.0.16 -u root -pDedoSQL1! winelist_test

# Production database
mysql -h 10.0.0.16 -u root -pDedoSQL1! winelist
```
