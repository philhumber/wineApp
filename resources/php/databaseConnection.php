<?php
    /**
     * Database configuration and connection
     */

    // Load config from outside web root
    $configPath = __DIR__ . '/../../wineapp-config/config.local.php';
    if (!file_exists($configPath)) {
        throw new Exception('Config file not found. See config.local.php.example for setup instructions.');
    }
    require_once $configPath;

    /**
     * Get a PDO database connection
     * @return PDO
     * @throws PDOException
     */
    function getDBConnection() {
        static $pdo = null;
        
        // Reuse existing connection if available
        if ($pdo !== null) {
            return $pdo;
        }
        
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
            return $pdo;
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed. Please try again later.");
        }
    }
?>