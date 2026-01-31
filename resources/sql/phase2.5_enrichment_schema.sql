-- =====================================================
-- Phase 2.5 - Enrichment Backend Schema Migration
-- Run after agent_schema.sql
-- MySQL 8.0 compatible (no IF NOT EXISTS for ADD COLUMN)
-- =====================================================

-- 1. Add drink window columns to wine table
-- Using stored procedure to check if columns exist

DELIMITER //
DROP PROCEDURE IF EXISTS add_phase25_columns//
CREATE PROCEDURE add_phase25_columns()
BEGIN
  -- Wine table columns
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wine' AND COLUMN_NAME = 'drinkWindowStart') THEN
    ALTER TABLE `wine` ADD COLUMN `drinkWindowStart` YEAR DEFAULT NULL COMMENT 'Earliest recommended drinking year';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wine' AND COLUMN_NAME = 'drinkWindowEnd') THEN
    ALTER TABLE `wine` ADD COLUMN `drinkWindowEnd` YEAR DEFAULT NULL COMMENT 'Latest optimal drinking year';
  END IF;

  -- cacheWineEnrichment columns
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'body') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `body` ENUM('Light', 'Medium-Light', 'Medium', 'Medium-Full', 'Full') DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'tannin') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `tannin` ENUM('Low', 'Medium-Low', 'Medium', 'Medium-High', 'High') DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'acidity') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `acidity` ENUM('Low', 'Medium-Low', 'Medium', 'Medium-High', 'High') DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'sweetness') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `sweetness` ENUM('Dry', 'Off-Dry', 'Medium-Sweet', 'Sweet') DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'confidence') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `confidence` DECIMAL(3,2) DEFAULT NULL COMMENT '0.00-1.00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'dataSource') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `dataSource` VARCHAR(100) DEFAULT NULL COMMENT 'web_search, inference, cache';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'hitCount') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `hitCount` INT NOT NULL DEFAULT 0 COMMENT 'Cache hit counter';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'lastAccessedAt') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `lastAccessedAt` TIMESTAMP NULL COMMENT 'Last cache access time';
  END IF;

  -- Narrative content columns (Phase 2.5 enrichment expansion)
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'overview') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `overview` TEXT DEFAULT NULL COMMENT 'AI-generated wine overview/description';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'tastingNotes') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `tastingNotes` TEXT DEFAULT NULL COMMENT 'AI-generated tasting notes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cacheWineEnrichment' AND COLUMN_NAME = 'pairingNotes') THEN
    ALTER TABLE `cacheWineEnrichment` ADD COLUMN `pairingNotes` TEXT DEFAULT NULL COMMENT 'AI-generated food pairing suggestions';
  END IF;
END//
DELIMITER ;

CALL add_phase25_columns();
DROP PROCEDURE IF EXISTS add_phase25_columns;

-- 2. Create critic_scores table for normalized storage
CREATE TABLE IF NOT EXISTS `critic_scores` (
  `scoreID` int NOT NULL AUTO_INCREMENT,
  `wineID` int NOT NULL,
  `critic` varchar(50) NOT NULL COMMENT 'WS, RP, JS, Decanter, etc.',
  `score` int NOT NULL COMMENT '50-100 scale only',
  `scoreYear` year DEFAULT NULL COMMENT 'Year review was published',
  `source` varchar(255) DEFAULT NULL COMMENT 'URL or publication reference',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`scoreID`),
  KEY `idx_wine_critic` (`wineID`, `critic`),
  KEY `idx_score` (`score`),
  CONSTRAINT `fk_critic_scores_wine` FOREIGN KEY (`wineID`)
    REFERENCES `wine` (`wineID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
