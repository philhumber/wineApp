<?php
/**
 * Intent Detector
 *
 * Detects user intent from text input. Determines whether the user
 * wants to add a wine, get advice, or find a pairing.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class IntentDetector
{
    /** Intent: Add wine to collection */
    public const INTENT_ADD = 'add';

    /** Intent: Get advice about a wine */
    public const INTENT_ADVICE = 'advice';

    /** Intent: Find pairing for meal */
    public const INTENT_PAIR = 'pair';

    /** @var array Patterns for intent detection */
    private array $patterns = [
        self::INTENT_PAIR => [
            '/\b(pair|pairing|goes?\s*with|match|serve\s*with|what\s*wine)\b/i',
            '/\b(dinner|lunch|meal|dish|food|eating|cooking|recipe)\b/i',
            '/\b(recommend|suggestion)\b.*\b(for|with)\b/i',
        ],
        self::INTENT_ADVICE => [
            '/\b(should\s*i|is\s*it|when|how\s*long|drink\s*now|ready|cellar|advice)\b/i',
            '/\b(worth|good|quality|rate|rating|review|opinion)\b/i',
            '/\b(age|aging|peak|prime|mature)\b/i',
            '/\b(store|storage|temperature|decant)\b/i',
            '/\?\s*$/i', // Questions often indicate advice intent
        ],
    ];

    /** @var array Keywords that strengthen intent detection */
    private array $strengtheners = [
        self::INTENT_PAIR => [
            'chicken', 'beef', 'fish', 'lamb', 'pork', 'steak', 'salmon',
            'pasta', 'pizza', 'cheese', 'dessert', 'chocolate',
            'grilled', 'roasted', 'fried', 'baked',
            'tonight', 'dinner party', 'guests',
        ],
        self::INTENT_ADVICE => [
            'years', 'old', 'vintage', 'cellar',
            'drink', 'open', 'serve',
            'worth', 'price', 'value',
            'special occasion', 'celebrate',
        ],
    ];

    /**
     * Detect intent from text
     *
     * @param string $text Input text
     * @return array Intent detection result with intent and confidence
     */
    public function detect(string $text): array
    {
        $scores = [
            self::INTENT_PAIR => $this->calculateScore($text, self::INTENT_PAIR),
            self::INTENT_ADVICE => $this->calculateScore($text, self::INTENT_ADVICE),
            self::INTENT_ADD => 0.5, // Base score for add intent
        ];

        // Find the intent with highest score
        $maxIntent = self::INTENT_ADD;
        $maxScore = $scores[self::INTENT_ADD];

        foreach ($scores as $intent => $score) {
            if ($score > $maxScore) {
                $maxScore = $score;
                $maxIntent = $intent;
            }
        }

        // If pair or advice score is too low, default to add
        if ($maxIntent !== self::INTENT_ADD && $maxScore < 0.4) {
            $maxIntent = self::INTENT_ADD;
            $maxScore = 0.8;
        }

        return [
            'intent' => $maxIntent,
            'confidence' => min(0.95, $maxScore),
            'scores' => $scores,
        ];
    }

    /**
     * Calculate score for a specific intent
     *
     * @param string $text Input text
     * @param string $intent Intent to score
     * @return float Score between 0 and 1
     */
    private function calculateScore(string $text, string $intent): float
    {
        $score = 0.0;
        $patternMatches = 0;
        $strengthenerMatches = 0;

        // Check patterns
        $patterns = $this->patterns[$intent] ?? [];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $patternMatches++;
            }
        }

        // Check strengtheners
        $strengtheners = $this->strengtheners[$intent] ?? [];
        $lowerText = strtolower($text);
        foreach ($strengtheners as $word) {
            if (strpos($lowerText, strtolower($word)) !== false) {
                $strengthenerMatches++;
            }
        }

        // Calculate score based on matches
        if ($patternMatches > 0) {
            $score = 0.4 + ($patternMatches * 0.15);
        }

        if ($strengthenerMatches > 0) {
            $score += min(0.3, $strengthenerMatches * 0.1);
        }

        return min(0.95, $score);
    }

    /**
     * Extract food items from text (for pairing intent)
     *
     * @param string $text Input text
     * @return array Extracted food items
     */
    public function extractFoodItems(string $text): array
    {
        $foods = [];
        $lowerText = strtolower($text);

        // Common food categories and items
        $foodPatterns = [
            // Proteins
            'beef' => '/\b(beef|steak|ribeye|filet|tenderloin)\b/i',
            'lamb' => '/\b(lamb|mutton)\b/i',
            'pork' => '/\b(pork|bacon|ham|prosciutto)\b/i',
            'chicken' => '/\b(chicken|poultry|turkey|duck)\b/i',
            'fish' => '/\b(fish|salmon|tuna|cod|halibut|sea\s*bass)\b/i',
            'shellfish' => '/\b(shrimp|lobster|crab|oyster|mussel|clam|scallop)\b/i',

            // Dishes
            'pasta' => '/\b(pasta|spaghetti|lasagna|risotto|gnocchi)\b/i',
            'pizza' => '/\b(pizza|flatbread)\b/i',
            'salad' => '/\b(salad|greens)\b/i',

            // Cheese
            'cheese' => '/\b(cheese|brie|camembert|cheddar|parmesan|gouda|blue\s*cheese)\b/i',

            // Preparations
            'grilled' => '/\b(grilled|bbq|barbecue|charred)\b/i',
            'roasted' => '/\b(roasted|baked|oven)\b/i',
            'fried' => '/\b(fried|crispy)\b/i',
            'braised' => '/\b(braised|stewed|slow[- ]cooked)\b/i',
        ];

        foreach ($foodPatterns as $category => $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $foods[] = [
                    'category' => $category,
                    'match' => $matches[0],
                ];
            }
        }

        return $foods;
    }

    /**
     * Check if text contains a question
     *
     * @param string $text Input text
     * @return bool True if text contains a question
     */
    public function isQuestion(string $text): bool
    {
        // Check for question mark
        if (strpos($text, '?') !== false) {
            return true;
        }

        // Check for question words at start
        $questionStarters = [
            '/^(what|which|when|where|why|how|should|could|would|is|are|can|do|does)\b/i',
        ];

        foreach ($questionStarters as $pattern) {
            if (preg_match($pattern, trim($text))) {
                return true;
            }
        }

        return false;
    }
}
