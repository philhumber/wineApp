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

    /** @var VisionProcessor Vision processor */
    private VisionProcessor $visionProcessor;

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
        $this->visionProcessor = new VisionProcessor($llmClient);
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

        // Route to appropriate processor based on input type
        if ($classification['type'] === InputClassifier::TYPE_IMAGE) {
            return $this->identifyFromImage($classification);
        }

        return $this->identifyFromText($classification);
    }

    /**
     * Identify wine from text input
     *
     * @param array $classification Validated text classification
     * @return array Identification result
     */
    private function identifyFromText(array $classification): array
    {
        // Step 2: Detect intent
        $intent = $this->intentDetector->detect($classification['text']);

        // Step 3: Process text with LLM (fast model first)
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

        // Track escalation metadata
        $escalation = [
            'attempted' => false,
            'improved' => false,
            'originalConfidence' => null,
        ];

        // Track total usage
        $totalUsage = [
            'tokens' => $processed['tokens'],
            'cost' => $processed['cost'],
            'latencyMs' => $processed['latencyMs'] ?? 0,
        ];

        // Step 4a: Model escalation - if confidence is below threshold, try detailed model
        $escalationThreshold = $this->config['confidence']['escalation_threshold'] ?? 70;
        if ($scoring['score'] < $escalationThreshold) {
            $escalation['attempted'] = true;
            $escalation['originalConfidence'] = $scoring['score'];

            // Get detailed model options
            $detailedOptions = $this->config['model_tiers']['detailed'] ?? [];

            // Try with detailed prompt and options
            $detailedProcessed = $this->textProcessor->process($classification['text'], [
                'detailed_prompt' => true,
                'temperature' => $detailedOptions['temperature'] ?? 0.4,
                'max_tokens' => $detailedOptions['max_tokens'] ?? 800,
            ]);

            if ($detailedProcessed['success']) {
                $detailedScoring = $this->scorer->score($detailedProcessed['parsed']);

                // Use detailed result if it improved confidence
                if ($detailedScoring['score'] > $scoring['score']) {
                    $escalation['improved'] = true;
                    $processed = $detailedProcessed;
                    $scoring = $detailedScoring;
                }

                // Combine usage from both attempts
                $totalUsage['tokens']['input'] += $detailedProcessed['tokens']['input'] ?? 0;
                $totalUsage['tokens']['output'] += $detailedProcessed['tokens']['output'] ?? 0;
                $totalUsage['cost'] += $detailedProcessed['cost'] ?? 0;
                $totalUsage['latencyMs'] += $detailedProcessed['latencyMs'] ?? 0;
            }
        }

        // Step 5: Build result
        $result = [
            'success' => true,
            'inputType' => 'text',
            'intent' => $intent['intent'],
            'parsed' => $processed['parsed'],
            'confidence' => $scoring['score'],
            'action' => $scoring['action'],
            'candidates' => [],
            'usage' => $totalUsage,
            'escalation' => $escalation,
        ];

        // Step 6: Get candidates if needed for disambiguation
        if ($scoring['action'] === 'disambiguate') {
            $result['candidates'] = $this->disambiguator->findCandidates($processed['parsed']);
        }

        return $result;
    }

    /**
     * Identify wine from image input
     *
     * @param array $classification Validated image classification
     * @return array Identification result
     */
    private function identifyFromImage(array $classification): array
    {
        // Extract supplementary text for re-identification with user context
        $supplementaryText = $classification['supplementaryText'] ?? null;
        $processOptions = [];
        if ($supplementaryText) {
            agentLogInfo('Supplementary text received for image re-identification', [
                'supplementaryText' => $supplementaryText,
            ]);        
            $processOptions['supplementary_text'] = $supplementaryText;
        }

        // Step 2: Process image with vision LLM (fast model first)
        $processed = $this->visionProcessor->process(
            $classification['imageData'],
            $classification['mimeType'],
            $processOptions
        );

        if (!$processed['success']) {
            return [
                'success' => false,
                'error' => $processed['error'],
                'errorType' => $processed['errorType'] ?? 'processing_error',
                'stage' => 'processing',
                'quality' => $processed['quality'] ?? null,
            ];
        }

        // Step 3: Score confidence
        $scoring = $this->scorer->score($processed['parsed']);

        // Track escalation metadata
        $escalation = [
            'attempted' => false,
            'improved' => false,
            'originalConfidence' => null,
        ];

        // Track total usage
        $totalUsage = [
            'tokens' => $processed['tokens'],
            'cost' => $processed['cost'],
            'latencyMs' => $processed['latencyMs'] ?? 0,
        ];

        // Keep first quality assessment
        $quality = $processed['quality'] ?? null;

        // Parse supplementary constraints for post-LLM confidence adjustment
        $constraints = [];
        if ($supplementaryText) {
            $parser = new SupplementaryContextParser();
            $contextResult = $parser->parse($supplementaryText);
            $constraints = $contextResult['constraints'] ?? [];
        }

        // Step 3a: Model escalation - if confidence is below threshold, try detailed model
        $escalationThreshold = $this->config['confidence']['escalation_threshold'] ?? 70;
        if ($scoring['score'] < $escalationThreshold) {
            $escalation['attempted'] = true;
            $escalation['originalConfidence'] = $scoring['score'];

            // Get detailed model options
            $detailedOptions = $this->config['model_tiers']['detailed'] ?? [];

            // Try with detailed prompt and options (also pass supplementary text)
            $escalationOptions = [
                'detailed_prompt' => true,
                'temperature' => $detailedOptions['temperature'] ?? 0.4,
                'max_tokens' => $detailedOptions['max_tokens'] ?? 800,
            ];
            if ($supplementaryText) {
                $escalationOptions['supplementary_text'] = $supplementaryText;
            }

            $detailedProcessed = $this->visionProcessor->process(
                $classification['imageData'],
                $classification['mimeType'],
                $escalationOptions
            );

            if ($detailedProcessed['success']) {
                $detailedScoring = $this->scorer->score($detailedProcessed['parsed']);

                // Use detailed result if it improved confidence
                if ($detailedScoring['score'] > $scoring['score']) {
                    $escalation['improved'] = true;
                    $processed = $detailedProcessed;
                    $scoring = $detailedScoring;
                }

                // Combine usage from both attempts
                $totalUsage['tokens']['input'] += $detailedProcessed['tokens']['input'] ?? 0;
                $totalUsage['tokens']['output'] += $detailedProcessed['tokens']['output'] ?? 0;
                $totalUsage['cost'] += $detailedProcessed['cost'] ?? 0;
                $totalUsage['latencyMs'] += $detailedProcessed['latencyMs'] ?? 0;
            }
        }

        // Step 3b: Post-LLM confidence adjustment based on supplementary constraints
        if (!empty($constraints)) {
            $parser = $parser ?? new SupplementaryContextParser();
            $adjustment = $parser->validateAgainstConstraints($processed['parsed'], $constraints);
            if ($adjustment !== 0) {
                $scoring['score'] = max(0, min(100, $scoring['score'] + $adjustment));
                $scoring['action'] = $this->scorer->score($processed['parsed'])['action'] ?? $scoring['action'];
                // Re-determine action based on adjusted score
                if ($scoring['score'] >= ($this->config['confidence']['auto_populate'] ?? 85)) {
                    $scoring['action'] = 'auto_populate';
                } elseif ($scoring['score'] >= ($this->config['confidence']['suggest'] ?? 60)) {
                    $scoring['action'] = 'suggest';
                } else {
                    $scoring['action'] = 'disambiguate';
                }
                agentLogInfo('Confidence adjusted by supplementary constraints', [
                    'adjustment' => $adjustment,
                    'newScore' => $scoring['score'],
                    'constraints' => $constraints,
                ]);
            }
        }

        // Step 4: Build result
        $result = [
            'success' => true,
            'inputType' => 'image',
            'intent' => 'add', // Image input always implies "add to cellar" intent
            'parsed' => $processed['parsed'],
            'confidence' => $scoring['score'],
            'action' => $scoring['action'],
            'candidates' => [],
            'usage' => $totalUsage,
            'quality' => $quality,
            'escalation' => $escalation,
        ];

        // Step 5: Get candidates if needed for disambiguation
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
     * Process image and get raw LLM output
     *
     * @param string $imageData Base64-encoded image data
     * @param string $mimeType Image MIME type
     * @return array Processing result
     */
    public function processImage(string $imageData, string $mimeType): array
    {
        return $this->visionProcessor->process($imageData, $mimeType);
    }

    /**
     * Quick image identification
     *
     * @param string $imageData Base64-encoded image data
     * @param string $mimeType Image MIME type
     * @return array Identification result
     */
    public function quickIdentifyImage(string $imageData, string $mimeType): array
    {
        return $this->identify(['image' => $imageData, 'mimeType' => $mimeType]);
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
