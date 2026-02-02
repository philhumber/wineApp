<?php
/**
 * Enrichment Cache
 *
 * Manages caching of wine enrichment data with field-level TTLs.
 * Supports multi-tier canonical resolution for improved cache hit rates.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentCache
{
    private \PDO $pdo;
    private array $config;
    private CacheKeyGenerator $keyGenerator;
    private ?CanonicalNameResolver $resolver = null;

    private const TTL_GROUPS = [
        'static' => ['grapeVarieties', 'appellation', 'alcoholContent'],
        'semi_static' => ['drinkWindowStart', 'drinkWindowEnd', 'productionMethod', 'body', 'tannin', 'acidity', 'sweetness', 'overview', 'tastingNotes', 'pairingNotes'],
        'dynamic' => ['criticScores', 'averagePrice', 'priceSource'],
    ];

    public function __construct(\PDO $pdo, array $config)
    {
        $this->pdo = $pdo;
        $this->config = $config;
        $this->keyGenerator = new CacheKeyGenerator();
    }

    /**
     * Set the canonical name resolver (for multi-tier lookup)
     */
    public function setResolver(CanonicalNameResolver $resolver): void
    {
        $this->resolver = $resolver;
    }

    /**
     * Get cached enrichment data with multi-tier canonical resolution
     *
     * Lookup order:
     * - Tier 1: Original key (exact match)
     * - Tier 2: Expanded key (abbreviation expansion - "Ch." → "Château")
     * - Tier 3: Alias table lookup (previously resolved variants)
     * - Tier 4: Fuzzy matching (substring containment + Levenshtein)
     *
     * @param string $producer Original producer name
     * @param string $wineName Original wine name
     * @param string|null $vintage Vintage year
     * @return array|null Cache result with matchType, or null if not found
     */
    public function getWithResolution(string $producer, string $wineName, ?string $vintage): ?array
    {
        // If no resolver configured, fall back to simple lookup
        if (!$this->resolver) {
            return $this->get($producer, $wineName, $vintage);
        }

        // TIER 1 & 2: Generate original and expanded keys
        $keys = $this->keyGenerator->generateExpandedKey($producer, $wineName, $vintage, $this->resolver);

        // Try original key first (exact match)
        $row = $this->lookupByKey($keys['originalKey']);
        if ($row) {
            return $this->processHit($row, $keys['originalKey'], 'exact', $producer, $wineName, $vintage);
        }

        // Try expanded key (abbreviation expansion)
        if ($keys['wasExpanded']) {
            $row = $this->lookupByKey($keys['expandedKey']);
            if ($row) {
                // Create alias for future lookups (original → expanded)
                $this->resolver->createAlias(
                    $keys['originalKey'],
                    $keys['expandedKey'],
                    'abbreviation',
                    $row['confidence'] ?? 0.9
                );
                return $this->processHit($row, $keys['expandedKey'], 'abbreviation', $producer, $wineName, $vintage, [
                    'expandedProducer' => $keys['expandedProducer'],
                    'expandedWine' => $keys['expandedWine'],
                ]);
            }
        }

        // TIER 3: Alias table lookup
        $canonicalKey = $this->resolver->findCanonicalAlias($keys['originalKey']);
        if ($canonicalKey) {
            $row = $this->lookupByKey($canonicalKey);
            if ($row) {
                $this->resolver->recordAliasHit($keys['originalKey']);
                return $this->processHit($row, $canonicalKey, 'alias', $producer, $wineName, $vintage);
            }
        }

        // TIER 4: Fuzzy matching (substring containment + Levenshtein)
        $fuzzyMatch = $this->resolver->findFuzzyMatch($keys['originalKey']);
        if ($fuzzyMatch) {
            $row = $this->lookupByKey($fuzzyMatch['canonicalKey']);
            if ($row) {
                return $this->processHit(
                    $row,
                    $fuzzyMatch['canonicalKey'],
                    'fuzzy',
                    $producer,
                    $wineName,
                    $vintage,
                    [
                        'expandedProducer' => $fuzzyMatch['matchedProducer'],
                        'expandedWine' => $fuzzyMatch['matchedWine'],
                    ]
                );
            }
        }

        return null;
    }

    /**
     * Simple cache lookup by key (no resolution)
     *
     * @param string $producer Producer name
     * @param string $wineName Wine name
     * @param string|null $vintage Vintage year
     * @return array|null Cache result or null
     */
    public function get(string $producer, string $wineName, ?string $vintage): ?array
    {
        $key = $this->keyGenerator->generateWineKey($producer, $wineName, $vintage);
        $row = $this->lookupByKey($key);

        if (!$row) {
            return null;
        }

        return $this->processHit($row, $key, 'exact', $producer, $wineName, $vintage);
    }

    /**
     * Store enrichment data in cache
     */
    public function set(string $producer, string $wineName, ?string $vintage, EnrichmentData $data): void
    {
        $key = $this->keyGenerator->generateWineKey($producer, $wineName, $vintage);
        $now = date('Y-m-d H:i:s');

        // Upsert cache entry
        $sql = 'INSERT INTO cacheWineEnrichment (
            lookupKey, grapeVarieties, appellation, alcoholContent,
            drinkWindowStart, drinkWindowEnd, productionMethod,
            criticScores, averagePrice, priceSource,
            body, tannin, acidity, sweetness,
            overview, tastingNotes, pairingNotes,
            confidence, dataSource,
            staticFetchedAt, semiStaticFetchedAt, dynamicFetchedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            grapeVarieties = VALUES(grapeVarieties),
            appellation = VALUES(appellation),
            alcoholContent = VALUES(alcoholContent),
            drinkWindowStart = VALUES(drinkWindowStart),
            drinkWindowEnd = VALUES(drinkWindowEnd),
            productionMethod = VALUES(productionMethod),
            criticScores = VALUES(criticScores),
            averagePrice = VALUES(averagePrice),
            priceSource = VALUES(priceSource),
            body = VALUES(body),
            tannin = VALUES(tannin),
            acidity = VALUES(acidity),
            sweetness = VALUES(sweetness),
            overview = VALUES(overview),
            tastingNotes = VALUES(tastingNotes),
            pairingNotes = VALUES(pairingNotes),
            confidence = VALUES(confidence),
            dataSource = VALUES(dataSource),
            staticFetchedAt = VALUES(staticFetchedAt),
            semiStaticFetchedAt = VALUES(semiStaticFetchedAt),
            dynamicFetchedAt = VALUES(dynamicFetchedAt)';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $key,
            json_encode($data->grapeVarieties ? array_map(fn($g) => $g->toArray(), $data->grapeVarieties) : null),
            $data->appellation,
            $data->alcoholContent,
            $data->drinkWindow?->start,
            $data->drinkWindow?->end,
            $data->productionMethod,
            json_encode($data->criticScores ? array_map(fn($s) => $s->toArray(), $data->criticScores) : null),
            $data->averagePrice,
            $data->priceSource,
            $data->body,
            $data->tannin,
            $data->acidity,
            $data->sweetness,
            $data->overview,
            $data->tastingNotes,
            $data->pairingNotes,
            $data->confidence,
            $data->sources[0] ?? 'unknown',
            $now, $now, $now,
        ]);
    }

    /**
     * Increment hit count for a cache entry
     */
    public function incrementHitCount(string $lookupKey): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE cacheWineEnrichment SET hitCount = hitCount + 1, lastAccessedAt = NOW() WHERE lookupKey = ?'
        );
        $stmt->execute([$lookupKey]);
    }

    /**
     * Get key generator instance
     */
    public function getKeyGenerator(): CacheKeyGenerator
    {
        return $this->keyGenerator;
    }

    /**
     * Look up cache row by key
     */
    private function lookupByKey(string $key): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM cacheWineEnrichment WHERE lookupKey = ?'
        );
        $stmt->execute([$key]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        // Check TTLs - return null if all groups stale
        $staleGroups = $this->getStaleGroups($row);
        if (count($staleGroups) === count(self::TTL_GROUPS)) {
            return null;
        }

        return $row;
    }

    /**
     * Process a cache hit and build result array with matchType
     *
     * @param array $row Database row
     * @param string $key Lookup key that matched
     * @param string $matchType 'exact', 'abbreviation', 'alias', or 'fuzzy'
     * @param string $originalProducer Original search producer
     * @param string $originalWine Original search wine name
     * @param string|null $originalVintage Original search vintage
     * @param array $meta Additional metadata (e.g., expanded names)
     * @return array Cache result with matchType
     */
    private function processHit(
        array $row,
        string $key,
        string $matchType,
        string $originalProducer,
        string $originalWine,
        ?string $originalVintage,
        array $meta = []
    ): array {
        // Extract matched wine info from cache key
        $keyParts = explode('|', $key);
        $matchedProducer = $meta['expandedProducer'] ?? $this->denormalizeName($keyParts[0] ?? '');
        $matchedWine = $meta['expandedWine'] ?? $this->denormalizeName($keyParts[1] ?? '');
        $matchedVintage = ($keyParts[2] ?? null) === 'NV' ? null : ($keyParts[2] ?? null);

        return [
            'data' => $this->rowToEnrichmentData($row),
            'staleGroups' => $this->getStaleGroups($row),
            'lookupKey' => $key,
            'matchType' => $matchType,
            'searchedFor' => [
                'producer' => $originalProducer,
                'wineName' => $originalWine,
                'vintage' => $originalVintage,
            ],
            'matchedTo' => [
                'producer' => $matchedProducer,
                'wineName' => $matchedWine,
                'vintage' => $matchedVintage,
            ],
            'confidence' => $matchType === 'exact' ? 1.0 : ($row['confidence'] ?? 0.9),
        ];
    }

    /**
     * Simple denormalization for display (best effort)
     * Converts "chateau-margaux" back to "Chateau Margaux"
     */
    private function denormalizeName(string $normalized): string
    {
        $words = explode('-', $normalized);
        return implode(' ', array_map('ucfirst', $words));
    }

    private function getStaleGroups(array $row): array
    {
        $stale = [];
        $ttlDays = $this->config['enrichment']['cache_ttl_days'];

        foreach (['static', 'semi_static', 'dynamic'] as $group) {
            $fetchedAt = $row[$group . 'FetchedAt'] ?? null;
            if (!$fetchedAt) {
                $stale[] = $group;
                continue;
            }

            $age = (new \DateTime())->diff(new \DateTime($fetchedAt))->days;
            if ($age > $ttlDays[$group]) {
                $stale[] = $group;
            }
        }

        return $stale;
    }

    private function rowToEnrichmentData(array $row): EnrichmentData
    {
        $data = new EnrichmentData();

        $grapes = json_decode($row['grapeVarieties'] ?? 'null', true);
        if ($grapes) {
            $data->grapeVarieties = array_map(fn($g) => GrapeVariety::fromArray($g), $grapes);
        }

        $data->appellation = $row['appellation'] ?? null;
        $data->alcoholContent = $row['alcoholContent'] ? (float)$row['alcoholContent'] : null;

        if ($row['drinkWindowStart'] || $row['drinkWindowEnd']) {
            $data->drinkWindow = new DrinkWindow(
                $row['drinkWindowStart'] ? (int)$row['drinkWindowStart'] : null,
                $row['drinkWindowEnd'] ? (int)$row['drinkWindowEnd'] : null
            );
        }

        $data->productionMethod = $row['productionMethod'] ?? null;

        $scores = json_decode($row['criticScores'] ?? 'null', true);
        if ($scores) {
            $data->criticScores = array_map(fn($s) => CriticScore::fromArray($s), $scores);
        }

        $data->averagePrice = $row['averagePrice'] ? (float)$row['averagePrice'] : null;
        $data->priceSource = $row['priceSource'] ?? null;
        $data->body = $row['body'] ?? null;
        $data->tannin = $row['tannin'] ?? null;
        $data->acidity = $row['acidity'] ?? null;
        $data->sweetness = $row['sweetness'] ?? null;
        $data->overview = $row['overview'] ?? null;
        $data->tastingNotes = $row['tastingNotes'] ?? null;
        $data->pairingNotes = $row['pairingNotes'] ?? null;
        $data->confidence = $row['confidence'] ? (float)$row['confidence'] : 0.0;
        $data->sources = ['cache'];

        return $data;
    }
}
