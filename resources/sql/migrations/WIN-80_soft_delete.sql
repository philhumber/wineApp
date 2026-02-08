-- ============================================
-- WIN-80: Soft Delete Migration
-- Run against: winelist database
-- Date: 2026-02-08
--
-- IMPORTANT: wine and bottles tables already have deleted/deletedAt/deletedBy
-- columns and idx_deleted indexes. This migration only adds them to
-- producers and region tables.
-- ============================================

-- Verify we're on the right database
-- SELECT DATABASE();

-- ============================================
-- STEP 1: Add soft-delete columns to producers
-- ============================================

ALTER TABLE producers
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `producerName`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- ============================================
-- STEP 2: Add soft-delete columns to region
-- Column order: regionID, regionName, countryID, description, climate, soil, map
-- ============================================

ALTER TABLE region
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `map`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- ============================================
-- STEP 3: Fix UNIQUE constraints
-- MySQL treats NULL as distinct in unique indexes, so:
-- - Active records (deletedAt = NULL) remain unique
-- - Multiple soft-deleted records can coexist with same name
-- ============================================

ALTER TABLE producers
  DROP INDEX `producerName`,
  ADD UNIQUE KEY `uq_producer_active` (`producerName`, `deletedAt`);

ALTER TABLE region
  DROP INDEX `regionName`,
  ADD UNIQUE KEY `uq_region_active` (`regionName`, `deletedAt`);

-- ============================================
-- STEP 4: Add composite indexes for query performance
-- ============================================

-- Optimize "active bottles for a wine" queries
ALTER TABLE bottles
  ADD INDEX `idx_wine_deleted_drunk` (`wineID`, `deleted`, `bottleDrunk`);

-- Optimize wine filtering by type
ALTER TABLE wine
  ADD INDEX `idx_deleted_type` (`deleted`, `typeID`);

-- ============================================
-- VERIFICATION: Check all columns were added
-- ============================================

-- SELECT 'producers' as tbl, COLUMN_NAME, DATA_TYPE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'winelist' AND TABLE_NAME = 'producers' AND COLUMN_NAME IN ('deleted', 'deletedAt', 'deletedBy')
-- UNION ALL
-- SELECT 'region' as tbl, COLUMN_NAME, DATA_TYPE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'winelist' AND TABLE_NAME = 'region' AND COLUMN_NAME IN ('deleted', 'deletedAt', 'deletedBy');

-- ============================================
-- ROLLBACK (if needed - run manually)
-- ============================================
-- ALTER TABLE producers DROP INDEX `uq_producer_active`, ADD UNIQUE KEY `producerName` (`producerName`);
-- ALTER TABLE producers DROP COLUMN `deleted`, DROP COLUMN `deletedAt`, DROP COLUMN `deletedBy`;
-- ALTER TABLE producers DROP INDEX `idx_deleted`;
--
-- ALTER TABLE region DROP INDEX `uq_region_active`, ADD UNIQUE KEY `regionName` (`regionName`);
-- ALTER TABLE region DROP COLUMN `deleted`, DROP COLUMN `deletedAt`, DROP COLUMN `deletedBy`;
-- ALTER TABLE region DROP INDEX `idx_deleted`;
--
-- ALTER TABLE bottles DROP INDEX `idx_wine_deleted_drunk`;
-- ALTER TABLE wine DROP INDEX `idx_deleted_type`;
