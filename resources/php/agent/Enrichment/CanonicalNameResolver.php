<?php
/**
 * Canonical Name Resolver
 *
 * Resolves wine name variants to canonical forms for improved cache hit rates.
 * Handles abbreviation expansion (Tier 1), alias table lookups (Tier 3),
 * and fuzzy matching (Tier 4).
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class CanonicalNameResolver
{
    private \PDO $pdo;
    private array $config;
    private ?array $abbreviations = null;  // Lazy-loaded in-memory cache
    private CacheKeyGenerator $keyGenerator;

    public function __construct(\PDO $pdo, array $config)
    {
        $this->pdo = $pdo;
        $this->config = $config;
        $this->keyGenerator = new CacheKeyGenerator();
    }

    /**
     * Expand abbreviations in text (Tier 1)
     *
     * @param string $text Text that may contain abbreviations
     * @param string $context 'producer', 'wine', or 'both'
     * @return string Text with abbreviations expanded
     */
    public function expandAbbreviations(string $text, string $context = 'both'): string
    {
        if (!$this->isEnabled('abbreviation_expansion')) {
            return $text;
        }

        $this->loadAbbreviations();

        if (empty($this->abbreviations)) {
            return $text;
        }

        $result = $text;

        foreach ($this->abbreviations as $abbr) {
            // Skip if context doesn't match
            if ($abbr['context'] !== 'both' && $abbr['context'] !== $context) {
                continue;
            }

            // Case-insensitive replacement with word boundaries
            // Use \b for start boundary, but allow trailing punctuation/space for end
            $escaped = preg_quote($abbr['abbreviation'], '/');
            $pattern = '/\b' . $escaped . '(?=\s|$|[,;:\-])/iu';

            // Use callback to avoid backreference expansion issues with $ or \ in expansion
            $expansion = $abbr['expansion'];
            $result = preg_replace_callback($pattern, function ($matches) use ($expansion) {
                return $expansion;
            }, $result);
        }

        return $result;
    }

    /**
     * Check if expanded text differs from original
     *
     * @param string $original Original text
     * @param string $expanded Text after expansion
     * @return bool True if expansion changed the text
     */
    public function wasExpanded(string $original, string $expanded): bool
    {
        // Normalize both for comparison (to handle accent differences)
        $normalizedOrig = $this->keyGenerator->normalize($original);
        $normalizedExp = $this->keyGenerator->normalize($expanded);
        return $normalizedOrig !== $normalizedExp;
    }

    /**
     * Find canonical key from alias table (Tier 3)
     *
     * @param string $aliasKey The lookup key that may be an alias
     * @return string|null The canonical key if found, null otherwise
     */
    public function findCanonicalAlias(string $aliasKey): ?string
    {
        if (!$this->isEnabled('alias_lookup')) {
            return null;
        }

        $stmt = $this->pdo->prepare(
            'SELECT canonicalKey FROM cacheCanonicalAliases WHERE aliasKey = ?'
        );
        $stmt->execute([$aliasKey]);
        $result = $stmt->fetchColumn();

        return $result !== false ? $result : null;
    }

    /**
     * Create a new alias mapping
     *
     * Only creates alias if confidence meets threshold (≥0.6)
     *
     * @param string $aliasKey The variant key
     * @param string $canonicalKey The canonical cache key
     * @param string $type 'abbreviation', 'variant', or 'fuzzy'
     * @param float $confidence Match confidence (0.0-1.0)
     * @return void
     */
    public function createAlias(string $aliasKey, string $canonicalKey, string $type, float $confidence = 1.0): void
    {
        // Only create aliases for high-confidence matches (≥0.6)
        $threshold = $this->config['enrichment']['confidence_thresholds']['cache_accept'] ?? 0.6;
        if ($confidence < $threshold) {
            return;
        }

        // Don't create alias if keys are identical
        if ($aliasKey === $canonicalKey) {
            return;
        }

        // Verify canonical key exists in cache before creating alias
        $checkStmt = $this->pdo->prepare('SELECT 1 FROM cacheWineEnrichment WHERE lookupKey = ?');
        $checkStmt->execute([$canonicalKey]);
        if (!$checkStmt->fetchColumn()) {
            return; // Canonical key doesn't exist, don't create orphan alias
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO cacheCanonicalAliases (aliasKey, canonicalKey, aliasType, confidence)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                canonicalKey = VALUES(canonicalKey),
                aliasType = VALUES(aliasType),
                confidence = VALUES(confidence)'
        );
        $stmt->execute([$aliasKey, $canonicalKey, $type, $confidence]);
    }

    /**
     * Record a hit on an alias (increment counter)
     *
     * @param string $aliasKey The alias key that was used
     * @return void
     */
    public function recordAliasHit(string $aliasKey): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE cacheCanonicalAliases
             SET hitCount = hitCount + 1, lastUsedAt = NOW()
             WHERE aliasKey = ?'
        );
        $stmt->execute([$aliasKey]);
    }

    /**
     * Check if a feature is enabled in config
     *
     * @param string $feature Feature name
     * @return bool
     */
    private function isEnabled(string $feature): bool
    {
        $canonicalConfig = $this->config['enrichment']['canonical_resolution'] ?? [];
        if (!($canonicalConfig['enabled'] ?? true)) {
            return false;
        }
        return $canonicalConfig[$feature] ?? true;
    }

    /**
     * Load abbreviations from database into memory cache
     */
    private function loadAbbreviations(): void
    {
        if ($this->abbreviations !== null) {
            return;  // Already loaded
        }

        $stmt = $this->pdo->query(
            'SELECT abbreviation, expansion, context, priority
             FROM refAbbreviations
             WHERE isActive = 1
             ORDER BY priority DESC, LENGTH(abbreviation) DESC'
        );
        $this->abbreviations = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Get key generator instance
     *
     * @return CacheKeyGenerator
     */
    public function getKeyGenerator(): CacheKeyGenerator
    {
        return $this->keyGenerator;
    }

    /**
     * Find best fuzzy match from cache candidates (Tier 4)
     *
     * Uses substring containment and Levenshtein distance to find matches for:
     * - Region prefixes: "Champagne Chavost" → "Chavost"
     * - Wine suffixes: "Paradox" → "Paradox Brut Nature"
     * - Minor typos
     *
     * @param string $searchKey The normalized lookup key (producer|wine|vintage)
     * @return array|null Best match with {canonicalKey, confidence, matchedProducer, matchedWine, matchedVintage}
     */
    public function findFuzzyMatch(string $searchKey): ?array
    {
        if (!$this->isEnabled('fuzzy_matching')) {
            return null;
        }

        $canonicalConfig = $this->config['enrichment']['canonical_resolution'] ?? [];
        $candidateLimit = $canonicalConfig['fuzzy_candidate_limit'] ?? 100;
        $minHitCount = $canonicalConfig['fuzzy_min_hit_count'] ?? 5;

        // Parse search key into components
        $searchParts = explode('|', $searchKey);
        $searchProducer = $searchParts[0] ?? '';
        $searchWine = $searchParts[1] ?? '';
        $searchVintage = $searchParts[2] ?? 'NV';

        // Get candidates from cache (prioritize by hit count for performance)
        $stmt = $this->pdo->prepare(
            'SELECT lookupKey, confidence, hitCount
             FROM cacheWineEnrichment
             WHERE hitCount >= ?
             ORDER BY hitCount DESC
             LIMIT ?'
        );
        $stmt->execute([$minHitCount, $candidateLimit]);
        $candidates = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (empty($candidates)) {
            return null;
        }

        $bestMatch = null;
        $bestScore = 0.0;
        $minConfidence = $this->config['enrichment']['confidence_thresholds']['cache_accept'] ?? 0.6;

        foreach ($candidates as $candidate) {
            $candidateParts = explode('|', $candidate['lookupKey']);
            $candidateProducer = $candidateParts[0] ?? '';
            $candidateWine = $candidateParts[1] ?? '';
            $candidateVintage = $candidateParts[2] ?? 'NV';

            // Vintage must match exactly (or both NV)
            if ($searchVintage !== $candidateVintage) {
                continue;
            }

            // Calculate similarity for producer and wine separately
            $producerScore = $this->calculateSimilarity($searchProducer, $candidateProducer);
            $wineScore = $this->calculateSimilarity($searchWine, $candidateWine);

            // Combined score: both must be reasonably similar
            // Weight wine name slightly higher as it's more specific
            $combinedScore = ($producerScore * 0.4) + ($wineScore * 0.6);

            // Require minimum per-field similarity to avoid false positives
            // Wine name threshold is higher (0.7) because same-producer wines
            // sharing a suffix (e.g. "Rose Imperial" vs "Nectar Imperial") can
            // score ~0.6 via Levenshtein — these are different wines, not typos.
            if ($producerScore < 0.5 || $wineScore < 0.7) {
                continue;
            }

            if ($combinedScore > $bestScore && $combinedScore >= $minConfidence) {
                $bestScore = $combinedScore;
                $bestMatch = [
                    'canonicalKey' => $candidate['lookupKey'],
                    'confidence' => $combinedScore,
                    'matchedProducer' => $this->denormalize($candidateProducer),
                    'matchedWine' => $this->denormalize($candidateWine),
                    'matchedVintage' => $candidateVintage === 'NV' ? null : $candidateVintage,
                ];
            }
        }

        return $bestMatch;
    }

    /**
     * Calculate similarity between two normalized strings
     *
     * Uses a combination of:
     * 1. Substring containment (high score if one contains the other)
     * 2. Levenshtein distance (for typos/small variations)
     *
     * @param string $search Search string (normalized)
     * @param string $candidate Candidate string (normalized)
     * @return float Similarity score 0.0-1.0
     */
    private function calculateSimilarity(string $search, string $candidate): float
    {
        // Exact match
        if ($search === $candidate) {
            return 1.0;
        }

        // Empty string handling
        if ($search === '' || $candidate === '') {
            return 0.0;
        }

        $searchLen = mb_strlen($search);
        $candidateLen = mb_strlen($candidate);

        // Substring containment check (handles region prefixes and wine suffixes)
        // "champagne-chavost" contains "chavost" → high score
        // "paradox-brut-nature" contains "paradox" → high score
        if (mb_strpos($candidate, $search) !== false) {
            // Search is contained in candidate (e.g., "paradox" in "paradox-brut-nature")
            // Score based on how much of candidate is covered
            return 0.7 + (0.3 * ($searchLen / $candidateLen));
        }

        if (mb_strpos($search, $candidate) !== false) {
            // Candidate is contained in search (e.g., "chavost" in "champagne-chavost")
            // Score based on how much of search is covered
            return 0.7 + (0.3 * ($candidateLen / $searchLen));
        }

        // Levenshtein distance for typos/small variations
        $maxLen = max($searchLen, $candidateLen);
        if ($maxLen === 0) {
            return 0.0;
        }

        // Use levenshtein (limited to 255 chars)
        $search = mb_substr($search, 0, 255);
        $candidate = mb_substr($candidate, 0, 255);
        $distance = levenshtein($search, $candidate);

        // Convert distance to similarity (0-1 scale)
        $similarity = 1.0 - ($distance / $maxLen);

        return max(0.0, $similarity);
    }

    /**
     * Simple denormalization for display
     * Converts "chateau-margaux" to "Chateau Margaux"
     */
    private function denormalize(string $normalized): string
    {
        $words = explode('-', $normalized);
        return implode(' ', array_map('ucfirst', $words));
    }
}
