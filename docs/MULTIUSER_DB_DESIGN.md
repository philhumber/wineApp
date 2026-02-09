# Multi-User Database & Architecture Design

**Status**: RFC (Request for Comments)
**Created**: 2026-02-09
**Author**: Design session — Phil + Claude

---

## Table of Contents

1. [The Core Question: Separate DBs vs Shared DB](#1-the-core-question)
2. [Recommendation: Shared Database with Tenant Column](#2-recommendation)
3. [User & Authentication Model](#3-user--authentication-model)
4. [Schema Migration Plan](#4-schema-migration-plan)
5. [Data Categories & Ownership](#5-data-categories--ownership)
6. [Learning System Data Model](#6-learning-system-data-model)
7. [Migration Path (Phased)](#7-migration-path-phased)
8. [Security & Isolation](#8-security--isolation)
9. [Performance Considerations](#9-performance-considerations)
10. [Open Questions](#10-open-questions)

---

## 1. The Core Question

**"Create a new DB for every user?"**

Three standard approaches exist for multi-tenancy:

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **DB-per-tenant** | Separate MySQL database per user | Total isolation, easy backup/restore per user, simple mental model | Operationally painful at scale, schema migrations hit N databases, connection pooling nightmare, expensive on hosting |
| **Schema-per-tenant** | Same DB, separate schema/prefix per user | Good isolation, single DB connection | MySQL doesn't support schemas like PostgreSQL; would mean table-name prefixes (`user1_wine`, `user2_wine`) — fragile |
| **Shared DB + tenant column** | Single database, `user_id` column on owned tables | Simple operations, single migration path, efficient connection pooling, shared reference data | Requires disciplined WHERE clauses, risk of data leaks if queries miss the filter |

### Verdict

**Shared database with tenant column (`user_id`)** is the right choice for Qvé. Here's why:

1. **You already have it partially** — The agent tables (`agentUsers`, `agentSessions`, `agentUsageLog`, etc.) already use this pattern with `userId` FK columns. Extending it to wine tables is the natural next step.

2. **Reference data is shared** — Countries, regions, grape varieties, wine types, appellations, abbreviations, pairing rules, intensity profiles — these are the same for every user. A DB-per-tenant model would duplicate ~6 reference tables and ~1,000+ rows per user for no reason.

3. **The learning system benefits from aggregate data** — If you want to build recommendation features, taste profiling, or "wines similar to what you like," having all user data in one database makes cross-user queries possible (anonymized). A DB-per-tenant model makes this nearly impossible.

4. **Operational simplicity** — One schema migration runs once. One backup covers everything. One connection pool serves all users.

5. **Scale reality** — DB-per-tenant starts to make sense at enterprise scale (100K+ tenants with strict compliance requirements). For a wine app with dozens to hundreds of users, it's massive over-engineering.

---

## 2. Recommendation

### Shared Database, Three Tiers of Data

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED (no user_id)                   │
│  Reference data: country, region, winetype, grapes,     │
│  refAppellations, refGrapeCharacteristics, refWineStyles│
│  refPairingRules, refIntensityProfiles, refAbbreviations│
│  currencies, bottle_sizes                               │
├─────────────────────────────────────────────────────────┤
│                  USER-OWNED (user_id FK)                 │
│  wine, bottles, ratings, producers, grapemix,           │
│  critic_scores, user_settings, audit_log                │
│  + NEW: learn_progress, learn_collections, learn_notes  │
├─────────────────────────────────────────────────────────┤
│              AGENT / ANALYTICS (userId FK)               │
│  agentUsers → BECOMES → users (unified)                 │
│  agentSessions, agentUsageLog, agentUsageDaily,         │
│  agentIdentificationResults, agentUserTasteProfile      │
│  + NEW: learn_content, learn_modules                    │
├─────────────────────────────────────────────────────────┤
│                 CACHE (no user_id)                       │
│  cacheWineEnrichment, cacheProducers,                   │
│  cacheCanonicalAliases                                  │
│  (shared across all users — same wine = same cache)     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. User & Authentication Model

### Unified `users` Table

The current `agentUsers` table becomes the single source of truth, renamed and extended:

```sql
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,       -- bcrypt via password_hash()
    avatar_url      VARCHAR(500) NULL,
    role            ENUM('user','admin') DEFAULT 'user',
    preferences     JSON NULL,                   -- theme, currency, personality, etc.
    email_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP NULL,
    status          ENUM('active','suspended','deleted') DEFAULT 'active',
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Authentication Strategy

For a PHP backend without a framework, the simplest robust approach:

1. **Session-based auth** (not JWT) — PHP's native `$_SESSION` with secure cookies
2. Login returns a session cookie; every API call validates the session
3. CSRF token for mutation endpoints
4. Optional: OAuth (Google/Apple) added later as a secondary auth method

```
Login Flow:
  POST /resources/php/auth/login.php { email, password }
  → password_verify() against password_hash
  → session_start(), $_SESSION['user_id'] = $user->id
  → Set-Cookie: PHPSESSID=xxx; HttpOnly; Secure; SameSite=Strict

Every API call:
  → auth middleware checks $_SESSION['user_id']
  → Injects $userId into request context
  → All queries filter by user_id
```

### Migration from `agentUsers`

```sql
-- Rename and extend
ALTER TABLE agentUsers RENAME TO users;
ALTER TABLE users
    ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER display_name,
    ADD COLUMN avatar_url VARCHAR(500) NULL AFTER password_hash,
    ADD COLUMN role ENUM('user','admin') DEFAULT 'user',
    ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN last_login_at TIMESTAMP NULL,
    ADD COLUMN status ENUM('active','suspended','deleted') DEFAULT 'active',
    ADD UNIQUE INDEX idx_email (email);

-- Update existing default user
UPDATE users SET email = 'phil.humber@gmail.com', display_name = 'Phil Humber' WHERE id = 1;
```

---

## 4. Schema Migration Plan

### Core Wine Tables — Add `user_id`

These are the tables that need a `user_id` column to become multi-user:

```sql
-- WINE: Add user_id, index it
ALTER TABLE wine
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER wineID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_wine_user FOREIGN KEY (user_id) REFERENCES users(id);

-- BOTTLES: Inherits user context through wine, but add direct FK for query efficiency
ALTER TABLE bottles
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER bottleID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_bottles_user FOREIGN KEY (user_id) REFERENCES users(id);

-- RATINGS: Add user_id (the person who rated)
ALTER TABLE ratings
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER ratingID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users(id);

-- PRODUCERS: Shared vs per-user is a design decision (see Section 5)
ALTER TABLE producers
    ADD COLUMN user_id INT NULL AFTER producerID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_producers_user FOREIGN KEY (user_id) REFERENCES users(id);

-- GRAPEMIX: Inherits through wine
ALTER TABLE grapemix
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER mixID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_grapemix_user FOREIGN KEY (user_id) REFERENCES users(id);

-- CRITIC_SCORES: Shared data, no user_id needed (same critics for everyone)

-- USER_SETTINGS: Add user_id, make it the primary grouping
ALTER TABLE user_settings
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 FIRST,
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (user_id, settingKey),
    ADD CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id);

-- AUDIT_LOG: Rename changedBy to user_id, add FK
ALTER TABLE audit_log
    CHANGE changedBy user_id INT NOT NULL DEFAULT 1,
    ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id);
```

### Agent Tables — Re-point FK to `users`

```sql
-- Update all agent FKs from agentUsers → users (table already renamed)
-- No structural changes needed — just verify FKs resolve correctly
-- The DEFAULT '1' values remain correct (Phil = user 1)
```

---

## 5. Data Categories & Ownership

### What's Per-User vs Shared

| Data | Ownership | Rationale |
|------|-----------|-----------|
| **wine** | Per-user | Your cellar is yours |
| **bottles** | Per-user | Your inventory |
| **ratings** | Per-user | Your tasting notes |
| **producers** | Hybrid (see below) | Complex — see discussion |
| **grapemix** | Per-user | Tied to your wine entry |
| **user_settings** | Per-user | Your preferences |
| **audit_log** | Per-user | Your change history |
| **country** | Shared | France is France for everyone |
| **region** | Shared | Burgundy doesn't change per user |
| **winetype** | Shared | "Red" is universal |
| **grapes** | Shared | Pinot Noir is Pinot Noir |
| **currencies** | Shared | Exchange rates are global |
| **bottle_sizes** | Shared | Standard sizes |
| **critic_scores** | Shared | Published scores are public data |
| **ref* tables** | Shared | Reference data |
| **cache* tables** | Shared | Enrichment cache benefits all users |

### The Producer Problem

Producers sit in a gray area:

- **Option A: Fully shared** — One `producers` table, all users reference the same records. Pro: no duplication, "Château Margaux" exists once. Con: who can edit it? Conflicts between users.
- **Option B: Per-user** — Each user has their own producer records. Pro: no conflicts. Con: "Château Margaux" stored 50 times.
- **Option C: Hybrid** — Shared canonical producers (NULL `user_id`) + user overrides. Users reference shared records but can create custom ones. The system attempts to match user-created producers to canonical ones for dedup.

**Recommendation: Option C (Hybrid)**. Start with per-user producers (every user's producer entry is theirs), but add a `canonical_producer_id` column that links to a shared/curated producer table in future. This keeps it simple now while allowing consolidation later.

```sql
-- Producers stay per-user for now
-- user_id NULL = shared/canonical (admin-curated)
-- user_id NOT NULL = user's own producer record
ALTER TABLE producers
    ADD COLUMN canonical_producer_id INT NULL,
    ADD INDEX idx_canonical (canonical_producer_id);
```

---

## 6. Learning System Data Model

Since `docs/learn/` doesn't exist yet, here's a proposed data model for a wine learning system that integrates with the existing cellar and agent infrastructure.

### What "Learn" Could Mean

Based on the app's DNA (AI sommelier, wine identification, enrichment), a learning system could include:

1. **Structured content** — Wine education modules (regions, grapes, tasting technique, food pairing)
2. **Progress tracking** — What has the user studied, quiz scores, streaks
3. **Personal collections** — Curated lists ("Wines to Try", "Study: Burgundy vs Oregon Pinot")
4. **Tasting journal** — Beyond ratings: structured tasting notes tied to learning goals
5. **AI-driven recommendations** — "Based on your cellar, you should learn about..."
6. **Social/comparative** — How your palate compares (anonymized)

### Proposed Tables

```sql
-- =============================================
-- LEARNING CONTENT (shared across all users)
-- =============================================

CREATE TABLE learn_modules (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(100) NOT NULL UNIQUE,     -- 'burgundy-101', 'tasting-basics'
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        ENUM('region','grape','technique','pairing','style','history') NOT NULL,
    difficulty      ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
    sort_order      INT DEFAULT 0,
    prerequisites   JSON NULL,                         -- [module_id, module_id]
    metadata        JSON NULL,                         -- flexible: image_url, duration, tags
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE learn_content (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    module_id       INT NOT NULL,
    content_type    ENUM('text','quiz','tasting_exercise','video','infographic') NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            JSON NOT NULL,                     -- structured content (markdown, questions, etc.)
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_content_module FOREIGN KEY (module_id) REFERENCES learn_modules(id),
    INDEX idx_module_sort (module_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- LEARNING PROGRESS (per-user)
-- =============================================

CREATE TABLE learn_progress (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    module_id       INT NOT NULL,
    content_id      INT NULL,                          -- NULL = module-level progress
    status          ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
    score           DECIMAL(5,2) NULL,                 -- quiz score (percentage)
    attempts        INT DEFAULT 0,
    started_at      TIMESTAMP NULL,
    completed_at    TIMESTAMP NULL,
    metadata        JSON NULL,                         -- answers, time_spent, notes
    CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_progress_module FOREIGN KEY (module_id) REFERENCES learn_modules(id),
    CONSTRAINT fk_progress_content FOREIGN KEY (content_id) REFERENCES learn_content(id),
    UNIQUE INDEX idx_user_module_content (user_id, module_id, content_id),
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- COLLECTIONS (per-user curated lists)
-- =============================================

CREATE TABLE collections (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    collection_type ENUM('wishlist','study','tasting_set','custom') DEFAULT 'custom',
    is_public       BOOLEAN DEFAULT FALSE,             -- future: sharing
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_collection_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_type (user_id, collection_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE collection_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    collection_id   INT NOT NULL,
    user_id         INT NOT NULL,                      -- denormalized for query efficiency
    wine_id         INT NULL,                          -- reference to wine table (if in cellar)
    external_ref    JSON NULL,                         -- for wines not in cellar: {name, producer, vintage, ...}
    notes           TEXT NULL,
    sort_order      INT DEFAULT 0,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_collection_sort (collection_id, sort_order),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- TASTING JOURNAL (per-user, extends ratings)
-- =============================================

CREATE TABLE tasting_journal (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    wine_id         INT NULL,                          -- optional link to cellar
    rating_id       INT NULL,                          -- optional link to existing rating
    wine_name       VARCHAR(255) NOT NULL,             -- stored independently (wine may not be in cellar)
    producer        VARCHAR(255) NULL,
    vintage         INT NULL,
    tasting_date    DATE NOT NULL,
    occasion        VARCHAR(255) NULL,
    appearance      JSON NULL,                         -- {color, intensity, clarity}
    nose            JSON NULL,                         -- {intensity, aromas: [], development}
    palate          JSON NULL,                         -- {sweetness, acidity, tannin, body, finish, flavors: []}
    conclusion      JSON NULL,                         -- {quality, readiness, score}
    notes           TEXT NULL,
    photos          JSON NULL,                         -- [url, url]
    is_blind        BOOLEAN DEFAULT FALSE,
    context_tags    JSON NULL,                         -- ['dinner_party', 'study_group', 'solo']
    module_id       INT NULL,                          -- if part of a learning exercise
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_journal_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_journal_module FOREIGN KEY (module_id) REFERENCES learn_modules(id),
    INDEX idx_user_date (user_id, tasting_date DESC),
    INDEX idx_user_wine (user_id, wine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### How Learning Connects to Existing Data

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ learn_modules│────→│ learn_content │     │ agentUserTaste   │
│ (shared)     │     │ (shared)      │     │ Profile (per-user)│
└──────┬───────┘     └──────────────┘     └────────┬─────────┘
       │                                           │
       ▼                                           ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│learn_progress│     │  collections  │     │  tasting_journal  │
│ (per-user)   │     │  (per-user)   │     │  (per-user)       │
└──────────────┘     └───────┬──────┘     └────────┬─────────┘
                             │                      │
                             ▼                      ▼
                     ┌──────────────┐     ┌──────────────────┐
                     │collection_   │     │  wine / ratings   │
                     │items         │     │  (per-user cellar)│
                     └──────────────┘     └──────────────────┘
```

The taste profile (already per-user in `agentUserTasteProfile`) drives personalized learning recommendations. Tasting journal entries can link back to cellar wines and learning modules, closing the loop between "what you're drinking" and "what you're studying."

---

## 7. Migration Path (Phased)

### Phase 1: Foundation (Auth + User Ownership)

**Goal**: Every row has an owner. Single user still works, but the infrastructure is multi-user ready.

1. Rename `agentUsers` → `users`, extend with auth columns
2. Add `user_id` column (DEFAULT 1) to: `wine`, `bottles`, `ratings`, `producers`, `grapemix`, `user_settings`, `audit_log`
3. Create auth middleware (`resources/php/auth/middleware.php`)
4. Add login/register endpoints
5. Update **every PHP endpoint** to:
   - Extract `$userId` from session
   - Add `WHERE user_id = :userId` to all SELECT queries
   - Set `user_id = :userId` on all INSERT queries
6. Frontend: Add auth store, login page, session management
7. API client: Add session cookie handling, 401 redirect

**Rollout strategy**: Deploy with auto-login for user 1 (Phil). Existing behavior unchanged. New users can register but the system is now structurally multi-user.

### Phase 2: Collections & Learning Infrastructure

**Goal**: New tables, new feature vertical.

1. Create `learn_modules`, `learn_content` tables (start with seed data)
2. Create `collections`, `collection_items` tables
3. Build collection UI (lists, add-to-collection from wine card)
4. Build basic learning module viewer
5. Track progress in `learn_progress`

### Phase 3: Tasting Journal & Deep Learning

**Goal**: Rich tasting experience tied to learning.

1. Create `tasting_journal` table
2. Build structured tasting note UI (appearance → nose → palate → conclusion)
3. Link journal entries to learning modules ("Tasting Exercise: Compare these 3 Pinots")
4. AI-driven learning recommendations based on cellar + taste profile + progress

### Phase 4: Social & Sharing (Future)

**Goal**: Controlled sharing between users.

1. `collections.is_public` flag for shared lists
2. Friend/follow system (new table)
3. Anonymized aggregate insights ("85% of users who like Barolo also enjoy Nebbiolo d'Alba")
4. Shared tasting sessions

---

## 8. Security & Isolation

### Query-Level Isolation

Every query touching user-owned data MUST include the user filter. The safest pattern is a helper function:

```php
// resources/php/auth/middleware.php

function requireAuth(): int {
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated']);
        exit;
    }
    return (int) $_SESSION['user_id'];
}

// Usage in every endpoint:
$userId = requireAuth();
$stmt = $pdo->prepare("SELECT * FROM wine WHERE user_id = :userId AND ...");
$stmt->execute(['userId' => $userId]);
```

### Defense in Depth

1. **Application layer**: `requireAuth()` on every endpoint, `user_id` in every query
2. **Database layer**: Consider MySQL views that auto-filter by user (optional, adds complexity)
3. **API validation**: Never trust client-supplied `user_id` — always derive from session
4. **Audit trail**: `audit_log` already tracks changes; now with real `user_id`
5. **Rate limiting**: Agent usage tracking (`agentUsageDaily`) already per-user; extend to API calls

### Data That Should NEVER Leak Between Users

- Wine collection (cellar contents)
- Ratings and tasting notes
- Bottle inventory and prices
- Learning progress and scores
- Collections and wishlists
- Agent conversation history (already session-scoped)

### Data That CAN Be Shared

- Reference data (countries, regions, grapes, styles)
- Enrichment cache (same wine = same enrichment for everyone)
- Learning content (modules, lessons — same curriculum)
- Aggregate/anonymous insights (Phase 4)

---

## 9. Performance Considerations

### Indexing Strategy

Every table with `user_id` needs it as the **leading column** in composite indexes:

```sql
-- Current: wine likely has indexes on (wineID), (producerID), (typeID), etc.
-- Add composite indexes for multi-user queries:
ALTER TABLE wine ADD INDEX idx_user_type (user_id, typeID);
ALTER TABLE wine ADD INDEX idx_user_producer (user_id, producerID);
ALTER TABLE bottles ADD INDEX idx_user_wine (user_id, wineID);
ALTER TABLE ratings ADD INDEX idx_user_bottle (user_id, bottleID);
```

### Query Impact

With proper indexes, adding `WHERE user_id = X` to queries actually **improves** performance at scale — you're scanning a smaller subset of rows. The existing single-user queries scan everything; multi-user queries are inherently more selective.

### Connection Pooling

PHP's process-per-request model means each request creates its own DB connection. The static singleton in `databaseConnection.php` reuses within a request. This pattern works fine for moderate scale. If you ever need connection pooling, ProxySQL or MySQL Router can sit in front.

### Caching

The enrichment cache tables are already user-agnostic (keyed on wine name, not user). This is correct — "Château Margaux 2015" enrichment data is the same regardless of who asks. No change needed.

---

## 10. Open Questions

These are decisions to make before implementation:

1. **Auth method**: Session-based (recommended for simplicity) vs JWT (better for mobile/API clients)? If you envision a native mobile app later, JWT might be worth the upfront complexity.

2. **Registration model**: Open registration? Invite-only? Admin-creates-accounts? This affects the auth flow significantly.

3. **Producer sharing**: The hybrid model (Section 5) is recommended, but should users see each other's producers for autocomplete? Or strictly isolated?

4. **Learning content authoring**: Who creates learning modules? Just admin (you)? Or can users contribute? This affects the content tables.

5. **Data migration**: The DEFAULT 1 approach means all existing data belongs to user 1 (Phil). Is that correct, or do you need to split existing data across multiple users?

6. **Bottle-level user_id**: Bottles already have `wineID` FK. Adding `user_id` directly to bottles is denormalization for query performance. Worth it? (Recommended yes — avoids JOINs on every bottle query.)

7. **Region/Country user-scoping**: Currently shared. Some users might want custom regions. Keep shared? Or add user-overrides later?

8. **Offline/PWA**: The app is already a PWA with Workbox. Does auth need to work offline? (Probably not initially — require online for login, cache session for subsequent offline use.)

---

## Appendix: Current vs Target State

```
CURRENT (Single User)                    TARGET (Multi-User)
========================                 ========================

No auth                          →       Session-based auth
agentUsers (minimal)             →       users (full auth table)
wine (no user_id)                →       wine (user_id FK)
bottles (no user_id)             →       bottles (user_id FK)
ratings (no user_id)             →       ratings (user_id FK)
user_settings (global)           →       user_settings (per-user)
No collections                   →       collections + items
No learning system               →       modules + content + progress
No tasting journal               →       tasting_journal
Agent tables (userId=1)          →       Agent tables (real userId)
Single DB connection             →       Single DB connection (unchanged)
No API auth                      →       Session middleware on all endpoints
Frontend: no auth store          →       Frontend: auth store + login page
```

### Estimated Table Count After Migration

| Category | Current | After Phase 1 | After Phase 3 |
|----------|---------|---------------|---------------|
| Core (user-owned) | 12 | 12 (+ user_id) | 12 |
| Agent | 7 | 7 (FK updated) | 7 |
| Cache | 3 | 3 | 3 |
| Reference | 6 | 6 | 6 |
| Auth | 0 | 1 (users) | 1 |
| Learning | 0 | 0 | 3 (modules, content, progress) |
| Collections | 0 | 0 | 2 (collections, items) |
| Journal | 0 | 0 | 1 |
| Views | 3 | 3 | 3+ |
| **Total** | **31** | **32** | **38** |
