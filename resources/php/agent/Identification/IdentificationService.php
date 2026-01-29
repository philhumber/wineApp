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

    /** @var InferenceEngine Inference engine for post-LLM inference */
    private InferenceEngine $inferenceEngine;

    /** @var LLMClient LLM client for multi-provider escalation */
    private LLMClient $llmClient;

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
        $this->llmClient = $llmClient;
        $this->classifier = new InputClassifier($config);
        $this->intentDetector = new IntentDetector();
        $this->textProcessor = new TextProcessor($llmClient);
        $this->visionProcessor = new VisionProcessor($llmClient);
        $this->scorer = new ConfidenceScorer($config);
        $this->disambiguator = new DisambiguationHandler($pdo);
        $this->inferenceEngine = new InferenceEngine($pdo);
    }

    // ─────────────────────────────────────────────────────
    // FOUR-TIER ESCALATION HELPER METHODS
    // ─────────────────────────────────────────────────────

    /**
     * Process input with Gemini model at specified tier
     *
     * @param string $input Input text
     * @param string $tier Tier name ('fast' or 'detailed')
     * @param array|null $priorResult Previous tier result for context
     * @return array Processing result
     */
    private function processWithGemini(string $input, string $tier, ?array $priorResult = null): array
    {
        $tierConfig = $this->config['model_tiers'][$tier] ?? $this->config['model_tiers']['fast'];

        $options = [
            'provider' => $tierConfig['provider'] ?? 'gemini',
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
            'temperature' => $tierConfig['temperature'] ?? 0.3,
            'max_tokens' => $tierConfig['max_tokens'] ?? 500,
        ];

        // Add thinking level for Gemini 3 models
        if (isset($tierConfig['thinking_level'])) {
            $options['thinking_level'] = $tierConfig['thinking_level'];
        }

        // Add prior result context for escalation
        if ($priorResult) {
            $options['prior_context'] = $this->buildPriorContext($priorResult);
        }

        return $this->textProcessor->process($input, $options);
    }

    /**
     * Process input with Claude model
     *
     * @param string $input Input text
     * @param string $model Claude model name
     * @param array|null $priorResult Previous tier result for context
     * @return array Processing result
     */
    private function processWithClaude(string $input, string $model, ?array $priorResult = null): array
    {
        $options = [
            'provider' => 'claude',
            'model' => $model,
            'temperature' => 0.3,
            'max_tokens' => 800,
        ];

        // Add prior result context for escalation
        if ($priorResult) {
            $options['prior_context'] = $this->buildPriorContext($priorResult);
        }

        return $this->textProcessor->process($input, $options);
    }

    /**
     * Build context string from prior identification result
     *
     * @param array $priorResult Previous identification result
     * @return string Context string for escalation
     */
    private function buildPriorContext(array $priorResult): string
    {
        $parsed = $priorResult['parsed'] ?? [];
        return sprintf(
            "Previous attempt found: Producer=%s, Wine=%s, Region=%s (confidence: %d%%). Please analyze more carefully and look for details that might have been missed.",
            $parsed['producer'] ?? 'unknown',
            $parsed['wineName'] ?? 'unknown',
            $parsed['region'] ?? 'unknown',
            $priorResult['confidence'] ?? 0
        );
    }

    // ─────────────────────────────────────────────────────
    // VISION ESCALATION HELPER METHODS
    // ─────────────────────────────────────────────────────

    /**
     * Process image with Gemini vision at specified tier
     *
     * @param string $imageData Base64-encoded image
     * @param string $mimeType Image MIME type
     * @param string $tier Tier name ('fast' or 'detailed')
     * @param array $options Additional options (supplementary_text, etc.)
     * @return array Processing result
     */
    private function processVisionWithGemini(
        string $imageData,
        string $mimeType,
        string $tier,
        array $options = []
    ): array {
        $tierConfig = $this->config['model_tiers'][$tier] ?? $this->config['model_tiers']['fast'];

        $processOptions = [
            'provider' => $tierConfig['provider'] ?? 'gemini',
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
            'temperature' => $tierConfig['temperature'] ?? 0.3,
            'max_tokens' => $tierConfig['max_tokens'] ?? 4000,
        ];

        // Add thinking level for Gemini 3 models
        if (isset($tierConfig['thinking_level'])) {
            $processOptions['thinking_level'] = $tierConfig['thinking_level'];
        }

        // Use detailed prompt for higher tiers
        if ($tier === 'detailed') {
            $processOptions['detailed_prompt'] = true;
        }

        // Pass through supplementary text
        if (!empty($options['supplementary_text'])) {
            $processOptions['supplementary_text'] = $options['supplementary_text'];
        }

        return $this->visionProcessor->process($imageData, $mimeType, $processOptions);
    }

    /**
     * Process image with Claude vision
     *
     * @param string $imageData Base64-encoded image
     * @param string $mimeType Image MIME type
     * @param string $model Claude model name
     * @param array $options Additional options
     * @return array Processing result
     */
    private function processVisionWithClaude(
        string $imageData,
        string $mimeType,
        string $model,
        array $options = []
    ): array {
        $processOptions = [
            'provider' => 'claude',
            'model' => $model,
            'temperature' => 0.3,
            'max_tokens' => 1000,
            'detailed_prompt' => true, // Always use detailed for Claude escalation
        ];

        // Pass through supplementary text
        if (!empty($options['supplementary_text'])) {
            $processOptions['supplementary_text'] = $options['supplementary_text'];
        }

        return $this->visionProcessor->process($imageData, $mimeType, $processOptions);
    }

    /**
     * Apply inference engine to fill missing fields
     *
     * @param array $result Processing result
     * @return array Updated result with inferences applied
     */
    private function applyInference(array $result): array
    {
        if (!$result['success']) {
            return $result;
        }

        $inferences = $this->inferenceEngine->infer($result['parsed']);

        foreach ($inferences as $inference) {
            $field = $inference['field'];
            if (!isset($result['parsed'][$field]) || $result['parsed'][$field] === null) {
                $result['parsed'][$field] = $inference['value'];
                $result['inferences_applied'][] = $inference['type'];
            }
        }

        // Re-score after inference
        $newScoring = $this->scorer->score($result['parsed']);
        $result['confidence'] = $newScoring['score'];
        $result['action'] = $newScoring['action'];

        return $result;
    }

    /**
     * Finalize identification result with escalation metadata
     *
     * @param array $result Processing result
     * @param string $action Determined action
     * @param array $escalation Escalation metadata
     * @param array $extra Extra fields to include
     * @return array Finalized result
     */
    private function finalizeResult(array $result, string $action, array $escalation, array $extra = []): array
    {
        $finalResult = [
            'success' => $result['success'],
            'wine' => $result['parsed'] ?? null,
            'parsed' => $result['parsed'] ?? null,
            'confidence' => $result['confidence'] ?? 0,
            'action' => $action,
            'escalation' => $escalation,
            'inferences_applied' => $result['inferences_applied'] ?? [],
        ];

        return array_merge($finalResult, $extra);
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
     * Identify wine from text input using four-tier escalation
     *
     * Escalation tiers:
     * - Tier 1: Gemini 3.0 Flash (low thinking) - ~80% of requests
     * - Tier 1.5: Gemini 3.0 Flash (high thinking) - ~10% escalated
     * - Tier 2: Claude Sonnet 4.5 - ~7% cross-provider escalation
     * - User Choice: action='user_choice' - user decides Opus vs conversational
     * - Tier 3: Claude Opus 4.5 - user-triggered only via identifyWithOpus()
     *
     * @param array $classification Validated text classification
     * @return array Identification result
     */
    private function identifyFromText(array $classification): array
    {
        // Step 1: Detect intent
        $intent = $this->intentDetector->detect($classification['text']);
        $inputText = $classification['text'];

        // Get configurable thresholds
        $thresholds = $this->config['confidence'] ?? [];
        $tier1Threshold = $thresholds['tier1_threshold'] ?? 85;
        $tier1_5Threshold = $thresholds['tier1_5_threshold'] ?? 70;
        $tier2Threshold = $thresholds['tier2_threshold'] ?? 60;
        $userChoiceThreshold = $thresholds['user_choice_threshold'] ?? 50;

        // Track escalation metadata
        $escalationData = [
            'tiers' => [],
            'final_tier' => null,
            'total_cost' => 0,
        ];

        // ─────────────────────────────────────────────────────
        // TIER 1: Fast (Gemini 3 Flash, low thinking)
        // ─────────────────────────────────────────────────────
        $result = $this->processWithGemini($inputText, 'fast');
        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier1_processing',
            ];
        }

        $result = $this->applyInference($result);
        $scoring = $this->scorer->score($result['parsed']);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $escalationData['tiers']['tier1'] = [
            'confidence' => $result['confidence'],
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
        ];
        $escalationData['total_cost'] += $result['cost'] ?? 0;

        // Check Tier 1 threshold
        if ($result['confidence'] >= $tier1Threshold) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildTextResult($result, 'auto_populate', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // TIER 1.5: Retry (Gemini 3 Flash, high thinking)
        // ─────────────────────────────────────────────────────
        $tier1Result = $result; // Save for context
        $result = $this->processWithGemini($inputText, 'detailed', $tier1Result);

        if ($result['success']) {
            $result = $this->applyInference($result);
            $scoring = $this->scorer->score($result['parsed']);
            $result['confidence'] = $scoring['score'];
            $result['action'] = $scoring['action'];

            $detailedTierConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $result['confidence'],
                'model' => $detailedTierConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedTierConfig['thinking_level'] ?? 'HIGH',
            ];
            $escalationData['total_cost'] += $result['cost'] ?? 0;

            // Use better result
            if ($result['confidence'] < $tier1Result['confidence']) {
                $result = $tier1Result; // Keep tier 1 result if it was better
            }
        } else {
            // Tier 1.5 failed, keep tier 1 result
            $result = $tier1Result;
        }

        // Check Tier 1.5 threshold
        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // TIER 2: Balanced (Claude Sonnet 4.5)
        // ─────────────────────────────────────────────────────
        // Check if Claude is available before attempting
        if ($this->llmClient->isProviderAvailable('claude')) {
            $tier1_5Result = $result; // Save for context
            $claudeResult = $this->processWithClaude($inputText, 'claude-sonnet-4-5-20250929', $tier1_5Result);

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $scoring = $this->scorer->score($claudeResult['parsed']);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];
                $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;

                // Use better result
                if ($claudeResult['confidence'] > $result['confidence']) {
                    $result = $claudeResult;
                }
            }
        }

        // Check Tier 2 threshold
        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // USER CHOICE: Below 60% - always offer premium model
        // ─────────────────────────────────────────────────────
        // Any confidence below tier2Threshold (60%) offers the premium model option
        $escalationData['final_tier'] = 'user_choice';
        $finalResult = $this->buildTextResult($result, 'user_choice', $intent, $escalationData, [
            'options' => ['try_harder', 'tell_me_more'],
        ]);

        // Also get candidates for disambiguation if confidence is very low
        if ($result['confidence'] < 30) {
            $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);
        }

        return $finalResult;
    }

    /**
     * Build text identification result with standard structure
     *
     * @param array $result Processing result
     * @param string $action Action to take
     * @param array $intent Intent detection result
     * @param array $escalation Escalation metadata
     * @param array $extra Extra fields
     * @return array Complete result
     */
    private function buildTextResult(array $result, string $action, array $intent, array $escalation, array $extra = []): array
    {
        $finalResult = [
            'success' => true,
            'inputType' => 'text',
            'intent' => $intent['intent'] ?? 'add',
            'parsed' => $result['parsed'],
            'confidence' => $result['confidence'],
            'action' => $action,
            'candidates' => [],
            'usage' => [
                'tokens' => $result['tokens'] ?? ['input' => 0, 'output' => 0],
                'cost' => $escalation['total_cost'] ?? 0,
                'latencyMs' => $result['latencyMs'] ?? 0,
            ],
            'escalation' => $escalation,
            'inferences_applied' => $result['inferences_applied'] ?? [],
        ];

        return array_merge($finalResult, $extra);
    }

    /**
     * Identify wine with Opus (Tier 3) - User-triggered escalation
     *
     * Called when user clicks "Try harder" after user_choice action.
     * Uses Claude Opus 4.5 for maximum accuracy.
     *
     * @param array $input Original input data
     * @param array $priorResult Previous identification result
     * @return array Identification result
     */
    public function identifyWithOpus(array $input, array $priorResult): array
    {
        $inputText = $input['text'] ?? '';

        // Get configurable threshold
        $tier2Threshold = $this->config['confidence']['tier2_threshold'] ?? 60;

        // Check if Claude is available
        if (!$this->llmClient->isProviderAvailable('claude')) {
            return [
                'success' => false,
                'error' => 'Premium model not available',
                'errorType' => 'provider_unavailable',
                'stage' => 'tier3_processing',
            ];
        }

        // Process with Opus
        $result = $this->processWithClaude($inputText, 'claude-opus-4-5-20251101', $priorResult);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Premium processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier3_processing',
            ];
        }

        $result = $this->applyInference($result);
        $scoring = $this->scorer->score($result['parsed']);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $escalation = [
            'tiers' => [
                'tier3' => [
                    'confidence' => $result['confidence'],
                    'model' => 'claude-opus-4-5-20251101',
                ],
            ],
            'final_tier' => 'tier3',
            'total_cost' => $result['cost'] ?? 0,
        ];

        // Determine action based on confidence
        if ($result['confidence'] >= $tier2Threshold) {
            return $this->buildTextResult($result, 'suggest', ['intent' => 'add'], $escalation);
        }

        // Even Opus couldn't identify with confidence - go to conversational
        $finalResult = $this->buildTextResult($result, 'disambiguate', ['intent' => 'add'], $escalation);
        $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);

        return $finalResult;
    }

    /**
     * Identify wine image with Opus (Tier 3) - User-triggered escalation
     *
     * Called when user clicks "Try harder" after user_choice action on an image.
     * Uses Claude Opus 4.5 with vision for maximum accuracy.
     *
     * @param array $input Original input data (image, mimeType, supplementaryText)
     * @param array $priorResult Previous identification result
     * @return array Identification result
     */
    public function identifyImageWithOpus(array $input, array $priorResult): array
    {
        $imageData = $input['image'] ?? '';
        $mimeType = $input['mimeType'] ?? 'image/jpeg';
        $supplementaryText = $input['supplementaryText'] ?? null;

        // Get configurable threshold
        $tier2Threshold = $this->config['confidence']['tier2_threshold'] ?? 60;

        // Check if Claude is available
        if (!$this->llmClient->isProviderAvailable('claude')) {
            return [
                'success' => false,
                'error' => 'Premium model not available',
                'errorType' => 'provider_unavailable',
                'stage' => 'tier3_processing',
            ];
        }

        // Process with Opus vision
        $processOptions = [];
        if ($supplementaryText) {
            $processOptions['supplementary_text'] = $supplementaryText;
        }

        $result = $this->processVisionWithClaude(
            $imageData,
            $mimeType,
            'claude-opus-4-5-20251101',
            $processOptions
        );

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Premium processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier3_processing',
            ];
        }

        $result = $this->applyInference($result);
        $scoring = $this->scorer->score($result['parsed']);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $escalation = [
            'tiers' => [
                'tier3' => [
                    'confidence' => $result['confidence'],
                    'model' => 'claude-opus-4-5-20251101',
                ],
            ],
            'final_tier' => 'tier3',
            'total_cost' => $result['cost'] ?? 0,
        ];

        // Determine action based on confidence
        if ($result['confidence'] >= $tier2Threshold) {
            return $this->buildImageResult($result, 'suggest', $escalation, null);
        }

        // Even Opus couldn't identify with confidence - go to conversational
        $finalResult = $this->buildImageResult($result, 'disambiguate', $escalation, null);
        $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);

        return $finalResult;
    }

    /**
     * Identify wine from image input using four-tier escalation
     *
     * Escalation tiers (same as text):
     * - Tier 1: Gemini 3 Flash (low thinking) - ~80% of requests
     * - Tier 1.5: Gemini 3 Flash (high thinking) - ~10% escalated
     * - Tier 2: Claude Sonnet 4.5 - ~7% cross-provider escalation
     * - User Choice: action='user_choice' - user decides Opus vs conversational
     * - Tier 3: Claude Opus 4.5 - user-triggered only
     *
     * @param array $classification Validated image classification
     * @return array Identification result
     */
    private function identifyFromImage(array $classification): array
    {
        $imageData = $classification['imageData'];
        $mimeType = $classification['mimeType'];
        $supplementaryText = $classification['supplementaryText'] ?? null;

        // Options to pass to processors
        $processOptions = [];
        if ($supplementaryText) {
            agentLogInfo('Supplementary text received for image identification', [
                'supplementaryText' => $supplementaryText,
            ]);
            $processOptions['supplementary_text'] = $supplementaryText;
        }

        // Get configurable thresholds (same as text)
        $thresholds = $this->config['confidence'] ?? [];
        $tier1Threshold = $thresholds['tier1_threshold'] ?? 85;
        $tier1_5Threshold = $thresholds['tier1_5_threshold'] ?? 70;
        $tier2Threshold = $thresholds['tier2_threshold'] ?? 60;

        // Track escalation metadata (matches text structure)
        $escalationData = [
            'tiers' => [],
            'final_tier' => null,
            'total_cost' => 0,
        ];

        // Keep quality assessment from first attempt
        $quality = null;

        // ─────────────────────────────────────────────────────
        // TIER 1: Fast (Gemini 3 Flash, low thinking)
        // ─────────────────────────────────────────────────────
        $result = $this->processVisionWithGemini($imageData, $mimeType, 'fast', $processOptions);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier1_processing',
                'quality' => $result['quality'] ?? null,
            ];
        }

        $quality = $result['quality'] ?? null;
        $result = $this->applyInference($result);
        $scoring = $this->scorer->score($result['parsed']);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $escalationData['tiers']['tier1'] = [
            'confidence' => $result['confidence'],
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
        ];
        $escalationData['total_cost'] += $result['cost'] ?? 0;

        // Check Tier 1 threshold
        if ($result['confidence'] >= $tier1Threshold) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildImageResult($result, 'auto_populate', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // TIER 1.5: Detailed (Gemini 3 Flash, high thinking)
        // ─────────────────────────────────────────────────────
        $tier1Result = $result; // Save for context
        $result = $this->processVisionWithGemini($imageData, $mimeType, 'detailed', $processOptions);

        if ($result['success']) {
            $result = $this->applyInference($result);
            $scoring = $this->scorer->score($result['parsed']);
            $result['confidence'] = $scoring['score'];
            $result['action'] = $scoring['action'];

            $detailedTierConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $result['confidence'],
                'model' => $detailedTierConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedTierConfig['thinking_level'] ?? 'HIGH',
            ];
            $escalationData['total_cost'] += $result['cost'] ?? 0;

            // Use better result
            if ($result['confidence'] < $tier1Result['confidence']) {
                $result = $tier1Result; // Keep tier 1 result if it was better
            }
        } else {
            // Tier 1.5 failed, keep tier 1 result
            $result = $tier1Result;
        }

        // Check Tier 1.5 threshold
        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // TIER 2: Balanced (Claude Sonnet 4.5 with vision)
        // ─────────────────────────────────────────────────────
        if ($this->llmClient->isProviderAvailable('claude')) {
            $tier1_5Result = $result; // Save for context
            $claudeResult = $this->processVisionWithClaude(
                $imageData,
                $mimeType,
                'claude-sonnet-4-5-20250929',
                $processOptions
            );

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $scoring = $this->scorer->score($claudeResult['parsed']);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];
                $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;

                // Use better result
                if ($claudeResult['confidence'] > $result['confidence']) {
                    $result = $claudeResult;
                }
            }
        }

        // Check Tier 2 threshold
        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // USER CHOICE: Below 60% - always offer premium model
        // ─────────────────────────────────────────────────────
        $escalationData['final_tier'] = 'user_choice';
        $finalResult = $this->buildImageResult($result, 'user_choice', $escalationData, $quality, [
            'options' => ['try_harder', 'tell_me_more'],
        ]);

        // Also get candidates for disambiguation if confidence is very low
        if ($result['confidence'] < 30) {
            $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);
        }

        return $finalResult;
    }

    /**
     * Build image identification result with standard structure
     *
     * @param array $result Processing result
     * @param string $action Action to take
     * @param array $escalation Escalation metadata
     * @param array|null $quality Image quality assessment
     * @param array $extra Extra fields
     * @return array Complete result
     */
    private function buildImageResult(
        array $result,
        string $action,
        array $escalation,
        ?array $quality,
        array $extra = []
    ): array {
        $finalResult = [
            'success' => true,
            'inputType' => 'image',
            'intent' => 'add', // Image input always implies "add to cellar"
            'parsed' => $result['parsed'],
            'confidence' => $result['confidence'],
            'action' => $action,
            'candidates' => [],
            'usage' => [
                'tokens' => $result['tokens'] ?? ['input' => 0, 'output' => 0],
                'cost' => $escalation['total_cost'] ?? 0,
                'latencyMs' => $result['latencyMs'] ?? 0,
            ],
            'quality' => $quality,
            'escalation' => $escalation,
            'inferences_applied' => $result['inferences_applied'] ?? [],
        ];

        return array_merge($finalResult, $extra);
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
