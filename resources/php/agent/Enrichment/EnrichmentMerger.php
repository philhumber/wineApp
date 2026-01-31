<?php
/**
 * Enrichment Merger
 *
 * Merges enrichment data from multiple sources with conflict resolution.
 * Priority: fresh > stale_cache > inference
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentMerger
{
    /**
     * Merge sources: fresh > stale_cache > inference
     * @return array{data: EnrichmentData, fieldSources: array}
     */
    public function merge(?EnrichmentData $fresh, ?EnrichmentData $cached, ?EnrichmentData $inference): array
    {
        $result = new EnrichmentData();
        $fieldSources = [];

        $sources = [
            'fresh' => $fresh,
            'cache' => $cached,
            'inference' => $inference,
        ];

        // Merge scalar fields with priority
        foreach (['appellation', 'alcoholContent', 'productionMethod', 'body', 'tannin', 'acidity', 'sweetness', 'overview', 'tastingNotes', 'pairingNotes', 'averagePrice', 'priceSource'] as $field) {
            foreach ($sources as $sourceName => $source) {
                if ($source && $source->$field !== null) {
                    $result->$field = $source->$field;
                    $fieldSources[$field] = $sourceName;
                    break;
                }
            }
        }

        // Merge grapes (prefer fresh, then cached)
        if ($fresh?->grapeVarieties) {
            $result->grapeVarieties = $fresh->grapeVarieties;
            $fieldSources['grapeVarieties'] = 'fresh';
        } elseif ($cached?->grapeVarieties) {
            $result->grapeVarieties = $cached->grapeVarieties;
            $fieldSources['grapeVarieties'] = 'cache';
        } elseif ($inference?->grapeVarieties) {
            $result->grapeVarieties = $inference->grapeVarieties;
            $fieldSources['grapeVarieties'] = 'inference';
        }

        // Merge drink window
        if ($fresh?->drinkWindow) {
            $result->drinkWindow = $fresh->drinkWindow;
            $fieldSources['drinkWindow'] = 'fresh';
        } elseif ($cached?->drinkWindow) {
            $result->drinkWindow = $cached->drinkWindow;
            $fieldSources['drinkWindow'] = 'cache';
        }

        // Merge critic scores with conflict resolution
        $result->criticScores = $this->mergeCriticScores(
            $fresh?->criticScores,
            $cached?->criticScores
        );
        if ($result->criticScores) {
            $fieldSources['criticScores'] = $fresh?->criticScores ? 'fresh' : 'cache';
        }

        // Calculate combined confidence
        $result->confidence = $fresh?->confidence ?? $cached?->confidence ?? $inference?->confidence ?? 0;

        // Combine sources
        $result->sources = array_unique(array_filter([
            $fresh ? 'web_search' : null,
            $cached ? 'cache' : null,
            $inference ? 'inference' : null,
        ]));

        return [
            'data' => $result,
            'fieldSources' => $fieldSources,
        ];
    }

    /**
     * Merge critic scores, handling conflicts
     * @param CriticScore[]|null $a
     * @param CriticScore[]|null $b
     * @return CriticScore[]|null
     */
    private function mergeCriticScores(?array $a, ?array $b): ?array
    {
        if (!$a && !$b) {
            return null;
        }
        if (!$a) {
            return $b;
        }
        if (!$b) {
            return $a;
        }

        $indexed = [];

        // Process cached first (lower priority)
        foreach ($b as $score) {
            $indexed[$score->getKey()] = $score;
        }

        // Process fresh (higher priority) - overwrites on conflict
        foreach ($a as $score) {
            $key = $score->getKey();

            if (!isset($indexed[$key])) {
                $indexed[$key] = $score;
            } else {
                // Conflict resolution: prefer score with source, or higher score if same metadata
                $existing = $indexed[$key];

                if ($score->source && !$existing->source) {
                    $indexed[$key] = $score;  // Prefer sourced
                } elseif (!$score->source && $existing->source) {
                    // Keep existing (has source)
                } elseif (abs($score->score - $existing->score) <= 2) {
                    // Within 2 points - prefer higher
                    $indexed[$key] = $score->score >= $existing->score ? $score : $existing;
                } else {
                    // Significant difference - prefer fresh
                    $indexed[$key] = $score;
                }
            }
        }

        return array_values($indexed);
    }
}
