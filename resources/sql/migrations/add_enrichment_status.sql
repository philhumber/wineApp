-- Migration: Add enrichment_status to wine table
-- Date: 2026-02-01
-- Description: Adds enrichment tracking column for background AI enrichment
--
-- enrichment_status semantics:
--   NULL     = Legacy wine (pre-enrichment era, never evaluated)
--   'pending' = Newly added, queued for background enrichment
--   'complete' = Enrichment finished successfully
--   'failed'  = Enrichment attempted but failed
--
-- Run on test first:
--   mysql -h 10.0.0.16 -u username -p winelist_test < resources/sql/migrations/add_enrichment_status.sql
--
-- Then on production:
--   mysql -h 10.0.0.16 -u username -p winelist < resources/sql/migrations/add_enrichment_status.sql

-- Add column with explicit DEFAULT NULL for clarity
ALTER TABLE `wine`
ADD COLUMN `enrichment_status` ENUM('pending', 'complete', 'failed') DEFAULT NULL
COMMENT 'AI enrichment: NULL=legacy, pending=queued, complete=done, failed=error'
AFTER `deletedBy`;

-- Add index for background worker queries (e.g., SELECT ... WHERE enrichment_status = 'pending')
ALTER TABLE `wine` ADD KEY `idx_enrichment_status` (`enrichment_status`);

-- Set existing wines to 'complete' (assume already have adequate data)
-- Note: This is a deliberate choice - existing wines are treated as "good enough"
-- Future enhancement could re-evaluate which wines need enrichment
UPDATE `wine` SET `enrichment_status` = 'complete' WHERE `enrichment_status` IS NULL;

-- ─────────────────────────────────────────────────────────
-- Rollback (if needed):
-- ─────────────────────────────────────────────────────────
-- ALTER TABLE `wine` DROP KEY `idx_enrichment_status`;
-- ALTER TABLE `wine` DROP COLUMN `enrichment_status`;
