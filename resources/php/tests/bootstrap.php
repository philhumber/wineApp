<?php
/**
 * PHPUnit Bootstrap File
 *
 * Sets up the test environment for PHP backend tests.
 */

declare(strict_types=1);

// Load Composer autoloader if it exists
$autoloader = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoloader)) {
    require_once $autoloader;
}

// Define test constants
define('TEST_MODE', true);

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Timezone
date_default_timezone_set('UTC');
