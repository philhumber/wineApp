<?php
/**
 * Unit tests for StreamingFieldDetector
 *
 * Run: php resources/php/tests/StreamingFieldDetectorTest.php
 */

require_once __DIR__ . '/../agent/LLM/Streaming/StreamingFieldDetector.php';

use Agent\LLM\Streaming\StreamingFieldDetector;

class StreamingFieldDetectorTest
{
    private static int $passed = 0;
    private static int $failed = 0;

    public static function run(): void
    {
        echo "Running StreamingFieldDetector tests...\n\n";

        self::testStringFieldDetection();
        self::testNumberFieldDetection();
        self::testNullFieldDetection();
        self::testArrayFieldDetection();
        self::testBooleanFieldDetection();
        self::testPartialStringNotEmitted();
        self::testPartialArrayNotEmitted();
        self::testMultipleFieldsProgressively();
        self::testDuplicateFieldIgnored();
        self::testReset();
        self::testTryParseComplete();
        self::testSetTargetFields();
        self::testEscapedQuotesInString();

        echo "\n" . str_repeat('=', 50) . "\n";
        echo "Results: " . self::$passed . " passed, " . self::$failed . " failed\n";
        exit(self::$failed > 0 ? 1 : 0);
    }

    private static function testStringFieldDetection(): void
    {
        echo "Testing string field detection...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        // Feed chunk by chunk
        $detector->processChunk('{"pro', $callback);
        self::assert(empty($detected), 'No detection on partial field name');

        $detector->processChunk('ducer": "Ch', $callback);
        self::assert(empty($detected), 'No detection on partial string value');

        $detector->processChunk('ateau Margaux",', $callback);
        self::assert(
            isset($detected['producer']) && $detected['producer'] === "Chateau Margaux",
            'String field detected with correct value "Chateau Margaux"',
            'Got: ' . ($detected['producer'] ?? 'null')
        );

        echo "\n";
    }

    private static function testNumberFieldDetection(): void
    {
        echo "Testing number field detection...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"vintage": 2020,', $callback);
        self::assert(
            isset($detected['vintage']) && $detected['vintage'] === 2020,
            'Integer field detected with value 2020',
            'Got: ' . var_export($detected['vintage'] ?? null, true)
        );

        self::assert(
            is_int($detected['vintage'] ?? null),
            'Vintage value is integer type',
            'Got type: ' . gettype($detected['vintage'] ?? null)
        );

        echo "\n";
    }

    private static function testNullFieldDetection(): void
    {
        echo "Testing null field detection...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"vintage": null,', $callback);
        self::assert(
            !isset($detected['vintage']),
            'Null field NOT added to detected fields'
        );

        self::assert(
            !$detector->hasField('vintage'),
            'hasField() returns false for null field'
        );

        echo "\n";
    }

    private static function testArrayFieldDetection(): void
    {
        echo "Testing array field detection...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"grapes": ["Merlot", "Cabernet Sauvignon"],', $callback);
        self::assert(
            isset($detected['grapes']) && is_array($detected['grapes']),
            'Array field detected'
        );

        self::assert(
            $detected['grapes'] === ['Merlot', 'Cabernet Sauvignon'],
            'Array contains correct values',
            'Got: ' . json_encode($detected['grapes'] ?? null)
        );

        echo "\n";
    }

    private static function testBooleanFieldDetection(): void
    {
        echo "Testing boolean field detection...\n";

        $detector = new StreamingFieldDetector();
        $detector->setTargetFields(['organic', 'biodynamic']);
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"organic": true, "biodynamic": false,', $callback);
        self::assert(
            isset($detected['organic']) && $detected['organic'] === true,
            'Boolean true detected',
            'Got: ' . var_export($detected['organic'] ?? null, true)
        );

        self::assert(
            isset($detected['biodynamic']) && $detected['biodynamic'] === false,
            'Boolean false detected',
            'Got: ' . var_export($detected['biodynamic'] ?? null, true)
        );

        echo "\n";
    }

    private static function testPartialStringNotEmitted(): void
    {
        echo "Testing partial string not emitted...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        // No closing quote
        $detector->processChunk('{"producer": "Chate', $callback);
        self::assert(
            empty($detected),
            'No callback fired for incomplete string value'
        );

        self::assert(
            !$detector->hasField('producer'),
            'hasField() returns false for incomplete string'
        );

        echo "\n";
    }

    private static function testPartialArrayNotEmitted(): void
    {
        echo "Testing partial array not emitted...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        // No closing bracket
        $detector->processChunk('{"grapes": ["Merlot"', $callback);
        self::assert(
            empty($detected),
            'No callback fired for incomplete array value'
        );

        self::assert(
            !$detector->hasField('grapes'),
            'hasField() returns false for incomplete array'
        );

        echo "\n";
    }

    private static function testMultipleFieldsProgressively(): void
    {
        echo "Testing multiple fields detected progressively...\n";

        $detector = new StreamingFieldDetector();
        $order = [];
        $callback = function (string $field, mixed $value) use (&$order) {
            $order[] = $field;
        };

        // Chunk 1: producer completes
        $detector->processChunk('{"producer": "Opus One", ', $callback);
        self::assert(
            $order === ['producer'],
            'After chunk 1: only producer detected',
            'Got: ' . json_encode($order)
        );

        // Chunk 2: wineName completes
        $detector->processChunk('"wineName": "Opus One", ', $callback);
        self::assert(
            $order === ['producer', 'wineName'],
            'After chunk 2: producer + wineName detected',
            'Got: ' . json_encode($order)
        );

        // Chunk 3: vintage completes
        $detector->processChunk('"vintage": 2018,', $callback);
        self::assert(
            $order === ['producer', 'wineName', 'vintage'],
            'After chunk 3: producer + wineName + vintage detected',
            'Got: ' . json_encode($order)
        );

        echo "\n";
    }

    private static function testDuplicateFieldIgnored(): void
    {
        echo "Testing duplicate field ignored...\n";

        $detector = new StreamingFieldDetector();
        $callCount = 0;
        $callback = function (string $field, mixed $value) use (&$callCount) {
            if ($field === 'producer') {
                $callCount++;
            }
        };

        $detector->processChunk('{"producer": "Opus One", ', $callback);
        self::assert($callCount === 1, 'Callback fired once for producer');

        // Feed more data that includes the already-detected field context
        $detector->processChunk('"wineName": "Reserve", ', $callback);
        self::assert(
            $callCount === 1,
            'Callback NOT fired again for already-detected producer',
            "Call count: $callCount"
        );

        echo "\n";
    }

    private static function testReset(): void
    {
        echo "Testing reset...\n";

        $detector = new StreamingFieldDetector();
        $callback = function (string $field, mixed $value) {};

        $detector->processChunk('{"producer": "Test", "vintage": 2020,', $callback);
        self::assert(
            count($detector->getCompletedFields()) === 2,
            'Two fields detected before reset'
        );

        $detector->reset();
        self::assert(
            count($detector->getCompletedFields()) === 0,
            'getCompletedFields() empty after reset'
        );

        self::assert(
            !$detector->hasField('producer'),
            'hasField() returns false after reset'
        );

        echo "\n";
    }

    private static function testTryParseComplete(): void
    {
        echo "Testing tryParseComplete...\n";

        // Complete JSON
        $detector = new StreamingFieldDetector();
        $callback = function (string $field, mixed $value) {};

        $detector->processChunk('{"producer": "Test", "vintage": 2020}', $callback);
        $result = $detector->tryParseComplete();
        self::assert(
            $result !== null && $result['producer'] === 'Test' && $result['vintage'] === 2020,
            'tryParseComplete() returns parsed array for complete JSON',
            'Got: ' . var_export($result, true)
        );

        // Partial JSON
        $detector2 = new StreamingFieldDetector();
        $detector2->processChunk('{"producer": "Test", "vint', $callback);
        $result2 = $detector2->tryParseComplete();
        self::assert(
            $result2 === null,
            'tryParseComplete() returns null for partial JSON'
        );

        echo "\n";
    }

    private static function testSetTargetFields(): void
    {
        echo "Testing setTargetFields...\n";

        $detector = new StreamingFieldDetector();
        $detector->setTargetFields(['producer', 'vintage']);
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"producer": "Test", "wineName": "Reserve", "vintage": 2020, "region": "Napa",', $callback);

        self::assert(
            isset($detected['producer']),
            'Target field "producer" detected'
        );

        self::assert(
            isset($detected['vintage']),
            'Target field "vintage" detected'
        );

        self::assert(
            !isset($detected['wineName']),
            'Non-target field "wineName" NOT detected'
        );

        self::assert(
            !isset($detected['region']),
            'Non-target field "region" NOT detected'
        );

        self::assert(
            count($detected) === 2,
            'Only 2 target fields detected',
            'Got: ' . count($detected)
        );

        echo "\n";
    }

    private static function testEscapedQuotesInString(): void
    {
        echo "Testing escaped quotes in string...\n";

        $detector = new StreamingFieldDetector();
        $detected = [];
        $callback = function (string $field, mixed $value) use (&$detected) {
            $detected[$field] = $value;
        };

        $detector->processChunk('{"producer": "Domaine d\'Auvenay",', $callback);
        self::assert(
            isset($detected['producer']) && $detected['producer'] === "Domaine d'Auvenay",
            'Escaped quote extracted correctly as "Domaine d\'Auvenay"',
            'Got: ' . ($detected['producer'] ?? 'null')
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
StreamingFieldDetectorTest::run();
