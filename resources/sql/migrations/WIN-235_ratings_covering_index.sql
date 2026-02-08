-- ============================================
-- WIN-235: Covering index for rating aggregation
-- Run against: winelist / winelist_test
-- ============================================
-- Covers getWines.php subqueries: avgRating, avgOverallRating,
-- avgValueRating, buyAgainPercent, ratingCount
-- MySQL can satisfy these queries entirely from the index (no table access)

CREATE INDEX idx_ratings_wine_scores
ON ratings (wineID, overallRating, valueRating, buyAgain);
