<?php
require_once 'securityHeaders.php';

// Non-POST requests: return success (OPTIONS handled by securityHeaders.php)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
    exit;
}

// Helper: truncate with marker
function truncateField($value, $maxLen) {
    if (!is_string($value)) return '';
    if (mb_strlen($value, 'UTF-8') > $maxLen) {
        return mb_substr($value, 0, $maxLen, 'UTF-8') . '...[truncated]';
    }
    return $value;
}

try {
    $rawInput = @file_get_contents('php://input');
    if ($rawInput === false) $rawInput = '';

    // Strip null bytes BEFORE json_decode
    $rawInput = str_replace("\x00", '', $rawInput);

    $data = json_decode($rawInput, true);

    if (!is_array($data)) {
        error_log('[Frontend Error] Malformed JSON: ' . mb_substr($rawInput, 0, 200, 'UTF-8'));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
        exit;
    }

    $message    = truncateField($data['message'] ?? '', 1000);
    $stack      = truncateField($data['stack'] ?? '', 5000);
    $url        = truncateField($data['url'] ?? '', 500);
    $context    = truncateField($data['context'] ?? '', 200);
    $supportRef = truncateField($data['supportRef'] ?? '', 20);
    $userAgent  = truncateField($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 500);

    if ($message === '') {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
        exit;
    }

    $contextJson = json_encode([
        'url' => $url,
        'context' => $context,
        'supportRef' => $supportRef ?: null,
        'userAgent' => $userAgent
    ], JSON_UNESCAPED_UNICODE);
    if ($contextJson === false) {
        $contextJson = '{"error":"json_encode_failed"}';
    }
    error_log("[Frontend Error] {$message} | Context: {$contextJson}");

    if ($stack !== '') {
        error_log("[Frontend Error] Stack: {$stack}");
    }

    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'Error logged', 'data' => null]);

} catch (Exception $e) {
    error_log('[logError.php] Exception: ' . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
    exit;
}
