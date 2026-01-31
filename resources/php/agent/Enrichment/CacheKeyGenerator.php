<?php
/**
 * Cache Key Generator
 *
 * Generates consistent cache keys for wine enrichment lookups.
 *
 * @package Agent\Enrichment
 */

namespace Agent\Enrichment;

class CacheKeyGenerator
{
    public function generateWineKey(?string $producer, ?string $wineName, ?string $vintage): string
    {
        $parts = [
            $this->normalize($producer ?? ''),
            $this->normalize($wineName ?? ''),
            $vintage ?? 'NV',  // Explicit NV handling for non-vintage wines
        ];
        return implode('|', $parts);
    }

    /**
     * Normalize text for cache key generation
     * Uses same pattern as checkDuplicate.php for consistency
     */
    public function normalize(string $text): string
    {
        // Remove accents (reuse proven pattern)
        $text = $this->normalizeAccents($text);
        // Lowercase
        $text = mb_strtolower($text, 'UTF-8');
        // Remove special chars but keep spaces and hyphens
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        // Collapse whitespace
        $text = preg_replace('/\s+/', ' ', trim($text));
        // Replace spaces with hyphens for readability
        $text = str_replace(' ', '-', $text);

        return $text;
    }

    private function normalizeAccents(string $text): string
    {
        if (class_exists('Transliterator')) {
            $transliterator = \Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC');
            if ($transliterator) {
                return $transliterator->transliterate($text);
            }
        }
        // Fallback
        $result = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        return $result !== false ? $result : $text;
    }
}
