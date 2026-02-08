<?php
/**
 * Tests for WIN-229: checkDuplicate pre-filtering helpers
 *
 * Verifies that SQL pre-filtering (extractSearchTokens + buildCandidateFilter)
 * produces correct tokens and SQL conditions, ensuring the same matching quality
 * as the previous load-all-records approach.
 *
 * Run: php resources/php/tests/CheckDuplicatePrefilterTest.php
 */

require_once __DIR__ . '/../FuzzyMatcher.php';

class CheckDuplicatePrefilterTest
{
    private static int $passed = 0;
    private static int $failed = 0;

    public static function run(): void
    {
        echo "Running WIN-229 checkDuplicate pre-filter tests...\n\n";

        self::testExtractSearchTokens();
        self::testBuildCandidateFilter();
        self::testPrefilterCatchesFuzzyMatches();

        echo "\n" . str_repeat('=', 50) . "\n";
        echo "Results: " . self::$passed . " passed, " . self::$failed . " failed\n";
        exit(self::$failed > 0 ? 1 : 0);
    }

    private static function testExtractSearchTokens(): void
    {
        echo "Testing extractSearchTokens...\n";

        // Basic multi-word wine name (accents preserved for MySQL collation matching)
        $tokens = FuzzyMatcher::extractSearchTokens('Château Margaux');
        self::assert(
            in_array('château', $tokens) && in_array('margaux', $tokens),
            'Extracts tokens from accented name (accents preserved)',
            'Got: ' . json_encode($tokens)
        );

        // Strips articles before tokenizing (L' stripped while apostrophe intact)
        $tokens = FuzzyMatcher::extractSearchTokens("L'Hermitage Grand Cru");
        self::assert(
            in_array('hermitage', $tokens) && in_array('grand', $tokens) && in_array('cru', $tokens),
            'Strips French articles and extracts tokens',
            'Got: ' . json_encode($tokens)
        );

        // Filters short tokens (< 3 chars)
        $tokens = FuzzyMatcher::extractSearchTokens('Le Vin de Pays');
        self::assert(
            !in_array('de', $tokens) && in_array('vin', $tokens) && in_array('pays', $tokens),
            'Filters out tokens shorter than 3 chars',
            'Got: ' . json_encode($tokens)
        );

        // Single word
        $tokens = FuzzyMatcher::extractSearchTokens('Margaux');
        self::assert(
            count($tokens) === 1 && $tokens[0] === 'margaux',
            'Single-word input produces one token',
            'Got: ' . json_encode($tokens)
        );

        // Hyphenated name (accents preserved)
        $tokens = FuzzyMatcher::extractSearchTokens('Saint-Émilion');
        self::assert(
            in_array('saint', $tokens) && in_array('émilion', $tokens),
            'Splits hyphenated accented names (accents preserved)',
            'Got: ' . json_encode($tokens)
        );

        // Very short input (all tokens < 3 chars)
        $tokens = FuzzyMatcher::extractSearchTokens('Le Do');
        self::assert(
            empty($tokens),
            'Very short input with articles produces empty tokens',
            'Got: ' . json_encode($tokens)
        );

        echo "\n";
    }

    private static function testBuildCandidateFilter(): void
    {
        echo "Testing buildCandidateFilter...\n";

        // Multi-token: generates LIKE conditions + SOUNDEX
        $tokens = FuzzyMatcher::extractSearchTokens('Château Margaux');
        [$sql, $params] = FuzzyMatcher::buildCandidateFilter('regionName', $tokens, 'Château Margaux');

        self::assert(
            strpos($sql, 'regionName COLLATE utf8mb4_unicode_ci LIKE') !== false,
            'SQL contains LIKE conditions with collation',
            'Got: ' . $sql
        );
        self::assert(
            strpos($sql, 'SOUNDEX(regionName)') !== false,
            'SQL contains SOUNDEX fallback',
            'Got: ' . $sql
        );
        self::assert(
            count($params) === count($tokens) + 1,
            'Params count = tokens + 1 (SOUNDEX)',
            'Expected ' . (count($tokens) + 1) . ', got ' . count($params)
        );

        // Verify LIKE params contain wildcards
        $likeParams = array_filter($params, fn($v) => strpos($v, '%') !== false);
        self::assert(
            count($likeParams) === count($tokens),
            'All token params have % wildcards',
            'Got ' . count($likeParams) . ' LIKE params'
        );

        // Single token: still generates LIKE + SOUNDEX
        $tokens = FuzzyMatcher::extractSearchTokens('Margaux');
        [$sql, $params] = FuzzyMatcher::buildCandidateFilter('wineName', $tokens, 'Margaux');
        self::assert(
            strpos($sql, 'LIKE') !== false && strpos($sql, 'SOUNDEX') !== false,
            'Single-token input generates LIKE + SOUNDEX',
            'Got: ' . $sql
        );

        // Empty tokens: still generates SOUNDEX fallback
        [$sql, $params] = FuzzyMatcher::buildCandidateFilter('wineName', [], 'Le Do');
        self::assert(
            strpos($sql, 'SOUNDEX') !== false,
            'Empty tokens still produces SOUNDEX condition',
            'Got: ' . $sql
        );

        // SQL-special chars in tokens are escaped
        $tokens = ['100%_natural'];
        [$sql, $params] = FuzzyMatcher::buildCandidateFilter('wineName', $tokens, 'test');
        $likeParam = $params[':tk0'] ?? '';
        self::assert(
            strpos($likeParam, '\\%') !== false && strpos($likeParam, '\\_') !== false,
            'SQL wildcards in tokens are escaped',
            'Got: ' . $likeParam
        );

        // Custom param prefix avoids collisions
        $tokens = ['margaux'];
        [$sql1, $params1] = FuzzyMatcher::buildCandidateFilter('col', $tokens, 'x', 'a');
        [$sql2, $params2] = FuzzyMatcher::buildCandidateFilter('col', $tokens, 'x', 'b');
        $keys1 = array_keys($params1);
        $keys2 = array_keys($params2);
        self::assert(
            empty(array_intersect($keys1, $keys2)),
            'Different param prefixes produce non-overlapping keys',
            'Keys1: ' . json_encode($keys1) . ', Keys2: ' . json_encode($keys2)
        );

        echo "\n";
    }

    /**
     * Verify that the pre-filter SQL would catch known fuzzy match scenarios.
     * Simulates what the LIKE conditions would match against.
     */
    private static function testPrefilterCatchesFuzzyMatches(): void
    {
        echo "Testing pre-filter catches known fuzzy match scenarios...\n";

        // Scenario: multi-token with one matching token
        // Input: "Chteau Margaux" (typo), DB: "Château Margaux"
        // Token "margaux" should match via LIKE even though "chteau" has a typo
        $tokens = FuzzyMatcher::extractSearchTokens('Chteau Margaux');
        self::assert(
            in_array('margaux', $tokens),
            'Typo input still extracts correct second token',
            'Got: ' . json_encode($tokens)
        );

        // Scenario: article-different names
        // Input: "Le Château Margaux", DB: "Château Margaux"
        // After article stripping, tokens should be same
        $tokens1 = FuzzyMatcher::extractSearchTokens('Le Château Margaux');
        $tokens2 = FuzzyMatcher::extractSearchTokens('Château Margaux');
        self::assert(
            $tokens1 === $tokens2,
            'Article stripping normalizes to same tokens',
            'T1: ' . json_encode($tokens1) . ', T2: ' . json_encode($tokens2)
        );

        // Scenario: word-order swap
        // Input: "Pichon Baron", DB: "Baron Pichon"
        // Both tokens appear in both, so LIKE catches the candidate
        $tokens = FuzzyMatcher::extractSearchTokens('Pichon Baron');
        self::assert(
            in_array('pichon', $tokens) && in_array('baron', $tokens),
            'Word-swap scenario: both tokens extracted for LIKE matching',
            'Got: ' . json_encode($tokens)
        );

        // Scenario: accent differences
        // Input: "Romanée-Conti", DB: "Romanee Conti"
        // Tokens keep accents; MySQL COLLATE handles matching
        $tokens = FuzzyMatcher::extractSearchTokens('Romanée-Conti');
        self::assert(
            in_array('romanée', $tokens) && in_array('conti', $tokens),
            'Accented tokens preserved (MySQL collation handles matching)',
            'Got: ' . json_encode($tokens)
        );

        // Scenario: single-token typo relies on SOUNDEX
        // Input: "Chteau" (typo for Château), tokens: ["chteau"]
        // LIKE '%chteau%' won't match "Château" but SOUNDEX should
        $tokens = FuzzyMatcher::extractSearchTokens('Chteau');
        self::assert(
            count($tokens) === 1 && $tokens[0] === 'chteau',
            'Single-token typo: SOUNDEX fallback needed (token won\'t substring-match)',
            'Got: ' . json_encode($tokens)
        );

        echo "\n";
    }

    private static function assert(bool $condition, string $description, string $details = ''): void
    {
        if ($condition) {
            echo "  ✓ $description\n";
            self::$passed++;
        } else {
            echo "  ✗ $description\n";
            if ($details) {
                echo "    $details\n";
            }
            self::$failed++;
        }
    }
}

CheckDuplicatePrefilterTest::run();
