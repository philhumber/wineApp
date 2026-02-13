# Multi-User Authentication Plan

**Status**: RFC (Request for Comments)
**Created**: 2026-02-13
**Author**: Design session — Phil + Claude
**Depends on**: `MULTIUSER_DB_DESIGN.md` (shared DB + tenant column strategy)

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Phase A — Multi-User Login (Foundation)](#2-phase-a--multi-user-login-foundation)
3. [Phase B — Invites + Self-Service](#3-phase-b--invites--self-service)
4. [Phase C — Email OTP 2FA (High-Level)](#4-phase-c--email-otp-2fa-high-level)
5. [Phase D — Session Hardening (High-Level)](#5-phase-d--session-hardening-high-level)
6. [New Tables Summary](#6-new-tables-summary)
7. [Security Considerations](#7-security-considerations)
8. [Open Questions](#8-open-questions)

---

## 1. Design Decisions

Decisions locked in during brainstorm session (2026-02-13):

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build vs external provider | **Build in PHP** | Full control, no dependency, no cost, fits existing stack. External providers (Auth0, Clerk) add complexity that doesn't pay off for dozens-to-hundreds of users. |
| Registration model | **Invite-only** | Admin generates invite link, recipient creates their account. Controlled rollout, no spam accounts. |
| Email service | **SendGrid** | Free tier: 100 emails/day. More than enough for invites + password resets. Phil already setting up the account. |
| 2FA approach | **Skip for now** | Data is not identifiable or sensitive — low risk. Enforce stronger password requirements instead. If 2FA is added later, use email OTP (no Google Authenticator, no phone numbers). |
| Session model | **PHP sessions (existing)** | Already built and working. Evolve from `$_SESSION['authenticated']` to `$_SESSION['user_id']`. No JWT. |
| Password storage | **bcrypt via `password_hash()`** | Already in use. No change. |
| Scope | **Phase A + B detailed, C + D high-level** | Get multi-user login and self-service working first. |

### Password Requirements

Since we're skipping 2FA, enforce slightly better password standards:

- **Minimum 10 characters** (up from no requirement)
- **At least 1 uppercase, 1 lowercase, 1 number**
- **No special character requirement** (encourages longer passphrases over `P@ssw0rd!` patterns)
- **Maximum 128 characters** (prevent bcrypt truncation at 72 bytes while allowing generous input)
- Validated on both frontend (instant feedback) and backend (enforced)
- Checked on registration and password change — **not** retroactively on existing login (would lock people out)

---

## 2. Phase A — Multi-User Login (Foundation)

**Goal**: Replace single shared password with per-user email + password accounts. Phil's existing data stays intact. The session carries a real user identity.

### 2.1 Database Changes

#### Rename `agentUsers` → `users`, extend with auth columns

```sql
-- Step 1: Rename table
ALTER TABLE agentUsers RENAME TO users;

-- Step 2: Add auth columns
ALTER TABLE users
    ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER displayName,
    ADD COLUMN avatar_url VARCHAR(500) NULL AFTER password_hash,
    ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER avatar_url,
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER role,
    ADD COLUMN last_login_at TIMESTAMP NULL AFTER email_verified,
    ADD COLUMN status ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active' AFTER last_login_at;

-- Step 3: Make email unique and NOT NULL (required for login)
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(255) NOT NULL,
    ADD UNIQUE INDEX idx_email (email);

-- Step 4: Seed Phil's account (user 1 already exists in agentUsers)
UPDATE users SET
    email = 'phil.humber@gmail.com',
    displayName = 'Phil Humber',
    password_hash = '<bcrypt hash generated at deploy time>',
    role = 'admin',
    email_verified = TRUE,
    status = 'active'
WHERE id = 1;
```

**Migration safety**: The `DEFAULT ''` on `password_hash` and `DEFAULT 'active'` on `status` mean any existing rows survive the ALTER. Phil's row is updated with real values in Step 4.

#### Update agent table FKs

The agent tables (`agentSessions`, `agentUserTasteProfile`, etc.) already reference `agentUsers(id)` via foreign keys. After the rename to `users`, MySQL automatically updates the FK target. No manual FK changes needed — verify with:

```sql
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'users' AND TABLE_SCHEMA = 'winelist';
```

### 2.2 PHP Backend Changes

#### `login.php` — Email + password lookup

**Current**: Validates against single `APP_PASSWORD_HASH` from config.
**Target**: Looks up user by email, validates per-row password hash.

Key changes:
```
1. Parse { email, password } from request body (was just { password })
2. Validate both fields are non-empty
3. SELECT id, password_hash, status, displayName, email
   FROM users WHERE email = :email AND status = 'active'
4. If no row found → 401 "Invalid email or password" (generic, no leak)
5. password_verify($password, $row['password_hash']) → same generic 401 on failure
6. On success:
   - $_SESSION['user_id'] = (int) $row['id']
   - $_SESSION['authenticated'] = true  (keep for backward compat during transition)
   - $_SESSION['auth_time'] = time()
   - UPDATE users SET last_login_at = NOW() WHERE id = :id
7. Return { success: true, user: { id, displayName, email } }
```

**Brute force**: Keep existing IP-based tracking. Additionally, add per-email rate limiting (5 attempts / 15 min per email address) to prevent credential stuffing against a specific account. Use the same file-based approach with `email_` prefix on the hash filename.

**Backward compatibility**: The `APP_PASSWORD_HASH` config constant is no longer used by `login.php`. Remove from config after migration is verified.

#### `checkAuth.php` — Return user object

**Current**: Returns `{ authenticated: bool }`.
**Target**: Returns `{ authenticated: bool, user: { id, displayName, email, role } | null }`.

```
1. Read $_SESSION['user_id'] instead of just $_SESSION['authenticated']
2. If valid session with user_id:
   - SELECT id, displayName, email, role FROM users
     WHERE id = :userId AND status = 'active'
   - If user found → return authenticated + user object
   - If user not found (deleted/suspended since login) → return not authenticated
3. Otherwise → return not authenticated
```

This DB check on every `checkAuth` call catches accounts that are suspended/deleted between logins. The query is indexed (PK lookup) and cheap.

#### `authMiddleware.php` — Extract `user_id`

**Current**: Returns void (just validates). Endpoints don't know *who* is authenticated.
**Target**: Returns the `user_id` so every endpoint can use it for tenant filtering.

```php
/**
 * Authenticate and return user ID.
 *
 * API key auth → returns user_id = 1 (admin/service account).
 * Session auth → returns $_SESSION['user_id'].
 *
 * @return int The authenticated user's ID
 */
function requireAuth(): int
{
    // 1. API key → user 1 (service/admin account)
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($apiKey !== '' && defined('API_AUTH_KEY') && hash_equals(API_AUTH_KEY, $apiKey)) {
        return 1;
    }

    // 2. Session cookie
    if (isset($_COOKIE['QVE_SESSION'])) {
        session_name('QVE_SESSION');
        // ... session_set_cookie_params (same as now) ...
        if (@session_start() === false) {
            sendAuthError('Session error');
        }

        $userId = $_SESSION['user_id'] ?? null;
        $authTime = $_SESSION['auth_time'] ?? null;

        session_write_close();

        if ($userId !== null && is_int($authTime) && ($authTime + 604800) > time()) {
            return (int) $userId;
        }
    }

    sendAuthError();
}
```

**Transition strategy**: Keep the old `authenticate()` function as a thin wrapper that calls `requireAuth()` and discards the return value. This way existing endpoints don't break during the transition — they still call `authenticate()` but gain `user_id` awareness once updated to call `requireAuth()` directly.

```php
// Backward compat — existing endpoints call this via securityHeaders.php
function authenticate(): void
{
    requireAuth(); // Validates and returns user_id, but we discard it here
}
```

#### `securityHeaders.php` — Thread `$userId` through

Once `authMiddleware.php` exposes `requireAuth()`, `securityHeaders.php` can capture the result:

```php
// In securityHeaders.php, after CORS handling:
$GLOBALS['authenticatedUserId'] = requireAuth();
```

Individual endpoints then access `$GLOBALS['authenticatedUserId']` or call `requireAuth()` directly. The global approach keeps the change minimal for the ~20 existing endpoints — they don't need to change their `require_once 'securityHeaders.php'` pattern.

#### Endpoint migration pattern

Every endpoint that touches user-owned data gets this pattern:

```php
// Before (single user):
$stmt = $pdo->prepare("SELECT * FROM wine WHERE deleted = 0");

// After (multi-user):
$userId = $GLOBALS['authenticatedUserId'];
$stmt = $pdo->prepare("SELECT * FROM wine WHERE user_id = :userId AND deleted = 0");
$stmt->execute(['userId' => $userId]);
```

**Phase A does NOT add `user_id` columns to data tables** — that's the separate DB migration in `MULTIUSER_DB_DESIGN.md` Phase 1. Phase A only modifies the auth endpoints and session handling. The `$userId` capture is ready for when the tenant columns land.

### 2.3 Frontend Changes

#### `stores/auth.ts` — Add `currentUser`

```typescript
interface User {
    id: number;
    displayName: string;
    email: string;
    role: 'user' | 'admin';
}

interface AuthState {
    authenticated: boolean;
    checking: boolean;
    loggingOut: boolean;
    error: string | null;
    user: User | null;  // NEW
}
```

Changes to store methods:

| Method | Current | Phase A |
|--------|---------|---------|
| `login(password)` | Sends `{ password }` | Sends `{ email, password }`. On success, stores `user` from response. |
| `checkAuth()` | Reads `data.authenticated` | Also reads `data.user` and stores it. |
| `logout()` | Clears `authenticated` | Also clears `user`. |

New derived stores:

```typescript
export const currentUser = derived(auth, $a => $a.user);
export const isAdmin = derived(auth, $a => $a.user?.role === 'admin');
```

#### Login page — Email + password fields

Evolve the login form from password-only to email + password:

```
┌─────────────────────────────────────────────┐
│                                             │
│                   Qvé                       │
│                  ─────                      │
│                                             │
│              ┌───────────┐                  │
│              │ Email      │                 │  ← New: email input
│              └───────────┘                  │
│              ┌───────────┐                  │
│              │ ●●●●●●●●  │                  │  ← Existing: password input
│              └───────────┘                  │
│                                             │
│              ┌───────────┐                  │
│              │  ENTER     │                 │
│              └───────────┘                  │
│                                             │
│              Forgot password?               │  ← New: link (Phase B)
│                                             │
│              Invalid email or password      │  ← Generic error
│                                             │
└─────────────────────────────────────────────┘
```

Design notes:
- Same wine-cellar-entrance aesthetic — just one more input field
- Email input: `type="email"`, `autocomplete="username"` (browser password managers expect this)
- Password input: `autocomplete="current-password"` (already set)
- "Forgot password?" link added but **disabled/hidden until Phase B** implements the reset flow
- Error messages stay generic: "Invalid email or password" — never reveal whether the email exists
- Tab order: email → password → Enter button
- Autofocus on email input (was on password)

#### Layout gate — No changes needed

The existing `+layout.svelte` auth gate logic (`$isAuthenticated` / `$isAuthChecking`) works as-is. It doesn't care *how* auth works, just whether the session is valid.

#### SideMenu — Show current user

Add the user's display name to the side menu, above the "Log out" item:

```
┌─────────────────┐
│  Qvé             │
│                  │
│  Cellar          │
│  History         │
│  Settings        │
│                  │
│  ─────────────── │
│  Phil Humber     │  ← New: from $currentUser.displayName
│  Log out         │
└─────────────────┘
```

### 2.4 Config Changes

#### `config.local.php`

```php
// REMOVE (no longer used after migration verified):
// define('APP_PASSWORD_HASH', '$2y$10$...');

// KEEP (unchanged):
define('API_AUTH_KEY', '...');

// ADD (for SendGrid in Phase B):
// define('SENDGRID_API_KEY', '...');
```

### 2.5 Implementation Order

| Step | Scope | Files | Notes |
|------|-------|-------|-------|
| 1 | Database | Migration SQL | Rename `agentUsers` → `users`, add columns, seed Phil's account |
| 2 | PHP | `authMiddleware.php` | Add `requireAuth()` returning `int`, keep `authenticate()` wrapper |
| 3 | PHP | `login.php` | Email + password lookup against `users` table, per-email rate limiting |
| 4 | PHP | `checkAuth.php` | Return user object, verify account still active |
| 5 | PHP | `logout.php` | No changes needed (session destroy works the same) |
| 6 | **Test** | curl | Full Phase A backend test suite (see Testing section) |
| 7 | Frontend | `stores/auth.ts` | Add `User` type, `currentUser` state, update `login()` signature |
| 8 | Frontend | `login/+page.svelte` | Add email field, update form submission |
| 9 | Frontend | `SideMenu.svelte` | Show `$currentUser.displayName` |
| 10 | **Test** | Browser | Login flow, session persistence, 401 redirect, side menu display |

### 2.6 Testing — Phase A

#### Backend (curl)

```bash
# 1. Login with email + password
curl -v -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"phil.humber@gmail.com","password":"your-password"}' \
  -c cookies.txt
# Expect: { success: true, user: { id: 1, displayName: "Phil Humber", ... } }

# 2. Login with wrong email
curl -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"wrong@example.com","password":"anything"}'
# Expect: 401 { success: false, message: "Invalid email or password" }

# 3. Login with wrong password (correct email)
curl -X POST http://localhost:8000/resources/php/auth/login.php \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"phil.humber@gmail.com","password":"wrong"}'
# Expect: 401 { success: false, message: "Invalid email or password" }
# (Same message for wrong email and wrong password — no leak)

# 4. Check auth returns user object
curl http://localhost:8000/resources/php/auth/checkAuth.php \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt
# Expect: { success: true, data: { authenticated: true, user: { id: 1, ... } } }

# 5. Suspended account
# Manually: UPDATE users SET status = 'suspended' WHERE id = 1;
curl http://localhost:8000/resources/php/auth/checkAuth.php \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt
# Expect: { success: true, data: { authenticated: false, user: null } }
# Restore: UPDATE users SET status = 'active' WHERE id = 1;

# 6. API key auth still works (backward compat)
curl http://localhost:8000/resources/php/getWines.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-api-key>" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{}'
# Expect: wine data (API key maps to user 1)

# 7. Per-email brute force
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8000/resources/php/auth/login.php \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Origin: http://localhost:5173" \
    -d '{"email":"phil.humber@gmail.com","password":"wrong"}'
  echo ""
done
# 6th attempt should get 429
```

#### Frontend (browser)

1. Login with email + password → lands on cellar
2. Refresh → still logged in (session persists)
3. Side menu shows "Phil Humber" above "Log out"
4. Log out → redirected to login → email + password form visible
5. Enter wrong credentials → "Invalid email or password" + shake
6. Deep link while logged out → login → redirect to original page after success

---

## 3. Phase B — Invites + Self-Service

**Goal**: Admin can invite new users. Users can reset their own password. Basic account settings page.

### 3.1 Database Changes

#### `invite_tokens` table

```sql
CREATE TABLE invite_tokens (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    token_hash  VARCHAR(64) NOT NULL COMMENT 'SHA-256 of the raw token',
    created_by  INT NOT NULL COMMENT 'Admin user who created the invite',
    email       VARCHAR(255) NULL COMMENT 'If set, invite only usable by this email',
    used_by     INT NULL COMMENT 'User who consumed the invite',
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invite_creator FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_invite_consumer FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### `password_reset_tokens` table

```sql
CREATE TABLE password_reset_tokens (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    token_hash  VARCHAR(64) NOT NULL COMMENT 'SHA-256 of the raw token',
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.2 SendGrid Integration

#### Setup

- Create SendGrid account, generate API key (Mail Send permission only)
- Add `SENDGRID_API_KEY` to `config.local.php`
- Verify sender identity: `noreply@qve-wine.com` (or domain-level verification)

#### PHP email helper

New file: `resources/php/auth/sendEmail.php`

```php
/**
 * Send transactional email via SendGrid v3 API.
 *
 * Uses cURL directly (no SDK) to keep dependencies minimal.
 *
 * @param string $to     Recipient email
 * @param string $name   Recipient display name
 * @param string $subject
 * @param string $html   HTML body
 * @return bool Success
 */
function sendEmail(string $to, string $name, string $subject, string $html): bool
{
    $payload = [
        'personalizations' => [[ 'to' => [[ 'email' => $to, 'name' => $name ]] ]],
        'from' => [ 'email' => 'noreply@qve-wine.com', 'name' => 'Qvé Wine' ],
        'subject' => $subject,
        'content' => [[ 'type' => 'text/html', 'value' => $html ]]
    ];

    $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . SENDGRID_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
}
```

No SDK, no Composer dependency. cURL to the SendGrid REST API. If SendGrid ever needs replacing, only this one function changes.

### 3.3 Invite Flow

#### How it works

```
Admin (Phil)                               Backend                              New User
    │                                          │                                    │
    ├── POST /auth/createInvite ──────────────►│                                    │
    │   { email: "friend@example.com" }        │                                    │
    │                                          ├── Generate token (random_bytes)     │
    │                                          ├── Store SHA-256(token) + email      │
    │                                          ├── Send invite email via SendGrid    │
    │◄── { success, inviteUrl } ───────────────┤                                    │
    │                                          │                                    │
    │                                          │    ◄── Clicks invite link ──────────┤
    │                                          │        /qve/register?token=abc123   │
    │                                          │                                    │
    │                                          │    ◄── POST /auth/register ─────────┤
    │                                          │        { token, displayName,        │
    │                                          │          email, password }           │
    │                                          ├── Validate token (hash, expiry,     │
    │                                          │   email match, not used)             │
    │                                          ├── Create user row                   │
    │                                          ├── Mark invite as used               │
    │                                          ├── Start session                     │
    │                                          │                                    │
    │                                          │    ──► Redirect to cellar ──────────►│
```

#### Endpoints

**`POST /auth/createInvite.php`** (admin-only):
- `requireAuth()` → check `role = 'admin'`
- Generate 32-byte token via `random_bytes(32)`, hex-encode
- Store `SHA-256(token)` in `invite_tokens` with 7-day expiry
- If `email` provided: store it (invite restricted to that address)
- Send email with link: `https://qve-wine.com/qve/register?token=<raw_token>`
- Return `{ success: true, inviteUrl: '...' }` (admin can also share link manually)
- Rate limit: max 10 invites per day per admin

**`POST /auth/register.php`**:
- Parse `{ token, displayName, email, password }`
- Hash token → look up in `invite_tokens` WHERE `token_hash = :hash AND used_by IS NULL AND expires_at > NOW()`
- If invite has `email` set → verify submitted email matches
- Validate password meets requirements (10+ chars, uppercase, lowercase, number)
- Validate email format, check not already registered
- Create `users` row with `password_hash`, `email_verified = TRUE` (invited = trusted), `status = 'active'`
- Mark invite token as `used_by = $newUserId`
- Start session (auto-login after registration)
- Return `{ success: true, user: { ... } }`

#### Frontend

**New route: `/qve/register`**
- Same wine-cellar aesthetic as login page
- Reads `?token=` from URL
- Fields: Display Name, Email (pre-filled if invite was email-restricted), Password, Confirm Password
- Password strength indicator (inline validation: length, uppercase, lowercase, number)
- On submit → POST to `register.php` → auto-login → redirect to cellar
- If token is invalid/expired → show message: "This invite link has expired. Please request a new one."

**Admin invite UI** (simple, in Settings or a separate admin page):
- Email input + "Send Invite" button
- Shows list of pending/used invites with status
- Accessible only when `$isAdmin` is true

### 3.4 Password Reset Flow

#### How it works

```
User                                      Backend                              SendGrid
  │                                          │                                    │
  ├── "Forgot password?" link ──────────────►│                                    │
  │   GET /qve/forgot-password               │                                    │
  │                                          │                                    │
  ├── POST /auth/requestReset ──────────────►│                                    │
  │   { email: "phil@example.com" }          │                                    │
  │                                          ├── Lookup user by email              │
  │                                          ├── Generate token (random_bytes)     │
  │                                          ├── Store SHA-256(token), 1hr expiry  │
  │                                          ├── Send reset email ────────────────►│
  │◄── "If account exists, check email" ─────┤                                    │
  │                                          │                                    │
  │    (checks email)                        │                                    │
  │                                          │                                    │
  ├── GET /qve/reset-password?token=abc ────►│                                    │
  │                                          │                                    │
  ├── POST /auth/resetPassword ─────────────►│                                    │
  │   { token, newPassword }                 │                                    │
  │                                          ├── Validate token (hash + expiry)    │
  │                                          ├── Update password_hash              │
  │                                          ├── Mark token used_at                │
  │                                          ├── Invalidate other sessions         │
  │                                          ├── Start new session (auto-login)    │
  │◄── { success, user } ───────────────────┤                                    │
  │                                          │                                    │
  ├── Redirect to cellar                     │                                    │
```

#### Endpoints

**`POST /auth/requestReset.php`**:
- Parse `{ email }`
- Rate limit: 1 request per email per 5 minutes (file-based, same pattern as brute force)
- Look up user by email + `status = 'active'`
- If found:
  - Invalidate any existing unused tokens for this user (UPDATE `used_at = NOW()`)
  - Generate 32-byte token, store SHA-256 hash with 1-hour expiry
  - Send reset email via SendGrid
- **Always return** `{ success: true, message: "If an account exists with that email, we've sent a reset link." }`
- Never reveal whether the email is registered

**`POST /auth/resetPassword.php`**:
- Parse `{ token, newPassword }`
- Hash token → look up in `password_reset_tokens` WHERE `token_hash = :hash AND used_at IS NULL AND expires_at > NOW()`
- If invalid → `{ success: false, message: "This reset link has expired or already been used." }`
- Validate new password meets requirements
- Update `users.password_hash`
- Mark token as `used_at = NOW()`
- Delete all PHP session files for this user (see Session Invalidation below)
- Start new session → auto-login
- Return `{ success: true, user: { ... } }`

#### Session invalidation on password reset

When a password is reset, all other sessions for that user should be invalidated. PHP's file-based sessions make this tricky — there's no table to query. Two approaches:

**Option A: `password_changed_at` timestamp** (recommended — simple):
- Add column: `ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL`
- On password reset/change: `UPDATE users SET password_changed_at = NOW()`
- In `authMiddleware.php` / `requireAuth()`: after validating the session, check `$_SESSION['auth_time'] < users.password_changed_at` → if true, session predates the password change → reject
- This is a lazy-invalidation approach: old sessions are rejected on next use rather than actively destroyed

**Option B: Active session tracking** (Phase D, `user_sessions` table):
- More complex but enables "log out all devices" UI
- Deferred to Phase D

**Recommendation**: Option A for Phase B. It's one column and one additional check in `requireAuth()`. No extra tables.

```sql
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL AFTER last_login_at;
```

```php
// In requireAuth(), after session validation:
$stmt = $pdo->prepare("SELECT password_changed_at FROM users WHERE id = :id");
$stmt->execute(['id' => $userId]);
$row = $stmt->fetch();
if ($row && $row['password_changed_at'] !== null) {
    $changedAt = strtotime($row['password_changed_at']);
    if ($authTime < $changedAt) {
        // Session predates password change — reject
        sendAuthError();
    }
}
```

This adds one lightweight query to auth validation. Could be cached in the session itself and only checked every N minutes if performance becomes a concern (it won't at this scale).

#### Frontend

**New route: `/qve/forgot-password`**
- Same minimal design as login page
- Single email input + "Send Reset Link" button
- On submit → always shows "If an account exists, we've sent a reset link."
- Link back to login page

**New route: `/qve/reset-password`**
- Reads `?token=` from URL
- New password + confirm password fields
- Password strength indicator (same as registration)
- On submit → POST to `resetPassword.php` → auto-login → redirect to cellar
- If token invalid → message + link to request new reset

**Login page update**:
- Add "Forgot password?" link below the form (small, subtle, `var(--text-tertiary)`)

### 3.5 Account Settings

**New route: `/qve/settings/account`** (or section within existing Settings modal)

Features:
- **Display name**: editable text field
- **Email**: displayed (read-only for now — email change requires verification flow, defer)
- **Change password**: current password + new password + confirm, with strength indicator
- **Avatar**: future (URL-based, not file upload — defer)

Endpoint: **`POST /auth/updateAccount.php`**
- `requireAuth()` → get `$userId`
- Accept `{ displayName?, currentPassword?, newPassword? }`
- If changing password: verify `currentPassword` first, validate new password, update `password_hash` + `password_changed_at`
- If changing display name: update `displayName`
- Return updated user object

### 3.6 Email Templates

Keep templates minimal — inline CSS, no images, plain and functional:

**Invite email**:
```
Subject: You're invited to Qvé

Hi,

You've been invited to join Qvé — a personal wine cellar app.

[Create Your Account]  →  https://qve-wine.com/qve/register?token=...

This link expires in 7 days.

— Qvé
```

**Password reset email**:
```
Subject: Reset your Qvé password

Hi {displayName},

We received a request to reset your password.

[Reset Password]  →  https://qve-wine.com/qve/reset-password?token=...

This link expires in 1 hour. If you didn't request this, you can ignore this email.

— Qvé
```

### 3.7 Implementation Order

| Step | Scope | Files | Notes |
|------|-------|-------|-------|
| 1 | Database | Migration SQL | Create `invite_tokens`, `password_reset_tokens` tables. Add `password_changed_at` to `users`. |
| 2 | PHP | `auth/sendEmail.php` | SendGrid cURL helper |
| 3 | PHP | `auth/createInvite.php` | Admin-only invite generation + email |
| 4 | PHP | `auth/register.php` | Token validation + account creation |
| 5 | PHP | `auth/requestReset.php` | Reset token generation + email |
| 6 | PHP | `auth/resetPassword.php` | Token validation + password update |
| 7 | PHP | `auth/updateAccount.php` | Display name + password change |
| 8 | PHP | `authMiddleware.php` | Add `password_changed_at` check |
| 9 | **Test** | curl | Full Phase B backend test suite |
| 10 | Frontend | `/qve/register` | Registration page |
| 11 | Frontend | `/qve/forgot-password` | Request reset page |
| 12 | Frontend | `/qve/reset-password` | New password page |
| 13 | Frontend | Login page | Add "Forgot password?" link |
| 14 | Frontend | Account settings | Change password, display name |
| 15 | Frontend | Admin invite UI | Invite management (admin-only) |
| 16 | **Test** | Browser | Full invite → register → login → reset → change password flow |

### 3.8 Testing — Phase B

#### Invite flow
1. Admin creates invite for `friend@example.com` → email received
2. Friend clicks link → registration page with email pre-filled
3. Friend sets password (must meet requirements — test rejection of weak passwords)
4. Auto-login → lands on empty cellar
5. Try reusing same invite link → rejected ("already used")
6. Try expired invite → rejected ("expired")

#### Password reset flow
1. Click "Forgot password?" → enter email → success message
2. Check email → click reset link → new password form
3. Set new password → auto-login → cellar
4. Verify old sessions are invalidated (open second browser, should be logged out)
5. Try reusing reset link → rejected ("already used")
6. Try expired reset link → rejected ("expired")
7. Request reset for non-existent email → same success message (no leak)

#### Account settings
1. Change display name → verify update in side menu
2. Change password → verify old password required → verify login with new password
3. Attempt weak password → rejected with specific feedback

---

## 4. Phase C — Email OTP 2FA (High-Level)

**Goal**: Optional second factor via email one-time password. No authenticator apps, no phone numbers.

**Why email OTP**: The data in Qvé is wine collections — not sensitive/identifiable. Email OTP provides a meaningful second factor without requiring users to install an authenticator app. Since SendGrid is already integrated (Phase B), the infrastructure is ready.

### How it would work

1. User enables email OTP in account settings
2. On login, after email + password success:
   - Backend generates 6-digit code, stores hash with 10-minute expiry
   - Sends code via SendGrid to user's email
   - Session is set to `2fa_pending` state
   - Frontend shows code input screen
3. User enters code → backend validates → session upgraded to fully authenticated
4. "Remember this device" option: stores a signed device token in a long-lived cookie, skips OTP for 30 days on that device

### Tables needed

```sql
CREATE TABLE email_otp_codes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    code_hash   VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add to users table:
ALTER TABLE users ADD COLUMN otp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

### Endpoints needed
- `POST /auth/sendOtp.php` — Generate and email OTP code
- `POST /auth/verifyOtp.php` — Validate code, upgrade session
- `POST /auth/updateOtpSetting.php` — Enable/disable OTP for user

### Frontend changes
- New OTP input component (6-digit code with auto-advance between digits)
- Login flow: after password success, conditionally show OTP step
- Account settings: toggle for email OTP
- "Remember this device" checkbox on OTP screen

### Considerations
- Rate limit OTP requests (max 3 per login attempt, max 5 per hour)
- Brute force protection on code entry (3 wrong codes → lock out, request new code)
- Codes are single-use and expire after 10 minutes
- If email is compromised, OTP is compromised — this is an accepted trade-off for the low sensitivity of the data

---

## 5. Phase D — Session Hardening (High-Level)

**Goal**: Active session management, security visibility, optional device tracking.

### `user_sessions` table

```sql
CREATE TABLE user_sessions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    session_id_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 of PHP session ID',
    ip_address      VARCHAR(45) NULL COMMENT 'IPv4 or IPv6',
    user_agent      VARCHAR(500) NULL,
    device_label    VARCHAR(100) NULL COMMENT 'Parsed: Chrome on macOS, Safari on iPhone, etc.',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_session (session_id_hash),
    INDEX idx_last_active (last_active_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Features

**"Log out all devices"**:
- DELETE FROM `user_sessions` WHERE `user_id = :id` AND `session_id_hash != :currentSession`
- Combined with `password_changed_at` check (Phase B) for immediate invalidation

**Active sessions list** (in account settings):
- Shows: device label, IP (masked: `192.168.x.x`), last active, "This device" badge on current
- "Log out" button per session
- "Log out all other devices" button

**Login history / security log**:
- New table or append to `audit_log`: login success/failure events
- Shows in account settings: "Recent activity" section
- Login time, IP, device, success/failure

**Session touch**:
- On each authenticated request, update `last_active_at` (throttled: once per 5 minutes to avoid write amplification)
- Enables accurate "last active" display

### Potential future additions (not planned)
- WebAuthn/passkeys as alternative to email OTP
- IP-based anomaly detection (login from unusual location → require OTP)
- Concurrent session limits (max 5 active sessions per user)

---

## 6. New Tables Summary

### Phase A

No new tables. Rename + extend `agentUsers` → `users`:

| Column | Type | Notes |
|--------|------|-------|
| password_hash | VARCHAR(255) | bcrypt hash |
| avatar_url | VARCHAR(500) | nullable, future use |
| role | ENUM('user','admin') | default 'user' |
| email_verified | BOOLEAN | default FALSE |
| last_login_at | TIMESTAMP | nullable |
| status | ENUM('active','suspended','deleted') | default 'active' |

### Phase B

| Table | Rows | Purpose |
|-------|------|---------|
| `invite_tokens` | ~tens | Invite links with token hash, expiry, email restriction |
| `password_reset_tokens` | ~tens | Password reset tokens with hash, expiry, single-use |

Plus column on `users`: `password_changed_at TIMESTAMP NULL`

### Phase C

| Table | Rows | Purpose |
|-------|------|---------|
| `email_otp_codes` | transient | OTP codes with hash, short expiry, single-use |

Plus column on `users`: `otp_enabled BOOLEAN DEFAULT FALSE`

### Phase D

| Table | Rows | Purpose |
|-------|------|---------|
| `user_sessions` | ~dozens | Active session tracking per user |

---

## 7. Security Considerations

### What each phase adds

| Phase | Security Layer |
|-------|---------------|
| A | Per-user identity, individual passwords, account suspension, generic error messages |
| B | Self-service password reset with secure tokens, session invalidation on password change, password strength requirements, invite-only registration |
| C | Optional second factor (email OTP), device remembering |
| D | Session visibility, remote logout, audit trail |

### Password security (Phase A + B)

- **bcrypt** via `password_hash(PASSWORD_BCRYPT)` — already in use
- **Minimum 10 chars**, 1 upper, 1 lower, 1 number — enforced backend + frontend
- **Generic error messages**: "Invalid email or password" — no username enumeration
- **Per-IP AND per-email brute force**: 5 attempts / 15 min each
- **Timing-safe comparison**: `password_verify()` handles this internally

### Token security (Phase B)

- Tokens generated with `random_bytes(32)` — 256 bits of entropy
- Only the **SHA-256 hash** stored in DB — raw token in email/URL only
- Single-use: marked as `used_at` after consumption
- Time-limited: 7 days for invites, 1 hour for password resets
- Invalidation: old reset tokens for same user are invalidated when new one is created

### What's NOT protected (accepted risks)

- **No 2FA** (Phases A-B): Acceptable — wine collection data is low sensitivity
- **File-based brute force tracking**: Adequate at this scale, no Redis needed
- **API key maps to user 1**: Service-level auth, not per-user. Acceptable for now.
- **Static SPA shell publicly accessible**: HTML/JS/CSS loads for anyone, but no data renders without auth
- **Email enumeration via invite**: Admin manually provides emails, so this isn't an attack vector

---

## 8. Open Questions

| # | Question | Context | Status |
|---|----------|---------|--------|
| 1 | **SendGrid sender verification**: Domain-level (DNS) or single-sender? | Domain verification is stronger for deliverability but requires DNS changes. Single-sender works immediately. | Decide during Phase B |
| 2 | **Invite expiry**: 7 days enough? | Some people are slow to check email. Could be 14 days. | Leaning 7 days, easy to change |
| 3 | **Max users**: Any practical limit? | With shared DB + tenant columns, performance degrades gradually. No hard limit needed unless hosting constrains it. | No limit for now |
| 4 | **Admin UI location**: Settings modal section or separate `/qve/admin` route? | Separate route is cleaner but more work. Settings section is quicker. | Decide during Phase B implementation |
| 5 | **Email change flow**: Allow users to change their email? | Requires verification of new email. Adds complexity. | Defer to post-Phase B |
| 6 | **Account deletion**: Self-service or admin-only? | GDPR-adjacent consideration, though not legally required for a personal app. | Admin-only for now (set status = 'deleted') |

---

## Appendix: File Change Map

### Phase A — Files to create/modify

| File | Action | Summary |
|------|--------|---------|
| `resources/sql/migrations/001_users_table.sql` | Create | Rename agentUsers → users, add auth columns |
| `resources/php/auth/login.php` | Modify | Email + password lookup from users table |
| `resources/php/auth/checkAuth.php` | Modify | Return user object |
| `resources/php/authMiddleware.php` | Modify | Add `requireAuth()` returning user_id |
| `qve/src/lib/stores/auth.ts` | Modify | Add User type, currentUser, update login() |
| `qve/src/routes/login/+page.svelte` | Modify | Add email field |
| `qve/src/lib/components/layout/SideMenu.svelte` | Modify | Show current user display name |

### Phase B — Files to create/modify

| File | Action | Summary |
|------|--------|---------|
| `resources/sql/migrations/002_auth_tokens.sql` | Create | invite_tokens, password_reset_tokens, password_changed_at |
| `resources/php/auth/sendEmail.php` | Create | SendGrid cURL helper |
| `resources/php/auth/createInvite.php` | Create | Admin invite generation |
| `resources/php/auth/register.php` | Create | Registration via invite token |
| `resources/php/auth/requestReset.php` | Create | Password reset request |
| `resources/php/auth/resetPassword.php` | Create | Password reset execution |
| `resources/php/auth/updateAccount.php` | Create | Account settings update |
| `resources/php/authMiddleware.php` | Modify | Add password_changed_at check |
| `qve/src/routes/register/+page.svelte` | Create | Registration page |
| `qve/src/routes/forgot-password/+page.svelte` | Create | Request reset page |
| `qve/src/routes/reset-password/+page.svelte` | Create | New password page |
| `qve/src/routes/login/+page.svelte` | Modify | Add "Forgot password?" link |
| Account settings (location TBD) | Create | Change password, display name |
| Admin invite UI (location TBD) | Create | Invite management |
