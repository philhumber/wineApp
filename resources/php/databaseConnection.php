<?php
    /**
     * Database configuration and connection
     */

    // Database credentials
    define('DB_HOST', '10.0.0.16');
    define('DB_NAME', 'winelist');
    define('DB_USER', 'webuser');
    define('DB_PASS', 'sqlserver');

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