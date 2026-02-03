-- Migration: WIN-153 - Add normalizedName column to refAppellations for indexed lookup
-- This allows efficient querying without runtime LOWER(REPLACE()) computation

-- Add the column with index
ALTER TABLE refAppellations
  ADD COLUMN normalizedName VARCHAR(150) NOT NULL DEFAULT '' AFTER appellationName;

-- Populate with normalized values (lowercase, no spaces, hyphens, or common accents)
UPDATE refAppellations
SET normalizedName = LOWER(
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    appellationName,
    '-', ''), ' ', ''), 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'à', 'a'), 'ô', 'o'), 'û', 'u'), 'ï', 'i'
  )
);

-- Add index for fast lookups
ALTER TABLE refAppellations
  ADD INDEX idx_normalizedName (normalizedName);

-- Verify migration (optional check)
-- SELECT appellationName, normalizedName FROM refAppellations LIMIT 10;
