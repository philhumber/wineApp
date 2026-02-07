<?php
/**
 * Image Quality Assessor
 *
 * Pre-flight validation for image inputs before sending to LLM.
 * Checks image format, size, dimensions, and basic quality indicators.
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class ImageQualityAssessor
{
    /** Minimum quality score to accept (0-100) */
    private const MIN_QUALITY_THRESHOLD = 50;

    /** Maximum image size in bytes (8MB) */
    private const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

    /** Minimum image dimension (pixels) */
    private const MIN_DIMENSION = 100;

    /** Maximum image dimension (pixels) */
    private const MAX_DIMENSION = 4096;

    /** Supported MIME types */
    private const SUPPORTED_MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
    ];

    /**
     * Assess image quality
     *
     * @param string $imageData Base64-encoded image data
     * @param string $mimeType Image MIME type
     * @return array Quality assessment result with score and issues
     */
    public function assess(string $imageData, string $mimeType): array
    {
        $issues = [];
        $score = 100;

        // Validate MIME type
        $mimeValidation = $this->validateMimeType($mimeType);
        if (!$mimeValidation['valid']) {
            return [
                'valid' => false,
                'score' => 0,
                'issues' => [$mimeValidation['error']],
            ];
        }

        // Decode and validate base64
        $binaryData = base64_decode($imageData, true);
        if ($binaryData === false) {
            return [
                'valid' => false,
                'score' => 0,
                'issues' => ['Invalid base64 encoding'],
            ];
        }

        // Check file size
        $sizeBytes = strlen($binaryData);
        if ($sizeBytes > self::MAX_IMAGE_SIZE) {
            $sizeMB = round($sizeBytes / (1024 * 1024), 2);
            $maxMB = self::MAX_IMAGE_SIZE / (1024 * 1024);
            return [
                'valid' => false,
                'score' => 0,
                'issues' => ["Image too large ({$sizeMB}MB). Maximum size is {$maxMB}MB."],
            ];
        }

        // Check minimum size (very small images are likely too low quality)
        if ($sizeBytes < 5000) {
            $score -= 30;
            $issues[] = 'Image file is very small, may be low quality';
        }

        // Try to get image dimensions
        $dimensions = $this->getImageDimensions($binaryData);
        if ($dimensions !== null) {
            // Check minimum dimensions
            if ($dimensions['width'] < self::MIN_DIMENSION || $dimensions['height'] < self::MIN_DIMENSION) {
                return [
                    'valid' => false,
                    'score' => 0,
                    'issues' => ["Image dimensions too small ({$dimensions['width']}x{$dimensions['height']}). Minimum is " . self::MIN_DIMENSION . "px."],
                ];
            }

            // Check maximum dimensions
            if ($dimensions['width'] > self::MAX_DIMENSION || $dimensions['height'] > self::MAX_DIMENSION) {
                $score -= 10;
                $issues[] = 'Image is very large, may be slow to process';
            }

            // Check aspect ratio (extremely wide or tall images are unusual for wine labels)
            $aspectRatio = $dimensions['width'] / max($dimensions['height'], 1);
            if ($aspectRatio > 4 || $aspectRatio < 0.25) {
                $score -= 20;
                $issues[] = 'Unusual aspect ratio for a wine label';
            }
        } else {
            // Could not determine dimensions - minor penalty
            $score -= 10;
            $issues[] = 'Could not verify image dimensions';
        }

        // Ensure score doesn't go below 0
        $score = max(0, $score);

        // Determine if image passes quality threshold
        $valid = $score >= self::MIN_QUALITY_THRESHOLD;

        return [
            'valid' => $valid,
            'score' => $score,
            'issues' => $issues,
            'dimensions' => $dimensions,
            'sizeBytes' => $sizeBytes,
        ];
    }

    /**
     * Validate MIME type
     *
     * @param string $mimeType MIME type to validate
     * @return array Validation result
     */
    private function validateMimeType(string $mimeType): array
    {
        $mimeType = strtolower(trim($mimeType));

        if (empty($mimeType)) {
            return [
                'valid' => false,
                'error' => 'MIME type is required',
            ];
        }

        if (!in_array($mimeType, self::SUPPORTED_MIME_TYPES)) {
            return [
                'valid' => false,
                'error' => "Unsupported image format: {$mimeType}. Supported formats: JPEG, PNG, WebP, HEIC",
            ];
        }

        return ['valid' => true];
    }

    /**
     * Get image dimensions from binary data
     *
     * @param string $binaryData Raw image binary data
     * @return array|null Dimensions array or null if cannot be determined
     */
    private function getImageDimensions(string $binaryData): ?array
    {
        // Create temporary file to use getimagesize
        $tempFile = tempnam(sys_get_temp_dir(), 'wine_img_');
        if ($tempFile === false) {
            return null;
        }

        try {
            file_put_contents($tempFile, $binaryData);
            $imageInfo = @getimagesize($tempFile);

            if ($imageInfo === false) {
                return null;
            }

            return [
                'width' => $imageInfo[0],
                'height' => $imageInfo[1],
                'type' => $imageInfo[2],
            ];
        } finally {
            @unlink($tempFile);
        }
    }

    /**
     * Get the minimum quality threshold
     *
     * @return int Minimum quality score
     */
    public function getMinQualityThreshold(): int
    {
        return self::MIN_QUALITY_THRESHOLD;
    }

    /**
     * Get supported MIME types
     *
     * @return array List of supported MIME types
     */
    public function getSupportedMimeTypes(): array
    {
        return self::SUPPORTED_MIME_TYPES;
    }

    /**
     * Get maximum image size in bytes
     *
     * @return int Maximum size in bytes
     */
    public function getMaxImageSize(): int
    {
        return self::MAX_IMAGE_SIZE;
    }
}
