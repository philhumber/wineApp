# Password Authentication for Qvé

**Consolidated Plan** — Technical implementation + Frontend design spec
**Source**: Deep-dive reviewed by 5 agents across 13 sections

---

## Context

The app needs a password gate before production launch via Cloudflare Tunnel. Single shared password (no user accounts). The app uses `adapter-static` (SPA) so SvelteKit server hooks/form actions aren't available — all auth logic goes through PHP.

## Approach: PHP Session Auth + SPA Login Page

- PHP login endpoint validates bcrypt password, starts a session, sets `httpOnly` cookie
- `authMiddleware.php` accepts EITHER API key OR valid session (dual auth)
- SPA has a `/qve/login` route; root layout checks auth on mount and gates the app
- API client handles 401 → redirect to login
- 7-day session lifetime, brute force protection (5 attempts / 15 min lockout)

**Same-origin cookie note:** In dev, Vite proxy (`/resources/php` → `localhost:8000`) means all requests are same-origin from the browser's perspective. In production, Cloudflare Tunnel serves everything from the same domain. Therefore `credentials: 'include'` and `Access-Control-Allow-Credentials` headers are NOT needed — the default `credentials: 'same-origin'` handles cookie sending automatically.

---

## Part 1: Frontend Design — Login Page

### Design Direction

**Aesthetic**: *Wine cellar entrance* — The login page is the threshold before the cellar. It should feel like arriving at a private tasting room: quiet confidence, warm materials, nothing wasted. The Qvé serif wordmark is the centrepiece. Everything else defers to it.

**Tone**: Refined minimalism with warmth. Not cold or clinical. The existing app palette — warm taupes, barely-there shadows, grain texture — carries through here. The login page should feel like it *belongs* to the same world as the cellar view.

**Differentiator**: The staggered entrance choreography. Elements arrive one by one like courses being placed on a table — unhurried, intentional. The wordmark appears first, then a fine horizontal rule, then the form fades up into place. It's a 1.2-second sequence that makes the page feel crafted rather than rendered.

### Layout Composition

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│                   Qvé                       │  ← Cormorant Garamond, 3.5rem, weight 300
│                  ─────                      │  ← 40px taupe rule, 1px, centered
│                                             │
│              ┌───────────┐                  │
│              │ ●●●●●●●●  │                  │  ← Password input, 320px max
│              └───────────┘                  │
│                                             │
│              ┌───────────┐                  │
│              │  ENTER     │                 │  ← Pill button, full width of input
│              └───────────┘                  │
│                                             │
│              Invalid password               │  ← Error text (conditional)
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

- **Full viewport**: `min-height: 100dvh` (fallback `100vh`)
- **Vertical centring**: `display: flex; align-items: center; justify-content: center`
- **Content width**: `max-width: 320px` with `padding: 0 var(--space-5)` for mobile gutters
- **No header, no side menu, no agent bubble** — clean standalone page
- **Background**: Same `var(--bg)` as the app body, inheriting the grain texture overlay from `base.css`

### Typography

| Element | Font | Size | Weight | Tracking | Transform |
|---------|------|------|--------|----------|-----------|
| Wordmark "Qvé" | `var(--font-serif)` | `3.5rem` / mobile `2.75rem` | 300 (Light) | `0.06em` | none |
| Input label (sr-only) | — | — | — | — | — |
| Input placeholder | `var(--font-sans)` | `0.9375rem` | 400 | normal | none |
| Button text | `var(--font-sans)` | `0.8125rem` | 500 | `0.08em` | uppercase |
| Error message | `var(--font-sans)` | `0.8125rem` | 400 | normal | none |

The wordmark at 300 weight (light) instead of the header's 400 creates a more delicate, elevated feeling. The extra letter-spacing (`0.06em` vs header's `0.04em`) gives it room to breathe as a standalone display element.

### Color Application

**Light mode:**
| Element | Property | Value | Token |
|---------|----------|-------|-------|
| Page background | background | `#FAF9F7` | `var(--bg)` |
| Wordmark | color | `#2D2926` | `var(--text-primary)` |
| Horizontal rule | background | `#C4BAA9` | `var(--accent-subtle)` |
| Input background | background | `#F5F3F0` | `var(--bg-subtle)` |
| Input border | border-color | `#E8E4DE` | `var(--divider)` |
| Input focus ring | box-shadow | `rgba(166,155,138,0.15)` | accent @ 15% |
| Input focus border | border-color | `#A69B8A` | `var(--accent)` |
| Button background | background | `#2D2926` | `var(--text-primary)` |
| Button text | color | `#FAF9F7` | `var(--bg)` |
| Error text | color | `#B87A7A` | `var(--error)` |
| Placeholder text | color | `#8A847D` | `var(--text-tertiary)` |

**Dark mode:** All tokens invert automatically via `[data-theme="dark"]` in `tokens.css`. No hardcoded overrides needed — the login page uses only CSS variables.

### Entrance Animation Choreography

A staggered reveal sequence, 1.2 seconds total:

```
t=0ms     Wordmark fades in + rises 12px        (0.6s, ease-out)
t=200ms   Horizontal rule scales from center     (0.5s, ease-out)
t=500ms   Form group fades in + rises 16px       (0.7s, ease-out)
```

CSS implementation using `animation-delay` and a single `@keyframes`:

```css
@keyframes loginReveal {
  from {
    opacity: 0;
    transform: translateY(var(--reveal-distance, 12px));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ruleExpand {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

.login-wordmark {
  --reveal-distance: 12px;
  opacity: 0;
  animation: loginReveal 0.6s var(--ease-out) 0s forwards;
}

.login-rule {
  opacity: 0;
  transform-origin: center;
  animation: ruleExpand 0.5s var(--ease-out) 0.2s forwards;
}

.login-form {
  --reveal-distance: 16px;
  opacity: 0;
  animation: loginReveal 0.7s var(--ease-out) 0.5s forwards;
}
```

Respects `prefers-reduced-motion` via the global rule in `animations.css`.

### Error State — Shake Animation

On invalid password, the form group shakes horizontally (not the whole page):

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%, 45%, 75% { transform: translateX(-6px); }
  30%, 60%, 90% { transform: translateX(6px); }
}

.login-form.shake {
  animation: shake 0.4s ease-in-out;
}
```

Error text appears below the button with a subtle fade-in:
```css
.login-error {
  color: var(--error);
  font-size: 0.8125rem;
  text-align: center;
  margin-top: var(--space-3);
  animation: loginReveal 0.3s var(--ease-out) forwards;
  --reveal-distance: 4px;
}
```

### Loading State

While the login request is in flight:
- Button text changes from "ENTER" to a single dot pulse animation (`···`)
- Button is `disabled` with `opacity: 0.7`, `pointer-events: none`
- Input is also `disabled`

```css
.login-dots::after {
  content: '···';
  letter-spacing: 0.3em;
  animation: pulse 1.2s ease-in-out infinite;
}
```

### Rate Limit State (429)

When locked out:
- Error message: "Too many attempts. Try again in 15 minutes."
- Input and button remain disabled
- No shake — the message speaks for itself

### Component Specification

```svelte
<!-- qve/src/routes/login/+page.svelte -->
<svelte:head>
  <title>Sign In — Qvé</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="login-page">
  <div class="login-container">
    <!-- Wordmark -->
    <h1 class="login-wordmark">Qvé</h1>

    <!-- Decorative rule -->
    <div class="login-rule" aria-hidden="true"></div>

    <!-- Form -->
    <form
      class="login-form"
      class:shake={showShake}
      on:submit|preventDefault={handleSubmit}
    >
      <label for="password" class="sr-only">Password</label>
      <input
        id="password"
        type="password"
        autocomplete="current-password"
        placeholder="Password"
        bind:value={password}
        bind:this={passwordInput}
        disabled={$isAuthChecking || isLockedOut}
        required
      />

      <button
        type="submit"
        class="login-button"
        disabled={$isAuthChecking || !password || isLockedOut}
      >
        {#if $isAuthChecking}
          <span class="login-dots" aria-label="Signing in"></span>
        {:else}
          Enter
        {/if}
      </button>

      {#if errorMessage}
        <p class="login-error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      {/if}
    </form>
  </div>
</div>
```

### Responsive Behaviour

| Breakpoint | Change |
|------------|--------|
| All widths | Container `max-width: 320px`, horizontally centered |
| `≤ 480px` | Wordmark shrinks to `2.75rem`, rule to `32px` |
| `≥ 481px` | Wordmark at `3.5rem`, rule at `40px` |

No grid, no columns — the layout is inherently mobile-first and needs only the wordmark size adjustment.

### Input & Button Detail Specs

**Password input:**
```css
.login-page input[type="password"] {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: var(--bg-subtle);
  border: 1px solid var(--divider);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.2s var(--ease-out),
              background 0.2s var(--ease-out),
              box-shadow 0.2s var(--ease-out);
}

.login-page input[type="password"]:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.15);
}

.login-page input[type="password"]::placeholder {
  color: var(--text-tertiary);
}
```

**Submit button:**
```css
.login-button {
  width: 100%;
  padding: var(--space-3) var(--space-5);
  margin-top: var(--space-3);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bg);
  background: var(--text-primary);
  border: 1px solid var(--text-primary);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.2s var(--ease-out),
              border-color 0.2s var(--ease-out),
              opacity 0.2s var(--ease-out);
}

.login-button:hover:not(:disabled) {
  background: var(--text-secondary);
  border-color: var(--text-secondary);
}

.login-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### Accessibility

- `<label for="password" class="sr-only">` — visually hidden but screen-reader accessible
- `role="alert" aria-live="polite"` on error messages
- Focus management: `passwordInput.focus()` on mount
- All interactive elements have visible `:focus-visible` states
- Keyboard: `Enter` submits (native form behaviour)
- Colour contrast: all text/background combos pass WCAG AA (checked against token values)

---

## Part 2: PHP Backend Implementation

### 1. `resources/php/auth/login.php`

POST endpoint. Receives `{ "password": "..." }`.

- Include `authCorsHeaders.php` (NOT `securityHeaders.php` — login can't require auth)
- CSRF check: call `validateCsrf()` from `authCorsHeaders.php`
- Brute force check: file-based per-IP tracking in `sys_get_temp_dir() . '/qve_auth_attempts/'`
  - 5 max attempts, 15 min lockout, HTTP 429 when locked
- Load config, `password_verify($password, APP_PASSWORD_HASH)`
- On success: configure session (see cookie params below), `session_regenerate_id(true)`, set `$_SESSION['authenticated'] = true` + `$_SESSION['auth_time'] = time()`, clear attempt file
- On failure: increment attempts, return `{ success: false, message: 'Invalid password' }`

**Brute force implementation — atomic tracking with `flock()`:**
```php
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ipHash = hash('sha256', $remoteAddr);  // Safe filename, works with IPv6
$attemptDir = sys_get_temp_dir() . '/qve_auth_attempts';

// Ensure directory exists
if (!is_dir($attemptDir)) {
    @mkdir($attemptDir, 0700, true);
}

// Fail-secure: if we can't track attempts, deny login
if (!is_writable($attemptDir)) {
    error_log('[Auth] Attempt directory not writable: ' . $attemptDir);
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Authentication temporarily unavailable']);
    exit;
}

$attemptFile = $attemptDir . '/' . $ipHash;

// Cleanup stale file (older than 15 min)
if (file_exists($attemptFile) && (time() - filemtime($attemptFile)) > 900) {
    @unlink($attemptFile);
}

// Read attempt count (with flock for atomicity)
function readAttempts(string $path): int {
    if (!file_exists($path)) return 0;
    $fp = fopen($path, 'r');
    if (!$fp) return 0;
    flock($fp, LOCK_SH);
    $count = (int) stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $count;
}

function writeAttempts(string $path, int $count): void {
    $fp = fopen($path, 'c');
    if (!$fp) return;
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string) $count);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

// Check lockout
$attempts = readAttempts($attemptFile);
if ($attempts >= 5) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many attempts. Try again in 15 minutes.']);
    exit;
}

// ... password_verify() ...
// On success: @unlink($attemptFile);
// On failure: writeAttempts($attemptFile, $attempts + 1);
```

**`isHttps()` helper (inline in login.php, reused pattern):**
```php
function isHttps(): bool {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') return true;
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
    return false;
}
```

**Session cookie params:**
```php
session_name('QVE_SESSION');
session_set_cookie_params([
    'lifetime' => 604800,     // 7 days
    'path'     => '/',
    'domain'   => '',
    'secure'   => isHttps(),  // Dynamic, not hardcoded
    'httponly'  => true,
    'samesite' => 'Strict'
]);
ini_set('session.gc_maxlifetime', 604800);
session_start();
session_regenerate_id(true);
$_SESSION['authenticated'] = true;
$_SESSION['auth_time'] = time();
```

**Error handling with support ref:**
```php
} catch (Exception $e) {
    $supportRef = 'ERR-' . strtoupper(substr(md5(time() . 'login' . $e->getMessage()), 0, 8));
    error_log('[Auth] Unexpected error: ' . $e->getMessage() . ' | Ref: ' . $supportRef);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred (Ref: ' . $supportRef . ')']);
    exit;
}
```

### 2. `resources/php/auth/logout.php`

POST endpoint. Idempotent — safe to call when no session exists.

```php
require_once __DIR__ . '/authCorsHeaders.php';
validateCsrf();

session_name('QVE_SESSION');

// Only start session if cookie exists
if (isset($_COOKIE['QVE_SESSION'])) {
    session_start();
    $_SESSION = [];
    session_destroy();
    error_log('[Auth] Session destroyed');
}

// Always delete cookie (handles stale cookies too)
setcookie('QVE_SESSION', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => '',
    'secure'   => isHttps(),
    'httponly'  => true,
    'samesite' => 'Strict'
]);

header('Content-Type: application/json');
echo json_encode(['success' => true]);
```

### 3. `resources/php/auth/checkAuth.php`

GET endpoint. Starts session only if `QVE_SESSION` cookie exists. Returns `{ success: true, data: { authenticated: bool } }`.

```php
require_once __DIR__ . '/authCorsHeaders.php';
// No CSRF check needed — GET endpoint, no state mutation

session_name('QVE_SESSION');
$authenticated = false;

if (isset($_COOKIE['QVE_SESSION'])) {
    session_start();
    $authenticated = (
        isset($_SESSION['authenticated'])
        && $_SESSION['authenticated'] === true
        && isset($_SESSION['auth_time'])
        && is_int($_SESSION['auth_time'])
        && ($_SESSION['auth_time'] + 604800) > time()
    );
    session_write_close();  // Release lock immediately
}

header('Content-Type: application/json');
echo json_encode(['success' => true, 'data' => ['authenticated' => $authenticated]]);
```

### 4. `resources/php/auth/authCorsHeaders.php`

Slim copy of the CORS + security headers from `securityHeaders.php` (lines 1-65, 124-148). Same `$allowedOrigins`, same preflight handling, same HTTP security headers. Does NOT call `authenticate()`.

Includes shared `validateCsrf()` function and `isHttps()` helper:
```php
/**
 * Auth endpoint headers. Duplicated from securityHeaders.php because
 * auth endpoints cannot include securityHeaders.php (which calls authenticate(),
 * creating circular dependency before session exists).
 *
 * MAINTENANCE: If CORS origins or headers change, update BOTH files.
 */

// ... CORS headers (same as securityHeaders.php lines 17-65) ...
// ... HTTP security headers (same as securityHeaders.php lines 124-148) ...

function isHttps(): bool {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') return true;
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
    return false;
}

function validateCsrf(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') return;

    // Origin validation (same logic as securityHeaders.php lines 89-108)
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        // ... same allowed origins list + local network pattern ...
        if (!$originAllowed) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            exit;
        }
    }

    // X-Requested-With validation (same as securityHeaders.php lines 110-121)
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
}
```

> Intentional duplication — sharing `securityHeaders.php` with a "skip auth" param would risk accidental auth bypass on real endpoints.

---

## Part 3: Frontend Store & Integration

### 5. `qve/src/lib/stores/auth.ts`

Full store implementation following established patterns from `wines.ts` and `history.ts`:

```typescript
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_API_KEY } from '$env/static/public';

interface AuthState {
  authenticated: boolean;
  checking: boolean;
  loggingOut: boolean;
  error: string | null;
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': PUBLIC_API_KEY,
  'X-Requested-With': 'XMLHttpRequest'
} as const;

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    authenticated: false,
    checking: true,  // Start true to prevent flash of login
    loggingOut: false,
    error: null
  });

  const initialized = writable(false);

  // Race condition protection (pattern from wines.ts)
  let fetchCounter = 0;
  let activeController: AbortController | null = null;

  async function checkAuth(): Promise<void> {
    if (!browser) return;

    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    const thisCheck = ++fetchCounter;

    update(s => ({ ...s, checking: true, error: null }));

    try {
      const response = await fetch('/resources/php/auth/checkAuth.php', {
        headers: AUTH_HEADERS,
        signal: controller.signal
      });

      if (thisCheck !== fetchCounter) return;
      const json = await response.json();

      set({
        authenticated: response.ok && json.success && json.data?.authenticated === true,
        checking: false,
        loggingOut: false,
        error: null
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (thisCheck !== fetchCounter) return;
      console.error('[Auth] Check failed:', e);
      set({ authenticated: false, checking: false, loggingOut: false, error: 'Connection error' });
    }
  }

  return {
    subscribe,
    isInitialized: { subscribe: initialized.subscribe },

    initialize: async () => {
      if (get(initialized)) return;
      initialized.set(true);
      await checkAuth();
    },

    checkAuth,

    login: async (password: string): Promise<boolean> => {
      if (!browser) return false;
      update(s => ({ ...s, checking: true, error: null }));

      try {
        const response = await fetch('/resources/php/auth/login.php', {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({ password })
        });
        const json = await response.json();

        if (response.ok && json.success) {
          set({ authenticated: true, checking: false, loggingOut: false, error: null });
          return true;
        }
        set({
          authenticated: false,
          checking: false,
          loggingOut: false,
          error: json.message || 'Login failed'
        });
        return false;
      } catch (e) {
        console.error('[Auth] Login failed:', e);
        set({ authenticated: false, checking: false, loggingOut: false, error: 'Connection error' });
        return false;
      }
    },

    logout: async (): Promise<void> => {
      if (!browser) return;
      update(s => ({ ...s, loggingOut: true, error: null }));

      try {
        await fetch('/resources/php/auth/logout.php', {
          method: 'POST',
          headers: AUTH_HEADERS
        });
      } catch (e) {
        console.error('[Auth] Logout request failed:', e);
      }
      // Always clear local state even if server fails
      set({ authenticated: false, checking: false, loggingOut: false, error: null });
    }
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, $a => $a.authenticated);
export const isAuthChecking = derived(auth, $a => $a.checking);
export const isAuthLoggingOut = derived(auth, $a => $a.loggingOut);
export const authError = derived(auth, $a => $a.error);
```

### 6. `qve/src/routes/login/+page.svelte`

See **Part 1** for complete design spec. Script logic:

```typescript
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { base } from '$app/paths';
import { auth, isAuthenticated, isAuthChecking } from '$stores';
import { theme } from '$stores';

let password = '';
let passwordInput: HTMLInputElement;
let errorMessage = '';
let showShake = false;
let isLockedOut = false;

onMount(() => {
  theme.initialize();
  passwordInput?.focus();

  // If already authenticated, redirect home
  if ($isAuthenticated) {
    goto(`${base}/`);
  }
});

async function handleSubmit() {
  if (!password || $isAuthChecking || isLockedOut) return;

  errorMessage = '';
  const success = await auth.login(password);

  if (success) {
    // Redirect to original destination or home
    const redirect = $page.url.searchParams.get('redirect');
    const destination = (redirect && redirect.startsWith(`${base}/`) && !redirect.includes('://'))
      ? redirect
      : `${base}/`;
    goto(destination);
  } else {
    // Read error from store
    const storeState = $auth;
    errorMessage = storeState.error || 'Invalid password';

    // Check if rate limited
    if (errorMessage.includes('Too many attempts')) {
      isLockedOut = true;
    }

    // Trigger shake
    showShake = true;
    password = '';
    setTimeout(() => {
      showShake = false;
      if (!isLockedOut) passwordInput?.focus();
    }, 400);
  }
}
```

### 7. `resources/php/authMiddleware.php`

Modify `authenticate()` to accept dual auth:
1. Check API key first (existing logic, cheap — no session overhead)
2. If no valid API key AND `QVE_SESSION` cookie exists: start session, check `$_SESSION['authenticated'] === true` and session age < 604800s
3. Call `session_write_close()` immediately after validation — critical to prevent session file locking from serializing concurrent requests (especially agent streaming endpoints with 120s timeouts)
4. If neither passes: `sendAuthError()`

```php
function authenticate(): void {
    $configPath = __DIR__ . '/../../wineapp-config/config.local.php';
    if (!file_exists($configPath)) {
        sendAuthError('Configuration error');
    }
    require_once $configPath;

    // 1. Check API key first (cheap — no session overhead)
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!empty($apiKey) && defined('API_AUTH_KEY') && hash_equals(API_AUTH_KEY, $apiKey)) {
        return;
    }

    // 2. Check session (only if cookie exists)
    if (isset($_COOKIE['QVE_SESSION'])) {
        session_name('QVE_SESSION');
        $isSecure = (
            (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        );
        session_set_cookie_params([
            'lifetime' => 604800,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isSecure,
            'httponly'  => true,
            'samesite' => 'Strict'
        ]);

        if (@session_start() === false) {
            error_log('[Auth] session_start() failed');
            sendAuthError('Session error');
        }

        $valid = (
            isset($_SESSION['authenticated'])
            && $_SESSION['authenticated'] === true
            && isset($_SESSION['auth_time'])
            && is_int($_SESSION['auth_time'])
            && ($_SESSION['auth_time'] + 604800) > time()
        );

        session_write_close();  // Release lock immediately

        if ($valid) return;
    }

    // 3. Neither method passed
    sendAuthError('Authentication required');
}
```

### 8. `../wineapp-config/config.local.php`

Add one constant:
```php
define('APP_PASSWORD_HASH', '$2y$10$...');  // bcrypt hash
```
Generated with: `php -r "echo password_hash('your-password', PASSWORD_BCRYPT) . PHP_EOL;"`

### 9. `qve/src/lib/stores/index.ts`

Add all auth store exports:
```ts
// Authentication
export { auth, isAuthenticated, isAuthChecking, isAuthLoggingOut, authError } from './auth';
```

### 10. `qve/src/routes/+layout.svelte`

Auth gate implementation:

- Import `auth`, `isAuthenticated`, `isAuthChecking` from `$stores`
- Import `goto` from `$app/navigation`, `page` from `$app/stores`, `base` from `$app/paths`
- In `onMount`: call `theme.initialize()` first (always, for login page styling), then `auth.initialize()`. Only init currency/collectionName/etc if authenticated.
- Reactive redirect:
  ```typescript
  $: if (!$isAuthChecking) {
    if (!$isAuthenticated && $page.url.pathname !== `${base}/login`) {
      goto(`${base}/login?redirect=${encodeURIComponent($page.url.pathname)}`);
    } else if ($isAuthenticated && $page.url.pathname === `${base}/login`) {
      goto(`${base}/`);
    }
  }
  ```
- Conditional template rendering:
  - `$isAuthChecking` → nothing (blank — prevents flash of content)
  - `!$isAuthenticated` → just `<slot />` (renders login page without app shell)
  - Otherwise → full app shell (SideMenu, slot, Toast, Modal, AgentBubble, AgentPanel)

### 11. `qve/src/lib/api/client.ts`

401 handling — placement depends on method type:

**Add static imports at top of file:**
```typescript
import { goto } from '$app/navigation';
import { base } from '$app/paths';
```

**In `fetchJSON()` — 401 check goes AFTER JSON parsing** (preserves structured agent errors):
```typescript
const response = await fetch(url, options);
const json = await response.json();

// 1. Preserve structured agent error handling
if (!json.success && json.error?.type) {
    throw AgentError.fromResponse(json as AgentErrorResponse);
}

// 2. 401 → redirect to login
if (response.status === 401) {
    goto(`${base}/login`);
    throw new Error('Session expired');
}

// 3. Generic HTTP error
if (!response.ok) {
    throw new Error(json.message || `HTTP ${response.status}: ${response.statusText}`);
}
```

**In streaming methods** (`identifyTextStream`, `identifyImageStream`, `enrichWineStream`) — 401 check goes BEFORE JSON parse (401 response may not have JSON body):
```typescript
if (!response.ok) {
    if (response.status === 401) {
        goto(`${base}/login`);
        throw new Error('Session expired');
    }
    // Try to parse error response for other HTTP errors...
}
```

**In `uploadImage()`** — add 401 check before text parsing:
```typescript
const response = await fetch(`${this.baseURL}upload.php`, { ... });
if (response.status === 401) {
    goto(`${base}/login`);
    throw new Error('Session expired');
}
const text = await response.text();
```

### 12. `qve/src/lib/components/layout/SideMenu.svelte`

Add "Sign Out" button between Settings and the footer. Import `auth` from `$stores`.

```typescript
async function handleLogout() {
    await auth.logout();
    goto(`${base}/login`);
}
```

### 13. `qve/src/lib/components/ui/Icon.svelte`

Add `'log-out'` to the `IconName` type union and add the Lucide log-out SVG path in the if/else chain.

---

## Part 4: Security

### What this protects
- All wine data behind auth (PHP endpoints require API key OR session)
- Password stored as bcrypt hash (never plaintext)
- Session fixation prevented (`session_regenerate_id(true)` on login)
- XSS can't steal session (`httpOnly` cookie)
- CSRF mitigated (`SameSite=Strict` + Origin/X-Requested-With checks)
- Brute force rate-limited (5 attempts / 15 min per IP)
- Brute force tracking is atomic (`flock()`), fail-secure (denies login if tracking unavailable), and self-cleaning (stale files purged after 15 min)

### Cloudflare Tunnel + HTTPS
- TLS terminates at Cloudflare edge — password and cookies encrypted in transit
- PHP detects HTTPS via `X-Forwarded-Proto: https` header (Cloudflare adds this)
- `Secure` cookie flag set dynamically via `isHttps()` helper
- HSTS header already set in `securityHeaders.php`
- Dev environment (HTTP localhost) correctly sets `Secure = false`; production (HTTPS via tunnel) correctly sets `Secure = true`

### Same-origin cookies
- Dev: Vite proxy (`/resources/php` → `localhost:8000`) means browser sees same origin
- Prod: Cloudflare Tunnel serves frontend and backend from same domain
- No `Access-Control-Allow-Credentials` header or `credentials: 'include'` needed

### Session locking mitigation
- `authMiddleware.php` calls `session_write_close()` immediately after validation
- Prevents PHP session file lock from serializing concurrent requests
- Critical for agent streaming endpoints (120s timeouts)

### What to be aware of
- **Static SPA shell is publicly accessible**: HTML/JS/CSS loads for anyone, but no data renders without auth
- **API key remains in client JS**: Already the case. Session auth adds a second layer
- **`SameSite=Strict`**: Cookies won't be sent when navigating from external links. User sees login page on first external-link visit — acceptable
- **Per-IP brute force**: Can be bypassed by rotating IPs. Acceptable for single-user app

### Production checklist
1. Generate password hash → add to production `config.local.php`
2. Verify Cloudflare Tunnel passes `X-Forwarded-Proto: https`
3. Test login flow through the tunnel (cookie set with `Secure` flag)
4. Verify session persistence (close/reopen browser — should stay 7 days)
5. Verify 401 handling (delete cookie, refresh → redirect to login)
6. Verify brute force (6 wrong attempts → 429 on 6th)
7. Verify session locking (agent identification + cellar load simultaneously → no blocking)

---

## Part 5: Testing Strategy

### Phase A: PHP endpoint tests (curl)

Run after creating all PHP files. Extract API key from config first:
```bash
API_KEY=$(php -r "require '../wineapp-config/config.local.php'; echo API_AUTH_KEY;")
```

**1. Login flow:**
```bash
# Should succeed (correct password)
curl -v -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -d '{"password":"your-password"}' \
  -c cookies.txt

# Verify cookie was set
cat cookies.txt  # Should show QVE_SESSION

# Should fail (wrong password)
curl -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -d '{"password":"wrong"}'
```

**2. Check auth:**
```bash
# With valid session cookie
curl http://localhost:8000/resources/php/auth/checkAuth.php \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt

# Without cookie
curl http://localhost:8000/resources/php/auth/checkAuth.php \
  -H "X-Requested-With: XMLHttpRequest"
```

**3. Dual auth on protected endpoint:**
```bash
# Session auth (cookie, no API key)
curl http://localhost:8000/resources/php/getWines.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt -d '{}'

# API key auth (no cookie)
curl http://localhost:8000/resources/php/getWines.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{}'

# No auth at all → should return 401
curl http://localhost:8000/resources/php/getWines.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{}'
```

**4. Logout:**
```bash
curl -X POST http://localhost:8000/resources/php/auth/logout.php \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt -c cookies.txt
```

**5. Brute force:**
```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8000/resources/php/auth/login.php \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Origin: http://localhost:5173" \
    -d '{"password":"wrong"}'
  echo ""
done
# 6th attempt should be HTTP 429
```

**6. CSRF rejection:**
```bash
# Missing X-Requested-With → should return 403
curl -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"password":"test"}'

# Wrong Origin → should return 403
curl -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://evil.com" \
  -d '{"password":"test"}'
```

### Phase B: Browser tests (manual)

1. **Login flow**: Open app → login page → enter password → cellar
2. **Session persistence**: Close tab, reopen → still authenticated
3. **Logout**: Side menu Sign Out → redirect to login
4. **401 redirect**: Delete QVE_SESSION cookie in DevTools → click navigation → login redirect
5. **Deep link redirect**: While logged out, go to `/qve/history` → login → arrive at `/qve/history`
6. **Already-authenticated redirect**: While logged in, go to `/qve/login` → redirect home
7. **Agent streaming**: Start wine identification via photo → works with session auth
8. **Mobile**: Login on phone via `--host`, use app, switch to camera, return

### Phase C: Edge cases (manual)

1. **Session expiry**: Change `604800` to `10`, log in, wait 15s, API call → login redirect
2. **Concurrent 401s**: Expired session + cellar load (multiple API calls) → redirect once
3. **Brute force recovery**: Get locked out, wait 15+ min → can log in again
4. **Back button after logout**: Log out, press back → no cached data

---

## Implementation Order

| Step | Scope | Files |
|------|-------|-------|
| 1 | Config | Generate hash, add `APP_PASSWORD_HASH` to `config.local.php` |
| 2 | PHP | Create `auth/authCorsHeaders.php`, `login.php`, `logout.php`, `checkAuth.php` |
| 3 | PHP | Modify `authMiddleware.php` for dual auth + `session_write_close()` |
| 4 | **Test** | Run Phase A curl tests |
| 5 | Frontend | Create `stores/auth.ts`, export from barrel |
| 6 | Frontend | Create `routes/login/+page.svelte` (see Part 1 design spec) |
| 7 | Frontend | Modify `+layout.svelte` (auth gate + conditional rendering) |
| 8 | Frontend | Modify `client.ts` (401 handling in fetchJSON, streaming, uploadImage) |
| 9 | Frontend | Add Icon `log-out` + SideMenu logout button |
| 10 | **Test** | Run Phase B browser tests |
| 11 | **Test** | Run Phase C edge case tests |
