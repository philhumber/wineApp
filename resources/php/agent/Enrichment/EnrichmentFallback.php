<?php
/**
 * Enrichment Fallback
 *
 * Provides fallback enrichment data from reference tables when
 * web search fails or returns low-confidence results.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentFallback
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function inferFromReference(?string $producer, ?string $wineName, ?string $region, ?string $wineType): ?EnrichmentData
    {
        // Try refAppellations for grape/style data
        $appellation = $this->findAppellation($region);
        if ($appellation) {
            $data = new EnrichmentData();
            $data->appellation = $appellation['appellationName'];

            $primaryGrapes = json_decode($appellation['primaryGrapes'] ?? '[]', true);
            if ($primaryGrapes) {
                $data->grapeVarieties = array_map(
                    fn($g) => new GrapeVariety($g, null, 'reference'),
                    $primaryGrapes
                );
            }

            $data->confidence = 0.4;  // Low confidence for inference
            $data->sources = ['inference'];
            return $data;
        }

        return null;
    }

    public function getMinimumViable(?string $wineType): EnrichmentData
    {
        // Use refWineStyles for basic defaults
        $style = $this->findWineStyle($wineType);

        $data = new EnrichmentData();
        $data->body = $style['body'] ?? null;
        $data->confidence = 0.2;
        $data->sources = ['default'];

        return $data;
    }

    private function findAppellation(?string $region): ?array
    {
        if (!$region) {
            return null;
        }

        $stmt = $this->pdo->prepare(
            'SELECT * FROM refAppellations WHERE appellationName LIKE ? OR region LIKE ? LIMIT 1'
        );
        $stmt->execute(["%{$region}%", "%{$region}%"]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    private function findWineStyle(?string $wineType): ?array
    {
        if (!$wineType) {
            return null;
        }

        $stmt = $this->pdo->prepare(
            'SELECT * FROM refWineStyles WHERE wineType = ? LIMIT 1'
        );
        $stmt->execute([$wineType]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }
}
