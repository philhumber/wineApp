<?php
/**
 * Unit tests for FuzzyMatcher
 *
 * Run: php resources/php/tests/FuzzyMatcherTest.php
 */

require_once __DIR__ . '/../FuzzyMatcher.php';

class FuzzyMatcherTest
{
    private static int $passed = 0;
    private static int $failed = 0;

    public static function run(): void
    {
        echo "Running FuzzyMatcher tests...\n\n";

        // Test article stripping
        self::testArticleStripping();

        // Test fuzzy matching
        self::testFuzzyMatching();

        // Test negative cases (should NOT match)
        self::testNegativeCases();

        // Summary
        echo "\n" . str_repeat('=', 50) . "\n";
        echo "Results: " . self::$passed . " passed, " . self::$failed . " failed\n";
        exit(self::$failed > 0 ? 1 : 0);
    }

    private static function testArticleStripping(): void
    {
        echo "Testing article stripping...\n";

        $tests = [
            // French
            ['Le Château', 'Château', 'French "Le"'],
            ['La Grande Année', 'Grande Année', 'French "La"'],
            ['Les Clous', 'Clous', 'French "Les"'],
            ["L'Hermitage", 'Hermitage', 'French "L\'"'],
            ['Du Val', 'Val', 'French "Du"'],
            ['Des Vignes', 'Vignes', 'French "Des"'],

            // Spanish
            ['El Rincón', 'Rincón', 'Spanish "El"'],
            ['Los Vascos', 'Vascos', 'Spanish "Los"'],

            // Italian
            ['Il Poggione', 'Poggione', 'Italian "Il"'],
            ['Gli Angeli', 'Angeli', 'Italian "Gli"'],

            // German
            ['Der Keller', 'Keller', 'German "Der"'],
            ['Die Weinberge', 'Weinberge', 'German "Die"'],

            // Portuguese
            ['O Vinho', 'Vinho', 'Portuguese "O"'],
            ['Os Vinhos', 'Vinhos', 'Portuguese "Os"'],

            // English
            ['The Vineyard', 'Vineyard', 'English "The"'],

            // Should NOT strip (word boundaries)
            ['Porto', 'Porto', 'Should not strip "o" from Porto'],
            ['Latour', 'Latour', 'Should not strip "la" from Latour'],
        ];

        foreach ($tests as [$input, $expected, $description]) {
            $result = FuzzyMatcher::stripArticles($input);
            self::assert($result === $expected, $description, "Expected: '$expected', Got: '$result'");
        }

        echo "\n";
    }

    private static function testFuzzyMatching(): void
    {
        echo "Testing fuzzy matching...\n";

        $tests = [
            // Article removal
            ['Château Margaux', 'Le Château Margaux', true, 'French article + match'],
            ['La Grande Année', 'Grande Annee', true, 'Article + accent removal'],
            ['Les Clous', 'Clous', true, 'Article removal'],
            ['El Coto', 'Coto', true, 'Spanish article removal'],
            ['Il Poggione', 'Poggione', true, 'Italian article removal'],

            // Word order flexibility
            ['Pichon Baron', 'Baron Pichon', true, 'Word order swap'],
            ['Grand Annee', 'Annee Grand', true, 'Word order swap'],

            // Accent handling
            ['Château d\'Yquem', 'Chateau d Yquem', true, 'Accent + apostrophe'],
            ['Romanée-Conti', 'Romanee Conti', true, 'Accent + hyphen'],
            ['Saint-Émilion', 'Saint Emilion', true, 'Hyphen + accent'],

            // Spelling variations (token Levenshtein)
            ['Chateau Margaux', 'Chteau Margaux', true, 'Typo: missing "a"'],
            ['Grande Année', 'Grand Annee', true, 'Variation: "grande" vs "grand"'],

            // Note: Partial matches like "Les Clous" vs "Les Clous Naturé" are
            // caught by isSubstringMatch() in checkDuplicate.php, not FuzzyMatcher.
            // FuzzyMatcher handles word-order flexibility and article removal.
        ];

        foreach ($tests as [$a, $b, $expected, $description]) {
            $result = FuzzyMatcher::isFuzzyMatch($a, $b);
            $similarity = round(FuzzyMatcher::similarity($a, $b), 2);
            self::assert(
                $result === $expected,
                $description,
                ($expected ? 'Expected match' : 'Expected no match') . ", Got: " . ($result ? 'match' : 'no match') . " (similarity: $similarity)"
            );
        }

        echo "\n";
    }

    private static function testNegativeCases(): void
    {
        echo "Testing negative cases (should NOT match)...\n";

        $tests = [
            // Different wines
            ['Château Margaux', 'Château Latour', false, 'Different wines'],
            ['Penfolds Grange', 'Penfolds Bin 389', false, 'Different wines same producer'],

            // Different regions
            ['Bordeaux', 'Burgundy', false, 'Different regions'],
            ['Napa Valley', 'Sonoma', false, 'Different regions'],

            // Unrelated names
            ['Lafite', 'Mouton', false, 'Unrelated names'],
        ];

        foreach ($tests as [$a, $b, $expected, $description]) {
            $result = FuzzyMatcher::isFuzzyMatch($a, $b);
            $similarity = round(FuzzyMatcher::similarity($a, $b), 2);
            self::assert(
                $result === $expected,
                $description,
                ($expected ? 'Expected match' : 'Expected no match') . ", Got: " . ($result ? 'match' : 'no match') . " (similarity: $similarity)"
            );
        }

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

// Run tests
FuzzyMatcherTest::run();
