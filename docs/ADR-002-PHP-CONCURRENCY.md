# ADR-002: PHP Concurrency — Dev Server Blocking & Production Scaling

**Date**: 2026-02-13
**Status**: Proposed
**Deciders**: Phil Humber
**Context**: Moving toward multi-user; PHP built-in dev server blocks on LLM calls; evaluating whether this is a dev-only issue or a production concern

---

## 1. Decision Summary

| Question | Decision | Confidence |
|----------|----------|------------|
| Is blocking a dev-only issue? | **Mostly yes.** Apache handles concurrency natively. | High |
| Dev server fix? | **PHP-FPM for local dev.** Eliminates single-thread bottleneck. | High |
| Production changes needed? | **Not yet.** Apache multi-process is sufficient for initial multi-user. | High |
| When to revisit? | **When concurrent LLM users routinely exceed ~20-30.** | Medium |

---

## 2. Context

### The Problem

The PHP built-in dev server (`php -S localhost:8000`) is **single-threaded, single-process**. When a streaming LLM call is in-flight (e.g., `identifyTextStream.php` with `set_time_limit(120)`), every other request queues behind it:

- Another user's identification → **blocked**
- `getWines.php` → **blocked**
- `cancelRequest.php` → **blocked** (hence the Vite `agentCancelPlugin` workaround)

This is already documented in `qve/vite.config.ts:9-19`:

```typescript
// The PHP built-in dev server is single-threaded — it can't process a cancel
// POST while a streaming SSE request is in-flight.
```

### Current Architecture

```
Development:
  Browser → Vite (port 5173) → proxy → php -S localhost:8000 (single-threaded)
                               ↓
                          agentCancelPlugin intercepts cancel POSTs in Node.js
                          (because PHP can't receive them while streaming)

Production:
  Browser → Apache (multi-process) → mod_php → PHP processes (one per request)
                                   → MySQL on 10.0.0.16
```

### Blocking Durations by Endpoint

| Endpoint | Blocking Duration | What's Happening |
|----------|-------------------|------------------|
| `identifyTextStream.php` | 5-15s (Tier 1) + 10-20s (escalation) | Streaming Gemini → blocking Claude/higher-tier escalation |
| `identifyImageStream.php` | 10-20s (Tier 1) + 10-20s (escalation) | Vision model streaming → escalation |
| `agentEnrichStream.php` | 15-30s | Web search + LLM enrichment streaming |
| `agentEnrich.php` | 15-30s | Blocking LLM call (pre-Phase 6 non-streaming) |
| `identifyText.php` | 10-25s | Non-streaming identification with escalation |
| `geminiAPI.php` | 10-30s | Direct Gemini API call for wizard enrichment |
| Regular endpoints | <100ms | Database queries only, not a concern |

---

## 3. Analysis: Dev vs Production

### Development — Single-Threaded Server

`php -S` was designed for quick local testing, not concurrent usage. PHP's own documentation warns:

> "The web server runs only one single-threaded process, so PHP applications will stall if a request is blocked."

**Impact**: While any LLM endpoint is running (10-90s), the entire backend is frozen. This makes it impossible to:
- Test multi-user scenarios
- Cancel in-flight requests (without the Vite workaround)
- Load any page while an agent request is processing
- Run the app normally while enrichment is happening in the background

### Production — Apache Multi-Process

Apache uses a Multi-Processing Module (MPM) that spawns multiple workers:

| MPM | Model | How Concurrency Works |
|-----|-------|----------------------|
| **prefork** | Multi-process | Each request gets its own PHP process. Full isolation. |
| **worker** | Multi-threaded | Threads handle connections; PHP via FastCGI. |
| **event** | Async + threads | Like worker but handles keep-alive efficiently. |

With any MPM, User A's 25-second identification runs in Worker 1 while User B's getWines returns instantly from Worker 2. **Concurrency is not a problem for initial multi-user.**

### Production Scaling Limits

Each LLM request ties up:
- 1 Apache worker (from the `MaxRequestWorkers` pool, typically 150-256)
- 1 PHP process (~20-128MB memory)
- 1 MySQL connection (from `max_connections`, typically 151)

**Back-of-envelope**: If each LLM call averages 20s and you have 150 workers:
- Sustained throughput: ~7.5 LLM requests/second
- At peak: 150 concurrent LLM calls before queuing starts
- Regular endpoints (getWines, etc.) compete for the same worker pool

For 10-20 concurrent users, this is more than sufficient. The problem appears at **50+ simultaneous LLM-heavy users**, which is well beyond initial multi-user rollout.

---

## 4. Decision: PHP-FPM for Local Development

### What was considered

| Option | Effort | Result |
|--------|--------|--------|
| **A. Keep `php -S`** | Zero | Blocking continues; can't test multi-user |
| **B. PHP-FPM + Vite proxy** | Small (config file + startup script) | Multiple PHP workers; concurrent requests work |
| **C. nginx + PHP-FPM locally** | Medium (install nginx, configure) | Closest to production; more setup |
| **D. Docker (nginx + PHP-FPM)** | Medium (Dockerfile, docker-compose) | Reproducible; adds Docker dependency |
| **E. Apache locally** | Medium (install/configure Apache) | Exact production mirror; heavy for dev |

### Why PHP-FPM (Option B) wins

PHP-FPM (FastCGI Process Manager) spawns a **pool of PHP worker processes**. Vite's existing proxy sends requests to PHP-FPM instead of the built-in server. Multiple requests are handled concurrently — LLM calls in one worker don't block other workers.

**Advantages over other options:**
- **Minimal change**: Only need a `php-fpm.conf` and a one-line startup change
- **No new dependencies**: PHP-FPM ships with PHP (just needs enabling on some platforms)
- **Vite proxy unchanged**: Same `localhost:PORT` target, just pointing at FPM's listener
- **Eliminates `agentCancelPlugin` need**: Cancel requests get their own worker
- **Closer to production**: Multi-process model matches Apache/nginx behavior

### Implementation

#### 1. PHP-FPM configuration file

Create `php-fpm.dev.conf` in project root:

```ini
[global]
; Don't daemonize — run in foreground for dev
daemonize = no
; Log to stderr for visibility in terminal
error_log = /dev/stderr

[www]
; Listen on TCP port (Vite proxy target)
listen = 127.0.0.1:8000

; Worker pool — 4 is enough for dev, handles concurrent LLM + regular requests
pm = static
pm.max_children = 4

; Inherit environment for config paths
clear_env = no

; Logging
access.log = /dev/stderr
catch_workers_output = yes
decorate_workers_output = no

; Match production timeout
request_terminate_timeout = 120
```

#### 2. Update dev startup

```bash
# Before (single-threaded, blocks):
php -S localhost:8000

# After (4 concurrent workers):
php-fpm -y php-fpm.dev.conf -F
```

#### 3. Vite proxy — no changes needed

The existing proxy in `vite.config.ts` already targets `http://localhost:8000`. PHP-FPM listens on the same address, so Vite works unchanged.

#### 4. agentCancelPlugin — can be retired

With PHP-FPM, cancel requests get their own worker process. The Vite-side workaround is no longer needed. It can be removed (or kept as a harmless fallback — it intercepts before the proxy, so it still works even with FPM).

### Platform notes

| Platform | PHP-FPM availability |
|----------|---------------------|
| **macOS (Homebrew)** | `brew install php` includes FPM. Config at `/opt/homebrew/etc/php/8.x/php-fpm.conf` |
| **Linux (apt/dnf)** | `sudo apt install php-fpm` or `sudo dnf install php-fpm` |
| **Windows** | PHP-FPM is **not available on Windows**. Use Docker (Option D) or WSL2 with Linux PHP-FPM |

Since the developer uses Windows (PowerShell deploy script), **WSL2 or Docker** would be needed for PHP-FPM. Alternatively, keep `php -S` on Windows and use the Vite cancel plugin as the workaround — production (Apache) handles concurrency natively regardless.

---

## 5. Production: No Changes Needed Now

Apache's multi-process model handles initial multi-user concurrency without any changes. The existing architecture is correct:

- Each request gets its own PHP process
- LLM calls block only their own worker
- Cancel tokens use the filesystem (works across processes)
- `connection_aborted()` + `isRequestCancelled()` checkpoints are already in place

### When to consider nginx + PHP-FPM in production

| Signal | Why it matters |
|--------|---------------|
| Apache worker exhaustion (503 errors under load) | Workers tied up by LLM calls starving regular endpoints |
| Memory pressure from PHP processes | Each prefork process duplicates PHP memory |
| Need for WebSocket support | Apache's WebSocket support is limited |
| >30 concurrent LLM-heavy users | Workers start queuing, response times degrade |

nginx + PHP-FPM is more resource-efficient than Apache prefork because nginx handles connection multiplexing asynchronously while PHP-FPM manages the PHP process pool separately. This means idle connections don't consume a PHP process.

### Future scaling path (not needed now)

```
Phase 1 (current):  Apache + mod_php           → Sufficient for initial multi-user
Phase 2 (if needed): nginx + PHP-FPM           → Better resource efficiency under load
Phase 3 (if needed): Background job queue       → Offload long LLM calls from request workers
Phase 4 (if needed): Async PHP or backend swap  → Event-driven for massive concurrency
```

Each phase is triggered by measurable load problems, not speculation.

---

## 6. What does NOT need to change

- **PHP code** — The synchronous model is standard and correct. PHP-FPM/Apache handle concurrency at the process level.
- **Streaming SSE** — `CURLOPT_WRITEFUNCTION` + `ob_implicit_flush` is the correct PHP streaming pattern.
- **Escalation architecture** — Tier 1 stream → Tier 1.5 blocking escalation is a good UX trade-off.
- **Cancel token mechanism** — Filesystem-based tokens work across processes.
- **Database connection pattern** — Static singleton per-process is correct for PHP's lifecycle.

---

## 7. Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-13 | PHP built-in server is primary dev bottleneck, not a production issue | Apache multi-process handles concurrent requests natively |
| 2026-02-13 | PHP-FPM for local dev (or Docker/WSL2 on Windows) | Eliminates single-thread blocking; 4 workers sufficient for dev |
| 2026-02-13 | No production changes needed for initial multi-user | Apache worker pool handles 10-30 concurrent users comfortably |
| 2026-02-13 | Monitor for nginx + PHP-FPM migration trigger | Switch when Apache workers exhausted or >30 concurrent LLM users |
