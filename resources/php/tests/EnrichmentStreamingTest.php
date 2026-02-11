<?php
/**
 * Unit tests for Phase 6 Enrichment Streaming
 *
 * Tests StreamingFieldDetector with enrichment-specific fields,
 * WebSearchEnricher schema and prompt generation.
 *
 * Run: php resources/php/tests/EnrichmentStreamingTest.php
 */

require_once __DIR__ . '/../agent/LLM/Streaming/StreamingFieldDetector.php';
require_once __DIR__ . '/../agent/LLM/LLMResponse.php';
require_once __DIR__ . '/../agent/LLM/LLMStreamingResponse.php';
require_once __DIR__ . '/../agent/Enrichment/GrapeVariety.php';
require_once __DIR__ . '/../agent/Enrichment/DrinkWindow.php';
require_once __DIR__ . '/../agent/Enrichment/CriticScore.php';
require_once __DIR__ . '/../agent/Enrichment/EnrichmentData.php';
require_once __DIR__ . '/../agent/Enrichment/WebSearchEnricher.php';

use Agent\LLM\Streaming\StreamingFieldDetector;
use Agent\Enrichment\WebSearchEnricher;

class EnrichmentStreamingTest
{
    private static int $passed = 0;
    private static int $failed = 0;

    public static function run(): void
    {
        echo "Running Enrichment Streaming tests...\n\n";

        self::testDetectorWithEnrichmentFields();
        self::testDetectorCompleteJson();
        self::testEnrichmentSchema();
        self::testStreamingPrompt();
        self::testStreamingPromptNV();

        echo "\n" . str_repeat('=', 50) . "\n";
        echo "Results: " . self::$passed . " passed, " . self::$failed . " failed\n";
        exit(self::$failed > 0 ? 1 : 0);
    }

    private static function testDetectorWithEnrichmentFields(): void
    {
        echo "Testing StreamingFieldDetector with enrichment fields...\n";

        $detector = new StreamingFieldDetector();
        $detector->setTargetFields(['body', 'tannin', 'grapeVarieties', 'drinkWindow', 'criticScores']);

        $emitted = [];
        $onField = function ($field, $value) use (&$emitted) {
            $emitted[$field] = $value;
        };

        // Feed JSON in chunks (simulating streaming)
        $detector->processChunk('{"body": "Full', $onField);
        self::assert(empty($emitted), 'No fields emitted yet (string incomplete)');

        $detector->processChunk('-bodied", "tannin": "High",', $onField);
        self::assert(
            isset($emitted['body']) && $emitted['body'] === 'Full-bodied',
            'body field emitted correctly',
            'Got: ' . ($emitted['body'] ?? 'null')
        );
        self::assert(
            isset($emitted['tannin']) && $emitted['tannin'] === 'High',
            'tannin field emitted correctly',
            'Got: ' . ($emitted['tannin'] ?? 'null')
        );

        // Complex array field
        $detector->processChunk(' "grapeVarieties": [{"grape": "Cabernet Sauvignon", "percentage": 75}, {"grape": "Merlot", "percentage": 25}],', $onField);
        self::assert(isset($emitted['grapeVarieties']), 'grapeVarieties array emitted');
        self::assert(
            count($emitted['grapeVarieties']) === 2,
            'grapeVarieties has 2 items',
            'Got: ' . count($emitted['grapeVarieties'] ?? [])
        );
        self::assert(
            $emitted['grapeVarieties'][0]['grape'] === 'Cabernet Sauvignon',
            'First grape is Cabernet Sauvignon',
            'Got: ' . ($emitted['grapeVarieties'][0]['grape'] ?? 'null')
        );
        self::assert(
            $emitted['grapeVarieties'][1]['percentage'] === 25,
            'Second grape percentage is 25',
            'Got: ' . var_export($emitted['grapeVarieties'][1]['percentage'] ?? null, true)
        );

        // Complex object field
        $detector->processChunk(' "drinkWindow": {"start": 2025, "end": 2045, "maturity": "young"},', $onField);
        self::assert(isset($emitted['drinkWindow']), 'drinkWindow object emitted');
        self::assert(
            $emitted['drinkWindow']['start'] === 2025,
            'drinkWindow start is 2025',
            'Got: ' . var_export($emitted['drinkWindow']['start'] ?? null, true)
        );
        self::assert(
            $emitted['drinkWindow']['end'] === 2045,
            'drinkWindow end is 2045',
            'Got: ' . var_export($emitted['drinkWindow']['end'] ?? null, true)
        );
        self::assert(
            $emitted['drinkWindow']['maturity'] === 'young',
            'drinkWindow maturity is young',
            'Got: ' . ($emitted['drinkWindow']['maturity'] ?? 'null')
        );

        // Array of objects
        $detector->processChunk(' "criticScores": [{"critic": "WS", "score": 95, "year": 2023}]}', $onField);
        self::assert(isset($emitted['criticScores']), 'criticScores emitted');
        self::assert(
            $emitted['criticScores'][0]['critic'] === 'WS',
            'criticScore critic is WS',
            'Got: ' . ($emitted['criticScores'][0]['critic'] ?? 'null')
        );
        self::assert(
            $emitted['criticScores'][0]['score'] === 95,
            'criticScore score is 95',
            'Got: ' . var_export($emitted['criticScores'][0]['score'] ?? null, true)
        );

        // Verify all 5 target fields emitted
        self::assert(
            count($emitted) === 5,
            'All 5 target fields emitted',
            'Got: ' . count($emitted) . ' (' . implode(', ', array_keys($emitted)) . ')'
        );

        echo "\n";
    }

    private static function testDetectorCompleteJson(): void
    {
        echo "Testing StreamingFieldDetector tryParseComplete with enrichment data...\n";

        $detector = new StreamingFieldDetector();
        $detector->setTargetFields(['body', 'overview']);

        $emitted = [];
        $onField = function ($field, $value) use (&$emitted) {
            $emitted[$field] = $value;
        };

        $json = '{"body": "Medium", "overview": "A fine wine.", "tannin": "Soft"}';
        $detector->processChunk($json, $onField);

        // Only target fields should be emitted
        self::assert(isset($emitted['body']), 'Target field body emitted');
        self::assert(isset($emitted['overview']), 'Target field overview emitted');
        self::assert(!isset($emitted['tannin']), 'Non-target field tannin NOT emitted');
        self::assert(
            count($emitted) === 2,
            'Only 2 target fields emitted',
            'Got: ' . count($emitted)
        );

        // tryParseComplete should return full JSON including non-target fields
        $complete = $detector->tryParseComplete();
        self::assert($complete !== null, 'Complete JSON parseable');
        self::assert(
            $complete['tannin'] === 'Soft',
            'Non-target field tannin still in complete JSON',
            'Got: ' . ($complete['tannin'] ?? 'null')
        );
        self::assert(
            $complete['body'] === 'Medium',
            'Target field body in complete JSON',
            'Got: ' . ($complete['body'] ?? 'null')
        );

        echo "\n";
    }

    private static function testEnrichmentSchema(): void
    {
        echo "Testing WebSearchEnricher enrichment schema structure...\n";

        // Use reflection to access private method
        $reflection = new \ReflectionMethod(WebSearchEnricher::class, 'getEnrichmentSchema');
        $reflection->setAccessible(true);

        // Create instance without constructor (we only need the schema, not LLM calls)
        $enricher = (new \ReflectionClass(WebSearchEnricher::class))->newInstanceWithoutConstructor();

        $schema = $reflection->invoke($enricher);

        self::assert($schema['type'] === 'object', 'Schema type is object');
        self::assert(isset($schema['properties']), 'Schema has properties');

        $expectedFields = [
            'grapeVarieties', 'appellation', 'alcoholContent', 'drinkWindow',
            'criticScores', 'productionMethod', 'body', 'tannin', 'acidity',
            'sweetness', 'overview', 'tastingNotes', 'pairingNotes',
        ];

        foreach ($expectedFields as $field) {
            self::assert(
                isset($schema['properties'][$field]),
                "Schema has field: {$field}"
            );
        }

        // Check field types (lowercase for REST API) and nullable flag
        self::assert(
            $schema['properties']['grapeVarieties']['type'] === 'array',
            'grapeVarieties is array',
            'Got: ' . json_encode($schema['properties']['grapeVarieties']['type'] ?? 'missing')
        );
        self::assert(
            ($schema['properties']['grapeVarieties']['nullable'] ?? false) === true,
            'grapeVarieties is nullable'
        );
        self::assert(
            $schema['properties']['drinkWindow']['type'] === 'object',
            'drinkWindow is object',
            'Got: ' . json_encode($schema['properties']['drinkWindow']['type'] ?? 'missing')
        );
        self::assert(
            $schema['properties']['criticScores']['type'] === 'array',
            'criticScores is array',
            'Got: ' . json_encode($schema['properties']['criticScores']['type'] ?? 'missing')
        );
        self::assert(
            $schema['properties']['body']['type'] === 'string',
            'body is string',
            'Got: ' . json_encode($schema['properties']['body']['type'] ?? 'missing')
        );
        self::assert(
            ($schema['properties']['body']['nullable'] ?? false) === true,
            'body is nullable'
        );
        self::assert(
            $schema['properties']['alcoholContent']['type'] === 'number',
            'alcoholContent is number',
            'Got: ' . json_encode($schema['properties']['alcoholContent']['type'] ?? 'missing')
        );

        // Check propertyOrdering on root schema
        self::assert(
            isset($schema['propertyOrdering']),
            'Schema has propertyOrdering'
        );
        self::assert(
            $schema['propertyOrdering'][0] === 'body',
            'propertyOrdering starts with body',
            'Got: ' . ($schema['propertyOrdering'][0] ?? 'missing')
        );

        // Check nested structure
        self::assert(
            isset($schema['properties']['grapeVarieties']['items']['properties']['grape']),
            'grapeVarieties items have grape property'
        );
        self::assert(
            isset($schema['properties']['grapeVarieties']['items']['propertyOrdering']),
            'grapeVarieties items have propertyOrdering'
        );
        self::assert(
            isset($schema['properties']['drinkWindow']['properties']['start']),
            'drinkWindow has start property'
        );
        self::assert(
            isset($schema['properties']['drinkWindow']['propertyOrdering']),
            'drinkWindow has propertyOrdering'
        );
        self::assert(
            isset($schema['properties']['drinkWindow']['properties']['maturity']),
            'drinkWindow has maturity property'
        );
        self::assert(
            isset($schema['properties']['criticScores']['items']['properties']['score']),
            'criticScores items have score property'
        );
        self::assert(
            isset($schema['properties']['criticScores']['items']['propertyOrdering']),
            'criticScores items have propertyOrdering'
        );

        echo "\n";
    }

    private static function testStreamingPrompt(): void
    {
        echo "Testing WebSearchEnricher streaming prompt generation...\n";

        $reflection = new \ReflectionMethod(WebSearchEnricher::class, 'buildStreamingPrompt');
        $reflection->setAccessible(true);

        $enricher = (new \ReflectionClass(WebSearchEnricher::class))->newInstanceWithoutConstructor();

        $prompt = $reflection->invoke($enricher, 'Chateau Margaux', 'Grand Vin', '2015');

        self::assert(
            str_contains($prompt, 'Chateau Margaux'),
            'Prompt contains producer',
            'Producer not found in prompt'
        );
        self::assert(
            str_contains($prompt, 'Grand Vin'),
            'Prompt contains wine name',
            'Wine name not found in prompt'
        );
        self::assert(
            str_contains($prompt, '2015'),
            'Prompt contains vintage',
            'Vintage not found in prompt'
        );
        self::assert(
            str_contains($prompt, 'grapeVarieties'),
            'Prompt mentions grapeVarieties'
        );
        self::assert(
            str_contains($prompt, 'criticScores'),
            'Prompt mentions criticScores'
        );
        self::assert(
            str_contains($prompt, 'drinkWindow'),
            'Prompt mentions drinkWindow'
        );
        self::assert(
            str_contains($prompt, 'tastingNotes'),
            'Prompt mentions tastingNotes'
        );
        self::assert(
            strlen($prompt) < 800,
            'Prompt is slimmed (' . strlen($prompt) . ' chars < 800)'
        );

        echo "\n";
    }

    private static function testStreamingPromptNV(): void
    {
        echo "Testing WebSearchEnricher streaming prompt with null vintage...\n";

        $reflection = new \ReflectionMethod(WebSearchEnricher::class, 'buildStreamingPrompt');
        $reflection->setAccessible(true);

        $enricher = (new \ReflectionClass(WebSearchEnricher::class))->newInstanceWithoutConstructor();

        $promptNV = $reflection->invoke($enricher, 'Veuve Clicquot', 'Yellow Label', null);
        self::assert(
            str_contains($promptNV, 'NV'),
            'Null vintage becomes NV in prompt',
            'NV not found in prompt'
        );
        self::assert(
            str_contains($promptNV, 'Veuve Clicquot'),
            'Prompt contains producer'
        );
        self::assert(
            str_contains($promptNV, 'Yellow Label'),
            'Prompt contains wine name'
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
EnrichmentStreamingTest::run();
