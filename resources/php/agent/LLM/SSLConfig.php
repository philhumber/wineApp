<?php
/**
 * SSL Configuration Helper
 *
 * Provides cross-platform SSL certificate bundle resolution for outbound HTTPS calls.
 * Handles dev (Windows) vs production (Linux) environments automatically.
 *
 * Used by both cURL-based adapters (GeminiAdapter, ClaudeAdapter) and
 * file_get_contents-based calls (geminiAPI.php).
 *
 * WIN-214: SSL verification is ALWAYS enabled. If no CA bundle is found,
 * cURL/PHP will use its compiled-in defaults. This is the secure approach:
 * fail closed rather than silently disabling verification.
 *
 * @package Agent\LLM
 */

namespace Agent\LLM;

class SSLConfig
{
    /** @var string|null|false Cached cert path (null=not checked, false=not found, string=path) */
    private static $cachedCertPath = null;

    /** @var bool Whether we're in dev mode */
    private static ?bool $isDevMode = null;

    /**
     * Get SSL certificate bundle path for the current environment
     *
     * Checks config override first, then OS-specific standard paths,
     * then PHP ini settings.
     *
     * @return string|null Path to CA certificate bundle, or null if not found
     */
    public static function getCertPath(): ?string
    {
        if (self::$cachedCertPath !== null) {
            return self::$cachedCertPath ?: null;
        }

        // 1. Check config override (SSL_CA_BUNDLE in config.local.php)
        if (\defined('SSL_CA_BUNDLE') && SSL_CA_BUNDLE && \file_exists(SSL_CA_BUNDLE)) {
            self::$cachedCertPath = SSL_CA_BUNDLE;
            return self::$cachedCertPath;
        }

        // 2. Check PHP ini settings (often configured correctly by sysadmin)
        $iniPaths = [
            \ini_get('curl.cainfo'),
            \ini_get('openssl.cafile'),
        ];

        foreach ($iniPaths as $path) {
            if ($path && \file_exists($path)) {
                self::$cachedCertPath = $path;
                return self::$cachedCertPath;
            }
        }

        // 3. Check OS-specific standard locations
        $osPaths = self::isWindows()
            ? self::getWindowsCertPaths()
            : self::getLinuxCertPaths();

        foreach ($osPaths as $path) {
            if ($path && \file_exists($path)) {
                self::$cachedCertPath = $path;
                return self::$cachedCertPath;
            }
        }

        // Not found
        self::$cachedCertPath = false;
        return null;
    }

    /**
     * Get cURL SSL options array
     *
     * Returns the appropriate CURLOPT settings for SSL verification.
     * WIN-214: SSL verification is always enabled. If no explicit cert path
     * is found, cURL will use its compiled-in/system defaults.
     *
     * @return array cURL options for SSL configuration
     */
    public static function getCurlOptions(): array
    {
        $certPath = self::getCertPath();

        $options = [
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];

        if ($certPath) {
            $options[CURLOPT_CAINFO] = $certPath;
        } else {
            // No explicit CA bundle found - cURL will use system/compiled-in defaults
            \error_log('[SSLConfig] No explicit CA bundle found. Relying on system defaults for SSL verification.');
        }

        return $options;
    }

    /**
     * Get stream context SSL options for file_get_contents
     *
     * Returns the appropriate ssl context options for stream_context_create.
     * WIN-214: SSL verification is always enabled. If no explicit cert path
     * is found, PHP will use its system defaults.
     *
     * @return array SSL context options
     */
    public static function getStreamContextOptions(): array
    {
        $certPath = self::getCertPath();

        $options = [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ];

        if ($certPath) {
            $options['cafile'] = $certPath;
        } else {
            // No explicit CA bundle found - PHP will use system defaults
            \error_log('[SSLConfig] No explicit CA bundle found for stream context. Relying on system defaults for SSL verification.');
        }

        return $options;
    }

    /**
     * Check if current environment is dev mode
     *
     * Dev mode is determined by APP_ENV constant (set in config.local.php).
     * Defaults to true (safe fallback) if not configured.
     *
     * @return bool True if running in dev/test mode
     */
    public static function isDevMode(): bool
    {
        if (self::$isDevMode !== null) {
            return self::$isDevMode;
        }

        // APP_ENV is defined in config.local.php: 'test' or 'prod'
        if (\defined('APP_ENV')) {
            self::$isDevMode = (APP_ENV !== 'prod');
        } else {
            // If not defined, assume dev mode (safe fallback)
            self::$isDevMode = true;
        }

        return self::$isDevMode;
    }

    /**
     * Check if running on Windows
     *
     * @return bool True if Windows
     */
    public static function isWindows(): bool
    {
        return PHP_OS_FAMILY === 'Windows' || \stripos(PHP_OS, 'WIN') === 0;
    }

    /**
     * Get standard Linux certificate bundle paths
     *
     * @return array List of paths to check
     */
    private static function getLinuxCertPaths(): array
    {
        return [
            // Debian/Ubuntu
            '/etc/ssl/certs/ca-certificates.crt',
            // RHEL/CentOS/Fedora
            '/etc/pki/tls/certs/ca-bundle.crt',
            // OpenSUSE
            '/etc/ssl/ca-bundle.pem',
            // Alpine
            '/etc/ssl/cert.pem',
            // Common fallback
            '/usr/local/share/ca-certificates/cacert.pem',
            '/usr/share/ssl/certs/ca-bundle.crt',
        ];
    }

    /**
     * Get standard Windows certificate bundle paths
     *
     * @return array List of paths to check
     */
    private static function getWindowsCertPaths(): array
    {
        return [
            // Project-local cert in wineapp-config (dev convenience)
            __DIR__ . '/../../../../../wineapp-config/cacert.pem',
            // Common PHP installation locations
            'C:/php/extras/ssl/cacert.pem',
            'C:/Program Files/php/extras/ssl/cacert.pem',
            // XAMPP
            'C:/xampp/php/extras/ssl/cacert.pem',
            // Laragon
            'C:/laragon/etc/ssl/cacert.pem',
        ];
    }

    /**
     * Validate SSL configuration and return diagnostic info
     *
     * Useful for deploy-time checks and debugging.
     *
     * @return array Diagnostic information
     */
    public static function diagnose(): array
    {
        $certPath = self::getCertPath();

        return [
            'os' => PHP_OS_FAMILY,
            'dev_mode' => self::isDevMode(),
            'cert_path' => $certPath,
            'cert_found' => $certPath !== null,
            'cert_readable' => $certPath ? \is_readable($certPath) : false,
            'cert_size' => $certPath && \file_exists($certPath) ? \filesize($certPath) : 0,
            'curl_cainfo' => \ini_get('curl.cainfo') ?: '(not set)',
            'openssl_cafile' => \ini_get('openssl.cafile') ?: '(not set)',
            'openssl_loaded' => \extension_loaded('openssl'),
            'curl_loaded' => \extension_loaded('curl'),
            'app_env' => \defined('APP_ENV') ? APP_ENV : '(not defined)',
        ];
    }

    /**
     * Reset cached values (for testing)
     *
     * @return void
     */
    public static function resetCache(): void
    {
        self::$cachedCertPath = null;
        self::$isDevMode = null;
    }
}
