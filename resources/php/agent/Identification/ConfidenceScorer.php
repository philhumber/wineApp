<?php
/**
 * Confidence Scorer
 *
 * Calculates confidence scores for wine identification results and
 * determines the appropriate action based on thresholds.
 *
 * Actions:
 * - auto_populate: ≥85% confidence - Fill form automatically
 * - suggest: 60-84% confidence - Show suggestion with confirmation
 * - disambiguate: <60% confidence - Show multiple options
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class ConfidenceScorer
{
    /** @var array Field weights for scoring */
    private array $weights;

    /** @var array Confidence thresholds */
    private array $thresholds;

    /**
     * Create a new confidence scorer
     *
     * @param array $config Configuration with weights and thresholds
     */
    public function __construct(array $config)
    {
        $this->weights = $config['confidence']['weights'] ?? [
            'producer' => 0.30,
            'wine_name' => 0.20,
            'vintage' => 0.15,
            'region' => 0.15,
            'grape' => 0.10,
            'type' => 0.10,
        ];

        $this->thresholds = [
            'auto_populate' => $config['confidence']['auto_populate'] ?? 85,
            'suggest' => $config['confidence']['suggest'] ?? 60,
        ];
    }

    /**
     * Score parsed wine data
     *
     * @param array $parsed Parsed wine data from LLM
     * @return array Scoring result with score, action, and details
     */
    public function score(array $parsed): array
    {
        $fieldScores = [];
        $totalWeight = 0;
        $weightedScore = 0;

        // Score each field
        foreach ($this->weights as $field => $weight) {
            $fieldKey = $this->mapFieldKey($field);
            $value = $parsed[$fieldKey] ?? null;

            $score = $this->scoreField($field, $value);
            $fieldScores[$field] = [
                'score' => $score,
                'weight' => $weight,
                'value' => $value,
            ];

            $weightedScore += $score * $weight;
            $totalWeight += $weight;
        }

        // Calculate weighted score
        $calculatedScore = $totalWeight > 0
            ? ($weightedScore / $totalWeight) * 100
            : 0;

        // Factor in LLM's own confidence
        $llmConfidence = $parsed['confidence'] ?? 50;

        // Blend calculated score with LLM confidence (70/30 split)
        $finalScore = ($calculatedScore * 0.7) + ($llmConfidence * 0.3);
        $finalScore = min(100, max(0, round($finalScore)));

        return [
            'score' => $finalScore,
            'action' => $this->determineAction($finalScore),
            'fieldScores' => $fieldScores,
            'llmConfidence' => $llmConfidence,
            'calculatedScore' => round($calculatedScore),
            'thresholds' => $this->thresholds,
        ];
    }

    /**
     * Map internal field key to parsed data key
     *
     * @param string $field Internal field name
     * @return string Parsed data key
     */
    private function mapFieldKey(string $field): string
    {
        $map = [
            'producer' => 'producer',
            'wine_name' => 'wineName',
            'vintage' => 'vintage',
            'region' => 'region',
            'grape' => 'grapes',
            'type' => 'wineType',
        ];
        return $map[$field] ?? $field;
    }

    /**
     * Score individual field
     *
     * @param string $field Field name
     * @param mixed $value Field value
     * @return float Score between 0 and 1
     */
    private function scoreField(string $field, $value): float
    {
        // Empty values get zero score
        if ($value === null || $value === '' || $value === []) {
            return 0.0;
        }

        // Field-specific scoring rules
        switch ($field) {
            case 'vintage':
                return $this->scoreVintage($value);

            case 'grape':
                return $this->scoreGrapes($value);

            case 'type':
                return $this->scoreWineType($value);

            case 'producer':
                return $this->scoreProducer($value);

            case 'wine_name':
                return $this->scoreWineName($value);

            case 'region':
                return $this->scoreRegion($value);

            default:
                // For unknown fields, score based on presence
                return is_string($value) && strlen($value) >= 2 ? 1.0 : 0.5;
        }
    }

    /**
     * Score vintage field
     *
     * @param mixed $value Vintage value
     * @return float Score
     */
    private function scoreVintage($value): float
    {
        $vintage = (string)$value;

        // Valid 4-digit year between 1900 and current year + 1
        if (preg_match('/^(19|20)\d{2}$/', $vintage)) {
            $year = (int)$vintage;
            $currentYear = (int)date('Y');

            if ($year >= 1900 && $year <= $currentYear + 1) {
                return 1.0;
            }
        }

        // Partial year format
        if (preg_match('/\d{2,4}/', $vintage)) {
            return 0.5;
        }

        return 0.3;
    }

    /**
     * Score grapes field
     *
     * @param mixed $value Grapes value
     * @return float Score
     */
    private function scoreGrapes($value): float
    {
        if (!is_array($value)) {
            $value = [$value];
        }

        $count = count(array_filter($value));

        if ($count === 0) {
            return 0.0;
        }

        // Single grape identified with confidence
        if ($count === 1) {
            return 0.9;
        }

        // Multiple grapes (blend) - slightly lower confidence
        return min(1.0, 0.8 + ($count - 1) * 0.05);
    }

    /**
     * Score wine type field
     *
     * @param mixed $value Wine type value
     * @return float Score
     */
    private function scoreWineType($value): float
    {
        $validTypes = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified'];

        if (in_array($value, $validTypes)) {
            return 1.0;
        }

        // Close match
        foreach ($validTypes as $type) {
            if (stripos($value, $type) !== false || stripos($type, $value) !== false) {
                return 0.8;
            }
        }

        return 0.5;
    }

    /**
     * Score producer field
     *
     * @param mixed $value Producer value
     * @return float Score
     */
    private function scoreProducer($value): float
    {
        if (!is_string($value)) {
            return 0.0;
        }

        $length = mb_strlen(trim($value));

        // Very short names are suspicious
        if ($length < 3) {
            return 0.3;
        }

        // Reasonable length names
        if ($length >= 3 && $length <= 100) {
            // Bonus for common producer patterns
            if (preg_match('/^(Château|Domaine|Bodega|Weingut|Tenuta|Castello)\s/i', $value)) {
                return 1.0;
            }
            return 0.9;
        }

        // Very long names might be errors
        return 0.6;
    }

    /**
     * Score wine name field
     *
     * @param mixed $value Wine name value
     * @return float Score
     */
    private function scoreWineName($value): float
    {
        if (!is_string($value)) {
            return 0.0;
        }

        $length = mb_strlen(trim($value));

        if ($length < 2) {
            return 0.3;
        }

        if ($length >= 2 && $length <= 80) {
            return 1.0;
        }

        return 0.6;
    }

    /**
     * Score region field
     *
     * @param mixed $value Region value
     * @return float Score
     */
    private function scoreRegion($value): float
    {
        if (!is_string($value)) {
            return 0.0;
        }

        $length = mb_strlen(trim($value));

        if ($length < 2) {
            return 0.3;
        }

        // Well-known regions get bonus
        $knownRegions = [
            'bordeaux', 'burgundy', 'champagne', 'napa', 'sonoma',
            'tuscany', 'piedmont', 'rioja', 'barossa', 'marlborough',
            'mosel', 'rhône', 'loire', 'alsace', 'mendoza',
        ];

        $lower = strtolower($value);
        foreach ($knownRegions as $region) {
            if (strpos($lower, $region) !== false) {
                return 1.0;
            }
        }

        return 0.8;
    }

    /**
     * Determine action based on score
     *
     * @param int $score Confidence score (0-100)
     * @return string Action (auto_populate, suggest, disambiguate)
     */
    private function determineAction(int $score): string
    {
        if ($score >= $this->thresholds['auto_populate']) {
            return 'auto_populate';
        }

        if ($score >= $this->thresholds['suggest']) {
            return 'suggest';
        }

        return 'disambiguate';
    }

    /**
     * Get scoring explanation for debugging
     *
     * @param array $parsed Parsed wine data
     * @return array Detailed scoring explanation
     */
    public function explain(array $parsed): array
    {
        $result = $this->score($parsed);

        $explanation = [
            'finalScore' => $result['score'],
            'action' => $result['action'],
            'actionReason' => $this->getActionReason($result['score'], $result['action']),
            'llmConfidence' => $result['llmConfidence'],
            'calculatedScore' => $result['calculatedScore'],
            'fields' => [],
        ];

        foreach ($result['fieldScores'] as $field => $data) {
            $explanation['fields'][$field] = [
                'value' => $data['value'],
                'score' => round($data['score'] * 100),
                'weight' => $data['weight'] * 100 . '%',
                'contribution' => round($data['score'] * $data['weight'] * 100, 1),
            ];
        }

        return $explanation;
    }

    /**
     * Get human-readable action reason
     *
     * @param int $score Score
     * @param string $action Action
     * @return string Explanation
     */
    private function getActionReason(int $score, string $action): string
    {
        return match ($action) {
            'auto_populate' => "High confidence ({$score}%) - safe to auto-fill form",
            'suggest' => "Medium confidence ({$score}%) - suggest with confirmation",
            'disambiguate' => "Low confidence ({$score}%) - show multiple options",
            default => "Unknown action",
        };
    }
}
