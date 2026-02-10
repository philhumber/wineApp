<?php
/**
 * Unit tests for IdentificationService prompt methods
 *
 * Uses Reflection to access private buildIdentificationPrompt() and buildVisionPrompt()
 * without requiring constructor dependencies.
 *
 * Run: php resources/php/tests/IdentificationPromptTest.php
 */

// Require all classes in the Identification namespace that IdentificationService references
require_once __DIR__ . '/../agent/Identification/InputClassifier.php';
require_once __DIR__ . '/../agent/Identification/IntentDetector.php';
require_once __DIR__ . '/../agent/Identification/TextProcessor.php';
require_once __DIR__ . '/../agent/Identification/VisionProcessor.php';
require_once __DIR__ . '/../agent/Identification/ConfidenceScorer.php';
require_once __DIR__ . '/../agent/Identification/DisambiguationHandler.php';
require_once __DIR__ . '/../agent/Identification/InferenceEngine.php';
require_once __DIR__ . '/../agent/Identification/IdentificationService.php';

// LLM namespace dependencies (needed for class loading)
require_once __DIR__ . '/../agent/LLM/LLMClient.php';

use Agent\Identification\IdentificationService;

class IdentificationPromptTest
{
    private static int $passed = 0;
    private static int $failed = 0;

    /** @var IdentificationService Instance created without constructor */
    private static IdentificationService $service;

    /** @var \ReflectionMethod buildIdentificationPrompt method */
    private static \ReflectionMethod $textPromptMethod;

    /** @var \ReflectionMethod buildVisionPrompt method */
    private static \ReflectionMethod $visionPromptMethod;

    public static function run(): void
    {
        echo "Running IdentificationService prompt tests...\n\n";

        // Create instance without calling constructor (bypasses all dependencies)
        $reflection = new \ReflectionClass(IdentificationService::class);
        self::$service = $reflection->newInstanceWithoutConstructor();

        // Access private methods via Reflection
        self::$textPromptMethod = $reflection->getMethod('buildIdentificationPrompt');
        self::$textPromptMethod->setAccessible(true);

        self::$visionPromptMethod = $reflection->getMethod('buildVisionPrompt');
        self::$visionPromptMethod->setAccessible(true);

        self::testTextPromptContainsRequiredFields();
        self::testTextPromptContainsInputText();
        self::testVisionPromptContainsRequiredFields();
        self::testVisionPromptAppendsSupplementaryText();

        echo "\n" . str_repeat('=', 50) . "\n";
        echo "Results: " . self::$passed . " passed, " . self::$failed . " failed\n";
        exit(self::$failed > 0 ? 1 : 0);
    }

    private static function testTextPromptContainsRequiredFields(): void
    {
        echo "Testing text prompt contains required fields...\n";

        $prompt = self::$textPromptMethod->invoke(self::$service, 'test wine input');

        $requiredFields = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes', 'confidence'];
        foreach ($requiredFields as $field) {
            self::assert(
                str_contains($prompt, $field),
                "Text prompt contains field \"$field\""
            );
        }

        echo "\n";
    }

    private static function testTextPromptContainsInputText(): void
    {
        echo "Testing text prompt contains input text...\n";

        $input = 'Chateau Margaux 2019';
        $prompt = self::$textPromptMethod->invoke(self::$service, $input);

        self::assert(
            str_contains($prompt, $input),
            "Text prompt contains input \"$input\""
        );

        echo "\n";
    }

    private static function testVisionPromptContainsRequiredFields(): void
    {
        echo "Testing vision prompt contains required fields...\n";

        $prompt = self::$visionPromptMethod->invoke(self::$service);

        $requiredFields = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes', 'confidence'];
        foreach ($requiredFields as $field) {
            self::assert(
                str_contains($prompt, $field),
                "Vision prompt contains field \"$field\""
            );
        }

        echo "\n";
    }

    private static function testVisionPromptAppendsSupplementaryText(): void
    {
        echo "Testing vision prompt appends supplementary text...\n";

        $supplementary = 'red wine from Bordeaux';
        $prompt = self::$visionPromptMethod->invoke(self::$service, $supplementary);

        self::assert(
            str_contains($prompt, $supplementary),
            "Vision prompt contains supplementary text \"$supplementary\""
        );

        // Also verify that without supplementary text, it does NOT contain the phrase
        $promptWithout = self::$visionPromptMethod->invoke(self::$service, null);
        self::assert(
            !str_contains($promptWithout, 'Additional context from user'),
            'Vision prompt without supplementary text has no "Additional context" section'
        );

        echo "\n";
    }

    private static function assert(bool $condition, string $description, string $details = ''): void
    {
        if ($condition) {
            echo "  PASS $description\n";
            self::$passed++;
        } else {
            echo "  FAIL $description\n";
            if ($details) {
                echo "    $details\n";
            }
            self::$failed++;
        }
    }
}

// Run tests
IdentificationPromptTest::run();
