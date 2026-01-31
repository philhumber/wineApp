<?php
/**
 * Grape Variety Value Object
 *
 * Represents a grape variety with optional percentage in a wine blend.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class GrapeVariety
{
    public string $grape;
    public ?int $percentage;
    public ?string $source;

    public function __construct(string $grape, ?int $percentage = null, ?string $source = null)
    {
        $this->grape = $grape;
        $this->percentage = $percentage;
        $this->source = $source;
    }

    public function toArray(): array
    {
        return [
            'grape' => $this->grape,
            'percentage' => $this->percentage,
            'source' => $this->source,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['grape'] ?? '',
            $data['percentage'] ?? null,
            $data['source'] ?? null
        );
    }

    /**
     * Parse legacy string format "Cabernet Sauvignon:75" into object
     */
    public static function fromString(string $str): self
    {
        if (preg_match('/^(.+):(\d+)$/', $str, $matches)) {
            return new self(trim($matches[1]), (int)$matches[2]);
        }
        return new self(trim($str), null);
    }
}
