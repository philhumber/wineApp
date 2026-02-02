<?php
/**
 * Enrichment Result Object
 *
 * API response wrapper for enrichment operations.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentResult
{
    public bool $success = true;
    public ?EnrichmentData $data = null;
    public string $source = 'inference';      // 'cache', 'web_search', 'inference'
    public array $warnings = [];
    public ?array $fieldSources = null;       // Which fields came from where
    public ?array $usage = null;              // LLM usage stats

    // WIN-162: Canonical resolution confirmation fields
    public bool $pendingConfirmation = false;
    public ?string $matchType = null;         // 'exact', 'abbreviation', 'alias', 'fuzzy'
    public ?array $searchedFor = null;        // Original search terms
    public ?array $matchedTo = null;          // What we matched to
    public ?float $confidence = null;         // Match confidence

    public function toArray(): array
    {
        $arr = [
            'success' => $this->success,
            'data' => $this->data?->toArray(),
            'source' => $this->source,
            'warnings' => $this->warnings,
            'fieldSources' => $this->fieldSources,
            'usage' => $this->usage,
        ];

        // Only include confirmation fields when applicable
        if ($this->pendingConfirmation) {
            $arr['pendingConfirmation'] = true;
            $arr['matchType'] = $this->matchType;
            $arr['searchedFor'] = $this->searchedFor;
            $arr['matchedTo'] = $this->matchedTo;
            $arr['confidence'] = $this->confidence;
        }

        return $arr;
    }
}
