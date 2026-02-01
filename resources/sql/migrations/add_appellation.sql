-- Migration: Add appellation column to wine table
-- Date: 2026-02-01
-- Issue: WIN-148 - Region inference returns villages instead of regions
--
-- Purpose: Store specific appellation (e.g., Margaux, Pauillac) separately from region (e.g., Bordeaux)
-- This allows us to capture granular appellation data for future filtering/display
-- while maintaining region for database matching.

-- Add appellation column after year (geographical context)
ALTER TABLE wine
ADD COLUMN appellation VARCHAR(150) NULL
COMMENT 'Specific appellation (e.g., Margaux, Pauillac) - more granular than region'
AFTER year;

-- Add index for future filtering
CREATE INDEX idx_wine_appellation ON wine(appellation);
