<?php
/**
 * Enrichment Service (Orchestrator)
 *
 * Main entry point for wine enrichment. Orchestrates cache lookups,
 * web search enrichment, validation, and fallback strategies.
 *
 * WIN-162: Added canonical name resolution with user confirmation for non-exact matches.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentService
{
    private EnrichmentCache $cache;
    private WebSearchEnricher $enricher;
    private ValidationService $validator;
    private EnrichmentMerger $merger;
    private EnrichmentFallback $fallback;
    private array $config;

    public function __construct(
        EnrichmentCache $cache,
        WebSearchEnricher $enricher,
        ValidationService $validator,
        EnrichmentMerger $merger,
        EnrichmentFallback $fallback,
        array $config
    ) {
        $this->cache = $cache;
        $this->enricher = $enricher;
        $this->validator = $validator;
        $this->merger = $merger;
        $this->fallback = $fallback;
        $this->config = $config;
    }

    /**
     * Enrich wine data from identification result
     *
     * @param array $identification Parsed identification data
     * @param bool $confirmMatch If true, user has confirmed a non-exact cache match
     * @param bool $forceRefresh If true, skip cache and do fresh web search
     * @return EnrichmentResult
     */
    public function enrich(array $identification, bool $confirmMatch = false, bool $forceRefresh = false): EnrichmentResult
    {
        $producer = $identification['parsed']['producer'] ?? null;
        $wineName = $identification['parsed']['wineName'] ?? null;
        $vintage = $identification['parsed']['vintage'] ?? null;
        $wineType = $identification['parsed']['wineType'] ?? null;
        $region = $identification['parsed']['region'] ?? null;

        $result = new EnrichmentResult();
        $result->source = 'inference';  // Default

        // Validate input
        if (!$producer && !$wineName) {
            $result->success = false;
            $result->warnings = ['No producer or wine name provided'];
            return $result;
        }

        $thresholds = $this->config['enrichment']['confidence_thresholds'];

        // Skip cache if forceRefresh requested
        if (!$forceRefresh) {
            // 1. Check cache with canonical resolution
            $cacheResult = $this->cache->getWithResolution($producer ?? '', $wineName ?? '', $vintage);

            if ($cacheResult && $cacheResult['data']->confidence >= $thresholds['cache_accept']) {
                $matchType = $cacheResult['matchType'] ?? 'exact';

                // For non-exact matches, require user confirmation
                if ($matchType !== 'exact' && !$confirmMatch) {
                    return $this->buildPendingConfirmation($cacheResult, $identification);
                }

                // Exact match or user confirmed - return cached data
                $this->cache->incrementHitCount($cacheResult['lookupKey']);
                $result->success = true;
                $result->data = $cacheResult['data'];
                $result->source = 'cache';
                $result->matchType = $matchType;
                return $result;
            }
        }

        // 2. Web search enrichment
        $fresh = null;
        if ($this->config['enrichment']['enabled']) {
            try {
                $fresh = $this->enricher->enrich($producer ?? '', $wineName ?? '', $vintage);

                if ($fresh) {
                    // 3. Sanitize LLM output
                    $fresh = $this->validator->sanitize($fresh);

                    // 4. Validate and detect hallucinations
                    $warnings = $this->validator->validate($fresh, $vintage, $wineType);
                    $result->warnings = $warnings;

                    // 5. Cache if confidence meets threshold
                    if ($fresh->confidence >= $thresholds['store_minimum']) {
                        $this->cache->set($producer ?? '', $wineName ?? '', $vintage, $fresh);
                    }
                }
            } catch (\Exception $e) {
                \error_log("EnrichmentService: Web search failed - " . $e->getMessage());
                $result->warnings[] = 'Web search enrichment failed';
            }
        }

        // 6. Merge with cache/inference if needed
        $cached = null;
        if (!$forceRefresh) {
            $cacheResult = $this->cache->get($producer ?? '', $wineName ?? '', $vintage);
            $cached = $cacheResult ? $cacheResult['data'] : null;
        }
        $inference = null;

        if (!$fresh || $fresh->confidence < $thresholds['merge_threshold']) {
            $inference = $this->fallback->inferFromReference($producer, $wineName, $region, $wineType);
        }

        $mergeResult = $this->merger->merge($fresh, $cached, $inference);

        $result->success = true;
        $result->data = $mergeResult['data'];
        $result->fieldSources = $mergeResult['fieldSources'];
        $result->source = $fresh ? 'web_search' : ($cached ? 'cache' : 'inference');

        return $result;
    }

    /**
     * Build a pending confirmation response for non-exact cache matches
     *
     * @param array $cacheResult Cache result with matchType
     * @param array $identification Original identification data
     * @return EnrichmentResult
     */
    private function buildPendingConfirmation(array $cacheResult, array $identification): EnrichmentResult
    {
        $result = new EnrichmentResult();
        $result->success = true;
        $result->pendingConfirmation = true;
        $result->matchType = $cacheResult['matchType'];
        $result->searchedFor = [
            'producer' => $identification['parsed']['producer'] ?? null,
            'wineName' => $identification['parsed']['wineName'] ?? null,
            'vintage' => $identification['parsed']['vintage'] ?? null,
        ];
        $result->matchedTo = $cacheResult['matchedTo'] ?? [
            'producer' => null,
            'wineName' => null,
            'vintage' => null,
        ];
        $result->confidence = $cacheResult['confidence'] ?? 0.9;
        $result->data = null;  // Data withheld until confirmed
        $result->source = 'cache';

        return $result;
    }

    /**
     * Enrich with simplified input parameters
     *
     * @param string $producer Producer name
     * @param string $wineName Wine name
     * @param string|null $vintage Vintage year
     * @param string|null $wineType Wine type (Red, White, etc.)
     * @param string|null $region Region name
     * @param bool $confirmMatch User confirmed non-exact match
     * @param bool $forceRefresh Skip cache, do fresh search
     * @return EnrichmentResult
     */
    public function enrichSimple(
        string $producer,
        string $wineName,
        ?string $vintage = null,
        ?string $wineType = null,
        ?string $region = null,
        bool $confirmMatch = false,
        bool $forceRefresh = false
    ): EnrichmentResult {
        return $this->enrich([
            'parsed' => [
                'producer' => $producer,
                'wineName' => $wineName,
                'vintage' => $vintage,
                'wineType' => $wineType,
                'region' => $region,
            ]
        ], $confirmMatch, $forceRefresh);
    }
}
