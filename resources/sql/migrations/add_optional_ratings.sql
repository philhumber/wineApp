-- Migration: Add optional ratings to ratings table
-- Date: 2026-01-20
-- JIRA: WIN-70
-- Description: Adds 4 new optional rating columns for enhanced wine rating experience
--
-- Run on test first:
--   mysql -h 10.0.0.16 -u username -p winelist_test < resources/sql/migrations/add_optional_ratings.sql
--
-- Then on production:
--   mysql -h 10.0.0.16 -u username -p winelist < resources/sql/migrations/add_optional_ratings.sql

ALTER TABLE `ratings`
  ADD COLUMN `complexityRating` TINYINT NULL DEFAULT NULL
    COMMENT 'Optional 0-5: Simple to Multi-layered',
  ADD COLUMN `drinkabilityRating` TINYINT NULL DEFAULT NULL
    COMMENT 'Optional 0-5: Demanding to Easy drinking',
  ADD COLUMN `surpriseRating` TINYINT NULL DEFAULT NULL
    COMMENT 'Optional 0-5: Met expectations to Exceeded',
  ADD COLUMN `foodPairingRating` TINYINT NULL DEFAULT NULL
    COMMENT 'Optional 0-5: Poor match to Perfect pairing';
