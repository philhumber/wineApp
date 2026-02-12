# ADR-001: Stay Web + Consolidate PHP Backend

**Date**: 2026-02-12
**Status**: Proposed
**Deciders**: Phil Humber
**Context**: Planning Learn + Remember features; evaluating web vs native pivot; PHP backend growing from 39 to ~58 endpoints

---

## 1. Decision Summary

| Question | Decision | Confidence |
|----------|----------|------------|
| Web or Native? | **Stay web. Capacitor later if needed.** | High |
| PHP backend approach? | **Unified bootstrap with proper HTTP semantics.** | High |
| When to address backend? | **Before Learn/Remember endpoints ship.** | High |

---

## 2. Context

Qvé is a production SvelteKit PWA with a PHP backend (no framework). The app currently has:

- **105 Svelte components**, 5 routes, 24 stores
- **39 PHP endpoints** (25 regular, 10 agent, 4 auth)
- **33 database tables** (+ 3 views)
- **1 developer**

Two major features are planned:

| Feature | New Components | New Routes | New PHP Endpoints | New DB Tables |
|---------|---------------|-----------|-------------------|---------------|
| Learn (MVP) | ~30 | 10+ | ~12 | 2-6 |
| Remember (MVP) | ~8-12 | 2 | ~7 | 4 |
| **Combined** | **~40** | **~12** | **~19** | **~10** |

Post-build totals: ~145 components, ~17 routes, ~58 PHP endpoints, ~43 tables.

A production audit (2026-02-06) found 14 critical, 32 warning, 28 nit findings. Auth has since been added on `develop`. The agent subsystem (`_bootstrap.php`) has mature patterns (structured errors, SSE, cancellation, logging). The regular endpoints do not.

---

## 3. Decision 1: Stay Web

### What was considered

| Option | Effort | Tradeoff |
|--------|--------|----------|
| **A. Stay web (PWA)** | Zero migration cost | No native APIs (push, background sync) |
| **B. React Native / Flutter rewrite** | 6+ months, full rewrite | Native APIs, App Store, but dual codebase |
| **C. Capacitor wrap** | 1-2 days integration | Native APIs via plugins, keep Svelte codebase |

### Why web wins

**Learn is a personal wiki.** It surfaces existing reference data (42 grapes, 33 countries, 47 appellations, 58 pairing rules) with personal collection overlays. This is HTML content pages with a few bar charts. Web's bread and butter.

**Remember is a journal with photos.** Quick capture (camera API already works in agent), photo gallery (CSS scroll-snap), tags, timeline view. None of this needs native APIs at MVP.

**The hard mobile-web problems are already solved:**
- sessionStorage persistence for iOS tab switching (agent sessions survive camera app)
- Touch scroll vs tap detection (FilterPill pattern)
- Portal pattern for iOS stacking contexts (FilterDropdown)
- Safe area insets, overflow prevention, scroll momentum
- PWA already configured (Workbox, installable manifest)

**A rewrite delivers zero new features for months.** For a solo developer, the opportunity cost is catastrophic. Learn + Remember MVPs are 4-6 sprints. A native rewrite is 12+ sprints before reaching feature parity.

### What native would unlock (and when it matters)

| Capability | When needed | Web workaround |
|------------|-------------|----------------|
| Push notifications | Remember Phase 3 (drink window alerts) | PWA Notification API (limited iOS) |
| Offline capture | Remember Phase 3 | Service Worker + IndexedDB |
| Native share sheet | Remember Phase 3 (shareable memory cards) | Web Share API (iOS 15+) |
| Background sync | Remember Phase 3 | Not possible — degrade gracefully |
| App Store presence | Marketing milestone | PWA install prompt |

All of these are Phase 3+ features. None block MVP or Phase 2.

### Future Route: Capacitor for Semi-Native App

The path to native is not a rewrite — it's **Capacitor** (by Ionic). Capacitor wraps the existing SvelteKit SPA in a native iOS/Android shell, giving access to native APIs through plugins while keeping the entire Svelte codebase unchanged. The web app continues to work as-is alongside the native builds.

#### Why Capacitor (not React Native, Flutter, or Tauri)

| Option | Keeps Svelte? | Native APIs | App Store | Effort | Risk |
|--------|:---:|:---:|:---:|--------|------|
| **Capacitor** | Yes — zero rewrite | Via plugins | Yes | 1-2 days setup | Very low |
| React Native | No — full rewrite to React | Full native | Yes | 6+ months | High |
| Flutter | No — full rewrite to Dart | Full native | Yes | 6+ months | High |
| Tauri | Yes — but desktop-first | Limited mobile | No (desktop) | 1 week | Medium |

Capacitor is purpose-built for wrapping web apps. It has first-class SvelteKit support, an active plugin ecosystem, and Ionic maintains it commercially (not abandonware risk).

#### What Capacitor integration looks like

```
qve/
├── src/                    # Existing SvelteKit app (unchanged)
├── capacitor.config.ts     # Capacitor configuration
├── ios/                    # Xcode project (auto-generated)
├── android/                # Android Studio project (auto-generated)
└── package.json            # Add @capacitor/core, @capacitor/cli
```

Setup is ~6 commands:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Qvé" "com.qve.wine" --web-dir build
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

The web app runs inside a native WebView. All existing SvelteKit routes, stores, components, and API calls work unchanged. Native plugins are accessed via JavaScript imports — no Swift/Kotlin required for standard capabilities.

#### Plugin mapping to Qvé features

Each planned feature that currently hits a web limitation maps to a specific Capacitor plugin:

| Feature | Web Limitation | Capacitor Plugin | Plugin Maturity |
|---------|---------------|-----------------|-----------------|
| **Remember: Camera** | Web camera API works but no flash/focus/resolution control | `@capacitor/camera` | Stable (official) |
| **Remember: Photo gallery** | CSS scroll-snap works; no native gestures | `@capacitor/filesystem` + custom | Stable |
| **Remember: Offline capture** | Service Worker + IndexedDB is fragile on iOS | `@capacitor/filesystem` + `@capacitor/network` | Stable |
| **Remember: Share memory cards** | Web Share API limited on iOS < 16 | `@capacitor/share` | Stable (official) |
| **Remember: Geolocation** | Requires explicit permission prompt each visit | `@capacitor/geolocation` | Stable (official) |
| **Learn: Push notifications** (drink window alerts) | PWA notifications blocked on iOS Safari | `@capacitor/push-notifications` + FCM/APNs | Stable (official) |
| **Background sync** | Not possible in PWA | `@capacitor/background-runner` | Beta |
| **Haptic feedback** (rating dots, vibe ratings) | Not possible in web | `@capacitor/haptics` | Stable (official) |
| **App Store distribution** | PWA install prompt only | Built-in (Xcode/Gradle build) | N/A |
| **Biometric auth** (Face ID / fingerprint) | Not possible in web | `@capacitor-community/biometric-auth` | Community, stable |

#### How existing code adapts

The key architectural advantage: Capacitor plugins are progressive enhancements, not replacements. Code can detect the platform and use native APIs when available, falling back to web APIs otherwise:

```typescript
// Example: Camera capture in Remember
import { Capacitor } from '@capacitor/core';

async function capturePhoto(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    // Native: full camera control (flash, focus, gallery access)
    const { Camera, CameraResultType } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      quality: 90,
      allowEditing: false
    });
    return photo.dataUrl;
  } else {
    // Web: existing file input / agent camera flow
    return existingWebCameraCapture();
  }
}
```

This means:
- **Web PWA continues to work** for users who don't install the native app
- **Native app gets enhanced capabilities** without forking the codebase
- **One codebase, three targets**: web, iOS, Android

#### Triggers for Capacitor adoption

Don't add Capacitor preemptively. Add it when one of these triggers fires:

| Trigger | Signal | Expected timeline |
|---------|--------|-------------------|
| **Remember Phase 3: Offline capture** | Users report lost memories from poor connectivity at restaurants/events | Sprint 20+ |
| **Remember Phase 3: Share cards** | Web Share API doesn't work reliably on target iOS versions | Sprint 20+ |
| **Learn/Remember: Push notifications** | Drink window alerts or "On This Day" memories need background delivery | Sprint 20+ |
| **Marketing: App Store presence** | User acquisition strategy requires App Store discoverability | Business decision |
| **User feedback: "Why isn't this in the App Store?"** | Repeated requests from testers/users | Organic signal |

#### Capacitor integration effort estimate

| Task | Effort | Notes |
|------|--------|-------|
| Initial setup (config, iOS/Android projects) | 2 hours | `cap init` + `cap add` |
| Build pipeline (SvelteKit build → cap sync) | 2 hours | Add to existing deploy script |
| Camera plugin integration | 4 hours | Replace web camera with native, keep web fallback |
| Push notifications (FCM/APNs setup) | 1 day | Server-side token management, notification service |
| Share plugin integration | 2 hours | Wrap existing share logic |
| Geolocation plugin | 2 hours | Progressive enhancement over web API |
| App Store submission (iOS) | 1 day | Screenshots, metadata, review process |
| App Store submission (Android) | 4 hours | Play Store listing |
| **Total initial launch** | **~3 days** | Camera + share + push + store submission |

#### What NOT to do with Capacitor

- **Don't use Ionic UI components.** Qvé already has a complete Svelte component library with its own design system. Ionic's UI layer is unnecessary and would create style conflicts.
- **Don't move API calls to native HTTP.** Keep using `fetch()` — Capacitor's WebView handles it fine, and it keeps the web/native code paths identical.
- **Don't build native-only features.** Every feature should work on web (possibly degraded) and be enhanced on native. This keeps the web PWA viable and avoids platform lock-in.
- **Don't add Capacitor before Remember Phase 3.** The setup is fast enough that there's no benefit to early integration — it just adds build complexity before it's needed.

**Decision: Build Learn + Remember as web. Add Capacitor when a concrete trigger fires (likely Remember Phase 3, ~Sprint 20+). Do not rewrite. Do not add Capacitor preemptively.**

---

## 4. Decision 2: Consolidate PHP Backend

### The problem

The audit found two distinct PHP patterns that have diverged significantly:

#### Agent endpoints (10 files) — mature pattern
```
require_once '_bootstrap.php';
agentRequireMethod('POST');
$body = agentGetJsonBody();
agentRequireFields($body, ['text']);
// ... service calls ...
agentResponse(true, 'Identified', $result);
// or: agentExceptionError($e, 'identifyText');
```

Provides: structured errors with type classification, proper HTTP status codes (408/429/500/502/503), support references (`ERR-XXXXXXXX`), JSON-formatted logging, SSE helpers, request cancellation, factory-based dependency injection.

#### Regular endpoints (25 files) — legacy pattern
```
require_once 'securityHeaders.php';
require_once 'databaseConnection.php';
require_once 'errorHandler.php';
require_once 'validators.php';
require_once 'audit_log.php';
$response = ['success' => false, 'message' => '', 'data' => null];
try {
    $data = json_decode(file_get_contents('php://input'), true);
    // ... raw SQL ...
    $response['success'] = true;
} catch (Exception $e) {
    $response['message'] = safeErrorMessage($e, 'endpoint');
}
header('Content-Type: application/json');
echo json_encode($response);
```

Problems:
- **Always returns HTTP 200**, even for errors (client must parse body)
- **No input validation helper** — each endpoint manually checks fields
- **No method validation** — most endpoints don't check GET vs POST
- **Duplicate response initialization** — 25 copies of `$response = [...]`
- **Duplicate JSON parsing** — 27 copies of `json_decode(file_get_contents(...))`
- **CORS logic duplicated** between `securityHeaders.php` and `auth/authCorsHeaders.php` (32 lines, with one origin divergence)
- **Security headers duplicated** — 9 identical `header()` calls in both files
- **2 endpoints missing auth entirely** — `deleteItem.php` and `getDeleteImpact.php` don't include `securityHeaders.php`

Adding 19 more endpoints (12 Learn + 7 Remember) in the current pattern would mean 19 more copies of this boilerplate, 19 more files that might forget to include auth, and 19 more files returning 200 for errors.

### What was considered

| Option | Effort | Risk | Outcome |
|--------|--------|------|---------|
| **A. SvelteKit server routes** | High (rewrite PHP to TS) | Medium — new language for backend, DB driver change | TypeScript end-to-end, eliminate two-server setup |
| **B. PHP framework (Slim 4 / Lumen)** | Medium (add routing + middleware) | Low — same language, new patterns | Proper routing, middleware chain, DI container |
| **C. Unified bootstrap** | Small (extend existing pattern) | Very low — incremental, nothing breaks | Consistent patterns, proper HTTP codes, less boilerplate |
| **D. Keep as-is** | Zero | High — 19 more inconsistent files | Technical debt compounds |

### Why unified bootstrap wins

Option A is the right long-term answer but the wrong timing — rewriting 25 PHP endpoints to TypeScript while also building 19 new ones is a 2x multiplier on work. Option B (Slim/Lumen) adds a framework dependency and learning curve for marginal gain over what `_bootstrap.php` already provides. Option D is how you end up with 58 files, 4 different error handling patterns, and a security gap in every third endpoint.

**Option C extends the proven `_bootstrap.php` pattern to all endpoints.** The agent subsystem already solved these problems — structured errors, HTTP status codes, input validation, method checking, logging. The regular endpoints just need to adopt the same patterns.

### Implementation plan

#### Phase 1: Create `bootstrap.php` (before Learn/Remember work begins)

Extract a shared bootstrap from `_bootstrap.php` that works for ALL endpoints:

```
resources/php/bootstrap.php
```

**What it provides (ported from _bootstrap.php + securityHeaders.php):**

```php
<?php
// Auto-included by every endpoint via: require_once __DIR__ . '/bootstrap.php';

// 1. Security: CORS, auth, CSRF, HTTP headers (consolidates securityHeaders.php + authCorsHeaders.php)
// 2. Database: getDBConnection() singleton
// 3. Input helpers:
//    - requireMethod($allowed)        → 405 on mismatch
//    - getJsonBody()                  → parsed input with error handling
//    - requireFields($input, $fields) → 400 on missing
// 4. Response helpers:
//    - jsonResponse($success, $message, $data, $httpCode) → sets Content-Type, status code, exits
//    - jsonError($message, $httpCode)                     → shorthand for error responses
//    - exceptionError($e, $endpoint)                      → type classification, support ref, proper HTTP code
// 5. Audit: logChange() (from audit_log.php)
// 6. Validation: all validators.php functions
// 7. Error handling: safeErrorMessage() (from errorHandler.php)
```

**Key changes from current pattern:**
- **HTTP status codes by default.** `jsonResponse()` sets the code. No more 200-for-everything.
- **Single CORS source of truth.** Origins defined once, shared by all endpoints including auth.
- **Auth flag.** `bootstrap.php` accepts a config: `require_bootstrap(['auth' => false])` for auth endpoints and healthcheck. Default is auth required.
- **One include instead of five.** Endpoints go from 5 `require_once` lines to 1.

**What it does NOT change:**
- Agent `_bootstrap.php` stays separate — it has SSE, cancellation, service factories, and 120s timeout that regular endpoints don't need. It can `require_once '../bootstrap.php'` for shared pieces and add agent-specific behavior on top.
- Existing response structure `{success, message, data}` stays the same — just returned by a helper that also sets the HTTP status code.
- No routing framework — each file is still its own endpoint. Vite proxy handles URL mapping.

#### Phase 2: Migrate existing endpoints (incremental, alongside feature work)

Migrate the 25 regular endpoints to use `bootstrap.php`. This can happen file-by-file, not big-bang. Priority order:

| Priority | Endpoints | Why first |
|----------|-----------|-----------|
| **P0 — Security gap** | `deleteItem.php`, `getDeleteImpact.php` | Missing auth/security headers entirely |
| **P1 — Write operations** | `addWine`, `addBottle`, `updateWine`, `updateBottle`, `drinkBottle`, `updateRating` | Highest risk, benefit most from validation helpers |
| **P2 — Read operations** | `getWines`, `getDrunkWines`, `getBottles`, `getCellarValue` | Most traffic, benefit from proper HTTP codes |
| **P3 — Reference data** | `getCountries`, `getTypes`, `getRegions`, `getProducers`, `getYears` | Low risk, uniform pattern |
| **P4 — Utilities** | `upload`, `normalize`, `checkDuplicate`, `getCurrencies`, `healthcheck` | Edge cases, migrate last |

Each migration is a ~15-minute change per file: replace 5 includes with 1, swap manual response building for `jsonResponse()`, add `requireMethod()` call. No logic changes.

#### Phase 3: Build Learn/Remember endpoints on the new pattern

All new endpoints start with `bootstrap.php` from day one:

```php
<?php
// resources/php/learn/getGrapeDetail.php
require_once __DIR__ . '/../bootstrap.php';

requireMethod('GET');

try {
    $slug = $_GET['slug'] ?? '';
    if (!$slug) jsonError('Slug required', 400);

    $pdo = getDBConnection();

    // ... query grape data + user's collection stats ...

    jsonResponse(true, 'Grape detail', $grapeData);
} catch (Exception $e) {
    exceptionError($e, 'getGrapeDetail');
}
```

Clean, consistent, 1 include, proper HTTP codes, structured errors.

#### Phase 4: Consolidate agent bootstrap (optional, low priority)

Make `_bootstrap.php` extend `bootstrap.php` instead of duplicating its patterns:

```php
<?php
// resources/php/agent/_bootstrap.php (refactored)
require_once __DIR__ . '/../bootstrap.php';

// Agent-specific additions:
set_time_limit(120);
ignore_user_abort(false);
// ... SSE helpers, service factories, cancel tokens ...
```

This deduplicates the ~100 lines of shared logic (CORS, auth, DB, error classification) without touching agent behavior.

### What this looks like after

**Before (current state):**
```
Endpoint includes: 3-5 require_once per file (inconsistent subset)
Error handling: 2 patterns (agent structured vs regular 200-for-everything)
Auth coverage: 37/39 endpoints (2 gaps)
CORS config: 2 files (divergent origins)
Input validation: 2 patterns (agent helpers vs manual)
Response building: 2 patterns (agent helpers vs manual array)
Boilerplate per endpoint: ~15 lines
```

**After:**
```
Endpoint includes: 1 require_once per file (bootstrap.php)
Error handling: 1 pattern (structured, proper HTTP codes)
Auth coverage: 100% (default-on in bootstrap)
CORS config: 1 file (bootstrap.php)
Input validation: 1 pattern (shared helpers)
Response building: 1 pattern (jsonResponse helper)
Boilerplate per endpoint: ~3 lines
```

---

## 5. Migration risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Changing HTTP status codes breaks frontend | Medium | Frontend `api/client.ts` already checks `response.ok` AND `data.success` — both paths work. Verify with `grep` before deploying. |
| Auth flag misconfigured on new endpoint | Low | Default is auth-required. Only explicit `auth: false` skips it. |
| Agent endpoints regress during consolidation | Low | Phase 4 is optional. Agent bootstrap stays independent until deliberately merged. |
| CORS origin consolidation breaks auth flow | Low | Test auth login/logout flow specifically. The divergence is one origin (`https://qve-wine.com`) — add it to the unified list. |

---

## 6. Sequencing

```
Sprint 14 (current):
├── Create bootstrap.php (Phase 1)
├── Fix P0 security gap (deleteItem, getDeleteImpact)
├── Migrate P1 write endpoints
└── Verify frontend handles new HTTP status codes

Sprint 14-15:
├── Migrate P2-P4 remaining endpoints (Phase 2)
├── Begin Learn MVP (endpoints use bootstrap.php from start)
└── Delete deprecated securityHeaders.php, errorHandler.php, audit_log.php
    (after all endpoints migrated)

Sprint 15-17:
├── Learn MVP (Phase 3 — all new endpoints on bootstrap.php)
├── Remember MVP (Phase 3)
└── Optional: Consolidate agent bootstrap (Phase 4)
```

---

## 7. What this ADR does NOT cover

- **CI/CD pipeline** (audit finding A-C1) — separate decision, separate ADR
- **Query performance** (audit finding P-C1, 13 correlated subqueries) — optimization task, not architectural
- **XSS via `{@html}`** (audit finding S-C1) — security fix, not architectural
- **SvelteKit server routes migration** — revisit after Learn/Remember ship if PHP maintenance burden is still high

---

## 8. Decision record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-12 | Stay web, no native rewrite | All planned features are web-achievable; native APIs not needed until Phase 3+; solo developer can't sustain dual codebases |
| 2026-02-12 | Capacitor as future native route | Zero-rewrite native wrapper; ~3-day launch; plugin mapping to all Phase 3 features; triggers defined; defer until Remember Phase 3 or App Store demand |
| 2026-02-12 | Unified bootstrap.php before new endpoints | Prevents 19 more inconsistent files; fixes security gaps; extends proven agent patterns |
| 2026-02-12 | Incremental migration, not big-bang | Each endpoint migrates in ~15 min; no flag day; can ship alongside feature work |
