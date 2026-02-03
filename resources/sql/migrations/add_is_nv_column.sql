-- Migration: Add isNonVintage column to wine table
-- Date: 2026-02-01
-- JIRA: WIN-176
-- Description: Adds boolean flag for non-vintage wines (NV)
--
-- Run on test first:
--   mysql -h 10.0.0.16 -u username -p winelist_test < resources/sql/migrations/add_is_nv_column.sql
--
-- Then on production:
--   mysql -h 10.0.0.16 -u username -p winelist < resources/sql/migrations/add_is_nv_column.sql

DELIMITER //
DROP PROCEDURE IF EXISTS add_isNonVintage_column//
CREATE PROCEDURE add_isNonVintage_column()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'wine'
                 AND COLUMN_NAME = 'isNonVintage') THEN
    ALTER TABLE `wine` ADD COLUMN `isNonVintage` TINYINT(1) DEFAULT 0
      COMMENT 'Flag for non-vintage wines (NV)' AFTER year;
  END IF;
END//
DELIMITER ;

CALL add_isNonVintage_column();
DROP PROCEDURE IF EXISTS add_isNonVintage_column;

-- ─────────────────────────────────────────────────────────
-- Data Migration: Existing NULL years → isNonVintage=1
-- ─────────────────────────────────────────────────────────
UPDATE `wine` SET `isNonVintage` = 1 WHERE year IS NULL;

-- ─────────────────────────────────────────────────────────
-- Rollback (if needed):
-- ─────────────────────────────────────────────────────────
-- UPDATE `wine` SET `isNonVintage` = 0;
-- ALTER TABLE `wine` DROP COLUMN `isNonVintage`;
