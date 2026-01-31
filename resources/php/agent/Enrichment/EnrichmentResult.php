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
    public bool $success;
    public ?EnrichmentData $data = null;
    public string $source;                   // 'cache', 'web_search', 'inference'
    public array $warnings = [];
    public ?array $fieldSources = null;      // Which fields came from where
    public ?array $usage = null;             // LLM usage stats

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'data' => $this->data?->toArray(),
            'source' => $this->source,
            'warnings' => $this->warnings,
            'fieldSources' => $this->fieldSources,
            'usage' => $this->usage,
        ];
    }
}
