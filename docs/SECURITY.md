# Security Architecture — Sprint 11

**Implemented**: 2026-02-07
**Sprint**: Sprint 11 - Security (14 JIRA issues)
**Scope**: Full security hardening of PHP backend and Svelte frontend

---

## Overview

This document describes the security layers implemented in Sprint 11, the decisions behind each, and their implications for development and deployment.

### Defense-in-Depth Model

Every PHP request passes through multiple security layers in this order:

```
Client Request
  │
  ├── 1. CORS (WIN-216) ──────────── Origin allowlist, preflight handling
  │
  ├── 2. OPTIONS exit ─────────────── Preflight returns 204, no further checks
  │
  ├── 3. Authentication (WIN-203) ── X-API-Key header validation
  │
  ├── 4. CSRF Protection (WIN-215) ─ Origin validation + X-Requested-With
  │
  ├── 5. Security Headers (WIN-219) ─ CSP, X-Frame-Options, HSTS, etc.
  │
  └── 6. Endpoint Logic ───────────── Individual endpoint with error handling (WIN-217)
```

All layers are enforced in `resources/php/securityHeaders.php`, which is included by every endpoint.

---

## 1. Authentication — WIN-203

### Mechanism
API key authentication via `X-API-Key` HTTP header, validated in `resources/php/authMiddleware.php`.

### How It Works
- Server-side key defined as `API_AUTH_KEY` in `../wineapp-config/config.local.php` (outside repo and document root)
- Frontend key stored in `qve/.env` as `PUBLIC_API_KEY` (gitignored), baked into JS bundle at build time via SvelteKit's `$env/static/public`
- Comparison uses `hash_equals()` for timing-safe validation (prevents timing attacks)
- On failure: returns generic `401 Unauthorized` JSON — does not reveal whether key was missing, wrong, or misconfigured

### Scope
All endpoints require authentication — read-only, mutation, upload, and AI/LLM endpoints.

### Design Decisions
- **No dev bypass**: Dev and production use the same mechanism for consistency
- **Extensible layer**: `authenticate()` function is designed to be swapped for session/JWT auth when the app becomes multi-user and public-facing
- **Key in JS bundle**: Acceptable because the frontend is served from the same LAN server. The key prevents unauthorized LAN devices from accessing the API, not browser-side attackers who already have the frontend

### Security Implications
- The API key is visible in the browser's JS bundle. This is a known trade-off for a LAN-only single-user app. For the planned multi-user public-facing version, this should be replaced with proper user authentication (sessions or JWT)
- The key prevents: unauthorized LAN access, LLM credit abuse, data corruption from rogue clients

### Files
- `resources/php/authMiddleware.php` — auth logic
- `resources/php/securityHeaders.php` — integration point (calls `authenticate()`)
- `qve/src/lib/api/client.ts` — sends `X-API-Key` on all requests
- `../wineapp-config/config.local.php` — key storage (server)
- `qve/.env` — key storage (frontend, gitignored)

---

## 2. CSRF Protection — WIN-215

### Mechanism
Two-layer defense: Origin header validation + custom `X-Requested-With` header requirement.

### How It Works

**Layer 1 — Origin Validation:**
- Reads the `Origin` header from POST requests
- If present, validates against the same allowlist used by CORS
- If present but invalid, returns 403 and logs the attempt
- If absent, allows the request (browsers don't always send Origin for same-origin requests)

**Layer 2 — X-Requested-With:**
- Requires `X-Requested-With: XMLHttpRequest` header on all POST requests
- Blocks cross-origin form submissions (browsers can't set custom headers without CORS approval)
- Covers the gap when Origin is absent

### Scope
All endpoints (all use POST, including reads).

### Design Decisions
- **Origin + custom header** chosen over token-based CSRF because the app is stateless (no cookies/sessions)
- **Missing Origin allowed** because same-origin requests may not include it, and the X-Requested-With header provides a second check
- **Forward-compatible** with multi-user: works regardless of auth mechanism

### Security Implications
- Combined with CORS (strict origin allowlist) and API key auth, cross-site request forgery is mitigated at three independent layers
- A same-origin attacker with access to the JS bundle could theoretically craft requests, but they'd also need the API key

### Files
- `resources/php/securityHeaders.php` — Origin + X-Requested-With checks
- `qve/src/lib/api/client.ts` — sends `X-Requested-With: XMLHttpRequest`

---

## 3. CORS — WIN-216

### Mechanism
Strict origin allowlist with preflight handling in `resources/php/securityHeaders.php`.

### Allowed Origins
| Origin | Purpose |
|--------|---------|
| `http://10.0.0.16` | Production server |
| `http://localhost:5173` | Vite dev server |
| `http://127.0.0.1:5173` | Alternate localhost |
| `http://10.x.x.x:5173` | LAN IPs for mobile dev (`--host`) |
| `http://192.168.x.x:5173` | LAN IPs for mobile dev (`--host`) |

### Headers Set
- `Access-Control-Allow-Origin` — specific matched origin (not wildcard `*`)
- `Access-Control-Allow-Methods` — `GET, POST, OPTIONS`
- `Access-Control-Allow-Headers` — `Content-Type, X-Requested-With, X-API-Key`
- `Access-Control-Max-Age` — `86400` (24-hour preflight cache)
- `Vary: Origin` — ensures caches don't serve wrong CORS response

### Preflight
OPTIONS requests receive 204 No Content and exit before any auth/CSRF checks.

### Security Implications
- Prevents cross-origin JavaScript from making requests to the API
- The `Vary: Origin` header prevents CDN/proxy cache poisoning
- Mobile dev regex (`10.x.x.x`, `192.168.x.x`) is scoped to port 5173 only

---

## 4. HTTP Security Headers — WIN-219

### Headers Applied (all API responses)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS (1 year) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `X-XSS-Protection` | `0` | Disables legacy XSS filter (CSP replaces it) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restricts browser APIs |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | API-only CSP |

### Design Decisions
- **CSP `default-src 'none'`**: Appropriate for JSON API endpoints. The SvelteKit frontend has its own CSP managed by SvelteKit.
- **X-XSS-Protection `0`**: Modern best practice. The legacy XSS Auditor has been removed from Chrome/Edge and could be exploited when active.
- **HSTS**: Only takes effect over HTTPS. Harmless over HTTP but ready for TLS.

---

## 5. Error Handling — WIN-217

### Problem
17+ endpoints returned `$e->getMessage()` to clients, exposing table names, SQL queries, file paths, and server configuration.

### Solution
Centralized error handler in `resources/php/errorHandler.php`:

- **`safeErrorMessage($e, $endpoint)`** — returns generic message to client, logs full details server-side
- **`isSystemError($e)`** — detects PDOException, SQL keywords, file paths, server config via regex
- **Support references** — errors include `ERR-XXXXXXXX` codes for cross-referencing with server logs
- **Validation errors** — safe user-facing messages are passed through unchanged

### Pattern
```php
// Before (INSECURE):
$response['message'] = $e->getMessage();

// After:
$response['message'] = safeErrorMessage($e, 'addWine');
// Client sees: "An unexpected error occurred. Please try again. (Ref: ERR-A1B2C3D4)"
// Server logs: Full exception with message, file, line, trace
```

### Coverage
All 19 non-agent endpoints sanitized. Agent endpoints already had proper error handling via `_bootstrap.php`.

### Security Implications
- No internal details leak to clients (table names, SQL, file paths, PHP config)
- Support reference codes allow debugging without exposing internals
- Follows the same pattern as agent endpoints (`agentExceptionError()`)

---

## 6. XSS Prevention — WIN-202

### Problem
`{@html}` in Svelte renders raw HTML. The `wn()` helper in `personalities.ts` wrapped LLM-sourced wine names in `<span>` tags without escaping. Malicious LLM output could execute JavaScript.

### Solution
- **`escapeHtml()`** function in `personalities.ts` — escapes `<`, `>`, `&`, `"`, `'`
- **`wn()`** now sanitizes all names before wrapping in HTML
- **`formatMessage()`** in `messages.ts` also escapes interpolated values (defense-in-depth)

### Affected Rendering Points
| Component | Usage |
|-----------|-------|
| `TextMessage.svelte:49` | `{@html content}` — static rendering |
| `TypewriterText.svelte:137` | `{@html displayedText}` — animated rendering |

### Test Coverage
18 new tests covering XSS payloads, event handler injection, ampersands, quotes, and integration through real message templates.

### Security Implications
- All LLM-sourced content is now escaped before HTML rendering
- Defense applies at the `wn()` function level — all 25+ call sites across personality files are automatically protected

---

## 7. SSL/TLS — WIN-214, WIN-143, WIN-253

### WIN-214: SSL Verification Enabled
Previously `CURLOPT_SSL_VERIFYPEER = false` in 4 files (5 locations). Now:
- SSL verification is **always enabled** (fail-closed)
- If no CA bundle found, requests error out rather than silently disabling verification
- Zero remaining instances of disabled SSL verification

### WIN-143: SSL Certificate Configuration
- **`SSLConfig.php`** — centralized helper that resolves CA bundle paths across Windows (dev) and Linux (production)
- **`_bootstrap.php`** — new `ssl_error` type (HTTP 502) with detection and user-friendly messages
- **`deploy.ps1`** — pre-flight SSL validation check before deployment
- Search paths: `wineapp-config/cacert.pem`, `/etc/ssl/certs/ca-certificates.crt`, PHP ini settings

### WIN-253: Gemini API Key Moved to Header
- Previously: API key in URL query parameter (`?key=API_KEY`) — visible in server/proxy logs
- Now: API key sent via `x-goog-api-key` HTTP header (supported by current Gemini API)
- Zero remaining `?key=` patterns in the codebase

### Security Implications
- Outbound API calls (Gemini, Anthropic) are now protected against MITM attacks
- API keys no longer appear in server access logs or proxy logs
- SSL failures produce clear, retryable errors rather than silent security downgrades

---

## 8. Upload Security — WIN-220, WIN-246

### Fixes Applied
| Issue | Fix |
|-------|-----|
| No authentication | Covered by WIN-203 (API key via securityHeaders.php) |
| 0777 directory permissions | Changed to 0755 |
| No upload error checking | Added PHP upload error detection with user-friendly messages |
| No MIME validation | Added allowlist: `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

### Pre-existing Security (already solid)
- 10MB file size limit
- Extension whitelist (jpg, jpeg, png, gif, webp)
- `getimagesize()` content validation
- Cryptographically random filenames (original filename discarded)
- Image re-encoding to JPEG (strips embedded payloads)

---

## 9. Agent userId — WIN-254

### Problem
Agent endpoints accepted `userId` from client request body (`$input['userId'] ?? 1`), allowing a client to set any userId to bypass rate limits or misattribute costs.

### Solution
Centralized `getAgentUserId()` function in `_bootstrap.php`:
- Currently returns hardcoded `1` (single-user app)
- Clearly marked with `TODO [multi-user]` for future session/token-based userId extraction
- All 8 agent endpoints updated to use `getAgentUserId()` instead of client input

### Security Implications
- Client can no longer impersonate other users or bypass rate limits
- Single point of change when multi-user auth is implemented

---

## 10. Other Fixes

### WIN-252: .gitignore
Added `.env`, `.env.*`, `!.env.example` to root `.gitignore`. Previously only `qve/.gitignore` had these rules.

### WIN-241: Agent Test Route
Deleted `qve/src/routes/agent-test/+page.svelte` (580 lines). This dev testing page was accessible in production builds at `/qve/agent-test`. SvelteKit file-based routing automatically includes all routes.

---

## New Files Reference

| File | Purpose |
|------|---------|
| `resources/php/securityHeaders.php` | CORS + auth + CSRF + security headers (shared by all endpoints) |
| `resources/php/authMiddleware.php` | Extensible API key authentication |
| `resources/php/errorHandler.php` | Centralized error sanitization with support refs |
| `resources/php/agent/LLM/SSLConfig.php` | SSL certificate path resolution and configuration |
| `qve/.env.example` | Template for frontend API key configuration |

---

## Deployment Notes

### First Deploy After This Sprint
Both frontend and backend changes must be deployed simultaneously:
1. Ensure `config.local.php` on the production server has the `API_AUTH_KEY` constant
2. Ensure `qve/.env` exists with matching `PUBLIC_API_KEY` before building
3. Build the frontend (`npm run build`) — the key is baked into the JS bundle
4. Deploy both frontend build and PHP files together
5. `deploy.ps1` will run SSL certificate validation as part of its pre-flight checks

### If Deploying Backend First
All frontend API calls will receive 401 Unauthorized until the frontend is rebuilt with the API key header.

### If Deploying Frontend First
The frontend will send `X-API-Key` and `X-Requested-With` headers. The old backend will ignore them (no harm), but the security protections won't be active until the backend is updated.

### Deployment Guidence for Linux
 The SSLConfig.php searches for CA certificates in this priority order:

  1. Config override (highest priority)

  If you define SSL_CA_BUNDLE in config.local.php, it uses that path. You don't have this yet.

  2. PHP ini settings

  If your production server's php.ini has curl.cainfo or openssl.cafile configured, it uses those. Most Linux PHP installations have this set   up already.

  3. Standard Linux paths (auto-detected)

  It checks these locations on your production server (10.0.0.16):
  - /etc/ssl/certs/ca-certificates.crt (Debian/Ubuntu)
  - /etc/pki/tls/certs/ca-bundle.crt (RHEL/CentOS)
  - /etc/ssl/ca-bundle.pem (OpenSUSE)
  - /etc/ssl/cert.pem (Alpine)

  4. Fallback: system defaults

  If none of the above are found, cURL/PHP use their compiled-in defaults (which often work on modern Linux).

  ---
  What to check on your production server

  SSH into 10.0.0.16 and run:

  # Check if the standard CA bundle exists
  ls -la /etc/ssl/certs/ca-certificates.crt 2>/dev/null || \
  ls -la /etc/pki/tls/certs/ca-bundle.crt 2>/dev/null || \
  echo "No standard CA bundle found"

  # Check PHP's SSL config
  php -r "echo 'curl.cainfo: ' . ini_get('curl.cainfo') . PHP_EOL; echo 'openssl.cafile: ' . ini_get('openssl.cafile') . PHP_EOL;"

  # Quick test — can PHP make HTTPS calls?
  php -r "echo file_get_contents('https://generativelanguage.googleapis.com') ? 'SSL works' : 'SSL failed';"

  If CA certs are missing

  On Debian/Ubuntu:
  sudo apt install ca-certificates
  sudo update-ca-certificates

  On RHEL/CentOS:
  sudo yum install ca-certificates
  sudo update-ca-trust

  Or as a fallback, download Mozilla's CA bundle manually:
  curl -o /etc/ssl/certs/cacert.pem https://curl.se/ca/cacert.pem
  Then add to config.local.php:
  define('SSL_CA_BUNDLE', '/etc/ssl/certs/cacert.pem');

  The deploy script will help

  When you run deploy.ps1, it now runs a Test-SSLCertificate pre-flight check that validates the SSL configuration is in place before        
  deploying. If certs are missing, it'll warn you.

  Bottom line: If your production server is a standard Linux distro with ca-certificates installed (most are), it should just work. The quick   test above will confirm.


---

## Future Considerations (Multi-User)

When the app transitions to multi-user and public-facing:

1. **Replace API key auth** with session-based or JWT authentication in `authMiddleware.php` — the `authenticate()` function was designed for this swap
2. **Replace `getAgentUserId()`** in `_bootstrap.php` — extract userId from session/token instead of returning `1`
3. **Add rate limiting** — per-user rate limits for LLM endpoints
4. **Add HTTPS** — HSTS headers are already set, just need TLS certificate configuration
5. **Review CORS origins** — update allowlist for production domain
6. **Add per-user authorization** — ensure users can only access their own wine data
