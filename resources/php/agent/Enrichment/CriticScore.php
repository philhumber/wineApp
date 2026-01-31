<?php
/**
 * Critic Score Value Object
 *
 * Represents a wine critic's score for a wine.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class CriticScore
{
    public string $critic;
    public int $score;
    public ?int $year;
    public ?string $source;

    public function __construct(string $critic, int $score, ?int $year = null, ?string $source = null)
    {
        $this->critic = $critic;
        $this->score = $score;
        $this->year = $year;
        $this->source = $source;
    }

    public function toArray(): array
    {
        return [
            'critic' => $this->critic,
            'score' => $this->score,
            'year' => $this->year,
            'source' => $this->source,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['critic'] ?? 'Unknown',
            $data['score'] ?? 0,
            $data['year'] ?? null,
            $data['source'] ?? null
        );
    }

    /**
     * Unique key for deduplication: critic + vintage being scored
     */
    public function getKey(): string
    {
        return strtoupper($this->critic) . '-' . ($this->year ?? 'NV');
    }
}
