<?php
/**
 * FuzzyMatcher - Token-based fuzzy matching for wine entity names
 *
 * Handles:
 * - Multilingual article removal (French, Spanish, Italian, German, Portuguese, English)
 * - Token-based similarity (word order agnostic)
 * - Hybrid Jaccard + per-token Levenshtein scoring
 *
 * @package WineApp
 * @see WIN-188
 */

class FuzzyMatcher
{
    /**
     * Multilingual article patterns to strip from names
     * Order matters: longer patterns processed first to avoid partial matches
     *
     * Note: Single-letter articles (I, O, A) use word boundary patterns
     * to avoid false positives (e.g., "Porto" should keep "o")
     */
    private const ARTICLES = [
        // French (most common in wine names)
        "/\\bl[''']\\s*/iu",      // L' with straight or curly apostrophe
        "/\\bd[''']\\s*/iu",      // d' contraction (de + elision): d'Yquem
        "/\\bd\\s+/iu",           // standalone d (de without apostrophe): Chateau d Yquem
        "/\\bles\\s+/iu",
        "/\\bla\\s+/iu",
        "/\\ble\\s+/iu",
        "/\\bdu\\s+/iu",
        "/\\bdes\\s+/iu",
        "/\\bde\\s+/iu",

        // Spanish
        "/\\blos\\s+/iu",
        "/\\blas\\s+/iu",
        "/\\bel\\s+/iu",
        // 'la' already covered by French

        // Italian
        "/\\bgli\\s+/iu",
        "/\\bil\\s+/iu",
        "/\\blo\\s+/iu",
        // 'la', 'le' already covered
        "/\\bi\\s+/iu",            // Single letter, word boundary required

        // German
        "/\\bder\\s+/iu",
        "/\\bdie\\s+/iu",
        "/\\bdas\\s+/iu",

        // Portuguese
        "/\\bos\\s+/iu",
        "/\\bas\\s+/iu",
        "/\\bo\\s+/iu",            // Single letter, word boundary required
        "/\\ba\\s+/iu",            // Single letter, word boundary required

        // English
        "/\\bthe\\s+/iu",
    ];

    /**
     * Default Jaccard similarity threshold for fuzzy matching
     * 0.55 = 55% token overlap required
     */
    private const JACCARD_THRESHOLD = 0.55;

    /**
     * Maximum Levenshtein distance for individual token matching
     * Allows for minor spelling variations ("grande" ~ "grand")
     */
    private const TOKEN_LEVENSHTEIN_THRESHOLD = 2;

    /**
     * Calculate similarity score between two strings
     *
     * @param string $a First string
     * @param string $b Second string
     * @return float Similarity score (0.0-1.0)
     */
    public static function similarity(string $a, string $b): float
    {
        $tokensA = self::tokenize($a);
        $tokensB = self::tokenize($b);

        if (empty($tokensA) || empty($tokensB)) {
            return 0.0;
        }

        return self::jaccardSimilarity($tokensA, $tokensB);
    }

    /**
     * Check if two strings are a fuzzy match
     *
     * @param string $a First string
     * @param string $b Second string
     * @param float|null $threshold Custom threshold (default: 0.55)
     * @return bool True if fuzzy match
     */
    public static function isFuzzyMatch(string $a, string $b, ?float $threshold = null): bool
    {
        $threshold = $threshold ?? self::JACCARD_THRESHOLD;
        $score = self::similarity($a, $b);
        return $score >= $threshold;
    }

    /**
     * Strip multilingual articles from text
     *
     * Uses word boundary patterns to avoid removing letters from within words
     * (e.g., "Porto" keeps its "o", "Latour" keeps its "la")
     *
     * @param string $text Input text
     * @return string Text with articles removed
     */
    public static function stripArticles(string $text): string
    {
        foreach (self::ARTICLES as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }

        // Clean up multiple spaces
        return preg_replace('/\s+/', ' ', trim($text));
    }

    /**
     * Tokenize and normalize text for comparison
     *
     * Pipeline:
     * 1. Strip articles
     * 2. Normalize accents
     * 3. Lowercase
     * 4. Remove punctuation
     * 5. Split on whitespace
     *
     * @param string $text Input text
     * @return array Array of normalized tokens
     */
    private static function tokenize(string $text): array
    {
        // Step 1: Strip articles
        $text = self::stripArticles($text);

        // Step 2: Normalize accents
        $text = self::normalizeAccents($text);

        // Step 3: Lowercase
        $text = mb_strtolower($text, 'UTF-8');

        // Step 4: Remove punctuation, keep alphanumeric and spaces
        $text = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $text);

        // Step 5: Split and filter empty
        $tokens = preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);

        return $tokens;
    }

    /**
     * Normalize accented characters for comparison
     *
     * Uses ICU Transliterator when available (most accurate),
     * falls back to iconv transliteration.
     *
     * Post-processes to remove any stray apostrophes or quotes that
     * transliteration might introduce (e.g., é → 'e on some systems).
     *
     * @param string $string Input string
     * @return string Normalized string with accents removed
     */
    public static function normalizeAccents(string $string): string
    {
        if (class_exists('Transliterator')) {
            $transliterator = \Transliterator::createFromRules(
                ':: NFD; :: [:Nonspacing Mark:] Remove; :: NFC;'
            );
            if ($transliterator) {
                $result = $transliterator->transliterate($string);
                // Remove any stray apostrophes/quotes that transliteration may introduce
                $result = preg_replace("/[''`´]/u", '', $result);
                return $result;
            }
        }

        // Fallback: iconv transliteration
        $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $string);
        if ($normalized !== false) {
            // Remove any stray apostrophes/quotes that iconv may introduce
            $normalized = preg_replace("/[''`´]/u", '', $normalized);
            return $normalized;
        }
        return $string;
    }

    /**
     * Calculate Jaccard similarity with fuzzy token matching
     *
     * Standard Jaccard = |intersection| / |union|
     *
     * Enhanced with per-token Levenshtein to handle:
     * - Minor spelling variations ("grande" matches "grand")
     * - Typos ("Chateau" matches "Chteau")
     *
     * @param array $tokensA First token set
     * @param array $tokensB Second token set
     * @return float Similarity score (0.0-1.0)
     */
    private static function jaccardSimilarity(array $tokensA, array $tokensB): float
    {
        // Track which tokens have matched (fuzzy or exact)
        $matchedA = [];
        $matchedB = [];

        // Find all fuzzy matches between token sets
        foreach ($tokensA as $i => $tokenA) {
            foreach ($tokensB as $j => $tokenB) {
                // Already matched this B token? Skip
                if (isset($matchedB[$j])) {
                    continue;
                }

                // Exact match or fuzzy match?
                if ($tokenA === $tokenB || self::fuzzyTokenMatch($tokenA, $tokenB)) {
                    $matchedA[$i] = true;
                    $matchedB[$j] = true;
                    break; // Move to next A token
                }
            }
        }

        $intersectionSize = count($matchedA);
        $unionSize = count($tokensA) + count($tokensB) - $intersectionSize;

        if ($unionSize === 0) {
            return 0.0;
        }

        return $intersectionSize / $unionSize;
    }

    /**
     * Check if two tokens are a fuzzy match using Levenshtein distance
     *
     * Uses dynamic threshold based on token length:
     * - Short tokens (<=4 chars): max 1 edit
     * - Medium tokens (5-8 chars): max 2 edits
     * - Long tokens (>8 chars): uses constant threshold
     *
     * @param string $tokenA First token
     * @param string $tokenB Second token
     * @return bool True if tokens are a fuzzy match
     */
    private static function fuzzyTokenMatch(string $tokenA, string $tokenB): bool
    {
        $lenA = mb_strlen($tokenA, 'UTF-8');
        $lenB = mb_strlen($tokenB, 'UTF-8');

        // Skip if length difference exceeds threshold
        $lenDiff = abs($lenA - $lenB);
        if ($lenDiff > self::TOKEN_LEVENSHTEIN_THRESHOLD) {
            return false;
        }

        // Dynamic threshold based on token length
        $avgLen = ($lenA + $lenB) / 2;
        if ($avgLen <= 4) {
            $threshold = 1;
        } elseif ($avgLen <= 8) {
            $threshold = 2;
        } else {
            $threshold = self::TOKEN_LEVENSHTEIN_THRESHOLD;
        }

        $distance = levenshtein($tokenA, $tokenB);
        return $distance <= $threshold;
    }
}
