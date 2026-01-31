<?php
/**
 * Drink Window Value Object
 *
 * Represents optimal drinking window for a wine.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class DrinkWindow
{
    public ?int $start;
    public ?int $end;
    public ?string $maturity;  // 'young', 'ready', 'peak', 'declining'

    public function __construct(?int $start = null, ?int $end = null, ?string $maturity = null)
    {
        $this->start = $start;
        $this->end = $end;
        $this->maturity = $maturity;
    }

    public function toArray(): array
    {
        return [
            'start' => $this->start,
            'end' => $this->end,
            'maturity' => $this->maturity,
        ];
    }

    public static function fromArray(?array $data): ?self
    {
        if (!$data) {
            return null;
        }
        return new self(
            $data['start'] ?? null,
            $data['end'] ?? null,
            $data['maturity'] ?? null
        );
    }

    public function isValid(): bool
    {
        if ($this->start === null && $this->end === null) {
            return true;  // Both null is valid (no data)
        }
        if ($this->start !== null && $this->end !== null) {
            return $this->end >= $this->start;
        }
        return false;  // Partial data is invalid
    }
}
