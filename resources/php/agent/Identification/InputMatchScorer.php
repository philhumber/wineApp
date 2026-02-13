<?php
/**
 * Input Match Scorer
 *
 * Compares user input tokens against LLM output fields to derive a factual
 * confidence score measuring how well the result matches what the user asked.
 *
 * Two-pass extraction: multi-word phrase matching first, then single-token
 * matching on remaining text. Anchors (vintage, grapes, regions, name tokens)
 * are weighted and compared against parsed LLM output fields.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

require_once __DIR__ . '/../../FuzzyMatcher.php';

use FuzzyMatcher;

class InputMatchScorer
{
    private InferenceEngine $inferenceEngine;
    private array $stopWords;

    public function __construct(InferenceEngine $inferenceEngine)
    {
        $this->inferenceEngine = $inferenceEngine;
        $this->stopWords = [
            // Articles & prepositions
            'the', 'a', 'an', 'from', 'with', 'and', 'of', 'in', 'for', 'by', 'on', 'at',
            // Pronouns & common verbs
            'this', 'that', 'some', 'it', 'its', 'is', 'was', 'can', 'you', 'me', 'my', 'i', 'we',
            // Wine-domain filler (NOT wine types/grapes/regions)
            'wine', 'bottle', 'glass', 'vintage', 'label', 'winery', 'estate', 'vineyard', 'cellar', 'cuvee',
            'produced', 'made', 'aged',
            // Request/question words
            'please', 'find', 'identify', 'help', 'tell', 'show', 'looking', 'search', 'what', 'whats', 'where',
            'wheres', 'which', 'how', 'about',
            // Qualifiers
            'nice', 'good', 'great', 'very', 'really', 'quite', 'pretty', 'fairly', 'excellent', 'amazing',
            'wonderful', 'lovely', 'fantastic', 'delicious', 'beautiful',
            // Misc
            'been', 'have', 'has', 'had', 'heres', 'thats', 'there', 'here',
        ];
    }

    /**
     * Main scoring entry point — compare user input against LLM output
     *
     * @param string $userInput Raw user text
     * @param array $parsed LLM parsed result (producer, wineName, vintage, region, country, wineType, grapes, confidence)
     * @param array $thresholds {auto_populate, suggest, user_choice}
     * @return array Score result matching ConfidenceScorer return shape
     */
    public function score(string $userInput, array $parsed, array $thresholds): array
    {
        $anchors = $this->extractAnchors($userInput);
        $matchResult = $this->matchAnchors($anchors, $parsed);

        // Calculate anchor match score
        $anchorMatchScore = ($matchResult['totalWeight'] > 0)
            ? round($matchResult['matchedWeight'] / $matchResult['totalWeight'] * 100)
            : 50;

        // Specificity cap based on ORIGINAL anchor weight (what the user actually typed),
        // not the inflated weight from matching mechanics (e.g., appellation cross-check)
        $specificityCap = min(95, max(50, round(50 + $anchors['totalWeight'] * 15)));

        // Completeness bonus: +1 per non-empty, non-placeholder field in parsed output
        $placeholders = ['unknown', 'n/a', 'none', 'not specified', 'unspecified', 'tbd'];
        $completenessBonus = 0;
        $completenessFields = ['producer', 'wineName', 'vintage', 'region', 'grapes'];
        foreach ($completenessFields as $field) {
            $val = $parsed[$field] ?? null;
            if ($val === null || $val === '' || (is_array($val) && empty($val))) {
                continue;
            }
            // Filter placeholder string values
            if (is_string($val) && in_array(mb_strtolower(trim($val)), $placeholders, true)) {
                continue;
            }
            $completenessBonus++;
        }

        $finalScore = min($anchorMatchScore, $specificityCap) + $completenessBonus;
        $finalScore = max(0, min(100, $finalScore));

        $action = $this->determineAction($finalScore, $thresholds);

        error_log("[InputMatchScorer] score: anchorMatch={$anchorMatchScore}, cap={$specificityCap}, bonus={$completenessBonus}, final={$finalScore}, action={$action}");

        return [
            'score' => (int) $finalScore,
            'action' => (string) $action,
            'fieldScores' => [],
            'llmConfidence' => (int) ($parsed['confidence'] ?? 50),
            'calculatedScore' => (int) $anchorMatchScore,
            'thresholds' => $thresholds,
            'trace' => [
                'anchors' => $anchors,
                'totalWeight' => $matchResult['totalWeight'],
                'matchedWeight' => $matchResult['matchedWeight'],
                'matches' => $matchResult['matches'],
                'specificityCap' => $specificityCap,
                'completenessBonus' => $completenessBonus,
                'anchorMatchScore' => $anchorMatchScore,
            ],
        ];
    }

    /**
     * Image fallback scoring when no text input is available
     *
     * @param array $parsed LLM parsed result
     * @param int $llmConfidence LLM's own confidence (0-100)
     * @param array $thresholds {auto_populate, suggest, user_choice}
     * @return array Score result matching ConfidenceScorer return shape
     */
    public function scoreImageFallback(array $parsed, int $llmConfidence, array $thresholds): array
    {
        // Image fallback checks 7 fields (including country, wineType) vs text path's 5,
        // because image identification can extract visual cues for type/country from labels
        $fields = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];
        $presentFields = [];
        foreach ($fields as $field) {
            $val = $parsed[$field] ?? null;
            if ($val !== null && $val !== '' && (!is_array($val) || !empty($val))) {
                $presentFields[] = $field;
            }
        }

        $fieldCompleteness = round(count($presentFields) / 7 * 100);
        $blendedScore = ($fieldCompleteness * 0.7) + ($llmConfidence * 0.3);
        $finalScore = min(70, round($blendedScore));
        $finalScore = max(0, min(100, $finalScore));

        $action = $this->determineAction($finalScore, $thresholds);

        error_log("[InputMatchScorer] imageFallback: fieldCompleteness={$fieldCompleteness}, llmConf={$llmConfidence}, blended={$blendedScore}, final={$finalScore}");

        return [
            'score' => (int) $finalScore,
            'action' => (string) $action,
            'fieldScores' => [],
            'llmConfidence' => (int) $llmConfidence,
            'calculatedScore' => (int) round($blendedScore),
            'thresholds' => $thresholds,
            'trace' => [
                'imageFallback' => true,
                'presentFields' => $presentFields,
                'fieldCompleteness' => $fieldCompleteness,
                'blendedScore' => $blendedScore,
            ],
        ];
    }

    /**
     * Step 1: Extract anchors from user input via two-pass approach
     *
     * Pass 1: Normalize & multi-word phrase matching (grapes, regions, countries)
     * Pass 2: Single-token matching on remaining text
     *
     * @param string $userInput Raw user input
     * @return array Structured anchors with weights
     */
    public function extractAnchors(string $userInput): array
    {
        error_log("[InputMatchScorer] extractAnchors input='{$userInput}'");

        $anchors = [
            'vintage' => null,
            'type' => null,
            'grapes' => [],
            'regions' => [],
            'countries' => [],
            'appellations' => [],
            'nameTokens' => [],
            'totalWeight' => 0.0,
            'debug' => ['pass1_matches' => [], 'pass2_matches' => [], 'removed_stopwords' => []],
        ];

        if (empty(trim($userInput))) {
            return $anchors;
        }

        // Normalize: strip accents then lowercase
        $normalized = $this->stripAccents($userInput);
        $text = mb_strtolower($normalized, 'UTF-8');

        // ── PASS 1: Multi-word phrase matching ──

        // Extract vintage
        if (preg_match('/\b((?:19|20)\d{2})\b/', $text, $m)) {
            $year = (int) $m[1];
            $currentYear = (int) date('Y');
            if ($year >= 1900 && $year <= $currentYear + 2) {
                $anchors['vintage'] = $m[1];
                $anchors['totalWeight'] += 0.8;
                $anchors['debug']['pass1_matches'][] = "vintage={$m[1]}";
                // Remove vintage from text
                $text = preg_replace('/\b' . preg_quote($m[1], '/') . '\b/', ' ', $text, 1);
            }
        }

        // Multi-word grape matching (sort keys by length DESC, check longest first)
        $grapeKeys = array_keys(InferenceEngine::GRAPES);
        usort($grapeKeys, fn($a, $b) => mb_strlen($b) - mb_strlen($a));
        foreach ($grapeKeys as $grapeKey) {
            // Only match multi-word entries in Pass 1
            if (strpos($grapeKey, ' ') === false) {
                continue;
            }
            $pos = strpos($text, $grapeKey);
            if ($pos !== false) {
                $grapeData = InferenceEngine::GRAPES[$grapeKey];
                $anchors['grapes'][] = ['text' => $grapeKey, 'weight' => 0.6];
                $anchors['totalWeight'] += 0.6;
                $anchors['debug']['pass1_matches'][] = "grape={$grapeKey}";
                // Remove matched phrase
                $text = substr_replace($text, str_repeat(' ', mb_strlen($grapeKey)), $pos, mb_strlen($grapeKey));
            }
        }

        // Multi-word region matching
        $regionKeys = array_keys(InferenceEngine::REGIONS);
        usort($regionKeys, fn($a, $b) => mb_strlen($b) - mb_strlen($a));
        foreach ($regionKeys as $regionKey) {
            if (strpos($regionKey, ' ') === false) {
                continue;
            }
            $pos = strpos($text, $regionKey);
            if ($pos !== false) {
                $anchors['regions'][] = ['text' => $regionKey, 'weight' => 0.6];
                $anchors['totalWeight'] += 0.6;
                $anchors['debug']['pass1_matches'][] = "region={$regionKey}";
                $text = substr_replace($text, str_repeat(' ', mb_strlen($regionKey)), $pos, mb_strlen($regionKey));
            }
        }

        // Multi-word country matching
        $countryKeys = array_keys(InferenceEngine::COUNTRIES);
        usort($countryKeys, fn($a, $b) => mb_strlen($b) - mb_strlen($a));
        foreach ($countryKeys as $countryKey) {
            if (strpos($countryKey, ' ') === false) {
                continue;
            }
            $pos = strpos($text, $countryKey);
            if ($pos !== false) {
                $anchors['countries'][] = ['text' => $countryKey, 'weight' => 0.4];
                $anchors['debug']['pass1_matches'][] = "country={$countryKey}";
                $anchors['totalWeight'] += 0.4;
                $text = substr_replace($text, str_repeat(' ', mb_strlen($countryKey)), $pos, mb_strlen($countryKey));
            }
        }

        error_log("[InputMatchScorer] Pass 1: vintage={$anchors['vintage']}, grapes=[" . implode(',', array_column($anchors['grapes'], 'text')) . "], regions=[" . implode(',', array_column($anchors['regions'], 'text')) . "]");

        // ── PASS 2: Single-token matching on remaining text ──

        $tokens = preg_split('/[\s,;.!?]+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        $matchedTokens = [];
        $removedStopwords = [];
        $nameTokens = [];

        foreach ($tokens as $token) {
            if (mb_strlen($token) < 2) {
                continue;
            }

            $matched = false;

            // a. Grape match (single-word)
            if (isset(InferenceEngine::GRAPES[$token])) {
                $anchors['grapes'][] = ['text' => $token, 'weight' => 0.6];
                $anchors['totalWeight'] += 0.6;
                $matchedTokens[] = "grape={$token}";
                $matched = true;
            }

            // b. Region match (single-word)
            if (!$matched && isset(InferenceEngine::REGIONS[$token])) {
                $anchors['regions'][] = ['text' => $token, 'weight' => 0.6];
                $anchors['totalWeight'] += 0.6;
                $matchedTokens[] = "region={$token}";
                $matched = true;
            }

            // c. Country match (single-word)
            if (!$matched && isset(InferenceEngine::COUNTRIES[$token])) {
                $anchors['countries'][] = ['text' => $token, 'weight' => 0.4];
                $anchors['totalWeight'] += 0.4;
                $matchedTokens[] = "country={$token}";
                $matched = true;
            }

            // d. Wine type match
            if (!$matched && isset(InferenceEngine::WINE_TYPES[$token])) {
                $anchors['type'] = $token;
                $anchors['totalWeight'] += 0.3;
                $matchedTokens[] = "type={$token}";
                $matched = true;
            }

            // e. Appellation fallback
            if (!$matched) {
                $appellationMatch = $this->inferenceEngine->matchAppellationStatic($token);
                if ($appellationMatch) {
                    $anchors['appellations'][] = [
                        'text' => $token,
                        'parentRegion' => $appellationMatch['region'] ?? null,
                        'weight' => 0.6,
                    ];
                    $anchors['totalWeight'] += 0.6;
                    $matchedTokens[] = "appellation={$token}";
                    $matched = true;
                }
            }

            // f. Stop word removal
            if (!$matched && in_array($token, $this->stopWords, true)) {
                $removedStopwords[] = $token;
                $matched = true;
            }

            // g. Remaining tokens with length >= 3 become name tokens
            if (!$matched && mb_strlen($token) >= 3) {
                $nameTokens[] = $token;
            }
        }

        $anchors['nameTokens'] = $nameTokens;
        $anchors['totalWeight'] += count($nameTokens) * 1.0;

        $anchors['debug']['pass2_matches'] = $matchedTokens;
        $anchors['debug']['removed_stopwords'] = $removedStopwords;

        error_log("[InputMatchScorer] Pass 2: tokens=[" . implode(',', $tokens) . "], matched=[" . implode(',', $matchedTokens) . "], stopwords=[" . implode(',', $removedStopwords) . "], nameTokens=[" . implode(',', $nameTokens) . "]");
        error_log("[InputMatchScorer] Anchors: totalWeight={$anchors['totalWeight']}, types=" . json_encode(array_keys(array_filter([
            'vintage' => $anchors['vintage'],
            'type' => $anchors['type'],
            'grapes' => $anchors['grapes'],
            'regions' => $anchors['regions'],
            'appellations' => $anchors['appellations'],
            'nameTokens' => $anchors['nameTokens'],
        ]))));

        return $anchors;
    }

    /**
     * Step 2: Match extracted anchors against LLM output fields
     *
     * @param array $anchors From extractAnchors()
     * @param array $parsed LLM parsed result
     * @return array {totalWeight, matchedWeight, matches[]}
     */
    public function matchAnchors(array $anchors, array $parsed): array
    {
        $totalWeight = $anchors['totalWeight'];
        $matchedWeight = 0.0;
        $matches = [];

        // Match vintage
        if ($anchors['vintage'] !== null) {
            $parsedVintage = isset($parsed['vintage']) ? (string) $parsed['vintage'] : null;
            $matched = ($parsedVintage !== null && (string) $anchors['vintage'] === $parsedVintage);
            $matchedAgainst = $matched ? $parsedVintage : null;
            if ($matched) {
                $matchedWeight += 0.8;
            }
            $matches[] = [
                'type' => 'vintage',
                'text' => $anchors['vintage'],
                'weight' => 0.8,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: vintage '{$anchors['vintage']}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match type
        if ($anchors['type'] !== null) {
            $parsedType = $parsed['wineType'] ?? null;
            $matched = ($parsedType !== null && mb_strtolower($anchors['type']) === mb_strtolower($parsedType));
            $matchedAgainst = $matched ? $parsedType : null;
            if ($matched) {
                $matchedWeight += 0.3;
            }
            $matches[] = [
                'type' => 'type',
                'text' => $anchors['type'],
                'weight' => 0.3,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: type '{$anchors['type']}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match grapes
        foreach ($anchors['grapes'] as $grapeAnchor) {
            $grapeText = $grapeAnchor['text'];
            $weight = $grapeAnchor['weight'];
            $matched = false;
            $matchedAgainst = null;

            $parsedGrapes = $parsed['grapes'] ?? null;
            if ($parsedGrapes !== null && is_array($parsedGrapes)) {
                foreach ($parsedGrapes as $parsedGrape) {
                    if (is_string($parsedGrape) && FuzzyMatcher::isFuzzyMatch($grapeText, $parsedGrape)) {
                        $matched = true;
                        $matchedAgainst = $parsedGrape;
                        break;
                    }
                }
            }

            if ($matched) {
                $matchedWeight += $weight;
            }
            $matches[] = [
                'type' => 'grape',
                'text' => $grapeText,
                'weight' => $weight,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: grape '{$grapeText}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match regions
        foreach ($anchors['regions'] as $regionAnchor) {
            $regionText = $regionAnchor['text'];
            $weight = $regionAnchor['weight'];
            $matched = false;
            $matchedAgainst = null;

            $fieldsToCheck = array_filter([
                $parsed['region'] ?? null,
                $parsed['country'] ?? null,
            ]);

            foreach ($fieldsToCheck as $fieldVal) {
                $fieldLower = mb_strtolower($fieldVal);
                $regionLower = mb_strtolower($regionText);

                // Substring match
                if (strpos($fieldLower, $regionLower) !== false || strpos($regionLower, $fieldLower) !== false) {
                    $matched = true;
                    $matchedAgainst = $fieldVal;
                    break;
                }
                // Fuzzy similarity
                if (FuzzyMatcher::similarity($regionText, $fieldVal) >= 0.50) {
                    $matched = true;
                    $matchedAgainst = $fieldVal;
                    break;
                }
            }

            if ($matched) {
                $matchedWeight += $weight;
            }
            $matches[] = [
                'type' => 'region',
                'text' => $regionText,
                'weight' => $weight,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: region '{$regionText}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match countries
        foreach ($anchors['countries'] ?? [] as $countryAnchor) {
            $countryText = $countryAnchor['text'];
            $weight = $countryAnchor['weight'];
            $matched = false;
            $matchedAgainst = null;

            $parsedCountry = $parsed['country'] ?? null;
            if ($parsedCountry !== null) {
                // Look up the normalized country name from the dictionary
                $normalizedCountry = InferenceEngine::COUNTRIES[$countryText] ?? $countryText;
                if (mb_strtolower($normalizedCountry) === mb_strtolower($parsedCountry)) {
                    $matched = true;
                    $matchedAgainst = $parsedCountry;
                }
            }

            if ($matched) {
                $matchedWeight += $weight;
            }
            $matches[] = [
                'type' => 'country',
                'text' => $countryText,
                'weight' => $weight,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: country '{$countryText}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match appellations
        foreach ($anchors['appellations'] as $appellationAnchor) {
            $appText = $appellationAnchor['text'];
            $parentRegion = $appellationAnchor['parentRegion'];
            $weight = $appellationAnchor['weight'];
            $matched = false;
            $matchedAgainst = null;

            $fieldsToCheck = array_filter([
                $parsed['region'] ?? null,
                $parsed['country'] ?? null,
                $parsed['appellation'] ?? null,
            ]);

            foreach ($fieldsToCheck as $fieldVal) {
                $fieldLower = mb_strtolower($fieldVal);
                $appLower = mb_strtolower($appText);

                if (strpos($fieldLower, $appLower) !== false || strpos($appLower, $fieldLower) !== false) {
                    $matched = true;
                    $matchedAgainst = $fieldVal;
                    break;
                }
            }

            // Also check parent region match
            if (!$matched && $parentRegion !== null) {
                $parentLower = mb_strtolower($parentRegion);
                foreach ($fieldsToCheck as $fieldVal) {
                    if (mb_strtolower($fieldVal) === $parentLower) {
                        $matched = true;
                        $matchedAgainst = $fieldVal . " (via parent region)";
                        break;
                    }
                }
            }

            if ($matched) {
                $matchedWeight += $weight;
            }
            $matches[] = [
                'type' => 'appellation',
                'text' => $appText,
                'weight' => $weight,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: appellation '{$appText}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // Match name tokens
        foreach ($anchors['nameTokens'] as $nameToken) {
            $weight = 1.0;
            $matched = false;
            $matchedAgainst = null;

            $producer = $parsed['producer'] ?? '';
            $wineName = $parsed['wineName'] ?? '';
            $combined = trim($producer . ' ' . $wineName);

            // Normalize accents for comparison (e.g., "chateau" matches "Château")
            $tokenLower = mb_strtolower($nameToken);
            $tokenNorm = mb_strtolower($this->stripAccents($nameToken));
            $bestScore = 0.0;
            $bestField = null;

            // Check producer
            if ($producer !== '') {
                $producerLower = mb_strtolower($producer);
                $producerNorm = mb_strtolower($this->stripAccents($producer));
                if (strpos($producerNorm, $tokenNorm) !== false) {
                    $matched = true;
                    $matchedAgainst = $producer;
                } else {
                    $sim = FuzzyMatcher::similarity($nameToken, $producer);
                    if ($sim > $bestScore) {
                        $bestScore = $sim;
                        $bestField = $producer;
                    }
                }
            }

            // Check wineName
            if (!$matched && $wineName !== '') {
                $wineNameNorm = mb_strtolower($this->stripAccents($wineName));
                if (strpos($wineNameNorm, $tokenNorm) !== false) {
                    $matched = true;
                    $matchedAgainst = $wineName;
                } else {
                    $sim = FuzzyMatcher::similarity($nameToken, $wineName);
                    if ($sim > $bestScore) {
                        $bestScore = $sim;
                        $bestField = $wineName;
                    }
                }
            }

            // Check combined
            if (!$matched && $combined !== '') {
                $combinedNorm = mb_strtolower($this->stripAccents($combined));
                if (strpos($combinedNorm, $tokenNorm) !== false) {
                    $matched = true;
                    $matchedAgainst = $combined;
                } else {
                    $sim = FuzzyMatcher::similarity($nameToken, $combined);
                    if ($sim > $bestScore) {
                        $bestScore = $sim;
                        $bestField = $combined;
                    }
                }
            }

            // Use best fuzzy score if >= 0.55
            if (!$matched && $bestScore >= 0.55) {
                $matched = true;
                $matchedAgainst = $bestField;
            }

            if ($matched) {
                $matchedWeight += $weight;
            }
            $matches[] = [
                'type' => 'nameToken',
                'text' => $nameToken,
                'weight' => $weight,
                'matched' => $matched,
                'matchedAgainst' => $matchedAgainst,
            ];
            error_log("[InputMatchScorer] matchAnchors: nameToken '{$nameToken}' => " . ($matched ? "MATCH against '{$matchedAgainst}'" : "NO MATCH"));
        }

        // ── Appellation name cross-check ──
        // If an appellation word (e.g., "margaux") was consumed as a geographic match,
        // also verify whether it appears in the wine's producer/name.
        // This distinguishes "Château Margaux" (name contains "margaux") from
        // "Château Palmer" (also from Margaux appellation, but name doesn't contain it).
        $nameCheckWeight = 0.6;
        foreach ($anchors['appellations'] as $appellationAnchor) {
            $appText = mb_strtolower($this->stripAccents($appellationAnchor['text']));
            $producer = $parsed['producer'] ?? '';
            $wineName = $parsed['wineName'] ?? '';
            $combined = mb_strtolower($this->stripAccents(trim($producer . ' ' . $wineName)));

            $totalWeight += $nameCheckWeight;

            if ($combined !== '' && strpos($combined, $appText) !== false) {
                $matchedWeight += $nameCheckWeight;
                error_log("[InputMatchScorer] matchAnchors: appellation '{$appText}' CONFIRMED in wine name '{$combined}' - bonus +{$nameCheckWeight}");
            } else {
                error_log("[InputMatchScorer] matchAnchors: appellation '{$appText}' NOT in wine name '{$combined}' - no name bonus");
            }
        }

        return [
            'totalWeight' => $totalWeight,
            'matchedWeight' => $matchedWeight,
            'matches' => $matches,
        ];
    }

    /**
     * Strip common accented characters for substring matching
     * More reliable than FuzzyMatcher::normalizeAccents on Windows (no Transliterator)
     */
    private function stripAccents(string $text): string
    {
        return str_replace(
            ['é', 'è', 'ê', 'ë', 'à', 'â', 'ä', 'ô', 'ö', 'û', 'ü', 'ù', 'ï', 'î', 'ç', 'ñ',
             'É', 'È', 'Ê', 'Ë', 'À', 'Â', 'Ä', 'Ô', 'Ö', 'Û', 'Ü', 'Ù', 'Ï', 'Î', 'Ç', 'Ñ'],
            ['e', 'e', 'e', 'e', 'a', 'a', 'a', 'o', 'o', 'u', 'u', 'u', 'i', 'i', 'c', 'n',
             'E', 'E', 'E', 'E', 'A', 'A', 'A', 'O', 'O', 'U', 'U', 'U', 'I', 'I', 'C', 'N'],
            $text
        );
    }

    /**
     * Determine action from score based on thresholds
     *
     * @param int $score Final confidence score (0-100)
     * @param array $thresholds {auto_populate, suggest, user_choice}
     * @return string Action: auto_populate, suggest, user_choice, or disambiguate
     */
    private function determineAction(int $score, array $thresholds): string
    {
        $autoPopulate = $thresholds['auto_populate'] ?? 85;
        $suggest = $thresholds['suggest'] ?? 60;
        $userChoice = $thresholds['user_choice'] ?? 60;

        if ($score >= $autoPopulate) return 'auto_populate';
        if ($score >= $suggest) return 'suggest';
        if ($score >= $userChoice) return 'user_choice';
        return 'disambiguate';
    }
}
