<?php
/**
 * Audit logging functions
 */

/**
 * Log a change to the audit_log table
 * 
 * @param PDO $pdo Database connection
 * @param string $table Table name that was changed
 * @param int $recordID ID of the record that was changed
 * @param string $action INSERT, UPDATE, or DELETE
 * @param string|null $column Column name (null for INSERT/DELETE)
 * @param mixed $oldValue Old value (null for INSERT)
 * @param mixed $newValue New value (null for DELETE)
 * @param int|null $userID User who made the change
 * @return bool Success status
 */
function logChange($pdo, $table, $recordID, $action, $column = null, $oldValue = null, $newValue = null, $userID = null) {
    try {
        // Serialize arrays to JSON for proper storage
        if (is_array($oldValue)) {
            $oldValue = json_encode($oldValue);
        }
        if (is_array($newValue)) {
            $newValue = json_encode($newValue);
        }

        $stmt = $pdo->prepare("
            INSERT INTO audit_log
            (tableName, recordID, action, columnName, oldValue, newValue, changedBy, ipAddress)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $table,
            $recordID,
            $action,
            $column,
            $oldValue,
            $newValue,
            $userID,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ]);

        return true;
    } catch (PDOException $e) {
        // Log error but don't fail the main operation
        error_log("Audit log failed: " . $e->getMessage());
        return false;
    }
}

/**
 * Log an INSERT operation
 */
function logInsert($pdo, $table, $recordID, $data, $userID = null) {
    foreach ($data as $column => $value) {
        logChange($pdo, $table, $recordID, 'INSERT', $column, null, $value, $userID);
    }
}

/**
 * Log an UPDATE operation by comparing old and new data
 */
function logUpdate($pdo, $table, $recordID, $oldData, $newData, $userID = null) {
    foreach ($newData as $column => $newValue) {
        if (isset($oldData[$column]) && $oldData[$column] != $newValue) {
            logChange($pdo, $table, $recordID, 'UPDATE', $column, $oldData[$column], $newValue, $userID);
        }
    }
}

/**
 * Log a DELETE operation
 */
function logDelete($pdo, $table, $recordID, $oldData, $userID = null) {
    foreach ($oldData as $column => $value) {
        logChange($pdo, $table, $recordID, 'DELETE', $column, $value, null, $userID);
    }
}
?>