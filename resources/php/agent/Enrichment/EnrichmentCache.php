<?php
/**
 * Enrichment Cache
 *
 * Manages caching of wine enrichment data with field-level TTLs.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentCache
{
    private \PDO $pdo;
    private array $config;
    private CacheKeyGenerator $keyGenerator;

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

    public function get(string $producer, string $wineName, ?string $vintage): ?array
    {
        $key = $this->keyGenerator->generateWineKey($producer, $wineName, $vintage);

        $stmt = $this->pdo->prepare(
            'SELECT * FROM cacheWineEnrichment WHERE lookupKey = ?'
        );
        $stmt->execute([$key]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        // Check TTLs per field group
        $staleGroups = $this->getStaleGroups($row);

        if (count($staleGroups) === count(self::TTL_GROUPS)) {
            return null;  // All groups stale
        }

        return [
            'data' => $this->rowToEnrichmentData($row),
            'staleGroups' => $staleGroups,
            'lookupKey' => $key,
        ];
    }

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

    public function incrementHitCount(string $lookupKey): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE cacheWineEnrichment SET hitCount = hitCount + 1, lastAccessedAt = NOW() WHERE lookupKey = ?'
        );
        $stmt->execute([$lookupKey]);
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
