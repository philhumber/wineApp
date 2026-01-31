<?php
/**
 * Disambiguation Handler
 *
 * Finds candidate matches when confidence is low.
 * Searches the user's collection and reference data for potential matches.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class DisambiguationHandler
{
    /** @var \PDO Database connection */
    private \PDO $pdo;

    /** @var int Maximum candidates to return */
    private int $maxCandidates = 5;

    /**
     * Create a new disambiguation handler
     *
     * @param \PDO $pdo Database connection
     */
    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Find candidate matches for parsed wine data
     *
     * @param array $parsed Parsed wine data
     * @return array Candidate matches sorted by confidence
     */
    public function findCandidates(array $parsed): array
    {
        $candidates = [];

        // Search existing wines in collection
        if (!empty($parsed['producer']) || !empty($parsed['wineName'])) {
            $collectionMatches = $this->searchCollection($parsed);
            foreach ($collectionMatches as $match) {
                $candidates[] = [
                    'source' => 'collection',
                    'confidence' => $match['matchScore'],
                    'data' => $match,
                ];
            }
        }

        // Search reference data (appellations)
        if (!empty($parsed['region'])) {
            $refMatches = $this->searchAppellations($parsed['region']);
            foreach ($refMatches as $match) {
                $candidates[] = [
                    'source' => 'reference',
                    'confidence' => $match['matchScore'],
                    'data' => $match,
                ];
            }
        }

        // Sort by confidence descending
        usort($candidates, fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        // Return top candidates
        return array_slice($candidates, 0, $this->maxCandidates);
    }

    /**
     * Search user's wine collection for matches
     *
     * @param array $parsed Parsed wine data
     * @return array Matching wines from collection
     */
    private function searchCollection(array $parsed): array
    {
        $matches = [];

        try {
            // Build search query
            $searchTerms = [];
            $params = [];

            if (!empty($parsed['producer'])) {
                $searchTerms[] = "p.producerName LIKE ?";
                $params[] = '%' . $parsed['producer'] . '%';
            }

            if (!empty($parsed['wineName'])) {
                $searchTerms[] = "w.wineName LIKE ?";
                $params[] = '%' . $parsed['wineName'] . '%';
            }

            if (empty($searchTerms)) {
                return [];
            }

            $whereClause = implode(' OR ', $searchTerms);

            $stmt = $this->pdo->prepare("
                SELECT
                    w.wineID,
                    w.wineName,
                    w.year AS vintage,
                    p.producerName,
                    r.regionName,
                    c.countryName,
                    t.wineType AS typeName
                FROM wine w
                LEFT JOIN producers p ON w.producerID = p.producerID
                LEFT JOIN region r ON p.regionID = r.regionID
                LEFT JOIN country c ON r.countryID = c.countryID
                LEFT JOIN winetype t ON w.wineTypeID = t.wineTypeID
                WHERE {$whereClause}
                LIMIT 10
            ");

            $stmt->execute($params);

            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                $row['matchScore'] = $this->calculateMatchScore($row, $parsed);
                $matches[] = $row;
            }

            // Sort by match score
            usort($matches, fn($a, $b) => $b['matchScore'] <=> $a['matchScore']);

        } catch (\PDOException $e) {
            // Log error but don't fail
            error_log("Disambiguation collection search failed: " . $e->getMessage());
        }

        return array_slice($matches, 0, $this->maxCandidates);
    }

    /**
     * Search appellation reference data
     *
     * @param string $region Region to search
     * @return array Matching appellations
     */
    private function searchAppellations(string $region): array
    {
        $matches = [];

        try {
            $stmt = $this->pdo->prepare("
                SELECT
                    appellationName,
                    country,
                    region,
                    subRegion,
                    wineTypes,
                    primaryGrapes,
                    classificationLevel
                FROM refAppellations
                WHERE appellationName LIKE ?
                OR region LIKE ?
                OR subRegion LIKE ?
                LIMIT 5
            ");

            $search = '%' . $region . '%';
            $stmt->execute([$search, $search, $search]);

            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                // Parse JSON fields
                if ($row['wineTypes']) {
                    $row['wineTypes'] = json_decode($row['wineTypes'], true);
                }
                if ($row['primaryGrapes']) {
                    $row['primaryGrapes'] = json_decode($row['primaryGrapes'], true);
                }

                // Calculate match score based on name similarity
                $row['matchScore'] = $this->calculateStringSimilarity($region, $row['appellationName']);
                $matches[] = $row;
            }

        } catch (\PDOException $e) {
            // Log error but don't fail
            error_log("Disambiguation appellation search failed: " . $e->getMessage());
        }

        return $matches;
    }

    /**
     * Calculate match score between existing wine and parsed data
     *
     * @param array $existing Existing wine data
     * @param array $parsed Parsed wine data
     * @return int Match score (0-100)
     */
    private function calculateMatchScore(array $existing, array $parsed): int
    {
        $score = 50; // Base score

        // Producer match (30% weight)
        if (!empty($parsed['producer']) && !empty($existing['producerName'])) {
            $similarity = $this->calculateStringSimilarity(
                $parsed['producer'],
                $existing['producerName']
            );
            $score += $similarity * 0.3;
        }

        // Wine name match (20% weight)
        if (!empty($parsed['wineName']) && !empty($existing['wineName'])) {
            $similarity = $this->calculateStringSimilarity(
                $parsed['wineName'],
                $existing['wineName']
            );
            $score += $similarity * 0.2;
        }

        // Vintage match (20% weight)
        if (!empty($parsed['vintage']) && !empty($existing['vintage'])) {
            if ($parsed['vintage'] === (string)$existing['vintage']) {
                $score += 20;
            }
        }

        // Region match (15% weight)
        if (!empty($parsed['region']) && !empty($existing['regionName'])) {
            $similarity = $this->calculateStringSimilarity(
                $parsed['region'],
                $existing['regionName']
            );
            $score += $similarity * 0.15;
        }

        // Type match (10% weight)
        if (!empty($parsed['wineType']) && !empty($existing['typeName'])) {
            if (strtolower($parsed['wineType']) === strtolower($existing['typeName'])) {
                $score += 10;
            }
        }

        // Country match (5% weight)
        if (!empty($parsed['country']) && !empty($existing['countryName'])) {
            if (strtolower($parsed['country']) === strtolower($existing['countryName'])) {
                $score += 5;
            }
        }

        return min(100, (int)$score);
    }

    /**
     * Calculate string similarity percentage
     *
     * @param string $str1 First string
     * @param string $str2 Second string
     * @return float Similarity percentage (0-100)
     */
    private function calculateStringSimilarity(string $str1, string $str2): float
    {
        $str1 = strtolower(trim($str1));
        $str2 = strtolower(trim($str2));

        if ($str1 === $str2) {
            return 100.0;
        }

        $maxLen = max(strlen($str1), strlen($str2));
        if ($maxLen === 0) {
            return 100.0;
        }

        // Use Levenshtein distance
        $distance = levenshtein($str1, $str2);
        return round((1 - $distance / $maxLen) * 100, 1);
    }

    /**
     * Set maximum candidates to return
     *
     * @param int $max Maximum candidates
     * @return void
     */
    public function setMaxCandidates(int $max): void
    {
        $this->maxCandidates = max(1, min(20, $max));
    }

    /**
     * Check if any candidates were found
     *
     * @param array $parsed Parsed wine data
     * @return bool True if candidates exist
     */
    public function hasCandidates(array $parsed): bool
    {
        $candidates = $this->findCandidates($parsed);
        return !empty($candidates);
    }

    /**
     * Get best candidate match
     *
     * @param array $parsed Parsed wine data
     * @return array|null Best match or null if none found
     */
    public function getBestMatch(array $parsed): ?array
    {
        $candidates = $this->findCandidates($parsed);
        return $candidates[0] ?? null;
    }
}
