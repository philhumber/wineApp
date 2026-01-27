<?php
/**
 * Input Classifier
 *
 * Validates and classifies input for wine identification.
 * Determines if input is text, image, or invalid.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class InputClassifier
{
    /** Input type: text */
    public const TYPE_TEXT = 'text';

    /** Input type: image */
    public const TYPE_IMAGE = 'image';

    /** Input type: invalid */
    public const TYPE_INVALID = 'invalid';

    /** @var array Configuration */
    private array $config;

    /** @var int Minimum text length */
    private int $minLength = 3;

    /** @var int Maximum text length */
    private int $maxLength = 500;

    /**
     * Create a new input classifier
     *
     * @param array $config Configuration
     */
    public function __construct(array $config = [])
    {
        $this->config = $config;

        if (isset($config['min_text_length'])) {
            $this->minLength = $config['min_text_length'];
        }
        if (isset($config['max_text_length'])) {
            $this->maxLength = $config['max_text_length'];
        }
    }

    /**
     * Classify and validate input
     *
     * @param array $input Input data
     * @return array Classification result with type, valid flag, and data/error
     */
    public function classify(array $input): array
    {
        // Check for image input (Phase 2)
        if (isset($input['image'])) {
            return $this->validateImage($input['image'], $input['mimeType'] ?? null);
        }

        // Check for text input
        if (isset($input['text'])) {
            return $this->validateText($input['text']);
        }

        return [
            'type' => self::TYPE_INVALID,
            'valid' => false,
            'error' => 'No valid input provided. Expected "text" or "image".',
        ];
    }

    /**
     * Validate text input
     *
     * @param string $text Input text
     * @return array Validation result
     */
    private function validateText(string $text): array
    {
        $text = trim($text);

        // Check for empty input
        if ($text === '') {
            return [
                'type' => self::TYPE_TEXT,
                'valid' => false,
                'error' => 'Input text cannot be empty.',
            ];
        }

        // Check minimum length
        if (mb_strlen($text) < $this->minLength) {
            return [
                'type' => self::TYPE_TEXT,
                'valid' => false,
                'error' => "Input text too short. Please provide at least {$this->minLength} characters.",
            ];
        }

        // Check maximum length
        if (mb_strlen($text) > $this->maxLength) {
            return [
                'type' => self::TYPE_TEXT,
                'valid' => false,
                'error' => "Input text too long. Maximum {$this->maxLength} characters allowed.",
            ];
        }

        // Basic content validation - check for at least some alphanumeric content
        if (!preg_match('/[a-zA-Z0-9]/', $text)) {
            return [
                'type' => self::TYPE_TEXT,
                'valid' => false,
                'error' => 'Input must contain at least some alphanumeric characters.',
            ];
        }

        return [
            'type' => self::TYPE_TEXT,
            'valid' => true,
            'text' => $text,
        ];
    }

    /** @var array Supported image MIME types */
    private array $supportedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
    ];

    /** @var int Maximum image size in bytes (8MB) */
    private int $maxImageSize = 8 * 1024 * 1024;

    /**
     * Validate image input
     *
     * @param string $imageData Base64-encoded image data
     * @param string|null $mimeType Image MIME type
     * @return array Validation result
     */
    private function validateImage(string $imageData, ?string $mimeType): array
    {
        // Check for empty input
        if (empty($imageData)) {
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => 'Image data cannot be empty.',
            ];
        }

        // Check MIME type is provided
        if (empty($mimeType)) {
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => 'Image MIME type is required.',
            ];
        }

        // Normalize and validate MIME type
        $mimeType = strtolower(trim($mimeType));
        if (!in_array($mimeType, $this->supportedMimeTypes)) {
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => "Unsupported image format: {$mimeType}. Supported formats: JPEG, PNG, WebP, HEIC.",
            ];
        }

        // Validate base64 encoding
        $binaryData = base64_decode($imageData, true);
        if ($binaryData === false) {
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => 'Invalid base64 encoding. Please provide valid base64-encoded image data.',
            ];
        }

        // Check file size
        $sizeBytes = strlen($binaryData);
        if ($sizeBytes > $this->maxImageSize) {
            $sizeMB = round($sizeBytes / (1024 * 1024), 2);
            $maxMB = $this->maxImageSize / (1024 * 1024);
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => "Image too large ({$sizeMB}MB). Maximum size is {$maxMB}MB. Please compress the image.",
            ];
        }

        // Check minimum size (very small images unlikely to be useful)
        if ($sizeBytes < 1000) {
            return [
                'type' => self::TYPE_IMAGE,
                'valid' => false,
                'error' => 'Image file is too small. Please provide a higher resolution image.',
            ];
        }

        return [
            'type' => self::TYPE_IMAGE,
            'valid' => true,
            'imageData' => $imageData,
            'mimeType' => $mimeType,
            'sizeBytes' => $sizeBytes,
        ];
    }

    /**
     * Check if input appears to be a wine-related query
     *
     * @param string $text Input text
     * @return bool True if likely wine-related
     */
    public function isWineRelated(string $text): bool
    {
        // Common wine-related terms
        $wineTerms = [
            'wine', 'vino', 'vin',
            'château', 'chateau', 'domaine', 'bodega', 'weingut',
            'vintage', 'year', 'millésime',
            'red', 'white', 'rosé', 'rose', 'sparkling', 'champagne',
            'cabernet', 'merlot', 'pinot', 'chardonnay', 'riesling', 'syrah', 'shiraz',
            'bordeaux', 'burgundy', 'champagne', 'napa', 'barolo', 'rioja',
            'bottle', 'glass', 'cellar',
        ];

        $lowerText = strtolower($text);

        foreach ($wineTerms as $term) {
            if (strpos($lowerText, $term) !== false) {
                return true;
            }
        }

        // Check for year pattern (common in wine names)
        if (preg_match('/\b(19|20)\d{2}\b/', $text)) {
            return true;
        }

        return false;
    }
}
