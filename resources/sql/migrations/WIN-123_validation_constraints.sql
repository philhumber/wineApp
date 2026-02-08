-- WIN-123: Field Validation — Database CHECK constraints
-- Ratings (1-10 main, 1-5 optional with NULL = not rated)
-- Bottles (price non-negative)
-- Note: MySQL 8.0 requires individual ALTER statements (no multi-ADD for CHECK)

-- Ratings constraints
ALTER TABLE ratings ADD CONSTRAINT chk_overall_range CHECK (overallRating BETWEEN 1 AND 10);
ALTER TABLE ratings ADD CONSTRAINT chk_value_range CHECK (valueRating BETWEEN 1 AND 10);
ALTER TABLE ratings ADD CONSTRAINT chk_complexity_range CHECK (complexityRating IS NULL OR complexityRating BETWEEN 1 AND 5);
ALTER TABLE ratings ADD CONSTRAINT chk_drinkability_range CHECK (drinkabilityRating IS NULL OR drinkabilityRating BETWEEN 1 AND 5);
ALTER TABLE ratings ADD CONSTRAINT chk_surprise_range CHECK (surpriseRating IS NULL OR surpriseRating BETWEEN 1 AND 5);
ALTER TABLE ratings ADD CONSTRAINT chk_foodpairing_range CHECK (foodPairingRating IS NULL OR foodPairingRating BETWEEN 1 AND 5);

-- Bottles price constraint
ALTER TABLE bottles ADD CONSTRAINT chk_price_nonneg CHECK (price IS NULL OR price >= 0);

-- Verification
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
ORDER BY CONSTRAINT_NAME;

-- Rollback (run manually if needed):
-- ALTER TABLE ratings DROP CHECK chk_overall_range;
-- ALTER TABLE ratings DROP CHECK chk_value_range;
-- ALTER TABLE ratings DROP CHECK chk_complexity_range;
-- ALTER TABLE ratings DROP CHECK chk_drinkability_range;
-- ALTER TABLE ratings DROP CHECK chk_surprise_range;
-- ALTER TABLE ratings DROP CHECK chk_foodpairing_range;
-- ALTER TABLE bottles DROP CHECK chk_price_nonneg;
