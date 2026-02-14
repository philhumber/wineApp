# WIN-243: Frontend Error Tracking via Custom PHP Logging Endpoint

**Status**: Planned (deep-dive reviewed, ready to implement)
**Date**: 2026-02-14

## Changes from Original

1. **[REVISED] Double-reporting strategy**: `fetchJSON` and streaming methods re-throw errors that bubble to `hooks.client.ts`. Both levels report, but dedup (keyed by `message+url`) naturally catches the second report. First report from `client.ts` preserves granular `api:<endpoint>` context.
2. **[NEW] Agent middleware coverage**: `errorHandler.ts` catches and swallows errors (does NOT re-throw) — agent errors were completely invisible server-side. Added as 5th touch point in `client.ts` section.
3. **[REVISED] Streaming method catch blocks**: Inner catch blocks at lines 973/1089/1227 only cover `!response.ok` parsing errors. Wrapping entire method bodies in try-catch catches network errors, SSE parsing errors, and pre-response failures too.
4. **[REVISED] AbortError filter**: `includes('aborted')` was too broad — would suppress legitimate errors. Changed to exact matches against known fetch abort messages.
5. **[REVISED] Line numbers**: `handleError` insertion is line 20 (after multi-line `console.error` block), not line 14. `unhandledrejection` insertion is after line 35.
6. **[REVISED] PHP response**: Added `Content-Type: application/json` header and `message` field to match standard endpoint response pattern.
7. **[REVISED] ErrorReport interface**: Added optional `url` parameter so `handleError` can pass `event.url.pathname` (correct page) instead of relying on `window.location.pathname` (may reflect new page during navigation).
8. **[REVISED] PHP null handling**: Strip null bytes from raw body before `json_decode()`, not after. Added `is_array()` check for `json_decode()` null return.
9. **[REVISED] Rate limit**: Specified lazy reset mechanism (check elapsed time on each call).
10. **[REVISED] Dedup overflow**: Specified eviction algorithm (Map insertion order, delete first key).
11. **[NEW] supportRef extraction**: `hooks.client.ts` now extracts `supportRef` from AgentError instances for log correlation.
12. **[NEW] PHP truncation marker**: Appends `...[truncated]` when fields are truncated.
13. **[NEW] User-Agent truncation**: Caps at 500 chars to prevent log bloat from malicious clients.
14. **[NEW] PHP catch block logging**: Logs its own exceptions before returning success, so reporter failures aren't invisible.
15. **[NEW] Verification expanded**: Added agent error, AbortError suppression, supportRef, and keepalive-during-navigation test cases.

---

## Context
The app has proper error boundaries and agent error handling, but all frontend errors only go to `console.error()`. In production, these are invisible. This adds a lightweight error reporter that sends frontend errors to the PHP server log — the same `error_log()` used by all other PHP endpoints — so they can be grepped alongside backend errors.

---

## Plan

### 1. Backend: Create `resources/php/logError.php`

New endpoint following standard conventions.

**Includes:**
```php
require_once 'securityHeaders.php';  // CORS, auth (API key), CSRF, security headers
```

No `databaseConnection.php`, `audit_log.php`, or `errorHandler.php` needed — log-only.

**Method check:** Return success for non-POST requests. (OPTIONS preflight is handled by `securityHeaders.php` before this runs, but this provides defense-in-depth for other HTTP methods like GET.)

```php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
    exit;
}
```

**Input (POST JSON):**
```json
{
  "message": "TypeError: Cannot read properties of null",
  "stack": "at fetchJSON (client.ts:161)\n...",
  "url": "/qve/history",
  "context": "api:getWines",
  "supportRef": "ERR-A1B2C3D4"
}
```

**Body parsing** (entire body wrapped in try-catch):
```php
try {
    $rawInput = @file_get_contents('php://input');
    if ($rawInput === false) $rawInput = '';

    // Strip null bytes BEFORE json_decode — corrupted bytes can break parsing
    $rawInput = str_replace("\x00", '', $rawInput);

    $data = json_decode($rawInput, true);

    // json_decode returns null for empty/malformed input
    if (!is_array($data)) {
        // Log what we can of malformed input, then exit
        error_log('[Frontend Error] Malformed JSON: ' . mb_substr($rawInput, 0, 200, 'UTF-8'));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
        exit;
    }

    // ... validation and logging below ...

} catch (Exception $e) {
    error_log('[logError.php] Exception: ' . $e->getMessage());
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
    exit;
}
```

**Validation** (inline, not using `validators.php` — truncate, never reject):
```php
// Helper: truncate with marker
function truncateField($value, $maxLen) {
    if (!is_string($value)) return '';
    if (mb_strlen($value, 'UTF-8') > $maxLen) {
        return mb_substr($value, 0, $maxLen, 'UTF-8') . '...[truncated]';
    }
    return $value;
}

$message    = truncateField($data['message'] ?? '', 1000);
$stack      = truncateField($data['stack'] ?? '', 5000);
$url        = truncateField($data['url'] ?? '', 500);
$context    = truncateField($data['context'] ?? '', 200);
$supportRef = truncateField($data['supportRef'] ?? '', 20);
$userAgent  = truncateField($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 500);
```

Skip logging if no message:
```php
if ($message === '') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'OK', 'data' => null]);
    exit;
}
```

**Logging format** (follows same structural pattern as `agentLogError()` in `_bootstrap.php`, with `[Frontend Error]` prefix to distinguish client-side errors):
```php
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

// Log stack trace separately (keeps main line greppable)
if ($stack !== '') {
    error_log("[Frontend Error] Stack: {$stack}");
}
```

**Response:** Always success.
```php
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Error logged', 'data' => null]);
```

---

### 2. Frontend: Create `qve/src/lib/utils/errorReporter.ts`

Lightweight utility, no store dependencies, no imports from `$lib/stores`.

**Signature:**
```typescript
export interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;       // Override for window.location.pathname
  context?: string;
  supportRef?: string;
}
export function reportError(report: ErrorReport): void
```

**Transport:** `fetch()` with `keepalive: true` (64KB payload limit). Fire-and-forget — `.catch(() => {})` silences failures.
```typescript
import { PUBLIC_API_KEY } from '$env/static/public';

const DEDUP_WINDOW_MS = 60_000;
const MAX_DEDUP_ENTRIES = 20;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const dedupMap = new Map<string, number>();  // fingerprint → timestamp
let rateLimitCount = 0;
let rateLimitWindowStart = Date.now();

export function reportError(report: ErrorReport): void {
  // Guard 1: AbortError filter — exact matches only
  if (isAbortError(report.message)) return;

  const url = report.url || window.location.pathname;
  const fingerprint = `${report.message}|${url}`;

  // Guard 2: Dedup — skip if same fingerprint reported recently
  const now = Date.now();

  // Lazy cleanup: remove stale entries
  for (const [key, timestamp] of dedupMap.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      dedupMap.delete(key);
    }
  }

  // Check for existing fresh entry
  if (dedupMap.has(fingerprint)) return;

  // Size-based eviction: Map iteration order = insertion order
  if (dedupMap.size >= MAX_DEDUP_ENTRIES) {
    const oldestKey = dedupMap.keys().next().value;
    if (oldestKey) dedupMap.delete(oldestKey);
  }

  dedupMap.set(fingerprint, now);

  // Guard 3: Rate limit — lazy reset
  if (now - rateLimitWindowStart > RATE_WINDOW_MS) {
    rateLimitCount = 0;
    rateLimitWindowStart = now;
  }
  if (rateLimitCount >= RATE_LIMIT) return;
  rateLimitCount++;

  // Send
  const payload = {
    message: report.message,
    stack: report.stack,
    url,
    context: report.context,
    supportRef: report.supportRef
  };

  fetch('/resources/php/logError.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PUBLIC_API_KEY,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

function isAbortError(message: string): boolean {
  return (
    message === 'AbortError' ||
    message === 'The user aborted a request.' ||
    message === 'The operation was aborted.' ||
    message === 'The operation was aborted' ||
    message.includes('signal is aborted without reason')
  );
}
```

**Double-reporting note:** `fetchJSON` and streaming methods re-throw errors that bubble to `hooks.client.ts`. Both levels call `reportError()`. The dedup guard (keyed by `message + url`) catches the second report because the message and URL are identical — only the `context` differs. The first report (from `client.ts`) wins and preserves the more specific `api:<endpoint>` context.

**No SSR guard needed**: Only imported from `hooks.client.ts`, `client.ts`, and `errorHandler.ts` — all client-only. If ever imported server-side, `fetch` and `window` would fail at call time (acceptable since `reportError` is fire-and-forget in try-catch callers).

**Export from barrel**: Add to `qve/src/lib/utils/index.ts`:
```typescript
export { reportError, type ErrorReport } from './errorReporter';
```

---

### 3. Frontend: Hook into existing error handlers

**File: `qve/src/hooks.client.ts`** — 2 touch points:

Add import at top: `import { reportError } from '$lib/utils/errorReporter';`

1. **`handleError` hook** (line 20, after multi-line `console.error` block, before `return`):
   ```typescript
   // WIN-243: Report frontend errors
   reportError({
     message: err.message,
     stack: err?.stack,
     url: event.url?.pathname,
     context: `sveltekit:${status}`,
     supportRef: (err as any).supportRef || undefined
   });
   ```

2. **`unhandledrejection` listener** (after line 35, before the closing `});`):
   ```typescript
   // WIN-243: Report frontend errors
   reportError({
     message: String(event.reason),
     stack: event.reason?.stack,
     context: 'unhandled_rejection',
     supportRef: event.reason?.supportRef || undefined
   });
   ```

**File: `qve/src/lib/api/client.ts`** — 4 touch points:

Add import at top: `import { reportError } from '$lib/utils/errorReporter';`

1. **`fetchJSON` catch** (~line 161, after `console.error`, before `throw`):
   ```typescript
   if (!AgentError.isAgentError(error)) {
     reportError({
       message: (error as Error).message,
       stack: (error as Error).stack,
       context: `api:${endpoint}`
     });
   }
   ```

2. **`identifyTextStream`** (~line 940) — wrap entire method body in try-catch:
   ```typescript
   async identifyTextStream(...): Promise<...> {
     try {
       // ... existing method body ...
     } catch (e) {
       if (!AgentError.isAgentError(e)) {
         reportError({
           message: e instanceof Error ? e.message : String(e),
           stack: e instanceof Error ? e.stack : undefined,
           context: 'api:agent/identifyTextStream'
         });
       }
       throw e;
     }
   }
   ```

3. **`identifyImageStream`** (~line 1050) — same pattern:
   ```typescript
   // Wrap body in try-catch, context: 'api:agent/identifyImageStream'
   ```

4. **`enrichWineStream`** (~line 1192) — same pattern:
   ```typescript
   // Wrap body in try-catch, context: 'api:agent/agentEnrichStream'
   ```

**File: `qve/src/lib/agent/middleware/errorHandler.ts`** — 1 touch point:

Add import: `import { reportError } from '$lib/utils/errorReporter';`

5. **`executeWithErrorHandling` catch** (~line 135, after `console.error`):
   ```typescript
   console.error(`[AgentAction] Error handling ${action.type}:`, error);
   // WIN-243: Report agent errors (middleware catches and swallows — won't reach hooks.client.ts)
   reportError({
     message: error instanceof Error ? error.message : String(error),
     stack: error instanceof Error ? error.stack : undefined,
     context: `agent:${action.type}`
   });
   ```

**Not adding `reportError()` to:**
- Store catch blocks (`wines.ts`, `history.ts`) — API errors are reported by `client.ts` before stores catch the re-thrown error. Non-API store errors (serialization, validation) are rare edge cases — add later if needed.
- Component-level catches — these are handled gracefully with toasts and don't need server logging.

---

### 4. Files Summary

| File | Action | Description |
|------|--------|-------------|
| `resources/php/logError.php` | **CREATE** | ~50 lines. Parse, validate, truncate, sanitize, `error_log()`, respond |
| `qve/src/lib/utils/errorReporter.ts` | **CREATE** | ~70 lines. fetch+keepalive, dedup, rate limit, AbortError filter |
| `qve/src/lib/utils/index.ts` | **MODIFY** | Add `reportError` and `ErrorReport` exports |
| `qve/src/hooks.client.ts` | **MODIFY** | Add import + 2 `reportError()` calls after existing `console.error` |
| `qve/src/lib/api/client.ts` | **MODIFY** | Add import + 1 `reportError()` in `fetchJSON` catch + 3 outer try-catch wraps on streaming methods |
| `qve/src/lib/agent/middleware/errorHandler.ts` | **MODIFY** | Add import + 1 `reportError()` in catch block |

No changes to: `vite.config.ts` (proxy already covers `/resources/php/*`), `securityHeaders.php`, stores.

---

### 5. Verification

**Automated:**
1. `php -l resources/php/logError.php` — PHP syntax check
2. `cd qve && npm run check` — TypeScript/Svelte check (0 errors expected)

**Manual testing:**
3. Open browser console, run `throw new Error('test-error-243')` → check PHP error log for `[Frontend Error] test-error-243`
4. Trigger same error 5x rapidly → verify only 1 appears in log (dedup)
5. Trigger 15 different errors rapidly → verify max 10 in log (rate limit)
6. Test API error: temporarily break a PHP endpoint, trigger it from UI → verify `api:<endpoint>` context in log
7. Test agent error: trigger an agent flow failure → verify `agent:<actionType>` context in log
8. Test AbortError suppression: cancel a streaming request (navigate away during identification) → verify NO error logged
9. Test supportRef correlation: trigger an agent error that produces `ERR-XXXXXXXX` → verify ref appears in frontend error log
10. Test graceful degradation: stop PHP server, trigger error → verify no console errors from the reporter itself
11. Test keepalive during navigation: trigger error, immediately navigate → verify error still logged

---

### Known Limitations
- Auth-failure errors can't self-report (auth is required on the endpoint). Acceptable — PHP's `authMiddleware.php` already logs these server-side.
- Client-side rate limit only — no server-side throttling. Acceptable for internal tool; add IP-based throttling later if needed.
- Dedup fingerprint (`message + url`) may over-deduplicate different errors with identical messages on the same page. Acceptable trade-off — this is what prevents double-reporting when errors bubble from `client.ts` to `hooks.client.ts`.
