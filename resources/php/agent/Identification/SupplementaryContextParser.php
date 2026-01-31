<?php
/**
 * Supplementary Context Parser
 *
 * Parses user-provided supplementary text into structured constraints
 * with confidence levels. Used during re-identification to guide the LLM
 * and adjust post-LLM confidence scoring.
 *
 * Core matching logic (priority order):
 * 1. Region (highest) - match ~20 known regions, infer country
 * 2. Country - match ~15 country names, suggest typical regions
 * 3. Wine type - match red/white/sparkling etc., constrain grape color
 * 4. Grape - match ~30 common grapes, infer wine type from color
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class SupplementaryContextParser
{
    // ─────────────────────────────────────────────────────
    // STATIC LOOKUP DATA
    // ─────────────────────────────────────────────────────

    /** Region -> Country mapping (~20 entries) */
    private const REGIONS = [
        'bordeaux' => ['name' => 'Bordeaux', 'country' => 'France'],
        'burgundy' => ['name' => 'Burgundy', 'country' => 'France'],
        'bourgogne' => ['name' => 'Burgundy', 'country' => 'France'],
        'champagne' => ['name' => 'Champagne', 'country' => 'France'],
        'rhône' => ['name' => 'Rhône', 'country' => 'France'],
        'rhone' => ['name' => 'Rhône', 'country' => 'France'],
        'loire' => ['name' => 'Loire', 'country' => 'France'],
        'alsace' => ['name' => 'Alsace', 'country' => 'France'],
        'provence' => ['name' => 'Provence', 'country' => 'France'],
        'tuscany' => ['name' => 'Tuscany', 'country' => 'Italy'],
        'toscana' => ['name' => 'Tuscany', 'country' => 'Italy'],
        'piedmont' => ['name' => 'Piedmont', 'country' => 'Italy'],
        'piemonte' => ['name' => 'Piedmont', 'country' => 'Italy'],
        'veneto' => ['name' => 'Veneto', 'country' => 'Italy'],
        'rioja' => ['name' => 'Rioja', 'country' => 'Spain'],
        'ribera del duero' => ['name' => 'Ribera del Duero', 'country' => 'Spain'],
        'napa' => ['name' => 'Napa Valley', 'country' => 'USA'],
        'napa valley' => ['name' => 'Napa Valley', 'country' => 'USA'],
        'sonoma' => ['name' => 'Sonoma', 'country' => 'USA'],
        'barossa' => ['name' => 'Barossa Valley', 'country' => 'Australia'],
        'barossa valley' => ['name' => 'Barossa Valley', 'country' => 'Australia'],
        'marlborough' => ['name' => 'Marlborough', 'country' => 'New Zealand'],
        'mosel' => ['name' => 'Mosel', 'country' => 'Germany'],
        'mendoza' => ['name' => 'Mendoza', 'country' => 'Argentina'],
        'stellenbosch' => ['name' => 'Stellenbosch', 'country' => 'South Africa'],
    ];

    /** Country name normalization (~15 entries) */
    private const COUNTRIES = [
        'france' => 'France',
        'french' => 'France',
        'italy' => 'Italy',
        'italian' => 'Italy',
        'spain' => 'Spain',
        'spanish' => 'Spain',
        'portugal' => 'Portugal',
        'portuguese' => 'Portugal',
        'germany' => 'Germany',
        'german' => 'Germany',
        'australia' => 'Australia',
        'australian' => 'Australia',
        'new zealand' => 'New Zealand',
        'argentina' => 'Argentina',
        'chile' => 'Chile',
        'south africa' => 'South Africa',
        'usa' => 'USA',
        'united states' => 'USA',
        'america' => 'USA',
        'american' => 'USA',
        'california' => 'USA',
        'austria' => 'Austria',
        'austrian' => 'Austria',
    ];

    /** Wine type normalization */
    private const WINE_TYPES = [
        'red' => 'Red',
        'white' => 'White',
        'rose' => 'Rosé',
        'rosé' => 'Rosé',
        'pink' => 'Rosé',
        'sparkling' => 'Sparkling',
        'dessert' => 'Dessert',
        'sweet' => 'Dessert',
        'fortified' => 'Fortified',
        'port' => 'Fortified',
        'sherry' => 'Fortified',
    ];

    /** Grape variety matching with color (red/white) */
    private const GRAPES = [
        // Red grapes
        'cabernet sauvignon' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'cabernet' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'cab sav' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'merlot' => ['name' => 'Merlot', 'color' => 'Red'],
        'pinot noir' => ['name' => 'Pinot Noir', 'color' => 'Red'],
        'pinot' => ['name' => 'Pinot Noir', 'color' => 'Red'],
        'syrah' => ['name' => 'Syrah', 'color' => 'Red'],
        'shiraz' => ['name' => 'Shiraz', 'color' => 'Red'],
        'tempranillo' => ['name' => 'Tempranillo', 'color' => 'Red'],
        'sangiovese' => ['name' => 'Sangiovese', 'color' => 'Red'],
        'nebbiolo' => ['name' => 'Nebbiolo', 'color' => 'Red'],
        'malbec' => ['name' => 'Malbec', 'color' => 'Red'],
        'grenache' => ['name' => 'Grenache', 'color' => 'Red'],
        'garnacha' => ['name' => 'Grenache', 'color' => 'Red'],
        'zinfandel' => ['name' => 'Zinfandel', 'color' => 'Red'],
        'mourvèdre' => ['name' => 'Mourvèdre', 'color' => 'Red'],
        'mourvedre' => ['name' => 'Mourvèdre', 'color' => 'Red'],
        'barbera' => ['name' => 'Barbera', 'color' => 'Red'],
        'cabernet franc' => ['name' => 'Cabernet Franc', 'color' => 'Red'],
        'cab franc' => ['name' => 'Cabernet Franc', 'color' => 'Red'],
        'petit verdot' => ['name' => 'Petit Verdot', 'color' => 'Red'],
        'pinotage' => ['name' => 'Pinotage', 'color' => 'Red'],
        // White grapes
        'chardonnay' => ['name' => 'Chardonnay', 'color' => 'White'],
        'sauvignon blanc' => ['name' => 'Sauvignon Blanc', 'color' => 'White'],
        'sauv blanc' => ['name' => 'Sauvignon Blanc', 'color' => 'White'],
        'riesling' => ['name' => 'Riesling', 'color' => 'White'],
        'pinot grigio' => ['name' => 'Pinot Grigio', 'color' => 'White'],
        'pinot gris' => ['name' => 'Pinot Gris', 'color' => 'White'],
        'gewürztraminer' => ['name' => 'Gewürztraminer', 'color' => 'White'],
        'gewurztraminer' => ['name' => 'Gewürztraminer', 'color' => 'White'],
        'viognier' => ['name' => 'Viognier', 'color' => 'White'],
        'chenin blanc' => ['name' => 'Chenin Blanc', 'color' => 'White'],
        'grüner veltliner' => ['name' => 'Grüner Veltliner', 'color' => 'White'],
        'gruner veltliner' => ['name' => 'Grüner Veltliner', 'color' => 'White'],
        'albariño' => ['name' => 'Albariño', 'color' => 'White'],
        'albarino' => ['name' => 'Albariño', 'color' => 'White'],
        'moscato' => ['name' => 'Moscato', 'color' => 'White'],
        'muscat' => ['name' => 'Muscat', 'color' => 'White'],
    ];

    /** Country -> typical regions mapping for inferences */
    private const COUNTRY_REGIONS = [
        'France' => ['Bordeaux', 'Burgundy', 'Champagne', 'Rhône', 'Loire', 'Alsace', 'Provence'],
        'Italy' => ['Tuscany', 'Piedmont', 'Veneto', 'Sicily', 'Puglia'],
        'Spain' => ['Rioja', 'Ribera del Duero', 'Priorat', 'Rías Baixas'],
        'USA' => ['Napa Valley', 'Sonoma', 'Willamette Valley', 'Paso Robles'],
        'Australia' => ['Barossa Valley', 'McLaren Vale', 'Margaret River', 'Hunter Valley'],
        'Germany' => ['Mosel', 'Rheingau', 'Pfalz'],
        'Argentina' => ['Mendoza', 'Salta'],
        'New Zealand' => ['Marlborough', 'Central Otago', 'Hawke\'s Bay'],
        'South Africa' => ['Stellenbosch', 'Swartland', 'Franschhoek'],
    ];

    // ─────────────────────────────────────────────────────
    // PARSE
    // ─────────────────────────────────────────────────────

    /**
     * Parse supplementary text into structured constraints
     *
     * @param string $text User-provided supplementary text
     * @return array {constraints: array, inferences: array, promptSnippet: string}
     */
    public function parse(string $text): array
    {
        $text = trim($text);
        if (empty($text)) {
            return ['constraints' => [], 'inferences' => [], 'promptSnippet' => ''];
        }

        $constraints = [];
        $inferences = [];
        $lower = strtolower($text);

        // Detect uncertainty markers — reduces constraint confidence
        $hasUncertainty = (bool) preg_match('/\b(i think|maybe|possibly|perhaps|not sure|might be)\b/i', $text);
        $confidenceMultiplier = $hasUncertainty ? 0.7 : 1.0;

        // Split input into terms for multi-term matching
        // Handle both comma-separated and space-separated
        $terms = preg_split('/[,;]+/', $lower);
        $terms = array_map('trim', $terms);
        $terms = array_filter($terms);

        // Also try the full text as a single match (for multi-word terms like "ribera del duero")
        array_unshift($terms, $lower);

        $matchedTypes = [];

        foreach ($terms as $term) {
            // Strip common filler words for matching
            $cleanTerm = preg_replace('/\b(i think|maybe|possibly|perhaps|it\'?s?\s+(a|an)?|from|the|wine|grape|is)\b/', '', $term);
            $cleanTerm = trim(preg_replace('/\s+/', ' ', $cleanTerm));
            if (empty($cleanTerm)) continue;

            // Priority 1: Region match (highest priority)
            if (!isset($matchedTypes['region'])) {
                $regionMatch = $this->matchRegion($cleanTerm);
                if ($regionMatch) {
                    $matchedTypes['region'] = true;
                    $constraints[] = [
                        'type' => 'region',
                        'value' => $regionMatch['name'],
                        'confidence' => 0.90 * $confidenceMultiplier,
                    ];
                    // Infer country from region
                    if (!isset($matchedTypes['country'])) {
                        $matchedTypes['country'] = true;
                        $constraints[] = [
                            'type' => 'country',
                            'value' => $regionMatch['country'],
                            'confidence' => 0.95 * $confidenceMultiplier,
                        ];
                        $inferences[] = "Country inferred as {$regionMatch['country']} from region {$regionMatch['name']}";
                    }
                    continue;
                }
            }

            // Priority 2: Country match
            if (!isset($matchedTypes['country'])) {
                $countryMatch = $this->matchCountry($cleanTerm);
                if ($countryMatch) {
                    $matchedTypes['country'] = true;
                    $constraints[] = [
                        'type' => 'country',
                        'value' => $countryMatch,
                        'confidence' => 0.90 * $confidenceMultiplier,
                    ];
                    // Add region inference
                    if (isset(self::COUNTRY_REGIONS[$countryMatch])) {
                        $regions = implode(', ', self::COUNTRY_REGIONS[$countryMatch]);
                        $inferences[] = "Region should be in {$countryMatch} ({$regions})";
                    }
                    continue;
                }
            }

            // Priority 3: Wine type match
            if (!isset($matchedTypes['wineType'])) {
                $typeMatch = $this->matchWineType($cleanTerm);
                if ($typeMatch) {
                    $matchedTypes['wineType'] = true;
                    $constraints[] = [
                        'type' => 'wineType',
                        'value' => $typeMatch,
                        'confidence' => 0.85 * $confidenceMultiplier,
                    ];
                    // Infer grape color
                    if (in_array($typeMatch, ['Red', 'White'])) {
                        $inferences[] = "Grapes should be {$typeMatch} varieties";
                    }
                    continue;
                }
            }

            // Priority 4: Grape match
            if (!isset($matchedTypes['grape'])) {
                $grapeMatch = $this->matchGrape($cleanTerm);
                if ($grapeMatch) {
                    $matchedTypes['grape'] = true;
                    $constraints[] = [
                        'type' => 'grape',
                        'value' => $grapeMatch['name'],
                        'confidence' => 0.85 * $confidenceMultiplier,
                    ];
                    // Infer wine type from grape color
                    if (!isset($matchedTypes['wineType'])) {
                        $matchedTypes['wineType'] = true;
                        $constraints[] = [
                            'type' => 'wineType',
                            'value' => $grapeMatch['color'],
                            'confidence' => 0.80 * $confidenceMultiplier,
                        ];
                        $inferences[] = "Wine type inferred as {$grapeMatch['color']} from grape {$grapeMatch['name']}";
                    }
                    continue;
                }
            }
        }

        // Build prompt snippet
        $promptSnippet = $this->buildPromptSnippet($constraints, $inferences);

        return [
            'constraints' => $constraints,
            'inferences' => $inferences,
            'promptSnippet' => $promptSnippet,
        ];
    }

    // ─────────────────────────────────────────────────────
    // MATCHERS
    // ─────────────────────────────────────────────────────

    /**
     * Match text against known regions
     *
     * @param string $text Lowercase text
     * @return array|null {name, country} or null
     */
    private function matchRegion(string $text): ?array
    {
        // Exact match first
        if (isset(self::REGIONS[$text])) {
            return self::REGIONS[$text];
        }

        // Partial match — check if any region name appears in the text
        foreach (self::REGIONS as $key => $data) {
            if (strlen($key) >= 4 && strpos($text, $key) !== false) {
                return $data;
            }
        }

        return null;
    }

    /**
     * Match text against known countries
     *
     * @param string $text Lowercase text
     * @return string|null Normalized country name or null
     */
    private function matchCountry(string $text): ?string
    {
        // Exact match first
        if (isset(self::COUNTRIES[$text])) {
            return self::COUNTRIES[$text];
        }

        // Partial match for multi-word country names
        foreach (self::COUNTRIES as $key => $name) {
            if (strlen($key) >= 4 && strpos($text, $key) !== false) {
                return $name;
            }
        }

        return null;
    }

    /**
     * Match text against wine types
     *
     * @param string $text Lowercase text
     * @return string|null Normalized wine type or null
     */
    private function matchWineType(string $text): ?string
    {
        // Exact word match
        foreach (self::WINE_TYPES as $key => $type) {
            if (preg_match('/\b' . preg_quote($key, '/') . '\b/', $text)) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Match text against grape varieties
     *
     * @param string $text Lowercase text
     * @return array|null {name, color} or null
     */
    private function matchGrape(string $text): ?array
    {
        // Exact match first
        if (isset(self::GRAPES[$text])) {
            return self::GRAPES[$text];
        }

        // Partial match for multi-word grape names (e.g., "sauvignon" matches "Sauvignon Blanc")
        foreach (self::GRAPES as $key => $data) {
            if (strlen($key) >= 5 && strpos($text, $key) !== false) {
                return $data;
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────
    // PROMPT BUILDER
    // ─────────────────────────────────────────────────────

    /**
     * Build a prompt snippet from parsed constraints and inferences
     *
     * @param array $constraints Parsed constraints
     * @param array $inferences Inferred context
     * @return string Prompt snippet to append to LLM prompt
     */
    private function buildPromptSnippet(array $constraints, array $inferences): string
    {
        if (empty($constraints) && empty($inferences)) {
            return '';
        }

        $lines = ['USER CONTEXT (use to guide identification):'];

        foreach ($constraints as $constraint) {
            $lines[] = "- {$constraint['type']}: {$constraint['value']} (user indicated)";
        }

        foreach ($inferences as $inference) {
            $lines[] = "- Inferred: {$inference}";
        }

        $lines[] = 'Ensure identification is consistent with these hints, but trust clear visual/textual evidence over user hints if they conflict.';

        return implode("\n", $lines);
    }

    // ─────────────────────────────────────────────────────
    // POST-LLM VALIDATION
    // ─────────────────────────────────────────────────────

    /**
     * Validate LLM output against user-provided constraints
     * Returns a confidence adjustment value (positive = matches, negative = conflicts)
     *
     * Adjustments:
     * - High-confidence constraint matches LLM output: +15
     * - Low-confidence constraint matches: +10
     * - High-confidence constraint conflicts with LLM: -10
     * - Low-confidence constraint conflicts: -5
     *
     * @param array $parsed Parsed wine data from LLM
     * @param array $constraints Constraints from parse()
     * @return int Confidence adjustment (can be positive or negative)
     */
    public function validateAgainstConstraints(array $parsed, array $constraints): int
    {
        $adjustment = 0;

        foreach ($constraints as $constraint) {
            $type = $constraint['type'];
            $expectedValue = $constraint['value'];
            $constraintConfidence = $constraint['confidence'] ?? 0.5;
            $isHighConfidence = $constraintConfidence >= 0.80;

            $actualValue = $this->getFieldValue($parsed, $type);

            if ($actualValue === null) {
                // LLM didn't return this field — no adjustment
                continue;
            }

            $matches = $this->valuesMatch($type, $expectedValue, $actualValue);

            if ($matches) {
                $adjustment += $isHighConfidence ? 15 : 10;
            } else {
                $adjustment -= $isHighConfidence ? 10 : 5;
            }
        }

        return $adjustment;
    }

    /**
     * Get the relevant field value from parsed data for a constraint type
     *
     * @param array $parsed Parsed wine data
     * @param string $type Constraint type
     * @return string|null Field value
     */
    private function getFieldValue(array $parsed, string $type): ?string
    {
        $fieldMap = [
            'country' => 'country',
            'region' => 'region',
            'wineType' => 'wineType',
            'grape' => 'grapes',
        ];

        $field = $fieldMap[$type] ?? $type;
        $value = $parsed[$field] ?? null;

        if (is_array($value)) {
            // For grapes array, join for comparison
            return !empty($value) ? implode(', ', $value) : null;
        }

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Check if constraint value matches the LLM output
     * Uses case-insensitive partial matching
     *
     * @param string $type Constraint type
     * @param string $expected Expected value
     * @param string $actual Actual value from LLM
     * @return bool Whether values match
     */
    private function valuesMatch(string $type, string $expected, string $actual): bool
    {
        $expectedLower = strtolower($expected);
        $actualLower = strtolower($actual);

        // Exact match
        if ($expectedLower === $actualLower) {
            return true;
        }

        // Partial match — expected contained in actual or vice versa
        if (strpos($actualLower, $expectedLower) !== false || strpos($expectedLower, $actualLower) !== false) {
            return true;
        }

        // For grapes, check if expected grape appears in the grape list
        if ($type === 'grape') {
            return strpos($actualLower, strtolower($expected)) !== false;
        }

        return false;
    }
}
