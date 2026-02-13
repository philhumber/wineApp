<?php
/**
 * Test script for InputMatchScorer
 * Run: php resources/php/agent/Identification/test_input_match_scorer.php
 */

// Bootstrap
require_once __DIR__ . '/InputMatchScorer.php';
require_once __DIR__ . '/InferenceEngine.php';
require_once __DIR__ . '/../../FuzzyMatcher.php';

use Agent\Identification\InputMatchScorer;
use Agent\Identification\InferenceEngine;

$engine = new InferenceEngine(null); // null PDO = static-only mode
$scorer = new InputMatchScorer($engine);

$passed = 0;
$failed = 0;
$thresholds = ['auto_populate' => 85, 'suggest' => 60, 'user_choice' => 60];

function check(bool $condition, string $label, &$passed, &$failed): void {
    if ($condition) {
        echo "  ✓ {$label}\n";
        $passed++;
    } else {
        echo "  ✗ FAIL: {$label}\n";
        $failed++;
    }
}

// ═══════════════════════════════════════════════
echo "\n=== ANCHOR EXTRACTION TESTS ===\n\n";
// ═══════════════════════════════════════════════

// Test 1: Vintage extraction
echo "Test 1: Vintage extraction\n";
$anchors = $scorer->extractAnchors("chateau margaux 2019");
check($anchors['vintage'] === '2019', "vintage should be '2019', got '{$anchors['vintage']}'", $passed, $failed);
check(in_array('chateau', $anchors['nameTokens']), "should have 'chateau' as name token", $passed, $failed);
check(count($anchors['nameTokens']) >= 1, "should have at least 1 name token", $passed, $failed);

// Test 2: Multi-word grape
echo "\nTest 2: Multi-word grape extraction\n";
$anchors = $scorer->extractAnchors("cabernet sauvignon from napa valley");
$grapeTexts = array_column($anchors['grapes'], 'text');
check(in_array('cabernet sauvignon', $grapeTexts), "'cabernet sauvignon' should be extracted as single grape, got [" . implode(',', $grapeTexts) . "]", $passed, $failed);
$regionTexts = array_column($anchors['regions'], 'text');
check(in_array('napa valley', $regionTexts), "'napa valley' should be extracted as region", $passed, $failed);

// Test 3: Type extraction
echo "\nTest 3: Wine type extraction\n";
$anchors = $scorer->extractAnchors("red wine from bordeaux");
check($anchors['type'] === 'red', "should extract type 'red', got '{$anchors['type']}'", $passed, $failed);
$regionTexts = array_column($anchors['regions'], 'text');
check(in_array('bordeaux', $regionTexts), "'bordeaux' should be region", $passed, $failed);

// Test 4: All stop words
echo "\nTest 4: Stop word removal\n";
$anchors = $scorer->extractAnchors("find me a nice wine please");
check(empty($anchors['nameTokens']), "all stop words → no name tokens, got [" . implode(',', $anchors['nameTokens']) . "]", $passed, $failed);
check($anchors['totalWeight'] == 0, "all stop words → totalWeight=0, got {$anchors['totalWeight']}", $passed, $failed);

// Test 5: Appellation matching
echo "\nTest 5: Appellation matching\n";
$anchors = $scorer->extractAnchors("pauillac 2018");
check(!empty($anchors['appellations']), "'pauillac' should match as appellation", $passed, $failed);
if (!empty($anchors['appellations'])) {
    check($anchors['appellations'][0]['parentRegion'] === 'Bordeaux', "parent region should be 'Bordeaux'", $passed, $failed);
}
check($anchors['vintage'] === '2018', "vintage should be '2018'", $passed, $failed);

// Test 6: Accent handling
echo "\nTest 6: Accent normalization\n";
$anchors = $scorer->extractAnchors("rose from cotes du rhone");
$hasRose = ($anchors['type'] !== null) || !empty($anchors['grapes']);
check($hasRose, "'rose' should match as wine type or grape, type={$anchors['type']}", $passed, $failed);

// Test 7: Single-word grape
echo "\nTest 7: Single-word grape\n";
$anchors = $scorer->extractAnchors("merlot 2020");
$grapeTexts = array_column($anchors['grapes'], 'text');
check(in_array('merlot', $grapeTexts), "'merlot' should be grape", $passed, $failed);
check($anchors['vintage'] === '2020', "vintage=2020", $passed, $failed);

// Test 8: Country extraction
echo "\nTest 8: Country extraction\n";
$anchors = $scorer->extractAnchors("french red wine");
check(!empty($anchors['countries']), "'french' should match as country", $passed, $failed);
check($anchors['type'] === 'red', "type should be 'red'", $passed, $failed);

// Test 9: Complex input
echo "\nTest 9: Complex multi-anchor input\n";
$anchors = $scorer->extractAnchors("2019 red cabernet sauvignon from napa valley");
check($anchors['vintage'] === '2019', "vintage=2019", $passed, $failed);
check($anchors['type'] === 'red', "type=red", $passed, $failed);
$grapeTexts = array_column($anchors['grapes'], 'text');
check(in_array('cabernet sauvignon', $grapeTexts), "grape=cabernet sauvignon", $passed, $failed);
$regionTexts = array_column($anchors['regions'], 'text');
check(in_array('napa valley', $regionTexts), "region=napa valley", $passed, $failed);
check($anchors['totalWeight'] >= 2.0, "totalWeight >= 2.0, got {$anchors['totalWeight']}", $passed, $failed);

// Test 10: False vintage prevention
echo "\nTest 10: False vintage prevention\n";
$anchors = $scorer->extractAnchors("1er cru from bordeaux");
check($anchors['vintage'] === null, "'1er' should NOT be vintage", $passed, $failed);

// ═══════════════════════════════════════════════
echo "\n=== ANCHOR MATCHING TESTS ===\n\n";
// ═══════════════════════════════════════════════

$parsedCorrect = [
    'producer' => 'Château Margaux',
    'wineName' => null,
    'vintage' => '2019',
    'wineType' => 'Red',
    'region' => 'Bordeaux',
    'country' => 'France',
    'grapes' => ['Cabernet Sauvignon', 'Merlot'],
    'confidence' => 85,
];

// Test 11: Correct match
echo "Test 11: Correct match - Chateau Margaux 2019\n";
$anchors = $scorer->extractAnchors("chateau margaux 2019");
$matches = $scorer->matchAnchors($anchors, $parsedCorrect);
$matchRatio = $matches['totalWeight'] > 0 ? $matches['matchedWeight'] / $matches['totalWeight'] : 0;
check($matchRatio > 0.8, "correct result match ratio > 80%, got " . round($matchRatio * 100) . "%", $passed, $failed);

// Test 12: Wrong wine
echo "\nTest 12: Wrong wine - input Margaux, output Palmer\n";
$parsedWrong = [
    'producer' => 'Château Palmer',
    'wineName' => null,
    'vintage' => '2019',
    'wineType' => 'Red',
    'region' => 'Bordeaux',
    'country' => 'France',
    'grapes' => [],
    'confidence' => 85,
];
$anchors = $scorer->extractAnchors("chateau margaux 2019");
$matches = $scorer->matchAnchors($anchors, $parsedWrong);
check($matches['matchedWeight'] < $matches['totalWeight'], "wrong wine should have unmatched anchors (matched={$matches['matchedWeight']}, total={$matches['totalWeight']})", $passed, $failed);

// Test 13: Vague input
echo "\nTest 13: Vague input match\n";
$anchors = $scorer->extractAnchors("red wine from bordeaux");
$matches = $scorer->matchAnchors($anchors, $parsedCorrect);
check($matches['totalWeight'] < 1.5, "vague input totalWeight < 1.5, got {$matches['totalWeight']}", $passed, $failed);

// ═══════════════════════════════════════════════
echo "\n=== FULL SCORE TESTS ===\n\n";
// ═══════════════════════════════════════════════

// Test 14: High confidence correct match
echo "Test 14: Score - Chateau Margaux 2019 (correct)\n";
$score = $scorer->score("chateau margaux 2019", $parsedCorrect, $thresholds);
check($score['score'] >= 80, "correct specific match should score >= 80, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";
echo "  → trace: anchorMatch={$score['trace']['anchorMatchScore']}, cap={$score['trace']['specificityCap']}, bonus={$score['trace']['completenessBonus']}\n";

// Test 15: Vague input
echo "\nTest 15: Score - red wine from bordeaux (vague)\n";
$score = $scorer->score("red wine from bordeaux", $parsedCorrect, $thresholds);
check($score['score'] >= 50 && $score['score'] <= 80, "vague match should score 50-80, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";
echo "  → trace: anchorMatch={$score['trace']['anchorMatchScore']}, cap={$score['trace']['specificityCap']}, bonus={$score['trace']['completenessBonus']}\n";

// Test 16: No anchors (all stop words)
echo "\nTest 16: Score - find me a nice wine please (no anchors)\n";
$score = $scorer->score("find me a nice wine please", $parsedCorrect, $thresholds);
check($score['score'] <= 60, "no-anchor input should score <= 60, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";

// Test 17: Opus One (name tokens)
echo "\nTest 17: Score - Opus One (correct)\n";
$parsedOpus = [
    'producer' => 'Opus One',
    'wineName' => null,
    'vintage' => null,
    'wineType' => 'Red',
    'region' => 'Napa Valley',
    'country' => 'USA',
    'grapes' => ['Cabernet Sauvignon', 'Merlot'],
    'confidence' => 90,
];
$score = $scorer->score("opus one", $parsedOpus, $thresholds);
check($score['score'] >= 75, "Opus One correct should score >= 75, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";
echo "  → trace: anchorMatch={$score['trace']['anchorMatchScore']}, cap={$score['trace']['specificityCap']}, bonus={$score['trace']['completenessBonus']}\n";

// Test 18: Penfolds (single producer name)
echo "\nTest 18: Score - Penfolds (single word)\n";
$parsedPenfolds = [
    'producer' => 'Penfolds',
    'wineName' => 'Grange',
    'vintage' => null,
    'wineType' => 'Red',
    'region' => 'Barossa Valley',
    'country' => 'Australia',
    'grapes' => ['Shiraz'],
    'confidence' => 85,
];
$score = $scorer->score("penfolds", $parsedPenfolds, $thresholds);
check($score['score'] >= 60 && $score['score'] <= 80, "Penfolds should score 60-80, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";

// Test 19: Barolo 2015
echo "\nTest 19: Score - Barolo 2015\n";
$parsedBarolo = [
    'producer' => 'Marchesi di Barolo',
    'wineName' => 'Barolo',
    'vintage' => '2015',
    'wineType' => 'Red',
    'region' => 'Piedmont',
    'country' => 'Italy',
    'grapes' => ['Nebbiolo'],
    'confidence' => 80,
];
$score = $scorer->score("barolo 2015", $parsedBarolo, $thresholds);
check($score['score'] >= 70, "Barolo 2015 should score >= 70, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";
echo "  → trace: anchorMatch={$score['trace']['anchorMatchScore']}, cap={$score['trace']['specificityCap']}, bonus={$score['trace']['completenessBonus']}\n";

// Test 20: Wrong wine should score lower
echo "\nTest 20: Score - Chateau Margaux 2019 input vs Palmer output\n";
$score = $scorer->score("chateau margaux 2019", $parsedWrong, $thresholds);
check($score['score'] < 85, "wrong wine should score < 85, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";
echo "  → trace: anchorMatch={$score['trace']['anchorMatchScore']}, cap={$score['trace']['specificityCap']}\n";

// ═══════════════════════════════════════════════
echo "\n=== IMAGE FALLBACK TESTS ===\n\n";
// ═══════════════════════════════════════════════

// Test 21: Image fallback with full fields
echo "Test 21: Image fallback - full fields\n";
$score = $scorer->scoreImageFallback($parsedCorrect, 80, $thresholds);
check($score['score'] <= 70, "image fallback should be capped at 70, got {$score['score']}", $passed, $failed);
check($score['score'] >= 50, "image with full fields should score >= 50, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";

// Test 22: Image fallback with sparse fields
echo "\nTest 22: Image fallback - sparse fields\n";
$parsedSparse = [
    'producer' => 'Unknown',
    'wineName' => null,
    'vintage' => null,
    'wineType' => 'Red',
    'region' => null,
    'country' => null,
    'grapes' => [],
    'confidence' => 40,
];
$score = $scorer->scoreImageFallback($parsedSparse, 40, $thresholds);
check($score['score'] <= 70, "sparse image should be capped at 70, got {$score['score']}", $passed, $failed);
check($score['score'] < 50, "sparse fields + low conf should score < 50, got {$score['score']}", $passed, $failed);
echo "  → score={$score['score']}, action={$score['action']}\n";

// ═══════════════════════════════════════════════
echo "\n=== RETURN FORMAT TESTS ===\n\n";
// ═══════════════════════════════════════════════

// Test 23: Return format matches ConfidenceScorer shape
echo "Test 23: Return format validation\n";
$score = $scorer->score("chateau margaux 2019", $parsedCorrect, $thresholds);
check(isset($score['score']), "has 'score' key", $passed, $failed);
check(isset($score['action']), "has 'action' key", $passed, $failed);
check(isset($score['fieldScores']), "has 'fieldScores' key", $passed, $failed);
check(isset($score['llmConfidence']), "has 'llmConfidence' key", $passed, $failed);
check(isset($score['calculatedScore']), "has 'calculatedScore' key", $passed, $failed);
check(isset($score['thresholds']), "has 'thresholds' key", $passed, $failed);
check(isset($score['trace']), "has 'trace' key", $passed, $failed);
check(is_int($score['score']), "'score' is int", $passed, $failed);
check(in_array($score['action'], ['auto_populate', 'suggest', 'user_choice', 'disambiguate']), "valid action", $passed, $failed);

// ═══════════════════════════════════════════════
echo "\n=== EDGE CASE TESTS ===\n\n";
// ═══════════════════════════════════════════════

// Test 24: Empty input
echo "Test 24: Empty input\n";
$score = $scorer->score("", $parsedCorrect, $thresholds);
check($score['score'] >= 0 && $score['score'] <= 100, "empty input should give valid score, got {$score['score']}", $passed, $failed);

// Test 25: Null grapes in parsed
echo "\nTest 25: Null grapes in parsed\n";
$parsedNoGrapes = $parsedCorrect;
$parsedNoGrapes['grapes'] = null;
$score = $scorer->score("chateau margaux 2019", $parsedNoGrapes, $thresholds);
check($score['score'] >= 0 && $score['score'] <= 100, "null grapes should not crash, score={$score['score']}", $passed, $failed);

// Test 26: Multi-word country
echo "\nTest 26: Multi-word country\n";
$anchors = $scorer->extractAnchors("wine from new zealand");
check(!empty($anchors['countries']), "'new zealand' should match as country", $passed, $failed);

// ═══════════════════════════════════════════════
echo "\n" . str_repeat("═", 50) . "\n";
echo "RESULTS: {$passed} passed, {$failed} failed\n";
echo str_repeat("═", 50) . "\n\n";

exit($failed > 0 ? 1 : 0);
