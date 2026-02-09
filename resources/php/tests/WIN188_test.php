<?php
/**
 * WIN-188 Test Cases - Verify the original JIRA ticket scenarios
 */

require_once __DIR__ . '/../FuzzyMatcher.php';

// Replicate the functions from checkDuplicate.php without including security headers

function normalizeAccents($string) {
    if (class_exists('Transliterator')) {
        $transliterator = Transliterator::createFromRules(
            ':: NFD; :: [:Nonspacing Mark:] Remove; :: NFC;'
        );
        if ($transliterator) {
            $result = $transliterator->transliterate($string);
            $result = preg_replace("/[''`´]/u", '', $result);
            return $result;
        }
    }
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $string);
    if ($normalized !== false) {
        $normalized = preg_replace("/[''`´]/u", '', $normalized);
        return $normalized;
    }
    return $string;
}

function isFuzzyMatch($input, $candidate, $threshold = null) {
    return FuzzyMatcher::isFuzzyMatch($input, $candidate, $threshold);
}

function isSubstringMatch($input, $candidate) {
    $inputNorm = strtolower(FuzzyMatcher::stripArticles(normalizeAccents($input)));
    $candidateNorm = strtolower(FuzzyMatcher::stripArticles(normalizeAccents($candidate)));
    return strpos($candidateNorm, $inputNorm) !== false ||
           strpos($inputNorm, $candidateNorm) !== false;
}

echo "=== WIN-188 Original Test Cases ===\n\n";

// Case 1: La Grande Année vs Grand Annee
$tests = [
    ['La Grande Année', 'Grand Annee', 'JIRA example 1'],
    ['Les Clous', 'Les Clous Naturé', 'JIRA example 2'],
    ['Margaux', 'Château Margaux', 'Short name in longer'],
    ['Pichon Baron', 'Baron Pichon', 'Word order swap'],
    ['Château d\'Yquem', 'Chateau d Yquem', 'Apostrophe handling'],
];

$passed = 0;
$failed = 0;

foreach ($tests as [$a, $b, $description]) {
    $fuzzyMatch = isFuzzyMatch($a, $b);
    $substringMatch = isSubstringMatch($a, $b);
    $overall = $fuzzyMatch || $substringMatch;

    echo "$description:\n";
    echo "  '$a' vs '$b'\n";
    echo "  Similarity: " . round(FuzzyMatcher::similarity($a, $b), 2) . "\n";
    echo "  Fuzzy: " . ($fuzzyMatch ? 'YES' : 'NO') . "\n";
    echo "  Substring: " . ($substringMatch ? 'YES' : 'NO') . "\n";
    echo "  Result: " . ($overall ? '✓ MATCH' : '✗ NO MATCH') . "\n\n";

    if ($overall) {
        $passed++;
    } else {
        $failed++;
    }
}

echo "=================================================\n";
echo "Results: $passed passed, $failed failed\n";
exit($failed > 0 ? 1 : 0);
