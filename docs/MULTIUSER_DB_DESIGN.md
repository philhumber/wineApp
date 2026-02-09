# Multi-User Database & Architecture Design

**Status**: RFC (Request for Comments)
**Created**: 2026-02-09
**Updated**: 2026-02-09 (v2 — aligned with `docs/learn/` strategy and `docs/plans/AUTH_PLAN.md`)
**Author**: Design session — Phil + Claude

---

## Table of Contents

1. [The Core Question: Separate DBs vs Shared DB](#1-the-core-question)
2. [Recommendation: Shared Database with Tenant Column](#2-recommendation)
3. [User & Authentication Model](#3-user--authentication-model)
4. [Schema Migration Plan](#4-schema-migration-plan)
5. [Data Categories & Ownership](#5-data-categories--ownership)
6. [Learning System — Multi-User Implications](#6-learning-system--multi-user-implications)
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

3. **The learning system benefits from aggregate data** — The Learn feature's "Revealer" strategy is built on surfacing existing shared reference data (42 grapes, 33 countries, 47 appellations, 58 pairing rules, 500+ enrichments) and personalizing it against *each user's cellar*. All user data in one database makes these personalization queries natural. DB-per-tenant would make "Your 12 Pinot Noirs vs the reference profile" impossible without cross-database queries.

4. **Operational simplicity** — One schema migration runs once. One backup covers everything. One connection pool serves all users.

5. **Scale reality** — DB-per-tenant makes sense at enterprise scale (100K+ tenants with strict compliance requirements). For a wine app with dozens to hundreds of users, it's massive over-engineering.

---

## 2. Recommendation

### Shared Database, Four Tiers of Data

```
┌─────────────────────────────────────────────────────────┐
│              SHARED REFERENCE (no user_id)               │
│  country, region, winetype, grapes,                     │
│  refGrapeCharacteristics, refAppellations, refWineStyles│
│  refPairingRules, refIntensityProfiles, refAbbreviations│
│  currencies, bottle_sizes                               │
│  + NEW: refWinemakingProcesses (Phase 2)                │
├─────────────────────────────────────────────────────────┤
│            USER-OWNED CELLAR (user_id FK)                │
│  wine, bottles, ratings, producers, grapemix,           │
│  critic_scores, user_settings, audit_log                │
├─────────────────────────────────────────────────────────┤
│        USER-OWNED LEARN + AGENT (user_id FK)             │
│  agentUsers → BECOMES → users (unified)                 │
│  agentSessions, agentUsageLog, agentUsageDaily,         │
│  agentIdentificationResults, agentUserTasteProfile      │
│  + NEW: learnExplorationLog, learnBookmarks (Phase 1)   │
│  + NEW: learnTasteInsights (Phase 2)                    │
├─────────────────────────────────────────────────────────┤
│              SHARED CACHE (no user_id)                   │
│  cacheWineEnrichment, cacheProducers,                   │
│  cacheCanonicalAliases                                  │
│  (shared across all users — same wine = same cache)     │
├─────────────────────────────────────────────────────────┤
│       SHARED LEARN CONTENT (no user_id, Phase 2+)        │
│  learnContent (curated/AI articles)                     │
│  learnTopicLinks (knowledge graph)                      │
└─────────────────────────────────────────────────────────┘
```

### Key Insight: Learn MVP Needs No New Content Tables

The Learn "Revealer" strategy (see `docs/learn/STRATEGY_SUMMARY.md`) is built on a critical realization: **the database already contains 130+ unique pieces of educational content** across existing reference tables. Phase 1 surfaces this data and personalizes it — it doesn't create a CMS.

New tables are only needed for **tracking what users have explored** (per-user) and **curated articles** (shared, Phase 2+).

---

## 3. User & Authentication Model

### What Already Exists

Auth work is already underway on `develop` (see `docs/plans/AUTH_PLAN.md`):

- **PHP endpoints**: `resources/php/auth/login.php`, `logout.php`, `checkAuth.php`, `authCorsHeaders.php`
- **Middleware**: `resources/php/authMiddleware.php` — dual auth (API key OR session)
- **Frontend store**: `qve/src/lib/stores/auth.ts` — fully implemented with `initialize()`, `login()`, `logout()`, `checkAuth()`
- **Login page**: `qve/src/routes/login/+page.svelte` — wine-cellar-entrance design
- **Layout gate**: `+layout.svelte` auth guard with redirect

### Current Auth: Single-Password Gate

The current implementation is a **single shared password** (no user accounts) — designed to protect a single-user production deployment. This is the right foundation to evolve into multi-user.

### Evolution: Single Password → Multi-User Accounts

The existing `agentUsers` table becomes the unified `users` table:

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

### Auth Changes Required for Multi-User

The existing auth system needs these modifications:

| Component | Current (Single Password) | Multi-User |
|-----------|---------------------------|------------|
| `login.php` | Validates against single `APP_PASSWORD_HASH` config | `SELECT` user by email, `password_verify()` against row |
| `$_SESSION` | `['authenticated' => true]` | `['user_id' => $user->id, 'authenticated' => true]` |
| `authMiddleware.php` | Checks session exists | Checks session exists AND extracts `$userId` |
| `checkAuth.php` | Returns `{ authenticated: bool }` | Returns `{ authenticated: bool, user: { id, displayName, email } }` |
| Login page | Password-only input | Email + password inputs |
| `stores/auth.ts` | `authenticated` boolean | `authenticated` + `currentUser` object |
| Registration | N/A | New endpoint + page (invite-only or open) |

The session-based approach (not JWT) is correct — it's already built, works with PHP's native session handling, and the dual auth (API key + session) pattern in `authMiddleware.php` is sound.

---

## 4. Schema Migration Plan

### Core Wine Tables — Add `user_id`

These tables need a `user_id` column to become multi-user. The `DEFAULT 1` ensures all existing data is owned by Phil (user 1) with zero data migration:

```sql
-- WINE: Add user_id, index it
ALTER TABLE wine
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER wineID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_wine_user FOREIGN KEY (user_id) REFERENCES users(id);

-- BOTTLES: Denormalized user_id for query efficiency (avoids JOIN to wine on every query)
ALTER TABLE bottles
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER bottleID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_bottles_user FOREIGN KEY (user_id) REFERENCES users(id);

-- RATINGS: The person who rated
ALTER TABLE ratings
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER ratingID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users(id);

-- PRODUCERS: Hybrid model (NULL = shared canonical, NOT NULL = user's own)
ALTER TABLE producers
    ADD COLUMN user_id INT NULL AFTER producerID,
    ADD COLUMN canonical_producer_id INT NULL,
    ADD INDEX idx_user_id (user_id),
    ADD INDEX idx_canonical (canonical_producer_id),
    ADD CONSTRAINT fk_producers_user FOREIGN KEY (user_id) REFERENCES users(id);

-- Set existing producers to user 1
UPDATE producers SET user_id = 1;

-- GRAPEMIX: Inherits through wine, denormalized
ALTER TABLE grapemix
    ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER mixID,
    ADD INDEX idx_user_id (user_id),
    ADD CONSTRAINT fk_grapemix_user FOREIGN KEY (user_id) REFERENCES users(id);

-- CRITIC_SCORES: Shared data — no user_id needed (same critics for everyone)

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
-- agentUsers has been renamed to users
-- All agent table FKs already reference agentUsers(id) which is now users(id)
-- No structural changes needed — just verify FKs resolve correctly
-- The DEFAULT '1' values remain correct (Phil = user 1)
```

---

## 5. Data Categories & Ownership

### Complete Ownership Map

| Table | Ownership | Multi-User Action | Rationale |
|-------|-----------|-------------------|-----------|
| **wine** | Per-user | Add `user_id` FK | Your cellar is yours |
| **bottles** | Per-user | Add `user_id` FK (denormalized) | Your inventory, avoids JOIN |
| **ratings** | Per-user | Add `user_id` FK | Your tasting notes, your scores |
| **producers** | Hybrid | Add nullable `user_id` | See Producer Problem below |
| **grapemix** | Per-user | Add `user_id` FK (denormalized) | Tied to your wine entry |
| **user_settings** | Per-user | Add `user_id` to PK | Your preferences |
| **audit_log** | Per-user | Rename `changedBy` → `user_id` | Your change history |
| **country** | Shared | No change | France is France for everyone |
| **region** | Shared | No change | Burgundy doesn't change per user |
| **winetype** | Shared | No change | "Red" is universal |
| **grapes** | Shared | No change | Pinot Noir is Pinot Noir |
| **currencies** | Shared | No change | Exchange rates are global |
| **bottle_sizes** | Shared | No change | Standard sizes |
| **critic_scores** | Shared | No change | Published scores are public data |
| **ref* tables** (6) | Shared | No change | Reference/educational data |
| **cache* tables** (3) | Shared | No change | Enrichment cache benefits all users |
| **agent* tables** (6) | Per-user | Already have `userId` FK | Already multi-user ready |
| **learnExplorationLog** | Per-user | New table (has `userId`) | What you've explored |
| **learnBookmarks** | Per-user | New table (has `userId`) | Your saved topics |
| **learnContent** | Shared | New table Phase 2+ | Curated articles for everyone |
| **learnTopicLinks** | Shared | New table Phase 2+ | Knowledge graph |
| **learnTasteInsights** | Per-user | New table Phase 2+ | Computed personal insights |

### The Producer Problem

Producers sit in a gray area:

- **Option A: Fully shared** — One `producers` table, all users reference same records. Pro: no duplication, "Château Margaux" exists once. Con: who can edit? Conflicts between users.
- **Option B: Per-user** — Each user has their own producer records. Pro: no conflicts. Con: "Château Margaux" stored 50 times.
- **Option C: Hybrid (recommended)** — Shared canonical producers (NULL `user_id`) + user-owned records. The system matches user-created producers to canonical ones for dedup via `canonical_producer_id`.

**Recommendation: Option C**. Start with per-user producers (every user's producer entry is theirs). Add `canonical_producer_id` that links to a shared/curated producer identity. This keeps it simple now while enabling:
- Autocomplete from canonical names
- Future producer pages in Learn ("About Château Margaux")
- Dedup reporting without forcing data sharing

---

## 6. Learning System — Multi-User Implications

> Full Learn feature specification: `docs/learn/ARCHITECTURE.md`, `docs/learn/DATA_STRATEGY.md`, `docs/learn/CONTENT_STRATEGY.md`, `docs/learn/USER_PERSPECTIVE.md`, `docs/learn/STRATEGY_SUMMARY.md`

### How Learn Works (Summary)

The Learn feature surfaces **existing reference data** (not a CMS) and personalizes it against each user's cellar:

```
SHARED REFERENCE DATA                    PER-USER CELLAR DATA
(same for all users)                     (filtered by user_id)
─────────────────────                    ─────────────────────
refGrapeCharacteristics (42)      ──┐
refAppellations (47)                │    wine + bottles + ratings
refWineStyles (30)                  ├──→ JOIN on user's collection
refPairingRules (58)                │    = PERSONALIZED LEARN PAGE
refIntensityProfiles (25)           │
country (33) + region (30+)       ──┘    "Your 12 Pinot Noirs"
cacheWineEnrichment (500+)               "Avg rating: 7.8"
                                         "Top producer: Felton Road"
```

This is the core multi-user value: **the same grape reference page shows different personal stats for each user**. User A sees "Your 3 Nebbiolo wines" while User B sees "You haven't tried Nebbiolo yet — here's why you might like it based on your love of Sangiovese."

### Learn Tables — Multi-User Classification

**Phase 1 (MVP) — 2 new tables, both per-user:**

```sql
-- What has each user explored? (per-user)
CREATE TABLE learnExplorationLog (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    userId          INT NOT NULL,
    topicType       ENUM('grape','country','region','appellation','style',
                         'pairing','process','concept','producer') NOT NULL,
    topicId         INT NULL,
    topicName       VARCHAR(255) NOT NULL,
    firstViewedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastViewedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    viewCount       INT DEFAULT 1,
    timeSpentSeconds INT DEFAULT 0,
    source          ENUM('browse','cellar_link','search','recommendation','quiz') DEFAULT 'browse',
    CONSTRAINT fk_explore_user FOREIGN KEY (userId) REFERENCES users(id),
    INDEX idx_user_topic (userId, topicType),
    INDEX idx_user_recent (userId, lastViewedAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User's saved/bookmarked topics (per-user)
CREATE TABLE learnBookmarks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    userId          INT NOT NULL,
    topicType       ENUM('grape','country','region','appellation','style',
                         'pairing','process','concept','producer') NOT NULL,
    topicId         INT NULL,
    topicName       VARCHAR(255) NOT NULL,
    note            TEXT NULL,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookmark_user FOREIGN KEY (userId) REFERENCES users(id),
    UNIQUE INDEX idx_user_topic (userId, topicType, topicId),
    INDEX idx_user_created (userId, createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Phase 2+ — 3 more tables (2 shared, 1 per-user):**

```sql
-- Curated articles and AI-generated deep dives (shared across all users)
CREATE TABLE learnContent (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    title           VARCHAR(255) NOT NULL,
    subtitle        VARCHAR(255) NULL,
    category        ENUM('grape_guide','region_guide','winemaking','comparison',
                         'history','technique','pairing_guide') NOT NULL,
    body            MEDIUMTEXT NOT NULL,              -- Markdown
    summary         VARCHAR(500) NULL,
    difficulty      ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
    readTimeMinutes INT DEFAULT 5,
    heroImage       VARCHAR(500) NULL,
    relatedTopics   JSON NULL,                        -- [{type, id, name}]
    tags            JSON NULL,
    contentSource   ENUM('curated','ai_generated','data_derived') DEFAULT 'curated',
    reviewedAt      TIMESTAMP NULL,
    isPublished     BOOLEAN DEFAULT FALSE,
    sortOrder       INT DEFAULT 0,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_published (isPublished, sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Knowledge graph linking topics (shared)
CREATE TABLE learnTopicLinks (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    sourceType      VARCHAR(50) NOT NULL,             -- 'grape', 'region', 'appellation', etc.
    sourceId        INT NOT NULL,
    targetType      VARCHAR(50) NOT NULL,
    targetId        INT NOT NULL,
    linkType        ENUM('grows_in','native_to','classified_under','pairs_with',
                         'similar_to','sub_region_of','used_in','parent_grape') NOT NULL,
    strength        DECIMAL(3,2) DEFAULT 1.00,        -- 0-1 relevance
    metadata        JSON NULL,
    INDEX idx_source (sourceType, sourceId),
    INDEX idx_target (targetType, targetId),
    INDEX idx_link_type (linkType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Computed personal insights (per-user, regenerated periodically)
CREATE TABLE learnTasteInsights (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    userId          INT NOT NULL,
    insightType     ENUM('top_grape','top_country','top_region','preference_body',
                         'preference_acidity','preference_tannin','adventurousness',
                         'buy_again_pattern','drink_window_status') NOT NULL,
    insightKey      VARCHAR(100) NOT NULL,
    insightValue    VARCHAR(255) NOT NULL,
    insightLabel    VARCHAR(255) NOT NULL,             -- Human-readable
    insightDetail   JSON NULL,                         -- Supporting data
    computedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiresAt       TIMESTAMP NULL,
    CONSTRAINT fk_insight_user FOREIGN KEY (userId) REFERENCES users(id),
    UNIQUE INDEX idx_user_type_key (userId, insightType, insightKey),
    INDEX idx_user_expires (userId, expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Learn Personalization Queries — Multi-User Pattern

The 5 key personalization queries from `docs/learn/DATA_STRATEGY.md` all follow the same pattern — shared reference data JOINed with user-filtered cellar data:

```sql
-- Example: "Your Grapes" — works identically for any user_id
SELECT
    g.grapeName, g.color, gc.body, gc.tannin, gc.acidity,
    gc.primaryFlavors, gc.classicPairings,
    COUNT(DISTINCT w.wineID) as wineCountInCellar,
    AVG(r.overallRating) as avgRating,
    SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) / COUNT(r.ratingID) as buyAgainPercent
FROM grapes g
LEFT JOIN refGrapeCharacteristics gc ON g.grapeName = gc.grapeName
LEFT JOIN grapemix gm ON g.grapeID = gm.grapeID AND gm.user_id = :userId  -- ← tenant filter
LEFT JOIN wine w ON gm.wineID = w.wineID AND w.user_id = :userId           -- ← tenant filter
LEFT JOIN ratings r ON w.wineID = r.wineID AND r.user_id = :userId          -- ← tenant filter
GROUP BY g.grapeID
ORDER BY wineCountInCellar DESC, g.grapeName;
```

The `user_id` filter appears on the **user-owned JOINs** but NOT on the shared reference tables. This is the same pattern across all 5 queries (Your Grapes, Your Regions, Unexplored Territory, Taste Profile, Adventurousness Score).

### Learn + Existing Reference Tables — No Schema Changes Needed

The existing reference tables are already structured for multi-user Learn. They have no `user_id` and don't need one — they're shared educational content:

| Table | Rows | Learn Purpose | Multi-User Impact |
|-------|------|---------------|-------------------|
| `refGrapeCharacteristics` | 42 | Grape detail pages | None — same for all users |
| `refAppellations` | 47 | Region/appellation pages | None |
| `refWineStyles` | 30 | Style guide pages | None |
| `refPairingRules` | 58 | Pairing explorer | None |
| `refIntensityProfiles` | 25 | Pairing weight matching | None |
| `country` | 33 | Country pages (history, key grapes) | None |
| `region` | 30+ | Region pages (terroir, climate) | None |
| `cacheWineEnrichment` | 500+ | Wine-specific deep dives | None — keyed by wine name, not user |

The only schema change proposed for reference tables is expanding `refGrapeCharacteristics` with `originCountry`, `pronunciationGuide`, `funFact`, etc. — these are shared columns, not per-user.

### Seed Data for Phase 2

From `docs/learn/DATA_STRATEGY.md`, the knowledge graph can be auto-populated from existing reference data:

```sql
-- Auto-generate: Grape → Country (native_to) from country.keyGrapes JSON
-- Auto-generate: Grape → Appellation (grows_in) from refAppellations.primaryGrapes
-- Auto-generate: Grape → Style (used_in) from refWineStyles.typicalGrapes
-- Auto-generate: Appellation → Country (classified_under)
-- Auto-generate: Appellation → Appellation (sub_region_of) via parentAppellation
```

This means the knowledge graph is populated from **shared data** — no per-user involvement.

---

## 7. Migration Path (Phased)

### Phase 0: Auth Evolution (Pre-requisite)

**Goal**: Evolve single-password auth into per-user accounts.

**Already built** (on `develop`):
- Session-based auth with `login.php`, `logout.php`, `checkAuth.php`
- Dual auth middleware (API key + session)
- Frontend auth store, login page, layout gate
- Brute force protection, CSRF, rate limiting

**Still needed for multi-user**:
1. Rename `agentUsers` → `users`, extend with auth columns
2. Modify `login.php`: lookup by email, `password_verify()` per user
3. Store `$_SESSION['user_id']` (not just `['authenticated']`)
4. Modify `checkAuth.php`: return user object
5. Add registration endpoint (invite-only recommended for initial rollout)
6. Update `stores/auth.ts`: add `currentUser` state
7. Update login page: email + password fields

### Phase 1: Tenant Column + Learn MVP (Sprints 14-15)

**Goal**: Every row has an owner. Learn "Revealer" launches.

**Database**:
1. Add `user_id` column (DEFAULT 1) to: `wine`, `bottles`, `ratings`, `producers`, `grapemix`, `user_settings`, `audit_log`
2. Create `learnExplorationLog`, `learnBookmarks` tables
3. Complete 13 missing grape characteristic profiles
4. Add composite indexes (`user_id` + existing FKs)

**PHP Backend**:
5. Update `authMiddleware.php` to extract `$userId` from session
6. Update **every CRUD endpoint** to:
   - Call `requireAuth()` → get `$userId`
   - Add `WHERE user_id = :userId` to all SELECTs
   - Set `user_id = :userId` on all INSERTs
7. Build 12 Learn PHP endpoints (`resources/php/learn/`)
   - Each blends reference data + user-filtered cellar data

**Frontend**:
8. Learn routes, stores, components (per `docs/learn/ARCHITECTURE.md`)
9. API client: pass session cookie on all requests, handle 401

**Rollout**: Existing data automatically belongs to user 1 via DEFAULT. Phil's experience unchanged. New users can be invited.

### Phase 2: Knowledge Graph + Content (Sprints 16-17)

**Goal**: Deep learning content, cross-topic navigation.

1. Create `learnContent`, `learnTopicLinks`, `learnTasteInsights` tables
2. Auto-populate knowledge graph from reference data
3. Add `refWinemakingProcesses` table (12 seed entries)
4. Build Wine Moments (contextual micro-learning on wine view/rate)
5. Region, appellation, style, pairing detail pages
6. Taste profile / Wine DNA page (uses `learnTasteInsights`)

### Phase 3: Agent Integration + Journal (Sprints 18-19)

**Goal**: AI-powered learning, structured tasting.

1. Agent "learn" intent in router
2. Post-enrichment Learn suggestion chips
3. Agent-driven quiz mode
4. Tasting journal (optional — if demand exists)

### Phase 4: Social & Sharing (Future)

**Goal**: Controlled sharing between users.

1. Public collections / wishlists
2. Anonymous aggregate insights ("85% of users who like Barolo also enjoy Nebbiolo d'Alba")
3. Shared tasting sessions
4. Wine embeddings + similarity discovery (uses existing `agentWineEmbeddings`)

---

## 8. Security & Isolation

### Query-Level Isolation

Every query touching user-owned data MUST include the user filter. The existing `authMiddleware.php` pattern evolves:

```php
// Current (single password):
function authenticate() {
    // Check API key OR session exists
}

// Multi-user evolution:
function requireAuth(): int {
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated']);
        exit;
    }
    session_write_close(); // Release lock immediately (already in AUTH_PLAN)
    return (int) $_SESSION['user_id'];
}

// Usage in every endpoint:
$userId = requireAuth();
$stmt = $pdo->prepare("SELECT * FROM wine WHERE user_id = :userId AND ...");
$stmt->execute(['userId' => $userId]);
```

### Defense in Depth

1. **Application layer**: `requireAuth()` on every endpoint, `$userId` in every query
2. **API validation**: Never trust client-supplied `user_id` — always derive from session
3. **Audit trail**: `audit_log` already tracks changes; now with real `user_id`
4. **Rate limiting**: Agent usage tracking (`agentUsageDaily`) already per-user; extend to API calls
5. **Session security**: Already implemented — HttpOnly, Secure, SameSite=Strict, session_regenerate_id

### Data Isolation Matrix

| Data Type | Isolation Level | Enforcement |
|-----------|----------------|-------------|
| Wine collection | Strict per-user | `WHERE user_id = :userId` on all queries |
| Ratings & notes | Strict per-user | `WHERE user_id = :userId` |
| Bottle inventory & prices | Strict per-user | `WHERE user_id = :userId` |
| Learn exploration/bookmarks | Strict per-user | `WHERE userId = :userId` |
| Learn taste insights | Strict per-user | `WHERE userId = :userId` |
| Agent sessions & usage | Strict per-user | Already implemented with `userId` FK |
| Reference data | Shared (read-only for users) | No user_id column, admin-only writes |
| Enrichment cache | Shared | No user_id, keyed by wine name |
| Learn content & articles | Shared (read-only) | No user_id column |
| Knowledge graph | Shared (read-only) | No user_id column |

---

## 9. Performance Considerations

### Indexing Strategy

Every table with `user_id` needs it as the **leading column** in composite indexes for the most common query patterns:

```sql
-- Wine queries: user's wines by type, producer, year
ALTER TABLE wine ADD INDEX idx_user_type (user_id, wineTypeID);
ALTER TABLE wine ADD INDEX idx_user_producer (user_id, producerID);
ALTER TABLE wine ADD INDEX idx_user_deleted (user_id, deleted);

-- Bottle queries: user's bottles for a wine, active bottles
ALTER TABLE bottles ADD INDEX idx_user_wine (user_id, wineID);
ALTER TABLE bottles ADD INDEX idx_user_active (user_id, bottleDrunk, deleted);

-- Rating queries: user's ratings by wine
ALTER TABLE ratings ADD INDEX idx_user_wine (user_id, wineID);

-- Learn queries: user's recent exploration
-- (Already defined in table creation above)
```

### Query Impact

Adding `WHERE user_id = X` with proper indexes actually **improves** performance at scale — you scan a smaller subset of rows. Current single-user queries scan everything.

### Learn Query Performance

The Learn personalization queries (Section 6) JOIN shared reference tables with user-filtered cellar data. These are efficient because:
- Reference table JOINs use existing PKs/indexes (grapeID, regionID, etc.)
- User-owned table filters use the new `user_id` indexes
- Results are small (42 grapes max, 33 countries max)
- Can be cached in-memory per session (5-min TTL per `docs/learn/ARCHITECTURE.md`)

### Caching

| Cache Layer | Scope | Strategy |
|-------------|-------|----------|
| Enrichment cache (DB) | Shared | Already user-agnostic — no change |
| Learn content lists | Shared | In-memory + Workbox NetworkFirst, 5-min TTL |
| Learn detail + personal stats | Per-user | Re-fetch per request (always fresh) |
| Agent sessions | Per-user | Already per-user via sessionToken |

---

## 10. Open Questions

### Resolved by Existing Plans

| Question | Answer | Source |
|----------|--------|--------|
| Auth method? | Session-based (not JWT) | `AUTH_PLAN.md` — already built |
| Bottle-level user_id? | Yes, denormalized | See Section 4 — avoids JOINs on every bottle query |
| Learning content authoring? | Admin/curated only | `CONTENT_STRATEGY.md` — AI-generated with human review |
| Offline/PWA auth? | Online for login, cached session after | `AUTH_PLAN.md` — Workbox handles offline |

### Still Open

1. **Registration model**: Open registration? Invite-only? Admin-creates-accounts? Recommend **invite-only** for initial multi-user rollout — admin generates invite link, user sets their password.

2. **Producer sharing**: Users should see canonical producers for autocomplete but own their records. When should the system suggest merging a user-created producer with a canonical one?

3. **Data migration**: The `DEFAULT 1` approach assigns all existing data to user 1 (Phil). Is that correct, or does any data need to be split across users?

4. **Region/Country user-scoping**: Currently shared. Some users might want custom regions. Keep shared for now? (Recommended: yes — custom regions add complexity with minimal value.)

5. **Learn exploration — anonymous aggregates**: In Phase 4, should "Most explored grape" or "Trending topic" use anonymized cross-user data? If so, `learnExplorationLog` needs an aggregate view.

6. **Agent conversation isolation**: Agent sessions are already per-user via `agentSessions.userId`. But should agent enrichment results be shared? (E.g., if User A enriches "Château Margaux 2015" and User B asks for the same wine, should the cached result be reused?) Current answer: yes, via `cacheWineEnrichment` which is user-agnostic.

---

## Appendix A: Current vs Target State

```
CURRENT (Single User)                    TARGET (Multi-User)
========================                 ========================

Single password gate             →       Per-user email + password
agentUsers (1 row)               →       users (many rows, extended)
wine (no user_id)                →       wine (user_id FK)
bottles (no user_id)             →       bottles (user_id FK, denormalized)
ratings (no user_id)             →       ratings (user_id FK)
producers (no user_id)           →       producers (nullable user_id, hybrid)
user_settings (global)           →       user_settings (per-user composite PK)
No learn tracking                →       learnExplorationLog + learnBookmarks
No taste insights                →       learnTasteInsights (computed per-user)
No knowledge graph               →       learnTopicLinks (shared)
No curated articles              →       learnContent (shared)
Agent tables (userId=1)          →       Agent tables (real userId)
Single DB connection             →       Single DB connection (unchanged)
$_SESSION['authenticated']       →       $_SESSION['user_id']
Frontend: no user context        →       Frontend: currentUser in auth store
```

## Appendix B: Estimated Table Count

| Category | Current | After Phase 1 | After Phase 2 | After Phase 4 |
|----------|---------|---------------|---------------|---------------|
| Core (user-owned) | 12 | 12 (+ user_id) | 12 | 12 |
| Agent | 7 | 7 (FK updated) | 7 | 7 |
| Cache | 3 | 3 | 3 | 3 |
| Reference | 6 | 6 | 7 (+processes) | 7 |
| Auth | 0 | 1 (users) | 1 | 1 |
| Learn (per-user) | 0 | 2 (explore, bookmarks) | 3 (+insights) | 3 |
| Learn (shared) | 0 | 0 | 2 (content, links) | 2 |
| Views | 3 | 3 | 3 | 3+ |
| **Total** | **31** | **34** | **38** | **38+** |

## Appendix C: Related Documents

- `docs/learn/STRATEGY_SUMMARY.md` — Learn feature overview and 3 strategic options
- `docs/learn/ARCHITECTURE.md` — Routes, components, stores, API endpoints, performance
- `docs/learn/DATA_STRATEGY.md` — All tables, seed data, 5 personalization queries
- `docs/learn/CONTENT_STRATEGY.md` — 11 content formats, Wine Moments, learning paths
- `docs/learn/USER_PERSPECTIVE.md` — 5 personas, pain points, user stories, UX preferences
- `docs/plans/AUTH_PLAN.md` — Full auth implementation plan (single-password → multi-user path)
- `docs/ARCHITECTURE.md` — System architecture, ER diagrams, full schema reference
