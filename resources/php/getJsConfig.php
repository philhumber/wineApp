<?php
/**
 * Serves configuration to JavaScript
 * Only exposes frontend-safe values (API keys, not DB credentials)
 */
header('Content-Type: application/javascript');
header('Cache-Control: no-store'); // Don't cache credentials

// Load from outside web root (sibling directory to wineapp)
$configPath = __DIR__ . '/../../../wineapp-config/config.local.php';

if (!file_exists($configPath)) {
    // Fallback for development - warn developer
    echo "console.warn('Config not found. Copy config.local.php.example to ../wineapp-config/config.local.php');\n";
    echo "window.WINE_APP_CONFIG = { geminiApiKey: '' };\n";
    exit;
}

require_once $configPath;

echo "window.WINE_APP_CONFIG = {\n";
echo "    geminiApiKey: \"" . (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '') . "\",\n";
echo "    environment: \"" . (defined('APP_ENV') ? APP_ENV : 'prod') . "\"\n";
echo "};\n";
?>
