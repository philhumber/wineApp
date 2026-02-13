# Premium Features & Paywall Architecture Plan

**Date**: 2026-02-12
**Status**: Draft / Discussion
**Branch**: `claude/plan-premium-paywall-o6b3N`

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Design Principles](#2-design-principles)
3. [Feature Tiers](#3-feature-tiers)
4. [Authentication System](#4-authentication-system)
5. [Database Schema Changes](#5-database-schema-changes)
6. [Server-Side Feature Flags](#6-server-side-feature-flags)
7. [Backend Enforcement](#7-backend-enforcement)
8. [Frontend Integration](#8-frontend-integration)
9. [Payment Integration](#9-payment-integration)
10. [Migration Strategy](#10-migration-strategy)
11. [Implementation Phases](#11-implementation-phases)
12. [Security Considerations](#12-security-considerations)

---

## 1. Current State Summary

| Aspect | Current State | Impact |
|--------|--------------|--------|
| Authentication | None — single user, `userId=1` hardcoded | Must build auth from scratch |
| User table | `agentUsers` exists with `externalId` placeholder | Good foundation, needs extension |
| Usage tracking | Per-user daily aggregates + per-request logs | Ready to reuse for quota enforcement |
| Usage limits | Global hardcoded config (500 req/day, $25/day) | Needs per-tier limit profiles |
| Model tiers | 4 internal LLM tiers (fast → premium Opus) | Can gate premium tiers behind paywall |
| Settings | Global `user_settings` key-value, no userId | Must scope to users |
| Frontend auth | None — no tokens, no session cookies | Must add auth headers to API client |

**Key advantage**: The usage tracking and cost infrastructure already exists. We're adding auth + tier enforcement on top of a solid foundation.

---

## 2. Design Principles

### Server-Side Authority (The Core Security Rule)

> **Every feature gate MUST be enforced on the backend. The frontend is for UX only — never for security.**

This means:
- The PHP backend checks the user's tier before executing any premium action
- The frontend receives a **resolved feature manifest** from the server on login
- The frontend uses this manifest to show/hide UI elements (convenience, not security)
- If a user edits dev tools to reveal a hidden button and clicks it, the backend rejects the request with a 403
- Feature flags are **never stored or evaluated client-side** — they are computed server-side and served as a read-only snapshot

### Why This Works Against Dev Tools

```
User edits DOM → reveals hidden "Enrich with Opus" button → clicks it
  → Frontend sends POST /agent/identifyWithOpus.php
    → Backend: checkFeatureAccess($userId, 'premium_identification')
      → User tier = 'free' → 403 Forbidden: "Upgrade to Premium"
```

The frontend flag only controls whether the button renders. The backend doesn't care what the frontend shows — it independently validates every request.

---

## 3. Feature Tiers

### Proposed Tier Structure

| Feature | Free | Premium |
|---------|------|---------|
| **Wine identification** (text) | ✅ 10/day | ✅ Unlimited |
| **Wine identification** (image) | ✅ 5/day | ✅ Unlimited |
| **AI enrichment** (grapes, critics, drink window) | ❌ | ✅ |
| **Premium model escalation** ("Try Harder" / Opus) | ❌ | ✅ |
| **Cellar management** (add/edit/drink) | ✅ Up to 50 wines | ✅ Unlimited |
| **Drink history** | ✅ Last 30 days | ✅ Full history |
| **Export** (CSV/PDF) | ❌ | ✅ |
| **Multiple collections** | ❌ | ✅ |
| **Custom sommelier personality** | ❌ | ✅ |
| **Cellar value analytics** | Basic total | ✅ Full breakdown |

> **Note**: These are suggestions. The exact split is a product decision. The architecture supports any combination — you just toggle which feature keys belong to which tier.

### Quota Limits by Tier

| Limit | Free | Premium |
|-------|------|---------|
| Daily AI requests | 15 | 500 |
| Daily cost budget (USD) | $0.50 | $25.00 |
| Cellar size (wines) | 50 | Unlimited |
| History retention | 30 days | Unlimited |
| Image uploads/day | 5 | 100 |

---

## 4. Authentication System

### Recommended Approach: JWT + Refresh Tokens

Since the app is a SPA (SvelteKit) talking to a PHP backend, JWT is the cleanest fit. No PHP session state needed.

#### Flow

```
1. User registers/logs in → POST /auth/login.php
2. Backend validates credentials → returns { accessToken (15min), refreshToken (30d) }
3. Frontend stores:
   - accessToken → memory (JS variable, NOT localStorage)
   - refreshToken → httpOnly secure cookie (set by backend)
4. Every API call includes: Authorization: Bearer <accessToken>
5. On 401 → Frontend calls POST /auth/refresh.php (cookie sent automatically)
   → New accessToken returned → retry original request
6. On refresh failure → redirect to login
```

#### Why JWT Over PHP Sessions

| | JWT | PHP Sessions |
|---|-----|-------------|
| Stateless backend | ✅ No session files | ❌ Server-side storage |
| SPA-friendly | ✅ Bearer header | ⚠️ Cookie-only, CORS issues |
| Scalable | ✅ No shared state | ❌ Sticky sessions needed |
| Mobile-ready | ✅ Works anywhere | ❌ Cookie management pain |

#### Token Contents

```json
{
  "sub": 42,
  "email": "user@example.com",
  "tier": "premium",
  "features": ["enrichment", "premium_identification", "export", "unlimited_cellar"],
  "quotas": { "daily_ai_requests": 500, "daily_cost_usd": 25.0 },
  "iat": 1739360000,
  "exp": 1739360900
}
```

The `features` array in the JWT is a **convenience cache** for the frontend. The backend re-checks the database on every gated request — the JWT features list is never trusted for authorization. It exists so the frontend can render the correct UI without an extra API call.

#### Auth Endpoints (New)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/register.php` | POST | Create account (email + password) |
| `/auth/login.php` | POST | Authenticate, return tokens |
| `/auth/refresh.php` | POST | Exchange refresh token for new access token |
| `/auth/logout.php` | POST | Revoke refresh token |
| `/auth/me.php` | GET | Return current user profile + features |

#### Password Storage

- `password_hash()` with `PASSWORD_ARGON2ID` (PHP 7.3+)
- Never store plaintext; never use MD5/SHA
- Rate-limit login attempts (5 per minute per IP)

---

## 5. Database Schema Changes

### New Tables

```sql
-- User subscriptions / tier management
CREATE TABLE `user_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tier` enum('free','premium') NOT NULL DEFAULT 'free',
  `status` enum('active','cancelled','past_due','trialing') NOT NULL DEFAULT 'active',
  `stripeCustomerId` varchar(255) DEFAULT NULL,
  `stripeSubscriptionId` varchar(255) DEFAULT NULL,
  `currentPeriodStart` datetime DEFAULT NULL,
  `currentPeriodEnd` datetime DEFAULT NULL,
  `cancelAtPeriodEnd` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user` (`userId`),
  KEY `idx_stripe_customer` (`stripeCustomerId`),
  KEY `idx_stripe_sub` (`stripeSubscriptionId`),
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`userId`) REFERENCES `agentUsers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Feature flags — what each tier can access
CREATE TABLE `tier_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tier` enum('free','premium') NOT NULL,
  `featureKey` varchar(100) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `metadata` json DEFAULT NULL COMMENT 'e.g. {"limit": 10, "period": "daily"}',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tier_feature` (`tier`, `featureKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-tier quota configurations
CREATE TABLE `tier_quotas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tier` enum('free','premium') NOT NULL,
  `quotaKey` varchar(100) NOT NULL,
  `limitValue` int NOT NULL,
  `period` enum('daily','monthly','none') NOT NULL DEFAULT 'daily',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tier_quota` (`tier`, `quotaKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refresh tokens for JWT auth
CREATE TABLE `auth_refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL COMMENT 'SHA-256 of refresh token',
  `expiresAt` datetime NOT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `ipAddress` varchar(45) DEFAULT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`userId`),
  KEY `idx_token_hash` (`tokenHash`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`userId`) REFERENCES `agentUsers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Feature override per user (e.g., grandfathered access, beta testers)
CREATE TABLE `user_feature_overrides` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `featureKey` varchar(100) NOT NULL,
  `enabled` tinyint(1) NOT NULL,
  `reason` varchar(255) DEFAULT NULL COMMENT 'Why this override exists',
  `expiresAt` datetime DEFAULT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_feature` (`userId`, `featureKey`),
  CONSTRAINT `fk_override_user` FOREIGN KEY (`userId`) REFERENCES `agentUsers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Modifications to Existing Tables

```sql
-- agentUsers: add auth fields
ALTER TABLE `agentUsers`
  ADD COLUMN `passwordHash` varchar(255) DEFAULT NULL AFTER `email`,
  ADD COLUMN `tier` enum('free','premium') NOT NULL DEFAULT 'free' AFTER `passwordHash`,
  ADD COLUMN `emailVerified` tinyint(1) NOT NULL DEFAULT 0 AFTER `tier`,
  ADD COLUMN `lastLoginAt` datetime DEFAULT NULL AFTER `emailVerified`,
  ADD UNIQUE KEY `idx_email` (`email`);

-- user_settings: scope to users
ALTER TABLE `user_settings`
  ADD COLUMN `userId` int NOT NULL DEFAULT 1 AFTER `settingID`,
  DROP KEY (if any unique on settingKey),
  ADD UNIQUE KEY `idx_user_setting` (`userId`, `settingKey`);
```

### Seed Data: Feature Flags

```sql
-- Features available per tier
INSERT INTO `tier_features` (`tier`, `featureKey`, `enabled`, `metadata`) VALUES
('free',    'text_identification',     1, NULL),
('free',    'image_identification',    1, NULL),
('free',    'cellar_management',       1, '{"max_wines": 50}'),
('free',    'drink_history',           1, '{"retention_days": 30}'),
('free',    'basic_cellar_value',      1, NULL),
('premium', 'text_identification',     1, NULL),
('premium', 'image_identification',    1, NULL),
('premium', 'enrichment',             1, NULL),
('premium', 'premium_identification', 1, NULL),
('premium', 'cellar_management',       1, '{"max_wines": null}'),
('premium', 'drink_history',           1, '{"retention_days": null}'),
('premium', 'export',                 1, NULL),
('premium', 'multiple_collections',   1, NULL),
('premium', 'custom_personality',     1, NULL),
('premium', 'cellar_value_analytics', 1, NULL);

-- Quota limits per tier
INSERT INTO `tier_quotas` (`tier`, `quotaKey`, `limitValue`, `period`) VALUES
('free',    'daily_ai_requests',  15,  'daily'),
('free',    'daily_cost_usd',     50,  'daily'),   -- in cents
('free',    'daily_image_uploads', 5,  'daily'),
('premium', 'daily_ai_requests',  500, 'daily'),
('premium', 'daily_cost_usd',     2500, 'daily'),  -- in cents
('premium', 'daily_image_uploads', 100, 'daily');
```

---

## 6. Server-Side Feature Flags

### Feature Access Service (New PHP Class)

```
resources/php/auth/
├── AuthMiddleware.php     # JWT validation, user extraction
├── FeatureGate.php        # Feature flag checking
├── QuotaEnforcer.php      # Usage quota enforcement
├── JWTService.php         # Token generation/validation
└── PasswordService.php    # Hashing/verification
```

#### FeatureGate — The Core Mechanism

```php
class FeatureGate {
    private PDO $pdo;

    /**
     * Check if a user has access to a feature.
     * Resolution order:
     *   1. User-specific override (if not expired) → use override
     *   2. Tier feature flag → use tier default
     *   3. Feature not defined → deny (fail-closed)
     */
    public function hasAccess(int $userId, string $featureKey): bool {
        // 1. Check user override first
        $override = $this->getUserOverride($userId, $featureKey);
        if ($override !== null) {
            return $override;
        }

        // 2. Check tier feature
        $tier = $this->getUserTier($userId);
        return $this->getTierFeature($tier, $featureKey);
    }

    /**
     * Get full feature manifest for a user (sent to frontend).
     * Returns: { "enrichment": true, "export": false, ... }
     */
    public function getManifest(int $userId): array {
        $tier = $this->getUserTier($userId);
        $tierFeatures = $this->getAllTierFeatures($tier);
        $overrides = $this->getAllUserOverrides($userId);

        return array_merge($tierFeatures, $overrides);
    }

    /**
     * Get metadata for a feature (e.g., limits).
     * Returns: {"max_wines": 50} or null
     */
    public function getFeatureMetadata(int $userId, string $featureKey): ?array { ... }
}
```

#### QuotaEnforcer — Usage Limits

```php
class QuotaEnforcer {
    /**
     * Check if user is within quota for a given action.
     * Reuses existing agentUsageDaily table.
     */
    public function checkQuota(int $userId, string $quotaKey): QuotaResult {
        $tier = $this->getUserTier($userId);
        $limit = $this->getTierQuota($tier, $quotaKey);

        if ($limit === null) return QuotaResult::unlimited();

        $current = $this->getCurrentUsage($userId, $quotaKey);

        return new QuotaResult(
            allowed: $current < $limit,
            current: $current,
            limit: $limit,
            remaining: max(0, $limit - $current)
        );
    }
}
```

#### Usage in Endpoints

Every gated endpoint adds two lines at the top:

```php
// Before (current)
$userId = $input['userId'] ?? 1;

// After (with paywall)
$user = AuthMiddleware::authenticate();  // validates JWT, returns user
FeatureGate::require($user->id, 'enrichment');  // 403 if not allowed
QuotaEnforcer::require($user->id, 'daily_ai_requests');  // 429 if over quota
```

`FeatureGate::require()` is a convenience that throws a structured error:

```php
public static function require(int $userId, string $feature): void {
    $gate = new self(getDBConnection());
    if (!$gate->hasAccess($userId, $feature)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => [
                'type' => 'feature_restricted',
                'feature' => $feature,
                'userMessage' => 'This feature requires a Premium subscription.',
                'upgradeUrl' => '/qve/upgrade'
            ]
        ]);
        exit;
    }
}
```

---

## 7. Backend Enforcement

### Which Endpoints Get Gated

| Endpoint | Feature Key | Quota Key | Notes |
|----------|-------------|-----------|-------|
| `identifyText.php` | `text_identification` | `daily_ai_requests` | Free with daily limit |
| `identifyImage.php` | `image_identification` | `daily_ai_requests`, `daily_image_uploads` | Free with daily limit |
| `identifyWithOpus.php` | `premium_identification` | `daily_ai_requests` | Premium only |
| `agentEnrich.php` | `enrichment` | `daily_ai_requests` | Premium only |
| `agentEnrichStream.php` | `enrichment` | `daily_ai_requests` | Premium only |
| `addWine.php` | `cellar_management` | — | Check max_wines metadata |
| `getDrunkWines.php` | `drink_history` | — | Filter by retention_days metadata |
| `getCellarValue.php` | `cellar_value_analytics` | — | Premium gets full breakdown |

### Enforcement Pattern

```
Request arrives
  → AuthMiddleware::authenticate()          [WHO is this?]
    → Validate JWT signature + expiry
    → Extract userId from token
  → FeatureGate::require($userId, $feature) [CAN they do this?]
    → Query tier_features + user_feature_overrides
    → 403 if denied
  → QuotaEnforcer::require($userId, $quota) [HAVE they exceeded limits?]
    → Query agentUsageDaily for current usage
    → Compare against tier_quotas
    → 429 if exceeded (with remaining/reset info)
  → Execute endpoint logic                  [DO the thing]
  → CostTracker::log(...)                   [LOG what happened]
```

---

## 8. Frontend Integration

### Auth Store (New)

```typescript
// qve/src/lib/stores/auth.ts
interface AuthState {
  user: User | null;
  features: Record<string, boolean>;     // from server manifest
  quotas: Record<string, QuotaInfo>;     // remaining usage
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface User {
  id: number;
  email: string;
  displayName: string;
  tier: 'free' | 'premium';
}

interface QuotaInfo {
  current: number;
  limit: number;
  remaining: number;
  resetsAt: string;  // ISO datetime
}
```

### Feature Check Helper

```typescript
// qve/src/lib/utils/features.ts
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';

export function hasFeature(key: string): boolean {
  const state = get(auth);
  return state.features[key] ?? false;
}

// Svelte component usage:
// {#if $auth.features.enrichment}
//   <EnrichmentCard ... />
// {:else}
//   <UpgradePrompt feature="enrichment" />
// {/if}
```

### API Client Changes

```typescript
// qve/src/lib/api/client.ts — add auth header
class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async fetchJSON<T>(endpoint: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`/resources/php/${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',  // for refresh token cookie
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 → refresh token flow
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return this.fetchJSON(endpoint, body);  // retry
      throw new AuthError('Session expired');
    }

    // Handle 403 → feature restricted
    if (response.status === 403) {
      const data = await response.json();
      if (data.error?.type === 'feature_restricted') {
        throw new FeatureRestrictedError(data.error.feature, data.error.userMessage);
      }
    }

    // Handle 429 → quota exceeded
    if (response.status === 429) {
      const data = await response.json();
      throw new QuotaExceededError(data.error);
    }

    return response.json();
  }
}
```

### UI Treatment for Gated Features

Three patterns depending on context:

#### 1. Hidden (feature not visible to free users)
```svelte
{#if $auth.features.export}
  <ExportButton />
{/if}
```

#### 2. Teaser (visible but locked — better for conversion)
```svelte
{#if $auth.features.enrichment}
  <EnrichmentCard data={enrichmentData} />
{:else}
  <div class="premium-teaser">
    <EnrichmentCard data={sampleData} blurred />
    <UpgradeBadge message="Unlock AI wine insights" />
  </div>
{/if}
```

#### 3. Quota Warning (approaching limit)
```svelte
{#if $auth.quotas.daily_ai_requests.remaining <= 3}
  <QuotaWarning
    remaining={$auth.quotas.daily_ai_requests.remaining}
    resetsAt={$auth.quotas.daily_ai_requests.resetsAt}
  />
{/if}
```

### New Components Needed

| Component | Purpose |
|-----------|---------|
| `LoginPage.svelte` | Email/password login form |
| `RegisterPage.svelte` | Account creation |
| `UpgradePage.svelte` | Subscription plans, Stripe checkout |
| `UpgradeBadge.svelte` | Small inline "Premium" indicator |
| `UpgradePrompt.svelte` | Contextual upgrade CTA replacing locked features |
| `QuotaWarning.svelte` | "X identifications remaining today" |
| `AccountSettings.svelte` | Subscription management, plan details |

### New Routes

| Route | Description |
|-------|-------------|
| `/qve/login` | Login page |
| `/qve/register` | Registration page |
| `/qve/upgrade` | Subscription plans |
| `/qve/account` | Account & subscription management |

---

## 9. Payment Integration

### Recommended: Stripe

Stripe is the standard choice for SaaS subscriptions. The flow:

```
1. User clicks "Upgrade to Premium" on /qve/upgrade
2. Frontend calls POST /auth/create-checkout.php
3. Backend creates Stripe Checkout Session → returns session URL
4. User redirected to Stripe-hosted checkout page
5. User pays → Stripe sends webhook to /webhooks/stripe.php
6. Webhook handler:
   a. Validates signature (STRIPE_WEBHOOK_SECRET)
   b. Updates user_subscriptions table (tier → premium, status → active)
   c. Updates agentUsers.tier
7. User redirected back to /qve/upgrade?success=true
8. Frontend refreshes auth state → features manifest now includes premium
```

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription |
| `customer.subscription.updated` | Update period dates, handle plan changes |
| `customer.subscription.deleted` | Downgrade to free |
| `invoice.payment_failed` | Set status to `past_due`, notify user |
| `invoice.paid` | Clear `past_due` status |

### New Backend Files

```
resources/php/
├── auth/
│   ├── register.php
│   ├── login.php
│   ├── refresh.php
│   ├── logout.php
│   ├── me.php
│   ├── create-checkout.php
│   └── lib/
│       ├── AuthMiddleware.php
│       ├── FeatureGate.php
│       ├── QuotaEnforcer.php
│       ├── JWTService.php
│       └── PasswordService.php
├── webhooks/
│   └── stripe.php
```

---

## 10. Migration Strategy

### Phase 0: Existing User Transition

Since the app currently has a single implicit user (`userId=1`), migration is straightforward:

```sql
-- Ensure user 1 exists in agentUsers with full fields
UPDATE agentUsers SET
  email = 'phil.humber@gmail.com',
  passwordHash = '<generated_hash>',
  tier = 'premium',  -- grandfather existing user as premium
  emailVerified = 1
WHERE id = 1;

-- Create subscription record
INSERT INTO user_subscriptions (userId, tier, status)
VALUES (1, 'premium', 'active');

-- Scope existing settings to user 1
UPDATE user_settings SET userId = 1 WHERE userId = 0 OR userId = 1;
```

### Backward Compatibility

During rollout, endpoints can support both auth'd and unauth'd modes:

```php
// Transitional pattern — remove once auth is mandatory
$user = AuthMiddleware::authenticateOptional();
$userId = $user ? $user->id : 1;  // fall back to default user

// Feature gates only apply to authenticated users
if ($user) {
    FeatureGate::require($user->id, 'enrichment');
}
```

This lets you deploy auth infrastructure without forcing a login wall immediately.

---

## 11. Implementation Phases

### Phase 1: Auth Foundation
- Extend `agentUsers` table (password, tier, email verification)
- Create `auth_refresh_tokens` table
- Build JWT + refresh token auth endpoints
- Build `AuthMiddleware.php`
- Add login/register routes to frontend
- Add auth store + token management to API client
- **Result**: Users can register and log in. No features gated yet.

### Phase 2: Feature Flags Infrastructure
- Create `tier_features`, `tier_quotas`, `user_feature_overrides` tables
- Seed initial feature/quota data
- Build `FeatureGate.php` and `QuotaEnforcer.php`
- Add `/auth/me.php` endpoint returning feature manifest
- Build frontend `features.ts` utilities
- **Result**: Server can resolve feature access. Not enforced yet.

### Phase 3: Backend Enforcement
- Add `AuthMiddleware::authenticate()` to all agent endpoints
- Add `FeatureGate::require()` to premium endpoints (enrich, opus, etc.)
- Add `QuotaEnforcer::require()` to rate-limited endpoints
- Update `CostTracker` to use auth'd user ID
- Handle 403/429 responses in frontend API client
- **Result**: Premium features actually blocked for free users.

### Phase 4: Frontend UX
- Build `UpgradeBadge`, `UpgradePrompt`, `QuotaWarning` components
- Add conditional rendering throughout agent UI
- Build `/qve/upgrade` page with plan comparison
- Build `/qve/account` page for subscription management
- Add quota display to agent panel
- **Result**: Free users see clear upgrade prompts. Premium feels premium.

### Phase 5: Payment
- Create `user_subscriptions` table
- Integrate Stripe Checkout
- Build webhook handler
- Build checkout creation endpoint
- Wire upgrade page to Stripe
- Test full subscribe/cancel/renew cycle
- **Result**: Users can pay for Premium.

### Phase 6: Polish & Analytics
- Conversion analytics (where do free users hit walls?)
- A/B test teaser vs hidden approaches
- Grandfathering logic for early adopters
- Trial period support
- Referral codes

---

## 12. Security Considerations

### Token Security
- **Access tokens**: Short-lived (15 min), stored in JS memory only — never `localStorage`
- **Refresh tokens**: `httpOnly`, `Secure`, `SameSite=Strict` cookie — JS can't read it
- **Token rotation**: Each refresh issues a new refresh token, old one is revoked
- **Refresh token reuse detection**: If a revoked token is used, revoke ALL tokens for that user (stolen token scenario)

### Feature Flag Security
- **Fail-closed**: Unknown features default to denied
- **Server-authoritative**: Frontend manifest is convenience, not truth
- **No client-side evaluation**: The server computes the full manifest — the client never runs flag logic
- **Override audit trail**: `user_feature_overrides` tracks who got special access and why

### Webhook Security
- Validate Stripe webhook signatures using `STRIPE_WEBHOOK_SECRET`
- Use idempotency keys to handle duplicate webhook deliveries
- Log all webhook events for debugging

### Rate Limiting
- Login attempts: 5 per minute per IP (prevent brute force)
- Token refresh: 10 per minute per user
- Registration: 3 per hour per IP

### What CAN'T Be Bypassed via Dev Tools

| Attack Vector | Defense |
|---------------|---------|
| Editing `$auth.features` in console | Backend re-checks on every request |
| Removing `disabled` from buttons | Backend rejects unauthorized requests (403) |
| Modifying JWT in memory | JWT signature verification fails (invalid token) |
| Replaying stolen access tokens | 15-min expiry limits damage window |
| Forging refresh tokens | Stored as SHA-256 hash, compared server-side |
| Calling premium endpoints directly | `AuthMiddleware` + `FeatureGate` on every endpoint |

---

## Open Questions

1. **Social login?** — Google/Apple Sign-In as alternative to email/password? Adds complexity but improves conversion.
2. **Pricing?** — Monthly vs annual, price point, free trial length.
3. **Grandfathering?** — Should existing data (userId=1) be permanently premium or given a generous trial?
4. **Offline/PWA?** — How do feature flags work if the app is cached? (Answer: features manifest cached with last-known state, re-validated on reconnect.)
5. **Multiple users per household?** — Is a single premium subscription per account sufficient?
