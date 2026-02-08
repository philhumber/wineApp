-- WIN-144: Support enrichment data in addWine flow

-- Allow null percentage when enrichment doesn't provide it
ALTER TABLE grapemix MODIFY mixPercent decimal(10,0) DEFAULT NULL;

-- Trim trailing spaces from grape names before adding UNIQUE constraint
-- (MySQL 8 NO PAD collation treats "Chardonnay" and "Chardonnay " as different)
UPDATE grapes SET grapeName = TRIM(grapeName) WHERE grapeName != TRIM(grapeName);

-- Prevent duplicate grape names (charset utf8mb4_0900_ai_ci is already case-insensitive)
ALTER TABLE grapes ADD UNIQUE KEY idx_grapeName (grapeName);
