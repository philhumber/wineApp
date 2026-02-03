<?php
/**
 * Enrichment Data Object
 *
 * Contains all enrichment data for a wine including grape varieties,
 * critic scores, drink windows, and style profiles.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class EnrichmentData
{
    /** @var GrapeVariety[]|null */
    public ?array $grapeVarieties = null;
    public ?string $appellation = null;
    public ?float $alcoholContent = null;
    public ?DrinkWindow $drinkWindow = null;
    public ?string $productionMethod = null;
    /** @var CriticScore[]|null */
    public ?array $criticScores = null;
    public ?float $averagePrice = null;
    public ?string $priceSource = null;

    // Style profile embedded
    public ?string $body = null;         // "Light", "Medium", "Full"
    public ?string $tannin = null;
    public ?string $acidity = null;
    public ?string $sweetness = null;

    // Narrative content
    public ?string $overview = null;
    public ?string $tastingNotes = null;
    public ?string $pairingNotes = null;

    public float $confidence = 0.0;
    public array $sources = [];

    public function toArray(): array
    {
        return [
            'grapeVarieties' => $this->grapeVarieties
                ? array_map(fn($g) => $g->toArray(), $this->grapeVarieties)
                : null,
            'appellation' => $this->appellation,
            'alcoholContent' => $this->alcoholContent,
            'drinkWindow' => $this->drinkWindow?->toArray(),
            'productionMethod' => $this->productionMethod,
            'criticScores' => $this->criticScores
                ? array_map(fn($s) => $s->toArray(), $this->criticScores)
                : null,
            'averagePrice' => $this->averagePrice,
            'priceSource' => $this->priceSource,
            'body' => $this->body,
            'tannin' => $this->tannin,
            'acidity' => $this->acidity,
            'sweetness' => $this->sweetness,
            'overview' => $this->overview,
            'tastingNotes' => $this->tastingNotes,
            'pairingNotes' => $this->pairingNotes,
            'confidence' => $this->confidence,
            'sources' => $this->sources,
        ];
    }

    public static function fromArray(array $data): self
    {
        $obj = new self();

        if (!empty($data['grapeVarieties'])) {
            $obj->grapeVarieties = array_map(
                fn($g) => is_array($g) ? GrapeVariety::fromArray($g) : GrapeVariety::fromString($g),
                $data['grapeVarieties']
            );
        }

        $obj->appellation = $data['appellation'] ?? null;
        $obj->alcoholContent = isset($data['alcoholContent']) ? (float)$data['alcoholContent'] : null;
        $obj->drinkWindow = DrinkWindow::fromArray($data['drinkWindow'] ?? null);
        $obj->productionMethod = $data['productionMethod'] ?? null;

        if (!empty($data['criticScores'])) {
            $obj->criticScores = array_map(
                fn($s) => CriticScore::fromArray($s),
                $data['criticScores']
            );
        }

        $obj->averagePrice = isset($data['averagePrice']) ? (float)$data['averagePrice'] : null;
        $obj->priceSource = $data['priceSource'] ?? null;
        $obj->body = $data['body'] ?? null;
        $obj->tannin = $data['tannin'] ?? null;
        $obj->acidity = $data['acidity'] ?? null;
        $obj->sweetness = $data['sweetness'] ?? null;
        $obj->overview = $data['overview'] ?? null;
        $obj->tastingNotes = $data['tastingNotes'] ?? null;
        $obj->pairingNotes = $data['pairingNotes'] ?? null;
        $obj->confidence = $data['confidence'] ?? 0.0;
        $obj->sources = $data['sources'] ?? [];

        return $obj;
    }
}
