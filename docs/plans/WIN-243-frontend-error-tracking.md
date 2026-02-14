# WIN-243: Frontend Error Tracking via Custom PHP Logging Endpoint

**Status**: Planned (deep-dive reviewed, ready to implement)
**Date**: 2026-02-14

## Context
The app has proper error boundaries and agent error handling, but all frontend errors only go to `console.error()`. In production, these are invisible. This adds a lightweight error reporter that sends frontend errors to the PHP server log — the same `error_log()` used by all other PHP endpoints — so they can be grepped alongside backend errors.

## Deep-Dive Revisions
- **[REVISED]** Transport: `fetch` with `keepalive: true` replaces `sendBeacon` — sendBeacon can't set custom headers (`X-API-Key`, `X-Requested-With`), breaking auth and CSRF
- **[REVISED]** Dedup: Map with lazy timestamp cleanup replaces Set with setInterval — avoids memory leak from interval that never clears
- **[REVISED]** Logging format: JSON context matching `agentLogError()` pattern for consistent log parsing
- **[NEW]** AbortError filtering: skip reporting intentional fetch cancellations
- **[NEW]** Null byte sanitization in PHP to prevent log corruption
- **[NEW]** Graceful malformed-JSON handling in PHP
- **[NEW]** Streaming method catch blocks: cover `identifyTextStream`, `identifyImageStream`, `enrichWineStream` in addition to `fetchJSON`
- **[REMOVED]** sendBeacon fallback path — unnecessary, fetch+keepalive covers all cases

---

## Plan

### 1. Backend: Create `resources/php/logError.php`

New endpoint following standard conventions.

**Includes:**
```php
require_once 'securityHeaders.php';  // CORS, auth (API key), CSRF, security headers
```

No `databaseConnection.php`, `audit_log.php`, or `errorHandler.php` needed — log-only.

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

**Validation** (inline, not using `validators.php` — truncate, never reject):
- `message` — required, `mb_substr()` to 1000 chars
- `stack` — optional, `mb_substr()` to 5000 chars
- `url` — optional, `mb_substr()` to 500 chars
- `context` — optional, `mb_substr()` to 200 chars
- `supportRef` — optional, `mb_substr()` to 20 chars
- Strip null bytes from all fields (`str_replace("\x00", '', ...)`)

**Error handling:** Entire body wrapped in try-catch. Malformed JSON, empty body, and exceptions all return `{ "success": true }` — the error logger must never cascade failures. Log what we can even on malformed input.

**Method check:** Return `{ "success": true }` for non-POST requests (don't block OPTIONS preflight).

**Logging format** (matches `agentLogError()` in `_bootstrap.php`):
```php
error_log("[Frontend Error] {$message} | Context: " . json_encode([
    'url' => $url,
    'context' => $context,
    'supportRef' => $supportRef,
    'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
]));
```

**Response:** Always `{ "success": true }`.

---

### 2. Frontend: Create `qve/src/lib/utils/errorReporter.ts`

Lightweight utility, no store dependencies, no imports from `$lib/stores`.

**Signature:**
```typescript
interface ErrorReport {
  message: string;
  stack?: string;
  context?: string;
  supportRef?: string;
}
export function reportError(report: ErrorReport): void
```

**Transport:** `fetch()` with `keepalive: true`. Fire-and-forget — `.catch(() => {})` silences failures.
```typescript
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
```

Needs `import { PUBLIC_API_KEY } from '$env/static/public'` at top.

**Guards (checked before sending):**
1. **AbortError filter**: Skip if `message` contains `'AbortError'` or `'aborted'`
2. **Dedup**: Map<string, number> keyed by `message + url` fingerprint with timestamps. Lazy cleanup on insert — delete entries older than 60s. Max 20 entries (evict oldest on overflow). Skip if fingerprint exists and is fresh.
3. **Rate limit**: Counter resets every 60s. Cap at 10 reports per window. Simple incrementing number, not per-fingerprint.

**Auto-captured fields:**
- `url`: `window.location.pathname`

**No SSR guard needed**: Only imported from `hooks.client.ts` and `client.ts` — both are client-only. If ever imported server-side, `fetch` and `window` would fail at call time (acceptable since `reportError` is fire-and-forget in try-catch callers).

---

### 3. Frontend: Hook into existing error handlers

**File: `qve/src/hooks.client.ts`** — 2 touch points:

1. **`handleError` hook** (line 14, after existing `console.error`):
   ```typescript
   reportError({ message: err.message, stack: err.stack, context: `sveltekit:${status}` });
   ```

2. **`unhandledrejection` listener** (line 32, after existing `console.error`):
   ```typescript
   reportError({
     message: String(event.reason),
     stack: event.reason?.stack,
     context: 'unhandled_rejection'
   });
   ```

Add import at top: `import { reportError } from '$lib/utils/errorReporter';`

**File: `qve/src/lib/api/client.ts`** — 4 touch points:

1. **`fetchJSON` catch** (~line 161, after `console.error`, before `throw`):
   ```typescript
   if (!AgentError.isAgentError(error)) {
     reportError({ message: (error as Error).message, stack: (error as Error).stack, context: `api:${endpoint}` });
   }
   ```

2. **`identifyTextStream` catch** (~line 973):
   ```typescript
   reportError({ message: (e as Error).message, stack: (e as Error).stack, context: 'api:identifyTextStream' });
   ```

3. **`identifyImageStream` catch** (~line 1089):
   ```typescript
   reportError({ message: (e as Error).message, stack: (e as Error).stack, context: 'api:identifyImageStream' });
   ```

4. **`enrichWineStream` catch** (~line 1227):
   ```typescript
   reportError({ message: (e as Error).message, stack: (e as Error).stack, context: 'api:enrichWineStream' });
   ```

Add import at top of client.ts: `import { reportError } from '$lib/utils/errorReporter';`

**Not adding `reportError()` to:**
- Agent middleware (`errorHandler.ts`) — errors bubble to `hooks.client.ts` unhandledrejection handler, no duplication
- Store catch blocks (`wines.ts`, `history.ts`) — these call API client methods which report at the `client.ts` level
- Component-level catches — these are handled gracefully with toasts and don't need server logging

---

### 4. Files Summary

| File | Action | Description |
|------|--------|-------------|
| `resources/php/logError.php` | **CREATE** | ~40 lines. Validate, sanitize, `error_log()`, respond |
| `qve/src/lib/utils/errorReporter.ts` | **CREATE** | ~60 lines. fetch+keepalive, dedup, rate limit, AbortError filter |
| `qve/src/hooks.client.ts` | **MODIFY** | Add import + 2 `reportError()` calls after existing `console.error` |
| `qve/src/lib/api/client.ts` | **MODIFY** | Add import + 4 `reportError()` calls in catch blocks |

No changes to: `vite.config.ts` (proxy already covers `/resources/php/*`), `securityHeaders.php`, stores, agent middleware.

---

### 5. Verification

**Automated:**
1. `php -l resources/php/logError.php` — PHP syntax check
2. `cd qve && npm run check` — TypeScript/Svelte check (0 errors expected)

**Manual testing:**
3. Open browser console, run `throw new Error('test-error-243')`, check PHP error log for `[Frontend Error] test-error-243`
4. Trigger same error 5x rapidly — verify only 1 appears in log (dedup)
5. Trigger 15 different errors rapidly — verify max 10 in log (rate limit)
6. Test API error: temporarily break a PHP endpoint, trigger it from UI, verify `api:<endpoint>` context appears in log
7. Test graceful degradation: stop PHP server, trigger error — verify no console errors from the reporter itself

---

### Known Limitations
- Auth-failure errors can't self-report (auth is required on the endpoint). Acceptable — PHP's `authMiddleware.php` already logs these server-side.
