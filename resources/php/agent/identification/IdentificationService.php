<?php
/**
 * Identification Service
 *
 * Main orchestrator for wine identification. Coordinates input validation,
 * intent detection, LLM processing, confidence scoring, and disambiguation.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

use Agent\LLM\LLMClient;

class IdentificationService
{
    /** @var InputClassifier Input classifier */
    private InputClassifier $classifier;

    /** @var IntentDetector Intent detector */
    private IntentDetector $intentDetector;

    /** @var TextProcessor Text processor */
    private TextProcessor $textProcessor;

    /** @var ConfidenceScorer Confidence scorer */
    private ConfidenceScorer $scorer;

    /** @var DisambiguationHandler Disambiguation handler */
    private DisambiguationHandler $disambiguator;

    /** @var array Configuration */
    private array $config;

    /**
     * Create a new identification service
     *
     * @param LLMClient $llmClient LLM client instance
     * @param \PDO $pdo Database connection
     * @param array $config Configuration
     */
    public function __construct(LLMClient $llmClient, \PDO $pdo, array $config)
    {
        $this->config = $config;
        $this->classifier = new InputClassifier($config);
        $this->intentDetector = new IntentDetector();
        $this->textProcessor = new TextProcessor($llmClient);
        $this->scorer = new ConfidenceScorer($config);
        $this->disambiguator = new DisambiguationHandler($pdo);
    }

    /**
     * Identify wine from input
     *
     * @param array $input Input data (text or image)
     * @return array Identification result
     */
    public function identify(array $input): array
    {
        // Step 1: Classify and validate input
        $classification = $this->classifier->classify($input);
        if (!$classification['valid']) {
            return [
                'success' => false,
                'error' => $classification['error'],
                'stage' => 'classification',
            ];
        }

        // Step 2: Detect intent
        $intent = $this->intentDetector->detect($classification['text']);

        // Step 3: Process text with LLM
        $processed = $this->textProcessor->process($classification['text']);
        if (!$processed['success']) {
            return [
                'success' => false,
                'error' => $processed['error'],
                'errorType' => $processed['errorType'] ?? 'processing_error',
                'stage' => 'processing',
            ];
        }

        // Step 4: Score confidence
        $scoring = $this->scorer->score($processed['parsed']);

        // Step 5: Build result
        $result = [
            'success' => true,
            'intent' => $intent['intent'],
            'parsed' => $processed['parsed'],
            'confidence' => $scoring['score'],
            'action' => $scoring['action'],
            'candidates' => [],
            'usage' => [
                'tokens' => $processed['tokens'],
                'cost' => $processed['cost'],
                'latencyMs' => $processed['latencyMs'] ?? 0,
            ],
        ];

        // Step 6: Get candidates if needed for disambiguation
        if ($scoring['action'] === 'disambiguate') {
            $result['candidates'] = $this->disambiguator->findCandidates($processed['parsed']);
        }

        return $result;
    }

    /**
     * Quick identification with minimal processing
     *
     * Skips disambiguation for faster response when confidence is acceptable.
     *
     * @param string $text Input text
     * @return array Identification result
     */
    public function quickIdentify(string $text): array
    {
        return $this->identify(['text' => $text]);
    }

    /**
     * Get detailed scoring explanation
     *
     * @param array $parsed Parsed wine data
     * @return array Scoring explanation
     */
    public function explainScoring(array $parsed): array
    {
        return $this->scorer->explain($parsed);
    }

    /**
     * Find similar wines in collection
     *
     * @param array $parsed Parsed wine data
     * @return array Similar wines
     */
    public function findSimilar(array $parsed): array
    {
        return $this->disambiguator->findCandidates($parsed);
    }

    /**
     * Detect intent from text
     *
     * @param string $text Input text
     * @return array Intent detection result
     */
    public function detectIntent(string $text): array
    {
        return $this->intentDetector->detect($text);
    }

    /**
     * Validate input without processing
     *
     * @param array $input Input data
     * @return array Validation result
     */
    public function validateInput(array $input): array
    {
        return $this->classifier->classify($input);
    }

    /**
     * Check if text appears to be wine-related
     *
     * @param string $text Input text
     * @return bool True if wine-related
     */
    public function isWineRelated(string $text): bool
    {
        return $this->classifier->isWineRelated($text);
    }

    /**
     * Process text and get raw LLM output
     *
     * @param string $text Input text
     * @return array Processing result
     */
    public function processText(string $text): array
    {
        return $this->textProcessor->process($text);
    }

    /**
     * Batch identify multiple wines
     *
     * @param array $inputs Array of input texts
     * @return array Array of identification results
     */
    public function batchIdentify(array $inputs): array
    {
        $results = [];

        foreach ($inputs as $index => $text) {
            if (is_string($text)) {
                $results[$index] = $this->identify(['text' => $text]);
            } elseif (is_array($text)) {
                $results[$index] = $this->identify($text);
            } else {
                $results[$index] = [
                    'success' => false,
                    'error' => 'Invalid input format',
                    'stage' => 'validation',
                ];
            }
        }

        return $results;
    }
}
