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

require_once __DIR__ . '/../prompts/prompts.php';

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
        $this->inferenceEngine = new InferenceEngine($pdo);
        $inputMatchScorer = new InputMatchScorer($this->inferenceEngine);
        $this->scorer = new ConfidenceScorer($config, $inputMatchScorer);
        $this->disambiguator = new DisambiguationHandler($pdo);
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
    private function processWithGemini(string $input, string $tier, ?array $priorResult = null, array $lockedFields = []): array
    {
        $tierConfig = $this->config['model_tiers'][$tier] ?? $this->config['model_tiers']['fast'];

        $options = [
            'provider' => $tierConfig['provider'] ?? 'gemini',
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
            'temperature' => $tierConfig['temperature'] ?? 1.0, //Must be 1.0 for gemini 3
            'max_tokens' => $tierConfig['max_tokens'] ?? 1000,
        ];

        // Add thinking level for Gemini 3 models
        if (isset($tierConfig['thinking_level'])) {
            $options['thinking_level'] = $tierConfig['thinking_level'];
        }

        // Add prior result context for escalation
        if ($priorResult) {
            $options['prior_context'] = \Prompts::escalationContext($priorResult, $lockedFields);
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
    private function processWithClaude(string $input, string $model, ?array $priorResult = null, array $lockedFields = [], array $escalationContext = []): array
    {
        $options = [
            'provider' => 'claude',
            'model' => $model,
            'temperature' => 0.3,
            'max_tokens' => 800,
        ];

        // Add prior result context for escalation
        if ($priorResult) {
            $options['prior_context'] = \Prompts::escalationContext($priorResult, $lockedFields, $escalationContext);
        }

        return $this->textProcessor->process($input, $options);
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

        // Enable Google Search grounding + structured output for image identification
        $processOptions['web_search'] = true;
        $processOptions['response_schema'] = $this->getIdentificationSchema();

        // Grounding + response_schema requires at least MEDIUM thinking
        if (empty($processOptions['thinking_level']) ||
            in_array($processOptions['thinking_level'], ['MINIMAL', 'LOW'])) {
            $processOptions['thinking_level'] = 'MEDIUM';
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

        // Roll up village-level appellations to parent regions (WIN-148)
        // E.g., "Margaux" -> region: "Bordeaux", appellation: "Margaux"
        if (!empty($result['parsed']['region'])) {
            $rollup = $this->inferenceEngine->rollUpRegion($result['parsed']['region']);
            if ($rollup['appellation']) {
                $result['parsed']['region'] = $rollup['region'];
                $result['inferences_applied'][] = 'region_rolled_up_from_' . $rollup['appellation'];
                // Store the specific appellation for future use
                if (empty($result['parsed']['appellation'])) {
                    $result['parsed']['appellation'] = $rollup['appellation'];
                }
            }
        }

        // NOTE: Scoring removed from applyInference() — all 14 callers re-score
        // immediately after this call with user input context for accurate matching.

        return $result;
    }

    /**
     * Apply user-locked field values to parsed result.
     * Allows minor normalization (case/accents) if LLM value matches core intent.
     *
     * @param array $result Processing result
     * @param array $lockedFields User-locked fields (field => value)
     * @return array Updated result with locked fields applied
     */
    private function applyLockedFields(array $result, array $lockedFields): array
    {
        if (empty($lockedFields)) {
            return $result;
        }

        $allowedFields = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'appellation'];

        foreach ($lockedFields as $field => $value) {
            if (!in_array($field, $allowedFields, true)) continue;

            $llmValue = $result['parsed'][$field] ?? null;

            // If LLM provided a value, check if it's just a minor correction (case/accents)
            if ($llmValue !== null && is_string($llmValue) && is_string($value)) {
                $normalizedLlm = mb_strtolower($this->stripAccentsSimple($llmValue));
                $normalizedLocked = mb_strtolower($this->stripAccentsSimple((string)$value));
                if ($normalizedLlm === $normalizedLocked) {
                    // LLM's formatting is better (e.g., proper accents) — keep it
                    error_log("[IdentificationService] applyLockedFields: kept LLM formatting for {$field}: '{$llmValue}'");
                    continue;
                }
            }

            // Force locked value
            $result['parsed'][$field] = $value;
            error_log("[IdentificationService] applyLockedFields: forced {$field}='{$value}' (LLM had '{$llmValue}')");
        }

        return $result;
    }

    /**
     * Simple accent stripping for locked field comparison.
     * Uses str_replace instead of iconv (Windows iconv converts â to ^a not a).
     *
     * @param string $str Input string
     * @return string String with accents replaced by plain equivalents
     */
    private function stripAccentsSimple(string $str): string
    {
        $accents = ['à','á','â','ã','ä','å','è','é','ê','ë','ì','í','î','ï','ò','ó','ô','õ','ö','ù','ú','û','ü','ý','ÿ','ñ','ç',
                    'À','Á','Â','Ã','Ä','Å','È','É','Ê','Ë','Ì','Í','Î','Ï','Ò','Ó','Ô','Õ','Ö','Ù','Ú','Û','Ü','Ý','Ñ','Ç'];
        $plain =   ['a','a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o','u','u','u','u','y','y','n','c',
                    'A','A','A','A','A','A','E','E','E','E','I','I','I','I','O','O','O','O','O','U','U','U','U','Y','N','C'];
        return str_replace($accents, $plain, $str);
    }

    /**
     * Score result and apply confidence boost for locked fields.
     *
     * @param array $parsed The parsed wine data
     * @param string|null $userInput The original user input text
     * @param array $lockedFields User-locked fields
     * @param bool $grounded Whether Google Search grounding was used
     * @return array Scoring result with boosted score
     */
    private function scoreWithLockedBoost(array $parsed, ?string $userInput, array $lockedFields = [], bool $grounded = false): array
    {
        $scoring = $this->scorer->score($parsed, $userInput, $grounded);
        if (!empty($lockedFields)) {
            $boost = count($lockedFields) * 5;
            $scoring['score'] = min(100, $scoring['score'] + $boost);
            error_log("[IdentificationService] locked fields boost: +{$boost} → {$scoring['score']}");
        }
        return $scoring;
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

        // Pass locked fields through classification for downstream methods
        $classification['lockedFields'] = $input['lockedFields'] ?? [];

        // Route to appropriate processor based on input type
        if ($classification['type'] === InputClassifier::TYPE_IMAGE) {
            return $this->identifyFromImage($classification);
        }

        return $this->identifyFromText($classification);
    }

    /**
     * Identify wine from text input with SSE streaming (WIN-181)
     *
     * Streams the LLM response and calls onField callback for each detected field.
     * Uses Tier 1 only - escalation happens after streaming completes if needed.
     *
     * @param array $input Input data with 'text' key
     * @param callable $onField Callback fn(string $field, mixed $value) for field events
     * @return array Identification result with streaming metadata
     */
    public function identifyStreaming(array $input, callable $onField): array
    {
        // Validate input
        $classification = $this->classifier->classify($input);
        if (!$classification['valid']) {
            return [
                'success' => false,
                'error' => $classification['error'],
                'stage' => 'classification',
            ];
        }

        // Check streaming feature flag
        if (!($this->config['streaming']['enabled'] ?? false)) {
            // Fall back to non-streaming
            return $this->identify($input);
        }

        $text = $classification['text'];
        $intent = $this->intentDetector->detect($text);
        $lockedFields = $input['lockedFields'] ?? [];

        // Build prompt
        $prompt = \Prompts::textIdentifyStreaming($text);

        // Tier 1 only for streaming (per plan)
        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $options = [
            'provider' => $tierConfig['provider'] ?? 'gemini',
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
            'temperature' => $tierConfig['temperature'] ?? 0.3,
            'max_tokens' => $tierConfig['max_tokens'] ?? 2000,
            'response_schema' => $this->getIdentificationSchema(),
        ];

        // Add thinking level if configured
        if (isset($tierConfig['thinking_level'])) {
            $options['thinking_level'] = $tierConfig['thinking_level'];
        }

        // Execute streaming request
        $response = $this->llmClient->streamComplete('identify_text', $prompt, $onField, $options);

        if (!$response->success) {
            // WIN-227: Don't fallback if client cancelled — streaming "failed" due to abort
            if (isRequestCancelled()) {
                return [
                    'success' => false,
                    'error' => 'Request cancelled',
                    'errorType' => 'cancelled',
                ];
            }

            // On streaming error, fall back to non-streaming if configured
            if ($this->config['streaming']['fallback_on_error'] ?? true) {
                return $this->identify($input);
            }

            return [
                'success' => false,
                'error' => $response->error ?? 'Streaming failed',
                'errorType' => $response->errorType ?? 'streaming_error',
                'stage' => 'streaming',
            ];
        }

        // Parse the complete response
        $parsed = \json_decode($response->content, true) ?? [];

        // Apply inference and locked fields
        $result = ['success' => true, 'parsed' => $parsed];
        $result = $this->applyInference($result);
        $result = $this->applyLockedFields($result, $lockedFields);

        // Score the result
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $text, $lockedFields);

        // Determine action based on confidence
        $thresholds = $this->config['confidence'] ?? [];
        $tier1Threshold = $thresholds['tier1_threshold'] ?? 85;

        $action = $scoring['score'] >= $tier1Threshold ? 'auto_populate' : 'suggest';

        return [
            'success' => true,
            'inputType' => 'text',
            'intent' => $intent['intent'] ?? 'add',
            'parsed' => $result['parsed'],
            'confidence' => $scoring['score'],
            'action' => $action,
            'candidates' => [],
            'streamed' => true,
            'usage' => [
                'ttfbMs' => $response->ttfbMs,
                'fieldTimings' => $response->fieldTimings,
                'latencyMs' => $response->latencyMs,
                'tokens' => [
                    'input' => $response->inputTokens,
                    'output' => $response->outputTokens,
                ],
                'cost' => $response->costUSD,
            ],
            'escalation' => [
                'tiers' => [
                    'tier1' => [
                        'confidence' => $scoring['score'],
                        'model' => $options['model'],
                        'streamed' => true,
                    ],
                ],
                'final_tier' => 'tier1',
                'total_cost' => $response->costUSD,
            ],
            'inferences_applied' => $result['inferences_applied'] ?? [],
        ];
    }

    /**
     * Identify wine from image with SSE streaming (WIN-181)
     *
     * @param array $input Input data with 'image' and 'mimeType' keys
     * @param callable $onField Callback fn(string $field, mixed $value) for field events
     * @return array Identification result with streaming metadata
     */
    public function identifyStreamingImage(array $input, callable $onField): array
    {
        // Validate input
        $classification = $this->classifier->classify($input);
        if (!$classification['valid']) {
            return [
                'success' => false,
                'error' => $classification['error'],
                'stage' => 'classification',
            ];
        }

        // Check streaming feature flag
        if (!($this->config['streaming']['enabled'] ?? false)) {
            return $this->identify($input);
        }

        $imageData = $classification['imageData'];
        $mimeType = $classification['mimeType'];
        $supplementaryText = $classification['supplementaryText'] ?? null;
        $lockedFields = $input['lockedFields'] ?? [];

        // Build prompt
        $prompt = \Prompts::visionIdentifyStreaming($supplementaryText);

        // Tier 1 only for streaming
        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $options = [
            'provider' => $tierConfig['provider'] ?? 'gemini',
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
            'temperature' => $tierConfig['temperature'] ?? 0.3,
            'max_tokens' => $tierConfig['max_tokens'] ?? 2000,
            'response_schema' => $this->getIdentificationSchema(),
        ];

        if (isset($tierConfig['thinking_level'])) {
            $options['thinking_level'] = $tierConfig['thinking_level'];
        }

        // No grounding on Tier 1 — keeps TTFB fast (~2s).
        // User can manually verify via "Verify" chip → verifyImage.php → Tier 1.5 with grounding.

        // Wrap callback to capture emitted fields — used as fallback if final
        // JSON is truncated (response_schema can truncate mid-array).
        $capturedFields = [];
        $wrappedOnField = function ($field, $value) use ($onField, &$capturedFields) {
            $capturedFields[$field] = $value;
            $onField($field, $value);
        };

        // Execute streaming request with image
        $response = $this->llmClient->streamCompleteWithImage(
            'identify_image',
            $prompt,
            $imageData,
            $mimeType,
            $wrappedOnField,
            $options
        );

        if (!$response->success) {
            // WIN-227: Don't fallback if client cancelled — streaming "failed" due to abort
            if (isRequestCancelled()) {
                return [
                    'success' => false,
                    'error' => 'Request cancelled',
                    'errorType' => 'cancelled',
                ];
            }

            if ($this->config['streaming']['fallback_on_error'] ?? true) {
                return $this->identify($input);
            }

            return [
                'success' => false,
                'error' => $response->error ?? 'Streaming failed',
                'errorType' => $response->errorType ?? 'streaming_error',
                'stage' => 'streaming',
            ];
        }

        // Parse the complete response
        $parsed = \json_decode($response->content, true) ?? [];

        // Fallback: if JSON was truncated but streaming detected fields, use those
        if (empty($parsed) && !empty($capturedFields)) {
            \error_log("[Agent] identifyStreamingImage: JSON truncated, using " . count($capturedFields) . " streamed fields");
            $parsed = $capturedFields;
            if (!isset($parsed['confidence'])) {
                $parsed['confidence'] = 50; // Default when confidence wasn't reached
            }
        }

        // Apply inference and locked fields
        $result = ['success' => true, 'parsed' => $parsed];
        $result = $this->applyInference($result);
        $result = $this->applyLockedFields($result, $lockedFields);

        // Score the result (ungrounded — fast Tier 1 without Google Search)
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $supplementaryText, $lockedFields, false);

        $thresholds = $this->config['confidence'] ?? [];
        $tier1Threshold = $thresholds['tier1_threshold'] ?? 85;
        $action = $scoring['score'] >= $tier1Threshold ? 'auto_populate' : 'suggest';

        return [
            'success' => true,
            'inputType' => 'image',
            'intent' => 'add',
            'parsed' => $result['parsed'],
            'confidence' => $scoring['score'],
            'action' => $action,
            'candidates' => [],
            'streamed' => true,
            'usage' => [
                'ttfbMs' => $response->ttfbMs,
                'fieldTimings' => $response->fieldTimings,
                'latencyMs' => $response->latencyMs,
                'tokens' => [
                    'input' => $response->inputTokens,
                    'output' => $response->outputTokens,
                ],
                'cost' => $response->costUSD,
            ],
            'escalation' => [
                'tiers' => [
                    'tier1' => [
                        'confidence' => $scoring['score'],
                        'model' => $options['model'],
                        'streamed' => true,
                    ],
                ],
                'final_tier' => 'tier1',
                'total_cost' => $response->costUSD,
            ],
            'inferences_applied' => $result['inferences_applied'] ?? [],
        ];
    }

    /**
     * Get the JSON schema for identification responses.
     * Used with Gemini's responseSchema for structured output.
     */
    private function getIdentificationSchema(): array
    {
        // REST API (v1beta) requires lowercase types + propertyOrdering for streaming.
        // propertyOrdering controls field output order for StreamingFieldDetector.
        return [
            'type' => 'object',
            'properties' => [
                'producer' => ['type' => 'string', 'nullable' => true],
                'wineName' => ['type' => 'string', 'nullable' => true],
                'vintage' => ['type' => 'integer', 'nullable' => true],
                'region' => ['type' => 'string', 'nullable' => true],
                'country' => ['type' => 'string', 'nullable' => true],
                'wineType' => [
                    'type' => 'string',
                    'nullable' => true,
                    'enum' => ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified'],
                ],
                'grapes' => [
                    'type' => 'array',
                    'nullable' => true,
                    'items' => ['type' => 'string'],
                ],
                'confidence' => ['type' => 'integer'],
            ],
            'required' => ['confidence'],
            'propertyOrdering' => [
                'producer', 'wineName', 'vintage', 'region',
                'country', 'wineType', 'grapes', 'confidence',
            ],
        ];
    }

    /**
     * Escalate identification starting from Tier 1.5 (skips redundant Tier 1).
     * Used by streaming endpoints after Tier 1 result is already shown to user.
     *
     * @param array $input Original input data
     * @param array $tier1Result Tier 1 result with parsed + confidence
     * @param string $inputType 'text' or 'image'
     * @return array Escalated identification result
     */
    public function identifyEscalateOnly(array $input, array $tier1Result, string $inputType = 'text'): array
    {
        if ($inputType === 'image') {
            return $this->escalateImage($input, $tier1Result);
        }
        return $this->escalateText($input, $tier1Result);
    }

    /**
     * Escalate text identification from Tier 1.5 onward
     *
     * @param array $input Original input data
     * @param array $tier1Result Tier 1 result
     * @return array Escalated result
     */
    private function escalateText(array $input, array $tier1Result): array
    {
        $inputText = $input['text'] ?? '';
        $intent = $this->intentDetector->detect($inputText);
        $lockedFields = $input['lockedFields'] ?? [];

        $thresholds = $this->config['confidence'] ?? [];
        $tier1_5Threshold = $thresholds['tier1_5_threshold'] ?? 70;
        $tier2Threshold = $thresholds['tier2_threshold'] ?? 60;

        $escalationData = [
            'tiers' => ['tier1' => ['confidence' => $tier1Result['confidence'], 'model' => 'streamed']],
            'final_tier' => null,
            'total_cost' => 0,
        ];

        $result = $tier1Result;

        // ─── TIER 1.5: Detailed (Gemini 3 Flash, high thinking) ───
        if (isRequestCancelled()) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        error_log("[Agent] escalateText: Tier 1.5 starting (from {$result['confidence']})");
        $tier1_5Result = $this->processWithGemini($inputText, 'detailed', $tier1Result, $lockedFields);

        if ($tier1_5Result['success']) {
            $tier1_5Result = $this->applyInference($tier1_5Result);
            $tier1_5Result = $this->applyLockedFields($tier1_5Result, $lockedFields);
            $scoring = $this->scoreWithLockedBoost($tier1_5Result['parsed'], $inputText, $lockedFields);
            $tier1_5Result['confidence'] = $scoring['score'];
            $tier1_5Result['action'] = $scoring['action'];

            $detailedConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $tier1_5Result['confidence'],
                'model' => $detailedConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedConfig['thinking_level'] ?? 'HIGH',
            ];

            if ($tier1_5Result['confidence'] > $result['confidence']) {
                $result = $tier1_5Result;
                $escalationData['total_cost'] += $tier1_5Result['cost'] ?? 0;
            }
        } else {
            error_log("[Agent] escalateText: Tier 1.5 FAILED, keeping Tier 1");
        }

        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─── TIER 2: Balanced (Claude Sonnet 4.5) ───
        if (isRequestCancelled()) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        if ($this->llmClient->isProviderAvailable('claude')) {
            error_log("[Agent] escalateText: Tier 2 starting (from {$result['confidence']})");
            $claudeResult = $this->processWithClaude($inputText, 'claude-sonnet-4-5-20250929', $result, $lockedFields);

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $claudeResult = $this->applyLockedFields($claudeResult, $lockedFields);
                $scoring = $this->scoreWithLockedBoost($claudeResult['parsed'], $inputText, $lockedFields);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];

                if ($claudeResult['confidence'] > $result['confidence']) {
                    $result = $claudeResult;
                    $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;
                }
            } else {
                error_log("[Agent] escalateText: Tier 2 FAILED");
            }
        }

        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─── USER CHOICE ───
        error_log("[Agent] escalateText: low confidence — offering user_choice");
        $escalationData['final_tier'] = 'user_choice';
        $finalResult = $this->buildTextResult($result, 'user_choice', $intent, $escalationData, [
            'options' => ['try_harder', 'tell_me_more'],
        ]);

        if ($result['confidence'] < 30) {
            $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);
        }

        return $finalResult;
    }

    /**
     * Escalate image identification from Tier 1.5 onward
     *
     * @param array $input Original input data
     * @param array $tier1Result Tier 1 result
     * @return array Escalated result
     */
    private function escalateImage(array $input, array $tier1Result): array
    {
        $imageData = $input['image'] ?? '';
        $mimeType = $input['mimeType'] ?? '';
        $supplementaryText = $input['supplementaryText'] ?? null;
        $lockedFields = $input['lockedFields'] ?? [];

        $processOptions = [];
        if ($supplementaryText) {
            $processOptions['supplementary_text'] = $supplementaryText;
        }

        $thresholds = $this->config['confidence'] ?? [];
        $tier1_5Threshold = $thresholds['tier1_5_threshold'] ?? 70;
        $tier2Threshold = $thresholds['tier2_threshold'] ?? 60;

        $quality = $tier1Result['quality'] ?? null;

        $escalationData = [
            'tiers' => ['tier1' => ['confidence' => $tier1Result['confidence'], 'model' => 'streamed']],
            'final_tier' => null,
            'total_cost' => 0,
        ];

        $result = $tier1Result;

        // ─── TIER 1.5: Detailed (Gemini 3 Flash, high thinking) ───
        if (isRequestCancelled()) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        error_log("[Agent] escalateImage: Tier 1.5 starting (from {$result['confidence']})");
        // NOTE: Image path does NOT pass prior context to Tier 1.5 (by design)
        $tier1_5Result = $this->processVisionWithGemini($imageData, $mimeType, 'detailed', $processOptions);

        if ($tier1_5Result['success']) {
            $tier1_5Result = $this->applyInference($tier1_5Result);
            $tier1_5Result = $this->applyLockedFields($tier1_5Result, $lockedFields);
            $scoring = $this->scoreWithLockedBoost($tier1_5Result['parsed'], $supplementaryText, $lockedFields, true);
            $tier1_5Result['confidence'] = $scoring['score'];
            $tier1_5Result['action'] = $scoring['action'];

            $detailedConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $tier1_5Result['confidence'],
                'model' => $detailedConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedConfig['thinking_level'] ?? 'HIGH',
            ];

            if ($tier1_5Result['confidence'] >= $result['confidence']) {
                $result = $tier1_5Result;
                $escalationData['total_cost'] += $tier1_5Result['cost'] ?? 0;
            }
        } else {
            error_log("[Agent] escalateImage: Tier 1.5 FAILED, keeping Tier 1");
        }

        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─── TIER 2: Balanced (Claude Sonnet 4.5 with vision) ───
        if (isRequestCancelled()) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        if ($this->llmClient->isProviderAvailable('claude')) {
            error_log("[Agent] escalateImage: Tier 2 starting (from {$result['confidence']})");
            $claudeResult = $this->processVisionWithClaude(
                $imageData,
                $mimeType,
                'claude-sonnet-4-5-20250929',
                $processOptions
            );

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $claudeResult = $this->applyLockedFields($claudeResult, $lockedFields);
                $scoring = $this->scoreWithLockedBoost($claudeResult['parsed'], $supplementaryText, $lockedFields);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];

                if ($claudeResult['confidence'] >= $result['confidence']) {
                    $result = $claudeResult;
                    $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;
                }
            } else {
                error_log("[Agent] escalateImage: Tier 2 FAILED");
            }
        }

        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─── USER CHOICE ───
        error_log("[Agent] escalateImage: low confidence — offering user_choice");
        $escalationData['final_tier'] = 'user_choice';
        $finalResult = $this->buildImageResult($result, 'user_choice', $escalationData, $quality, [
            'options' => ['try_harder', 'tell_me_more'],
        ]);

        if ($result['confidence'] < 30) {
            $finalResult['candidates'] = $this->disambiguator->findCandidates($result['parsed']);
        }

        return $finalResult;
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
        $lockedFields = $classification['lockedFields'] ?? [];

        // Get configurable thresholds
        $thresholds = $this->config['confidence'] ?? [];
        $tier1Threshold = $thresholds['tier1_threshold'] ?? 85;
        $tier1_5Threshold = $thresholds['tier1_5_threshold'] ?? 70;
        $tier2Threshold = $thresholds['tier2_threshold'] ?? 60;
        $userChoiceThreshold = $thresholds['user_choice_threshold'] ?? 60;

        // Track escalation metadata
        $escalationData = [
            'tiers' => [],
            'final_tier' => null,
            'total_cost' => 0,
        ];

        // ─────────────────────────────────────────────────────
        // TIER 1: Fast (Gemini 3 Flash, low thinking)
        // ─────────────────────────────────────────────────────
        $tierModel = $this->config['model_tiers']['fast']['model'] ?? 'gemini-3-flash-preview';
        error_log("[Agent] identify(text): Tier 1 starting model={$tierModel}");
        $result = $this->processWithGemini($inputText, 'fast');
        if (!$result['success']) {
            error_log("[Agent] identify(text): Tier 1 FAILED — " . ($result['error'] ?? 'unknown'));
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier1_processing',
            ];
        }

        $result = $this->applyInference($result);
        $result = $this->applyLockedFields($result, $lockedFields);
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $inputText, $lockedFields);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $escalationData['tiers']['tier1'] = [
            'confidence' => $result['confidence'],
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
        ];
        $escalationData['total_cost'] += $result['cost'] ?? 0;

        error_log("[Agent] identify(text): Tier 1 done confidence={$result['confidence']} threshold={$tier1Threshold}");

        // Check Tier 1 threshold
        if ($result['confidence'] >= $tier1Threshold) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildTextResult($result, 'auto_populate', $intent, $escalationData);
        }

        // WIN-227: Bail early if client cancelled before escalation
        if (isRequestCancelled()) {
            error_log("[Agent] identify(text): CANCELLED before Tier 1.5");
            $escalationData['final_tier'] = 'tier1';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // TIER 1.5: Retry (Gemini 3 Flash, high thinking)
        // ─────────────────────────────────────────────────────
        error_log("[Agent] identify(text): Tier 1.5 starting (escalating from {$result['confidence']})");
        $tier1Result = $result; // Save for context
        $result = $this->processWithGemini($inputText, 'detailed', $tier1Result, $lockedFields);

        if ($result['success']) {
            $result = $this->applyInference($result);
            $result = $this->applyLockedFields($result, $lockedFields);
            $scoring = $this->scoreWithLockedBoost($result['parsed'], $inputText, $lockedFields);
            $result['confidence'] = $scoring['score'];
            $result['action'] = $scoring['action'];

            $detailedTierConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $result['confidence'],
                'model' => $detailedTierConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedTierConfig['thinking_level'] ?? 'HIGH',
            ];

            // Use better result - only add cost if we're using this tier's result
            if ($result['confidence'] < $tier1Result['confidence']) {
                error_log("[Agent] identify(text): Tier 1.5 worse ({$result['confidence']}), keeping Tier 1 ({$tier1Result['confidence']})");
                $result = $tier1Result; // Keep tier 1 result if it was better
            } else {
                $escalationData['total_cost'] += $result['cost'] ?? 0;
            }
        } else {
            error_log("[Agent] identify(text): Tier 1.5 FAILED, keeping Tier 1");
            $result = $tier1Result;
        }

        error_log("[Agent] identify(text): Tier 1.5 done confidence={$result['confidence']} threshold={$tier1_5Threshold}");

        // Check Tier 1.5 threshold
        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // WIN-227: Bail early if client cancelled before Tier 2
        if (isRequestCancelled()) {
            error_log("[Agent] identify(text): CANCELLED before Tier 2");
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // TIER 2: Balanced (Claude Sonnet 4.5)
        // ─────────────────────────────────────────────────────
        // Check if Claude is available before attempting
        if ($this->llmClient->isProviderAvailable('claude')) {
            error_log("[Agent] identify(text): Tier 2 starting model=claude-sonnet-4-5 (escalating from {$result['confidence']})");
            $tier1_5Result = $result; // Save for context
            $claudeResult = $this->processWithClaude($inputText, 'claude-sonnet-4-5-20250929', $tier1_5Result, $lockedFields);

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $claudeResult = $this->applyLockedFields($claudeResult, $lockedFields);
                $scoring = $this->scoreWithLockedBoost($claudeResult['parsed'], $inputText, $lockedFields);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];

                // Use better result - only add cost if we're using this tier's result
                if ($claudeResult['confidence'] > $result['confidence']) {
                    $result = $claudeResult;
                    $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;
                }
                error_log("[Agent] identify(text): Tier 2 done confidence={$claudeResult['confidence']}");
            } else {
                error_log("[Agent] identify(text): Tier 2 FAILED");
            }
        }

        error_log("[Agent] identify(text): best confidence={$result['confidence']} threshold={$tier2Threshold}");

        // Check Tier 2 threshold
        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildTextResult($result, 'suggest', $intent, $escalationData);
        }

        // ─────────────────────────────────────────────────────
        // USER CHOICE: Below 60% - always offer premium model
        // ─────────────────────────────────────────────────────
        // Any confidence below tier2Threshold (60%) offers the premium model option
        error_log("[Agent] identify(text): low confidence — offering user_choice");
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
        $lockedFields = $input['lockedFields'] ?? [];
        $escalationContext = $input['escalationContext'] ?? [];

        // Use original user text for scoring if available (avoids scoring on reconstructed text)
        $scoringText = !empty($escalationContext['originalUserText'])
            ? $escalationContext['originalUserText']
            : $inputText;

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

        // Process with Opus — pass escalation context for enhanced prompt
        $result = $this->processWithClaude($inputText, 'claude-opus-4-5-20251101', $priorResult, $lockedFields, $escalationContext);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Premium processing failed',
                'errorType' => $result['errorType'] ?? 'processing_error',
                'stage' => 'tier3_processing',
            ];
        }

        $result = $this->applyInference($result);
        $result = $this->applyLockedFields($result, $lockedFields);
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $scoringText, $lockedFields);
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
        $lockedFields = $input['lockedFields'] ?? [];
        $escalationContext = $input['escalationContext'] ?? [];

        // Use original user text for scoring if available
        $scoringText = !empty($escalationContext['originalUserText'])
            ? $escalationContext['originalUserText']
            : $supplementaryText;

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
        $result = $this->applyLockedFields($result, $lockedFields);
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $scoringText, $lockedFields);
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
        $lockedFields = $classification['lockedFields'] ?? [];

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
        $tierModel = $this->config['model_tiers']['fast']['model'] ?? 'gemini-3-flash-preview';
        error_log("[Agent] identify(image): Tier 1 starting model={$tierModel}");
        $result = $this->processVisionWithGemini($imageData, $mimeType, 'fast', $processOptions);

        if (!$result['success']) {
            error_log("[Agent] identify(image): Tier 1 FAILED — " . ($result['error'] ?? 'unknown'));
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
        $result = $this->applyLockedFields($result, $lockedFields);
        $scoring = $this->scoreWithLockedBoost($result['parsed'], $supplementaryText, $lockedFields, true);
        $result['confidence'] = $scoring['score'];
        $result['action'] = $scoring['action'];

        $tierConfig = $this->config['model_tiers']['fast'] ?? [];
        $escalationData['tiers']['tier1'] = [
            'confidence' => $result['confidence'],
            'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
        ];
        $escalationData['total_cost'] += $result['cost'] ?? 0;

        error_log("[Agent] identify(image): Tier 1 done confidence={$result['confidence']} threshold={$tier1Threshold}");

        // Check Tier 1 threshold
        if ($result['confidence'] >= $tier1Threshold) {
            $escalationData['final_tier'] = 'tier1';
            return $this->buildImageResult($result, 'auto_populate', $escalationData, $quality);
        }

        // WIN-227: Bail early if client cancelled before escalation
        if (isRequestCancelled()) {
            error_log("[Agent] identify(image): CANCELLED before Tier 1.5");
            $escalationData['final_tier'] = 'tier1';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // TIER 1.5: Detailed (Gemini 3 Flash, high thinking)
        // ─────────────────────────────────────────────────────
        error_log("[Agent] identify(image): Tier 1.5 starting (escalating from {$result['confidence']})");
        $tier1Result = $result; // Save for context
        $result = $this->processVisionWithGemini($imageData, $mimeType, 'detailed', $processOptions);

        if ($result['success']) {
            $result = $this->applyInference($result);
            $result = $this->applyLockedFields($result, $lockedFields);
            $scoring = $this->scoreWithLockedBoost($result['parsed'], $supplementaryText, $lockedFields, true);
            $result['confidence'] = $scoring['score'];
            $result['action'] = $scoring['action'];

            $detailedTierConfig = $this->config['model_tiers']['detailed'] ?? [];
            $escalationData['tiers']['tier1_5'] = [
                'confidence' => $result['confidence'],
                'model' => $detailedTierConfig['model'] ?? 'gemini-3-flash-preview',
                'thinking_level' => $detailedTierConfig['thinking_level'] ?? 'HIGH',
            ];

            // Use better result - only add cost if we're using this tier's result
            if ($result['confidence'] < $tier1Result['confidence']) {
                error_log("[Agent] identify(image): Tier 1.5 worse ({$result['confidence']}), keeping Tier 1 ({$tier1Result['confidence']})");
                $result = $tier1Result; // Keep tier 1 result if it was better
            } else {
                $escalationData['total_cost'] += $result['cost'] ?? 0;
            }
        } else {
            error_log("[Agent] identify(image): Tier 1.5 FAILED, keeping Tier 1");
            $result = $tier1Result;
        }

        error_log("[Agent] identify(image): Tier 1.5 done confidence={$result['confidence']} threshold={$tier1_5Threshold}");

        // Check Tier 1.5 threshold
        if ($result['confidence'] >= $tier1_5Threshold) {
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // WIN-227: Bail early if client cancelled before Tier 2
        if (isRequestCancelled()) {
            error_log("[Agent] identify(image): CANCELLED before Tier 2");
            $escalationData['final_tier'] = 'tier1_5';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // TIER 2: Balanced (Claude Sonnet 4.5 with vision)
        // ─────────────────────────────────────────────────────
        if ($this->llmClient->isProviderAvailable('claude')) {
            error_log("[Agent] identify(image): Tier 2 starting model=claude-sonnet-4-5 (escalating from {$result['confidence']})");
            $tier1_5Result = $result; // Save for context
            $claudeResult = $this->processVisionWithClaude(
                $imageData,
                $mimeType,
                'claude-sonnet-4-5-20250929',
                $processOptions
            );

            if ($claudeResult['success']) {
                $claudeResult = $this->applyInference($claudeResult);
                $claudeResult = $this->applyLockedFields($claudeResult, $lockedFields);
                $scoring = $this->scoreWithLockedBoost($claudeResult['parsed'], $supplementaryText, $lockedFields);
                $claudeResult['confidence'] = $scoring['score'];
                $claudeResult['action'] = $scoring['action'];

                $escalationData['tiers']['tier2'] = [
                    'confidence' => $claudeResult['confidence'],
                    'model' => 'claude-sonnet-4-5-20250929',
                ];

                // Use better result - only add cost if we're using this tier's result
                if ($claudeResult['confidence'] > $result['confidence']) {
                    $result = $claudeResult;
                    $escalationData['total_cost'] += $claudeResult['cost'] ?? 0;
                }
                error_log("[Agent] identify(image): Tier 2 done confidence={$claudeResult['confidence']}");
            } else {
                error_log("[Agent] identify(image): Tier 2 FAILED");
            }
        }

        error_log("[Agent] identify(image): best confidence={$result['confidence']} threshold={$tier2Threshold}");

        // Check Tier 2 threshold
        if ($result['confidence'] >= $tier2Threshold) {
            $escalationData['final_tier'] = 'tier2';
            return $this->buildImageResult($result, 'suggest', $escalationData, $quality);
        }

        // ─────────────────────────────────────────────────────
        // USER CHOICE: Below 60% - always offer premium model
        // ─────────────────────────────────────────────────────
        error_log("[Agent] identify(image): low confidence — offering user_choice");
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
     * @param string|null $userInput Original user input text
     * @return array Scoring explanation
     */
    public function explainScoring(array $parsed, ?string $userInput = null): array
    {
        return $this->scorer->explain($parsed, $userInput);
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
