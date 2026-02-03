<?php
/**
 * Validation Service
 *
 * Validates and sanitizes enrichment data from LLM responses.
 * Includes hallucination detection and data quality checks.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class ValidationService
{
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function validate(EnrichmentData $data, ?string $vintage = null, ?string $wineType = null): array
    {
        $warnings = [];
        $confidenceMultiplier = 1.0;
        $validation = $this->config['enrichment']['validation'];
        $fortifiedTypes = $this->config['enrichment']['fortified_types'];

        // === VALIDATION ===

        // ABV validation (type-aware)
        if ($data->alcoholContent !== null) {
            $isFortified = in_array($wineType, $fortifiedTypes, true);
            $max = $isFortified ? $validation['abv_max_fortified'] : $validation['abv_max_standard'];
            $min = $isFortified ? 15 : $validation['abv_min'];

            if ($data->alcoholContent < $min || $data->alcoholContent > $max) {
                $warnings[] = "ABV {$data->alcoholContent}% outside typical range for " . ($isFortified ? 'fortified' : 'standard') . " wine";
                $data->alcoholContent = null;
            }
        }

        // Drink window validation (proper null handling)
        if ($data->drinkWindow !== null) {
            if (!$data->drinkWindow->isValid()) {
                $warnings[] = 'Invalid drink window (partial or inverted range)';
                $data->drinkWindow = null;
            }
        }

        // Vintage vs drink window (allow same year)
        if ($vintage && $data->drinkWindow?->start !== null) {
            $vintageYear = (int)$vintage;
            if ($data->drinkWindow->start < $vintageYear - 1) {
                $warnings[] = 'Drink window starts before vintage year';
            }
        }

        // Impossible future dates
        $currentYear = (int)date('Y');
        if ($data->drinkWindow?->end !== null && $data->drinkWindow->end > $currentYear + 50) {
            $warnings[] = 'Drink window extends more than 50 years into future';
            $data->drinkWindow->end = null;
        }

        // Critic scores (100-point systems only)
        if ($data->criticScores) {
            $original = count($data->criticScores);
            $data->criticScores = array_filter($data->criticScores, function(CriticScore $score) use ($validation) {
                return $score->score >= $validation['critic_score_min']
                    && $score->score <= $validation['critic_score_max'];
            });
            if (count($data->criticScores) < $original) {
                $warnings[] = 'Some critic scores filtered (outside 50-100 range)';
            }
            $data->criticScores = array_values($data->criticScores);  // Re-index
        }

        // Grape percentages (handle "Other")
        if ($data->grapeVarieties) {
            $total = 0;
            $hasOther = false;
            foreach ($data->grapeVarieties as $grape) {
                if (in_array(strtolower($grape->grape), ['other', 'various', 'blend'], true)) {
                    $hasOther = true;
                }
                $total += $grape->percentage ?? 0;
            }

            $tolerance = $validation['grape_percentage_tolerance'];
            $minTotal = $hasOther ? 90 : (100 - $tolerance);
            $maxTotal = $hasOther ? 110 : (100 + $tolerance);

            if ($total > 0 && ($total < $minTotal || $total > $maxTotal)) {
                $warnings[] = "Grape percentages sum to {$total}%";
            }
        }

        // Narrative field length warnings (warn but store full content)
        if ($data->overview && strlen($data->overview) > 1000) {
            $warnings[] = 'Overview exceeds recommended length (' . strlen($data->overview) . ' chars)';
        }
        if ($data->tastingNotes && strlen($data->tastingNotes) > 1000) {
            $warnings[] = 'Tasting notes exceed recommended length (' . strlen($data->tastingNotes) . ' chars)';
        }
        if ($data->pairingNotes && strlen($data->pairingNotes) > 1000) {
            $warnings[] = 'Pairing notes exceed recommended length (' . strlen($data->pairingNotes) . ' chars)';
        }

        // === HALLUCINATION DETECTION ===

        // Identical scores from multiple critics (unlikely)
        if ($data->criticScores && count($data->criticScores) > 2) {
            $scoreValues = array_map(fn($s) => $s->score, $data->criticScores);
            if (count(array_unique($scoreValues)) === 1) {
                $warnings[] = 'Suspiciously identical scores from multiple critics';
                $confidenceMultiplier *= 0.8;
            }
        }

        // Generic critic names
        $suspiciousNames = ['wine expert', 'wine critic', 'anonymous', 'various', 'multiple critics'];
        if ($data->criticScores) {
            foreach ($data->criticScores as $score) {
                if (in_array(strtolower($score->critic), $suspiciousNames, true)) {
                    $warnings[] = "Generic critic name '{$score->critic}' suggests hallucination";
                    $confidenceMultiplier *= 0.9;
                    break;
                }
            }
        }

        // Generic drink windows - only flag if clearly synthetic
        if ($data->drinkWindow?->start && $data->drinkWindow?->end) {
            $range = $data->drinkWindow->end - $data->drinkWindow->start;
            $genericPatterns = [5, 10, 15, 20];  // Suspiciously round ranges
            if (in_array($range, $genericPatterns) && empty($data->sources) && $data->confidence < 0.5) {
                $warnings[] = 'Generic drink window pattern detected';
            }
        }

        // Apply confidence adjustment
        $data->confidence *= $confidenceMultiplier;

        return $warnings;
    }

    /**
     * Sanitize LLM output before storage
     */
    public function sanitize(EnrichmentData $data): EnrichmentData
    {
        // Strip HTML from text fields
        if ($data->productionMethod) {
            $data->productionMethod = strip_tags($data->productionMethod);
        }
        if ($data->appellation) {
            $data->appellation = strip_tags($data->appellation);
        }

        // Sanitize narrative fields
        if ($data->overview) {
            $data->overview = strip_tags($data->overview);
        }
        if ($data->tastingNotes) {
            $data->tastingNotes = strip_tags($data->tastingNotes);
        }
        if ($data->pairingNotes) {
            $data->pairingNotes = strip_tags($data->pairingNotes);
        }

        // Clamp numeric values
        if ($data->alcoholContent !== null) {
            $data->alcoholContent = max(0, min(30, $data->alcoholContent));
        }
        if ($data->drinkWindow?->start !== null) {
            $data->drinkWindow->start = max(1900, min(2100, $data->drinkWindow->start));
        }
        if ($data->drinkWindow?->end !== null) {
            $data->drinkWindow->end = max(1900, min(2100, $data->drinkWindow->end));
        }

        // Normalize style ENUM fields to match database values
        $data->body = $this->normalizeBody($data->body);
        $data->tannin = $this->normalizeTannin($data->tannin);
        $data->acidity = $this->normalizeAcidity($data->acidity);
        $data->sweetness = $this->normalizeSweetness($data->sweetness);

        return $data;
    }

    /**
     * Normalize body value to ENUM: Light, Medium-Light, Medium, Medium-Full, Full
     */
    private function normalizeBody(?string $value): ?string
    {
        if ($value === null) return null;

        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[-\s]?bodied$/i', '', $normalized);
        $normalized = trim($normalized);

        $map = [
            'light' => 'Light',
            'light body' => 'Light',
            'medium-light' => 'Medium-Light',
            'medium light' => 'Medium-Light',
            'medium' => 'Medium',
            'medium body' => 'Medium',
            'medium-full' => 'Medium-Full',
            'medium full' => 'Medium-Full',
            'full' => 'Full',
            'full body' => 'Full',
        ];

        return $map[$normalized] ?? null;
    }

    /**
     * Normalize tannin value to ENUM: Low, Medium-Low, Medium, Medium-High, High
     */
    private function normalizeTannin(?string $value): ?string
    {
        if ($value === null) return null;

        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/\s*(tannins?|level)$/i', '', $normalized);
        $normalized = trim($normalized);

        $map = [
            'low' => 'Low',
            'soft' => 'Low',
            'silky' => 'Low',
            'medium-low' => 'Medium-Low',
            'medium low' => 'Medium-Low',
            'moderate-low' => 'Medium-Low',
            'medium' => 'Medium',
            'moderate' => 'Medium',
            'medium-high' => 'Medium-High',
            'medium high' => 'Medium-High',
            'moderate-high' => 'Medium-High',
            'high' => 'High',
            'firm' => 'High',
            'grippy' => 'High',
        ];

        return $map[$normalized] ?? null;
    }

    /**
     * Normalize acidity value to ENUM: Low, Medium-Low, Medium, Medium-High, High
     */
    private function normalizeAcidity(?string $value): ?string
    {
        if ($value === null) return null;

        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/\s*(acidity|level)$/i', '', $normalized);
        $normalized = trim($normalized);

        $map = [
            'low' => 'Low',
            'soft' => 'Low',
            'medium-low' => 'Medium-Low',
            'medium low' => 'Medium-Low',
            'moderate-low' => 'Medium-Low',
            'medium' => 'Medium',
            'moderate' => 'Medium',
            'balanced' => 'Medium',
            'medium-high' => 'Medium-High',
            'medium high' => 'Medium-High',
            'moderate-high' => 'Medium-High',
            'high' => 'High',
            'bright' => 'High',
            'crisp' => 'High',
            'fresh' => 'Medium-High',
        ];

        return $map[$normalized] ?? null;
    }

    /**
     * Normalize sweetness value to ENUM: Dry, Off-Dry, Medium-Sweet, Sweet
     */
    private function normalizeSweetness(?string $value): ?string
    {
        if ($value === null) return null;

        $normalized = strtolower(trim($value));

        $map = [
            'dry' => 'Dry',
            'bone dry' => 'Dry',
            'very dry' => 'Dry',
            'brut' => 'Dry',
            'extra brut' => 'Dry',
            'brut nature' => 'Dry',
            'off-dry' => 'Off-Dry',
            'off dry' => 'Off-Dry',
            'slightly sweet' => 'Off-Dry',
            'extra dry' => 'Off-Dry',
            'demi-sec' => 'Off-Dry',
            'medium-sweet' => 'Medium-Sweet',
            'medium sweet' => 'Medium-Sweet',
            'semi-sweet' => 'Medium-Sweet',
            'sweet' => 'Sweet',
            'dessert' => 'Sweet',
            'doux' => 'Sweet',
            'luscious' => 'Sweet',
        ];

        return $map[$normalized] ?? null;
    }
}
