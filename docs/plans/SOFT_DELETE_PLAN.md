# WIN-80: Soft Delete — Implementation Plan

**Status**: Approved for implementation
**Date**: 2026-02-08
**JIRA**: WIN-80

---

## Implementation Session Decisions (2026-02-08)

This section captures decisions made during the implementation planning session. These are binding and should not require re-discussion.

### Clarified Requirements

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Bottle delete UI on edit page** | Option A: × buttons on bottle pills | Cleaner UX, inline with existing pill patterns |
| **Toast timer pause bug** | Fix as part of WIN-80 | Critical for correct undo experience |
| **Git/PR strategy** | Single PR for entire feature | Simpler review, all changes are interdependent |
| **Audit logging** | Include in V1 | Per-column approach using existing `logChange()` |
| **grapemix/critic_scores cascade** | No separate deleted columns | JOIN through wine with `wine.deleted = 0` (simpler, undo is automatic) |

### Architecture Review Fixes

These issues were identified during architecture review and are incorporated into the plan:

| Issue | Fix | Section |
|-------|-----|---------|
| Migration script: `AFTER worldID` doesn't exist | Changed to `AFTER map` | §3.2 (updated below) |
| Audit log schema mismatch | Use existing per-column `logChange()` pattern | §3.7 (updated below) |
| Rating count query wrong | Use `COUNT(DISTINCT r.ratingID) FROM ratings r JOIN bottles b` | §4.2 (updated below) |
| `updateRating.php` should check deleted bottle | Add JOIN to check `bottles.deleted = 0` | §4.3 (updated below) |

### Toast Timer Pausable Implementation

The toast system needs a pausable timer to sync with the CSS progress bar pause-on-hover. Implementation approach:

```typescript
// In toast.ts - add pausable timer tracking
const toastTimers = new Map<string, {
  remainingMs: number;
  lastTick: number;
  paused: boolean;
  rafId: number;
}>();

export function pauseToast(id: string): void {
  const timer = toastTimers.get(id);
  if (timer) timer.paused = true;
}

export function resumeToast(id: string): void {
  const timer = toastTimers.get(id);
  if (timer) {
    timer.paused = false;
    timer.lastTick = Date.now(); // Prevent time jump
  }
}
```

### PendingDelete Interface (Concrete)

```typescript
interface PendingDelete {
  id: string;                     // crypto.randomUUID()
  entityType: 'wine' | 'bottle' | 'producer' | 'region';
  entityId: number;
  entityName: string;
  snapshot: {
    wine?: Wine;                  // For wine deletes
    historyEntries?: DrunkWine[]; // For wine cascade (drink history)
    bottle?: Bottle;              // For bottle-only deletes
  };
  timerId: ReturnType<typeof setTimeout>;
  expiresAt: number;              // For sessionStorage recovery
  toastId: string;                // Reference to dismiss toast on undo
}

// sessionStorage persists only serializable parts:
interface PersistedPendingDelete {
  id: string;
  entityType: 'wine' | 'bottle' | 'producer' | 'region';
  entityId: number;
  entityName: string;
  snapshot: { wine?: Wine; historyEntries?: DrunkWine[]; bottle?: Bottle };
  expiresAt: number;
}
```

### Test Suite

A comprehensive TDD test suite has been created. See [`docs/SOFT_DELETE_TESTS.md`](./SOFT_DELETE_TESTS.md) for:
- 135+ tests across frontend and backend
- Implementation checklist mapping tests to features
- Setup and run instructions

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Database Changes](#3-database-changes)
4. [Backend (PHP) Changes](#4-backend-php-changes)
5. [Frontend Changes](#5-frontend-changes)
6. [Delete Flow Sequences](#6-delete-flow-sequences)
7. [Edge Cases & Mitigations](#7-edge-cases--mitigations)
8. [File Change Manifest](#8-file-change-manifest)
9. [Implementation Order](#9-implementation-order)
10. [Future Considerations](#10-future-considerations)

---

## 1. Overview

### What
Soft delete for wines, bottles, producers, regions, and drink history entries. Items are flagged as deleted (not physically removed), disappear from all views immediately, and can be undone within a 10-second window.

### Why
Users currently cannot remove accidentally-added wines, bottles, producers, or regions without drinking them. This blocks basic collection management.

### Scope

**Cascade direction: DOWN only.** Deleting a parent cascades to children. Deleting children never affects the parent — parents remain even when all children are deleted.

**Hierarchy**: Country → Region → Producer → Wine → Bottle

| Entity | Direct Delete | Cascade Down | Affected by Parent Delete |
|--------|:---:|:---:|:---:|
| Country | No (reference data) | — | — |
| Region | Yes (via API / future UI) | → producers → wines → bottles | No |
| Producer | Yes (via API / future UI) | → wines → bottles | Yes (when region deleted) |
| Wine | Yes (from card/edit page) | → bottles | Yes (when producer deleted) |
| Bottle | Yes (from edit page) | — | Yes (when wine deleted) |
| History entry | Yes (from history page) | — | Yes (when parent bottle/wine deleted) |

**Important**: Deleting all wines from a producer does NOT delete the producer. Deleting all bottles from a wine does NOT delete the wine. Orphaned parents persist and remain visible in the UI.

### Key Constraints
- Single-user app (userId = 1 for now)
- No "Trash" view — timed undo toast only
- Soft-deleted records kept indefinitely (no auto-purge)
- AI agent integration deferred but API designed for it
- Must work on mobile / iOS Safari

---

## 2. Architecture Decisions

### AD-1: Delayed API Delete (not immediate + restore)

**Decision**: The API delete call fires only AFTER the 10-second undo window expires. During the window, the item is removed from frontend stores (optimistic UI) but the server is untouched.

**Rationale**:
- Eliminates the entire restore endpoint and cascade restoration logic
- No batch timestamp tracking needed
- Risk of "browser crash during 10s window" is negligible vs. risk of "delete succeeded but restore API failed"
- Single-user app — no multi-device consistency concern

**Implication**: No `restoreItem.php` endpoint needed. The `deleteItem.php` endpoint handles the full cascade atomically in a single transaction.

### AD-2: Column Naming — `deleted` (not `isDeleted`)

**Decision**: Use `deleted`, `deletedAt`, `deletedBy` on all tables.

**Rationale**: The `wine` and `bottles` tables already have these columns with this exact naming (discovered during analysis — they exist but are completely unused). Standardizing avoids mixed naming across queries.

### AD-3: History Deletion Uses `bottles.deleted`

**Decision**: Individual drink history entries are deleted by soft-deleting the corresponding bottle record. The `ratings` table does NOT get its own `deleted` column.

**Rationale**: Ratings are 1:1 with drunk bottles. The `getDrunkWines.php` query JOINs through bottles already. Adding `AND bottles.deleted = 0` naturally excludes deleted history entries.

### AD-4: Cascade Goes Down Only — Never Up

**Decision**: Deleting children never affects the parent. Deleting all wines from a producer does NOT auto-delete the producer. Deleting all bottles from a wine does NOT auto-delete the wine. Orphaned parents persist.

**Rationale**: The hierarchy (Country → Region → Producer → Wine → Bottle) cascades downward on delete. Upward cascade creates confusing side-effects — users don't expect deleting a wine to sometimes also delete its producer. Parents are cheap to keep and easy to delete explicitly if wanted.

### AD-5: Producer/Region — API-Only for V1

**Decision**: Producers and regions are directly deletable via the `deleteItem.php` endpoint, but no dedicated deletion UI exists in V1 (no standalone management screen). They are deleted either as part of a parent cascade (region delete cascades to producers) or via the API (for future agent integration).

**Rationale**: No standalone producer/region management UI exists. Building one is out of scope for V1. The API is ready for when the agent or a management screen is added.

### AD-6: Countries Are Not Deletable

**Decision**: The `country` table does not get soft-delete columns.

**Rationale**: Countries are fundamental reference data. Deleting a country would cascade through regions → producers → wines → bottles — far too destructive. Countries are never user-created.

---

## 3. Database Changes

### 3.1 Existing Columns (No Migration Needed)

The `wine` and `bottles` tables already have the required columns and indexes:

```sql
-- wine table (already exists)
`deleted` tinyint DEFAULT '0'
`deletedAt` timestamp NULL DEFAULT NULL
`deletedBy` int DEFAULT NULL
-- INDEX: idx_deleted (deleted)

-- bottles table (already exists)
`deleted` tinyint DEFAULT '0'
`deletedAt` timestamp NULL DEFAULT NULL
`deletedBy` int DEFAULT NULL
-- INDEX: idx_deleted (deleted)
```

### 3.2 New Columns — ALTER TABLE Statements

```sql
-- ============================================
-- MIGRATION: Add soft-delete columns
-- ============================================

-- producers table
ALTER TABLE producers
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `producerName`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- region table (note: column order is regionID, regionName, countryID, description, climate, soil, map)
ALTER TABLE region
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `map`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);
```

### 3.3 UNIQUE Constraint Modification

**Critical**: `producers` has `UNIQUE KEY producerName` and `region` has `UNIQUE KEY regionName`. Soft-deleted records would block re-creation of items with the same name.

**Fix**: Change to composite unique keys. MySQL treats each `NULL` as distinct in unique indexes, so active records (`deletedAt = NULL`) remain unique while multiple soft-deleted records can coexist.

```sql
-- Fix UNIQUE constraints to allow re-creation after soft delete
ALTER TABLE producers
  DROP INDEX `producerName`,
  ADD UNIQUE KEY `uq_producer_active` (`producerName`, `deletedAt`);

ALTER TABLE region
  DROP INDEX `regionName`,
  ADD UNIQUE KEY `uq_region_active` (`regionName`, `deletedAt`);
```

### 3.4 Composite Indexes for Query Performance

```sql
-- Optimize common query patterns: "active bottles for a wine"
ALTER TABLE bottles
  ADD INDEX `idx_wine_deleted_drunk` (`wineID`, `deleted`, `bottleDrunk`);

ALTER TABLE wine
  ADD INDEX `idx_deleted_type` (`deleted`, `typeID`);
```

### 3.5 Views

The three views (`vw_model_confidence_stats`, `vw_tier_escalation_analysis`, `vw_model_comparison`) are agent analytics views. They reference `agentIdentificationResults` and do not JOIN to wine/bottles. **No view modifications needed.**

### 3.6 Junction Tables

`grapemix` and `critic_scores` reference `wineID` as foreign keys. They do NOT need `deleted` columns — they follow their parent wine. Any query reading these tables must JOIN through `wine` and check `wine.deleted = 0`.

### 3.7 Audit Log

Delete operations should be logged using the existing `audit_log.php` helper functions. The `audit_log` table has columns: `tableName`, `recordID`, `action`, `columnName`, `oldValue`, `newValue`, `changedBy`, `changedAt`, `ipAddress`.

**Use the existing per-column approach via `logChange()`:**

```php
// In deleteItem.php - log each column change
logChange($pdo, 'wine', $wineId, 'deleted', '0', '1', $userId);
logChange($pdo, 'wine', $wineId, 'deletedAt', null, date('Y-m-d H:i:s'), $userId);
logChange($pdo, 'wine', $wineId, 'deletedBy', null, $userId, $userId);

// For cascade, log each affected bottle
foreach ($affectedBottleIds as $bottleId) {
    logChange($pdo, 'bottles', $bottleId, 'deleted', '0', '1', $userId);
    // etc.
}
```

**Note:** The `action` enum only includes `'INSERT','UPDATE','DELETE'`. Soft delete is logged as `'UPDATE'` since we're updating the `deleted` column, not actually deleting rows.

### 3.8 Migration Script

Save as `resources/sql/migrations/WIN-80_soft_delete.sql`:

```sql
-- ============================================
-- WIN-80: Soft Delete Migration
-- Run against: winelist database
-- ============================================

START TRANSACTION;

-- 1. Add columns to producers
ALTER TABLE producers
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `producerName`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- 2. Add columns to region (column order: regionID, regionName, countryID, description, climate, soil, map)
ALTER TABLE region
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `map`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- 3. Fix UNIQUE constraints
ALTER TABLE producers
  DROP INDEX `producerName`,
  ADD UNIQUE KEY `uq_producer_active` (`producerName`, `deletedAt`);

ALTER TABLE region
  DROP INDEX `regionName`,
  ADD UNIQUE KEY `uq_region_active` (`regionName`, `deletedAt`);

-- 4. Add composite indexes
ALTER TABLE bottles
  ADD INDEX `idx_wine_deleted_drunk` (`wineID`, `deleted`, `bottleDrunk`);

ALTER TABLE wine
  ADD INDEX `idx_deleted_type` (`deleted`, `typeID`);

COMMIT;
```

---

## 4. Backend (PHP) Changes

### 4.1 New Endpoint: `deleteItem.php`

**Path**: `resources/php/deleteItem.php`
**Method**: POST
**Input**:
```json
{
  "type": "wine|bottle|producer|region",
  "id": 123,
  "userId": 1
}
```

**Response (success)**:
```json
{
  "success": true,
  "deleted": {
    "type": "wine",
    "id": 123,
    "name": "Château Margaux 2015",
    "cascaded": {
      "bottles": 3,
      "ratings": 2
    }
  }
}
```

**Cascade logic** (transaction-wrapped, **downward only**):

```
DELETE region:
  1. Soft-delete all bottles of all wines by all producers in region
  2. Soft-delete all wines by all producers in region
  3. Soft-delete all producers in region
  4. Soft-delete the region

DELETE producer:
  1. Soft-delete all bottles of all wines by producer
  2. Soft-delete all wines by producer
  3. Soft-delete the producer
  (Region is NOT affected — even if this was the last producer)

DELETE wine:
  1. Soft-delete all bottles of wine
  2. Soft-delete the wine
  (Producer is NOT affected — even if this was the last wine)

DELETE bottle:
  1. Soft-delete the bottle
  (Wine is NOT affected — even if this was the last bottle)
```

**No upward cascade.** Parents always remain. This simplifies the transaction logic — no need to check sibling counts or evaluate orphan eligibility.

**SQL pattern**:
```sql
-- All cascade items get the same deletedAt timestamp
SET @now = NOW();
SET @userId = :userId;

-- Example: delete wine (cascade down to bottles only)
UPDATE bottles SET deleted = 1, deletedAt = @now, deletedBy = @userId
  WHERE wineID = :wineId AND deleted = 0;

UPDATE wine SET deleted = 1, deletedAt = @now, deletedBy = @userId
  WHERE wineID = :wineId AND deleted = 0;

-- That's it. Producer is NOT touched. No upward cascade check needed.
```

### 4.2 New Endpoint: `getDeleteImpact.php`

**Path**: `resources/php/getDeleteImpact.php`
**Method**: GET
**Input**: `?type=wine&id=123`

**Response** (example for wine):
```json
{
  "success": true,
  "entity": {
    "type": "wine",
    "id": 123,
    "name": "Château Margaux 2015"
  },
  "impact": {
    "bottles": { "count": 3, "names": ["750ml - 2020", "750ml - 2021", "Magnum - 2020"] },
    "ratings": { "count": 2 }
  }
}
```

**Response** (example for region — shows full downward cascade):
```json
{
  "success": true,
  "entity": {
    "type": "region",
    "id": 5,
    "name": "Bordeaux"
  },
  "impact": {
    "producers": { "count": 5, "names": ["Château Margaux", "Château Latour", ...] },
    "wines": { "count": 23 },
    "bottles": { "count": 47 },
    "ratings": { "count": 12 }
  }
}
```

Since cascade is downward only, the impact query simply counts all children at each level below the target entity. No orphan/sibling checks needed.

**Impact queries**:

```sql
-- Wine impact: count bottles and ratings below it
SELECT COUNT(*) as bottleCount
  FROM bottles WHERE wineID = :id AND deleted = 0;

-- FIXED: Count actual ratings, not drunk bottles
SELECT COUNT(DISTINCT r.ratingID) as ratingCount
  FROM ratings r
  JOIN bottles b ON r.bottleID = b.bottleID
  WHERE b.wineID = :id AND b.deleted = 0;

-- Producer impact: count wines, bottles, and ratings below it
SELECT COUNT(*) as wineCount
  FROM wine WHERE producerID = :id AND deleted = 0;

SELECT COUNT(*) as bottleCount
  FROM bottles b JOIN wine w ON b.wineID = w.wineID
  WHERE w.producerID = :id AND w.deleted = 0 AND b.deleted = 0;

SELECT COUNT(DISTINCT r.ratingID) as ratingCount
  FROM ratings r
  JOIN bottles b ON r.bottleID = b.bottleID
  JOIN wine w ON b.wineID = w.wineID
  WHERE w.producerID = :id AND w.deleted = 0 AND b.deleted = 0;

-- Region impact: count producers, wines, bottles, and ratings below it
SELECT COUNT(*) as producerCount
  FROM producers WHERE regionID = :id AND deleted = 0;

SELECT COUNT(*) as wineCount
  FROM wine w JOIN producers p ON w.producerID = p.producerID
  WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0;

SELECT COUNT(*) as bottleCount
  FROM bottles b JOIN wine w ON b.wineID = w.wineID
  JOIN producers p ON w.producerID = p.producerID
  WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0 AND b.deleted = 0;

SELECT COUNT(DISTINCT r.ratingID) as ratingCount
  FROM ratings r
  JOIN bottles b ON r.bottleID = b.bottleID
  JOIN wine w ON b.wineID = w.wineID
  JOIN producers p ON w.producerID = p.producerID
  WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0 AND b.deleted = 0;
```

### 4.3 Modified Endpoints — Complete Query Audit

Every existing PHP endpoint that reads from affected tables needs `AND deleted = 0` conditions. Below is the exhaustive list:

#### `getWines.php` (HIGHEST IMPACT — ~15 subqueries)
| Location | Change |
|----------|--------|
| Main WHERE clause | Add `AND w.deleted = 0` |
| All bottle subqueries (avgRating, standardPrice, bottleSources, buyAgainPercent, avgPricePerLiterEUR, etc.) | Add `AND b.deleted = 0` to each |
| Producer JOIN | Add `AND p.deleted = 0` |
| Region JOIN | Add `AND r.deleted = 0` |

#### `getBottles.php`
| Location | Change |
|----------|--------|
| Main WHERE | Add `AND deleted = 0` |

#### `getDrunkWines.php`
| Location | Change |
|----------|--------|
| Main WHERE | Add `AND w.deleted = 0 AND b.deleted = 0` |

#### `getCountries.php`
| Location | Change |
|----------|--------|
| All LEFT JOINs through region/wine/bottles | Add `AND r.deleted = 0 AND w.deleted = 0 AND b.deleted = 0` |

#### `getTypes.php`
| Location | Change |
|----------|--------|
| All LEFT JOINs through wine/bottles | Add `AND w.deleted = 0 AND b.deleted = 0` |

#### `getRegions.php`
| Location | Change |
|----------|--------|
| Main query | Add `AND r.deleted = 0` |
| All LEFT JOINs through wine/bottles/producers | Add deleted = 0 for each joined table |

#### `getProducers.php`
| Location | Change |
|----------|--------|
| Main query | Add `AND p.deleted = 0` |
| All LEFT JOINs through wine/bottles | Add `AND w.deleted = 0 AND b.deleted = 0` |

#### `getYears.php`
| Location | Change |
|----------|--------|
| All JOINs through wine/bottles | Add `AND w.deleted = 0 AND b.deleted = 0` |

#### `getCellarValue.php`
| Location | Change |
|----------|--------|
| Main query (`WHERE b.bottleDrunk = 0`) | Add `AND b.deleted = 0 AND w.deleted = 0` |

#### `checkDuplicate.php`
| Location | Change |
|----------|--------|
| All wine/producer/region lookups | Add `AND w.deleted = 0` / `AND p.deleted = 0` / `AND r.deleted = 0` |

#### `addWine.php`
| Location | Change |
|----------|--------|
| Producer lookup by name | Add `AND deleted = 0` (prevents matching soft-deleted producers) |
| Region lookup by name | Add `AND deleted = 0` |

#### `updateWine.php`
| Location | Change |
|----------|--------|
| Wine lookup | Add `AND deleted = 0` (prevent editing deleted wine) |

#### `updateBottle.php`
| Location | Change |
|----------|--------|
| Bottle lookup | Add `AND deleted = 0` |

#### `drinkBottle.php`
| Location | Change |
|----------|--------|
| Bottle lookup | Add `AND deleted = 0` (prevent drinking deleted bottle) |

#### `addBottle.php`
| Location | Change |
|----------|--------|
| Wine existence check | Add `AND deleted = 0` |

#### Agent Endpoints
| File | Change |
|------|--------|
| `agent/identifyText.php` | If matching against existing wines, add `AND deleted = 0` |
| `agent/identifyImage.php` | Same |
| `agent/agentEnrich.php` | If querying wine data, add `AND deleted = 0` |
| `agent/clarifyMatch.php` | If matching against existing wines, add `AND deleted = 0` |

#### `updateRating.php`
| Location | Change |
|----------|--------|
| Rating lookup | Add JOIN to check parent bottle: `SELECT r.* FROM ratings r JOIN bottles b ON r.bottleID = b.bottleID WHERE r.ratingID = :ratingID AND b.deleted = 0` (prevent updating ratings for deleted history entries) |

#### No Changes Needed
| File | Reason |
|------|--------|
| `databaseConnection.php` | Connection utility, no queries |
| `normalize.php` | String utilities, no queries |
| `validators.php` | Validation, no queries |
| `upload.php` | Image upload, no wine queries |
| `geminiAPI.php` | AI proxy, no wine queries |
| `getCurrencies.php` | Reference data, unrelated |
| `getUserSettings.php` | Settings, unrelated |
| `updateUserSettings.php` | Settings, unrelated |
| Agent cache/config | Reference/cache tables, unrelated |

---

## 5. Frontend Changes

### 5.1 UI Component Design Specification

This section provides detailed UI specifications for all delete-related components, adhering to the Qvé design language: refined, luxury wine app aesthetic with Cormorant Garamond (serif) for titles and Outfit (sans) for UI text.

---

#### 5.1.1 Delete Confirmation Modal (`DeleteConfirmModal.svelte`)

**Path**: `qve/src/lib/components/modals/DeleteConfirmModal.svelte`

**Design Philosophy**: The modal should feel considered and calm, not alarming. Qvé's aesthetic favors understatement over dramatic warnings. The destructive action is clear but not aggressive.

**Props**:
```typescript
export let entityType: 'wine' | 'bottle' | 'producer' | 'region';
export let entityId: number;
export let entityName: string;
export let impact: DeleteImpact | null = null;  // Pre-fetched or fetched on mount
export let loading: boolean = false;
```

**Visual Design**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     ┌─────┐                                                 │
│     │ 🍷  │  ← Wine glass icon (muted, not alarming)        │
│     └─────┘                                                 │
│                                                             │
│        Delete "Château Margaux 2015"?                       │
│        ─────────────                                        │
│            ↑ Serif title, --text-primary                    │
│                                                             │
│   ┌───────────────────────────────────────────────────┐     │
│   │                                                   │     │
│   │   This will also remove:                          │     │
│   │                                                   │     │
│   │   ┌──────────────┐  ┌──────────────┐              │     │
│   │   │  3 bottles   │  │  2 ratings   │              │     │
│   │   └──────────────┘  └──────────────┘              │     │
│   │       ↑ Impact pills in grid layout               │     │
│   │                                                   │     │
│   └───────────────────────────────────────────────────┘     │
│       ↑ Subtle background container (--bg-subtle)           │
│                                                             │
│                                                             │
│   ○○○○○○○○○○  You have 10 seconds to undo                   │
│       ↑ Decorative dot divider                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│      ┌────────────────┐    ┌────────────────┐               │
│      │     Cancel     │    │     Delete     │               │
│      └────────────────┘    └────────────────┘               │
│           ↑ Ghost                 ↑ Danger (muted rose)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Styling Tokens**:

```css
/* Modal Container */
.delete-modal {
  max-width: 420px;
  border-radius: var(--radius-lg);          /* 12px */
  background: var(--surface);
  box-shadow: var(--shadow-xl);
  animation: modalReveal 0.25s var(--ease-out);
}

/* Header Icon - Wine glass silhouette, not warning triangle */
.delete-modal-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(184, 122, 122, 0.08);    /* Very subtle error tint */
  border-radius: 50%;
  color: var(--error);                       /* #B87A7A light / #C99999 dark */
}

/* Title - Serif, centered, not screaming */
.delete-modal-title {
  font-family: var(--font-serif);
  font-size: 1.375rem;                       /* 22px */
  font-weight: 400;
  color: var(--text-primary);
  text-align: center;
  margin: 0 0 var(--space-5);
}

/* Entity name highlight */
.delete-modal-title .entity-name {
  display: block;
  font-weight: 500;
  color: var(--text-primary);
}

/* Impact container */
.delete-impact-box {
  background: var(--bg-subtle);
  border-radius: var(--radius-md);           /* 8px */
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.delete-impact-label {
  font-family: var(--font-sans);
  font-size: 0.6875rem;                      /* 11px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

/* Impact pills - grid of affected items */
.delete-impact-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.impact-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-pill);         /* 100px */
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.impact-pill-count {
  font-weight: 600;
  color: var(--error);
}

/* Undo hint with decorative divider */
.undo-hint {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
}

.undo-hint-dots {
  display: flex;
  gap: 4px;
}

.undo-hint-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--divider);
}

.undo-hint-text {
  font-family: var(--font-sans);
  font-size: 0.8125rem;                      /* 13px */
  color: var(--text-tertiary);
  font-style: italic;
}

/* Footer with buttons */
.delete-modal-footer {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  background: var(--bg-subtle);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  border-top: 1px solid var(--divider-subtle);
}

/* Button base - matches existing ConfirmModal */
.btn-delete-cancel {
  flex: 1;
  padding: var(--space-3) var(--space-5);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);

  /* Ghost style */
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--divider);
}

.btn-delete-cancel:hover {
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}

.btn-delete-confirm {
  flex: 1;
  padding: var(--space-3) var(--space-5);
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);

  /* Danger style - muted rose, not aggressive red */
  color: var(--bg);
  background: var(--error);
  border: 1px solid var(--error);
}

.btn-delete-confirm:hover {
  background: #a06a6a;                       /* Slightly darker on hover */
  border-color: #a06a6a;
}

.btn-delete-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Loading State**:
- While fetching impact, show skeleton placeholders in the impact box
- Delete button disabled with `opacity: 0.5`
- Subtle shimmer animation on skeleton (matches agent card loading)

**Animation**:
```css
@keyframes modalReveal {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

**Region/Producer Cascade Layout** (many items):
When cascade includes 4+ entity types, use a 2×2 grid:

```
┌────────────────────────────────────────┐
│  This will also remove:                │
│                                        │
│  ┌───────────────┐ ┌───────────────┐   │
│  │ 5 producers   │ │ 23 wines      │   │
│  └───────────────┘ └───────────────┘   │
│  ┌───────────────┐ ┌───────────────┐   │
│  │ 47 bottles    │ │ 12 ratings    │   │
│  └───────────────┘ └───────────────┘   │
└────────────────────────────────────────┘
```

---

#### 5.1.2 Delete Action Buttons

**Design Principle**: Delete buttons are present but not prominent. They appear on hover/expand with the same visual weight as other actions. The danger color appears only on hover, not at rest.

**A. WineCard Delete Button**

Add to existing `.wine-actions` container alongside Drink, Add Bottle, Edit buttons.

```svelte
<!-- In WineCard.svelte, add after Edit button -->
<button
  class="action-btn action-btn-delete"
  title="Delete"
  on:click={(e) => handleAction('delete', e)}
>
  <Icon name="trash" size={14} />
</button>
```

**Styling**:
```css
/* Same 32px circular style as existing action buttons */
.action-btn-delete {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--divider);
  background: transparent;
  color: var(--text-tertiary);
  /* ... same base styles as .action-btn */
}

/* Danger tint on hover only */
.action-btn-delete:hover {
  background: rgba(184, 122, 122, 0.08);
  color: var(--error);
  border-color: var(--error);
  transform: scale(1.05);
}
```

**B. HistoryCard Delete Button**

Add to existing `.card-actions` container alongside Edit Rating and Add Bottle.

```svelte
<!-- In HistoryCard.svelte, add to .card-actions -->
<button class="action-btn action-btn-delete" title="Delete rating" on:click={handleDelete}>
  <Icon name="trash" size={14} />
  <span class="btn-text">Delete</span>
</button>
```

**Styling** (pill button matching existing):
```css
.action-btn-delete {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--divider);
  background: var(--surface);
  color: var(--text-secondary);
  /* ... same as existing .action-btn */
}

.action-btn-delete:hover {
  background: rgba(184, 122, 122, 0.08);
  color: var(--error);
  border-color: var(--error);
}
```

**C. Edit Page Delete Buttons**

Two placements on the edit page:

**Wine Delete Button** (bottom of Wine tab):
```
┌─────────────────────────────────────────────────────────────┐
│                         Wine Form                           │
│  [Name] [Year] [Type] etc...                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐                                       │
│  │   Delete Wine    │  ← Danger outline button, left-align  │
│  └──────────────────┘                                       │
│                                                             │
│                    [Cancel]  [Save Changes]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Bottle Delete Button** (in BottleSelector or BottleForm):

Option A - "×" on bottle pills:
```
Bottles:  [750ml - 2020 ×] [750ml - 2021 ×] [Magnum - 2020 ×]
                        ↑ Small × button, 44px touch target
```

Option B - Delete button when bottle selected:
```
┌─────────────────────────────────────────────────────────────┐
│  Editing: 750ml bottle from 2020                            │
│                                                             │
│  [Size ▼] [Location] [Source] [Price] [Currency ▼]          │
│                                                             │
│  ┌───────────────────┐                                      │
│  │   Delete Bottle   │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

**Styling for edit page buttons**:
```css
.btn-delete-outline {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--error);
  background: transparent;
  border: 1px solid var(--error);
  border-radius: var(--radius-pill);
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s var(--ease-out);
}

.btn-delete-outline:hover {
  opacity: 1;
  background: rgba(184, 122, 122, 0.08);
}
```

---

#### 5.1.3 Trash Icon Addition

Add `'trash'` to `Icon.svelte` with Heroicons-style outline:

```svelte
{:else if name === 'trash'}
  <!-- Trash icon for delete actions -->
  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
```

Update type definition:
```typescript
export type IconName =
  // ... existing icons
  | 'trash';
```

---

#### 5.1.4 Undo Toast with Countdown

**Enhancement to existing Toast component**: Add countdown display for undo-type toasts.

**Visual Design**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌────────┐  "Château Margaux" deleted        [Undo (8s)] × │
│  │  🍷    │                                                 │
│  └────────┘                                                 │
│  ════════════════════════════════════════                   │
│  ↑ Progress bar shrinking from right to left                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Countdown Implementation**:
```svelte
<!-- In Toast.svelte, for undo type -->
{#if toast.type === 'undo' && remainingSeconds > 0}
  <button class="toast-action toast-action-countdown" on:click={handleAction}>
    Undo <span class="countdown">({remainingSeconds}s)</span>
  </button>
{/if}
```

```css
.toast-action-countdown {
  margin-top: var(--space-2);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--accent);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.toast-action-countdown .countdown {
  font-variant-numeric: tabular-nums;        /* Prevent width jitter */
  opacity: 0.7;
}

.toast-action-countdown:hover {
  color: var(--text-primary);
  text-decoration: underline;
}
```

**Timer Pause Fix** (addresses pre-existing bug):
```typescript
// In toast.ts store or Toast.svelte
let remainingMs = toast.duration;
let lastTick = Date.now();
let paused = false;

function tick() {
  if (paused) return;
  const now = Date.now();
  remainingMs -= (now - lastTick);
  lastTick = now;

  if (remainingMs <= 0) {
    commitDelete();
  } else {
    requestAnimationFrame(tick);
  }
}

// On hover
function pause() {
  paused = true;
}

function resume() {
  paused = false;
  lastTick = Date.now();
  requestAnimationFrame(tick);
}
```

---

#### 5.1.5 Mobile & Touch Considerations

**Touch Targets**:
- All delete buttons: minimum 44×44px touch area (Apple HIG)
- BottleSelector "×" button: 24×24 visual, 44×44 touch area via padding

**iOS Safari**:
- Modal uses portal pattern (mounts to `document.body`) like existing `FilterDropdown`
- Dark theme colors hardcoded in `:global(html[data-theme="dark"])` selectors
- Progress bar uses CSS animation (not JS) for smooth rendering

**Swipe-to-Delete**: NOT implementing in V1
- Conflicts with horizontal scroll on filter bar
- Card tap-to-expand pattern is established
- Would require careful gesture detection to avoid false positives

**Tab Switch Survival**:
- Pending delete state persisted to `sessionStorage`
- On `visibilitychange`, check if undo window expired
- If expired, fire API call immediately on tab return

---

#### 5.1.6 State Diagram: Delete Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   [User taps delete]                                                 │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────────┐                                                │
│   │ Fetch Impact    │ ─── Loading spinner in modal                   │
│   └─────────────────┘                                                │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────────┐                                                │
│   │ Show Modal      │                                                │
│   │ with cascade    │                                                │
│   └─────────────────┘                                                │
│         │                                                            │
│    ┌────┴────┐                                                       │
│    ▼         ▼                                                       │
│ [Cancel]  [Delete]                                                   │
│    │         │                                                       │
│    │         ▼                                                       │
│    │   ┌─────────────────┐                                           │
│    │   │ Optimistic      │ ─── Remove from stores immediately        │
│    │   │ Removal         │     Invalidate filter caches              │
│    │   └─────────────────┘                                           │
│    │         │                                                       │
│    │         ▼                                                       │
│    │   ┌─────────────────┐                                           │
│    │   │ Show Undo Toast │ ─── 10-second countdown                   │
│    │   │ with countdown  │     Progress bar animation                │
│    │   └─────────────────┘                                           │
│    │         │                                                       │
│    │    ┌────┴────┐                                                  │
│    │    ▼         ▼                                                  │
│    │ [Undo]    [Timer expires]                                       │
│    │    │         │                                                  │
│    │    ▼         ▼                                                  │
│    │   Restore   API Call                                            │
│    │   snapshot  deleteItem                                          │
│    │    │         │                                                  │
│    ▼    ▼         ▼                                                  │
│   ┌─────────────────┐                                                │
│   │ Done            │                                                │
│   └─────────────────┘                                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

#### 5.1.7 Accessibility

- Modal traps focus, returns focus to trigger on close
- Delete button has `aria-label="Delete wine"` (entity-specific)
- Toast has `role="alert"` and `aria-live="polite"`
- Countdown announced via `aria-live` region (once at 5s, once at 2s)
- All interactive elements have visible focus states (`outline: 2px solid var(--accent)`)
- Color contrast meets WCAG AA (error color `#B87A7A` on white = 4.6:1)

### 5.2 New Store: `delete.ts`

**Path**: `qve/src/lib/stores/delete.ts`

This is the orchestrator for all delete operations. It manages the optimistic removal, undo timers, and deferred API calls.

```typescript
interface PendingDelete {
  id: string;                    // Unique ID (crypto.randomUUID)
  entityType: 'wine' | 'bottle' | 'producer' | 'region';
  entityId: number;
  entityName: string;
  snapshot: unknown;             // Data snapshot for undo restoration
  timerId: ReturnType<typeof setTimeout>;
  undoFn: () => void;           // Restores data to stores
  commitFn: () => Promise<void>; // API call to execute
}

// Public API
requestDelete(entityType, entityId, entityName): void  // Opens modal
confirmDelete(): Promise<void>                          // After modal confirm
undoDelete(pendingId: string): void                    // From toast callback
cancelAllPending(): void                               // On app teardown
```

**Flow**:
1. `requestDelete` → fetch impact → open `DeleteConfirmModal`
2. User confirms → `confirmDelete`:
   - Snapshot entity from stores
   - Remove from stores (optimistic)
   - Invalidate filter option caches
   - Show undo toast (10s)
   - Schedule `commitFn` after 10s
3. Undo clicked → `undoDelete`:
   - Clear timer
   - Restore snapshot to stores
   - Re-invalidate filter caches
   - Dismiss toast
4. Timer expires → `commitFn`:
   - Call `api.deleteItem(type, id)`
   - On API failure: restore snapshot, show error toast

### 5.3 Delete Button Placement

#### Wine — from WineCard
Add trash icon button to `.wine-actions` alongside existing Drink / Add Bottle / Edit buttons.
- Same 32px circular button style
- Red-tinted hover state (`var(--error)`)
- Dispatches `delete` event with `{ wine }` detail
- Hidden in compact view (same as other actions — revealed on card expand)

#### Wine — from Edit Page
Add "Delete Wine" danger button in `.form-nav` bar next to Cancel/Save.
- Secondary button style with `var(--error)` color
- Bypasses dirty-check (delete supersedes edit)
- On delete: set `allowNavigation = true`, navigate to home

#### Bottle — from Edit Page
Add "Delete Bottle" button in bottle form section when a bottle is selected.
- Also add small "×" close icon on each bottle pill in `BottleSelector`
- Simple confirmation — no cascade (deleting a bottle never affects the parent wine)

#### History Entry — from HistoryCard
Add delete button to `.card-actions` alongside "Edit Rating" and "Add Bottle".
- Pill-style button matching existing `.action-btn`
- No cascade display needed (single entry deletion)
- Uses simpler confirmation (existing `ConfirmModal`)

### 5.4 Undo Toast Enhancement

**Duration change**: `toast.ts` — increase undo default from 5000ms to 10000ms.

**Countdown display**: `Toast.svelte` — for `undo` type, show remaining seconds next to the Undo button: `"Undo (8s)"`.

**Timer pause fix** (pre-existing bug): The CSS progress bar pauses on hover but the store's `setTimeout` does not. Fix by replacing `setTimeout` with a pausable timer that respects the component's `paused` state:
- Store tracks `remainingMs` instead of absolute timeout
- On hover → pause timer, record remaining time
- On unhover → restart timer with remaining time
- This prevents accidental execution while user is reading the toast

### 5.5 Icon Addition

Add `'trash'` to the `IconName` type in `Icon.svelte` with an appropriate SVG path (e.g., Heroicons trash outline).

### 5.6 API Client Additions

New methods in `qve/src/lib/api/client.ts`:

```typescript
async deleteItem(type: 'wine' | 'bottle' | 'producer' | 'region', id: number): Promise<DeleteResult>
async getDeleteImpact(type: string, id: number): Promise<DeleteImpact>
```

New types in `qve/src/lib/api/types.ts`:

```typescript
export interface DeleteImpact {
  entity: { type: string; id: number; name: string };
  impact: {
    producers?: { count: number; names: string[] };  // Only for region delete
    wines?: { count: number };                        // For region/producer delete
    bottles: { count: number; names: string[] };
    ratings: { count: number };
  };
}

export interface DeleteResult {
  success: boolean;
  deleted: {
    type: string;
    id: number;
    name: string;
    cascaded: { bottles: number; ratings: number };
  };
}
```

### 5.7 Store Modifications

| Store | New Methods |
|-------|-------------|
| `wines.ts` | `restoreWineToList(wine: Wine)` — re-insert at correct sort position |
| `history.ts` | `removeDrunkWine(bottleId: number)` — optimistic removal |
| `history.ts` | `removeDrunkWinesByWineId(wineId: number)` — for wine cascade |
| `history.ts` | `restoreDrunkWine(entry: DrunkWine)` / `restoreDrunkWines(entries: DrunkWine[])` |
| `editWine.ts` | `removeBottleFromList(bottleId: number)` — optimistic removal from edit |
| `editWine.ts` | `restoreBottle(bottle: Bottle)` |
| `modal.ts` | Add `'deleteConfirm'` to `ModalType` union |
| `toast.ts` | Change undo duration default to 10000 |

### 5.8 Route Page Changes

| Route | Change |
|-------|--------|
| `+page.svelte` (home) | Handle `delete` event from WineGrid → call `deleteStore.requestDelete()` |
| `edit/[id]/+page.svelte` | Add "Delete Wine" button, "Delete Bottle" button, wire to deleteStore, navigate home on delete |
| `history/+page.svelte` | Handle `deleteRating` event from HistoryGrid → simpler confirm → delete |
| `+layout.svelte` | On `beforeNavigate`: commit any pending deletes (fire-and-forget) and clear timers. OR: let timers persist since toast is in layout. **Decision**: let timers persist — toasts survive navigation. |

### 5.9 Mobile / iOS Safari Considerations

- **Touch targets**: Delete buttons use same 32px circular style as existing actions — adequate since they're only visible on card expand (full-width)
- **Swipe-to-delete**: NOT implementing in V1 (conflicts with card tap and filter scroll)
- **Tab switch survival**: Store pending delete IDs + expiry timestamps in `sessionStorage`. On visibility change (tab resume), check if undo window has expired; if so, fire the API call immediately
- **BottleSelector "×" button**: Minimum 44×44px tap area (Apple HIG) around the small icon

---

## 6. Delete Flow Sequences

### 6.1 Wine Delete (from Cellar View)

```
1. User taps trash icon on WineCard
2. WineCard dispatches 'delete' → WineGrid forwards → +page.svelte
3. +page.svelte calls deleteStore.requestDelete('wine', wineID, wineName)
4. deleteStore:
   a. Fetches cascade impact: api.getDeleteImpact('wine', wineID)
   b. Opens DeleteConfirmModal with impact data
5. User reads impact, clicks "Delete"
6. deleteStore.confirmDelete():
   a. Snapshots wine + its entries from wines/history stores
   b. wines.removeWineFromList(wineID)
   c. history.removeDrunkWinesByWineId(wineID) (if any)
   d. filterOptions.invalidate()
   e. modal.close()
   f. toast.undo('"Château Margaux" deleted', () => deleteStore.undoDelete(pendingId))
   g. setTimeout(10000, () => deleteStore.commit(pendingId))
7a. IF user clicks "Undo" within 10s:
   - Clear timer
   - wines.restoreWineToList(snapshot)
   - history.restoreDrunkWines(historySnapshot)
   - filterOptions.invalidate()
   - toast.dismiss()
7b. IF timer expires:
   - api.deleteItem('wine', wineID)
   - On success: remove pending entry, done
   - On failure: restoreWineToList(snapshot), toast.error('Delete failed')
```

### 6.2 Bottle Delete (from Edit Page)

```
1. User clicks "Delete Bottle" or "×" on bottle pill
2. ConfirmModal: "Delete this bottle?"
   (No cascade — bottle delete never affects the parent wine)
3. On confirm:
   a. Snapshot bottle from editWine store
   b. editWine.removeBottleFromList(bottleId)
   c. toast.undo('"750ml" deleted', undoFn)
   d. setTimeout(10000, commitFn)
4. On commit: api.deleteItem('bottle', bottleId)
```

Note: Even if this is the last bottle, the wine remains. The wine will show with 0 bottles in the cellar view (existing empty-bottle wines are already handled by the UI).

### 6.3 History Entry Delete

```
1. User clicks delete on HistoryCard
2. ConfirmModal: "Delete this rating for Château Margaux?"
   (No cascade needed — independent deletion)
3. On confirm:
   a. Snapshot entry from history store
   b. history.removeDrunkWine(bottleId)
   c. toast.undo('Rating deleted', undoFn)
   d. setTimeout(10000, commitFn)
4. On commit: api.deleteItem('bottle', bottleId)
   (sets bottles.deleted = 1 for the drunk bottle)
```

---

## 7. Edge Cases & Mitigations

### 7.1 UNIQUE Constraint on Re-creation
**Scenario**: User soft-deletes a producer named "Domaine Leroy", then adds a new wine by "Domaine Leroy".
**Mitigation**: Composite unique key `(producerName, deletedAt)` — active records have `deletedAt = NULL` (unique), soft-deleted records have non-NULL timestamps (distinct from active).

### 7.2 addWine.php Matches Soft-Deleted Producer
**Scenario**: Add Wine looks up "Domaine Leroy" and finds the soft-deleted record.
**Mitigation**: All lookup queries in `addWine.php` add `AND deleted = 0`.

### 7.3 Multiple Rapid Deletes
**Scenario**: User deletes Wine A, Wine B, Wine C in rapid succession. Three undo toasts stack.
**Mitigation**: Toast container already supports stacking (max 5). Each delete has an independent timer and snapshot in the `PendingDelete` map.

### 7.4 Delete + Undo with Multiple Pending Deletes
**Scenario**: User deletes Wine A, then deletes Wine B, then undoes Wine A.
**Mitigation**: Since there is no upward cascade, each delete is independent. Wine A is restored to the frontend store. Wine B's timer continues independently. No interaction between the two operations — the simplicity of downward-only cascade eliminates cross-delete dependencies.

### 7.5 Edit Page Redirect After Delete + Undo
**Scenario**: User deletes wine from edit page → navigates to home → clicks undo on toast.
**Mitigation**: Undo restores the wine to the wines store (visible on home page). Does NOT navigate back to edit. Optionally highlight the restored wine using `targetWineID` store.

### 7.6 Toast Hover Pause
**Scenario**: User hovers undo toast to read it — CSS progress bar pauses but timer fires.
**Mitigation**: Fix pre-existing bug — replace `setTimeout` with pausable timer that syncs with the component's `paused` state.

### 7.7 iOS Tab Switch During Undo Window
**Scenario**: User deletes wine, switches to Camera app, returns 30 seconds later.
**Mitigation**: Persist pending delete state to `sessionStorage`. On visibility change (`visibilitychange` event), check if timer expired; if so, fire API call immediately.

### 7.8 checkDuplicate Ghost Matches
**Scenario**: Adding a wine similar to a soft-deleted one triggers duplicate warning.
**Mitigation**: `checkDuplicate.php` adds `AND deleted = 0` to all queries.

### 7.9 Filter Counts Drift
**Scenario**: After optimistic delete, filter pills show stale counts ("France (12)" should be "France (11)").
**Mitigation**: Call `filterOptions.invalidate()` after every optimistic delete and undo. Counts refresh on next filter interaction.

### 7.10 Delete API Failure After Timer
**Scenario**: 10 seconds pass, API call fires, but network/server error occurs.
**Mitigation**: Restore the item from snapshot and show error toast: "Delete failed — your item has been restored."

---

## 8. File Change Manifest

### New Files (5)

| File | Purpose |
|------|---------|
| `resources/sql/migrations/WIN-80_soft_delete.sql` | Database migration script |
| `resources/php/deleteItem.php` | Soft delete endpoint with cascade |
| `resources/php/getDeleteImpact.php` | Cascade impact preview endpoint |
| `qve/src/lib/components/modals/DeleteConfirmModal.svelte` | Cascade confirmation modal |
| `qve/src/lib/stores/delete.ts` | Delete orchestration store |

### Modified Files — Backend (16)

| File | Change Summary |
|------|---------------|
| `resources/php/getWines.php` | Add `deleted = 0` to main query + all ~15 subqueries |
| `resources/php/getBottles.php` | Add `AND deleted = 0` |
| `resources/php/getDrunkWines.php` | Add `AND w.deleted = 0 AND b.deleted = 0` |
| `resources/php/getCountries.php` | Add deleted filters to all JOINs |
| `resources/php/getTypes.php` | Add deleted filters to all JOINs |
| `resources/php/getRegions.php` | Add `AND r.deleted = 0` + deleted filters to JOINs |
| `resources/php/getProducers.php` | Add `AND p.deleted = 0` + deleted filters to JOINs |
| `resources/php/getYears.php` | Add deleted filters to all JOINs |
| `resources/php/getCellarValue.php` | Add `AND b.deleted = 0 AND w.deleted = 0` |
| `resources/php/checkDuplicate.php` | Add deleted filters to all lookups |
| `resources/php/addWine.php` | Add `AND deleted = 0` to producer/region lookups |
| `resources/php/updateWine.php` | Add `AND deleted = 0` to wine lookup |
| `resources/php/updateBottle.php` | Add `AND deleted = 0` to bottle lookup |
| `resources/php/drinkBottle.php` | Add `AND deleted = 0` to bottle lookup |
| `resources/php/addBottle.php` | Add `AND deleted = 0` to wine existence check |
| `resources/php/agent/*.php` | Add deleted filters to any wine-matching queries |

### Modified Files — Frontend (18)

| File | Change Summary |
|------|---------------|
| `qve/src/lib/components/ui/Icon.svelte` | Add `'trash'` icon |
| `qve/src/lib/components/ui/Toast.svelte` | Add countdown display, fix timer pause |
| `qve/src/lib/components/wine/WineCard.svelte` | Add delete button to actions |
| `qve/src/lib/components/wine/WineGrid.svelte` | Forward `delete` event |
| `qve/src/lib/components/wine/HistoryCard.svelte` | Add delete button |
| `qve/src/lib/components/wine/HistoryGrid.svelte` | Forward `deleteRating` event |
| `qve/src/lib/components/edit/BottleSelector.svelte` | Add "×" delete on bottle pills |
| `qve/src/lib/components/modals/ModalContainer.svelte` | Register DeleteConfirmModal |
| `qve/src/lib/components/modals/index.ts` | Export DeleteConfirmModal |
| `qve/src/lib/components/index.ts` | Export DeleteConfirmModal |
| `qve/src/lib/stores/modal.ts` | Add `'deleteConfirm'` to ModalType |
| `qve/src/lib/stores/toast.ts` | Undo duration 5000 → 10000, pausable timer |
| `qve/src/lib/stores/wines.ts` | Add `restoreWineToList()` |
| `qve/src/lib/stores/history.ts` | Add remove/restore helper functions |
| `qve/src/lib/stores/editWine.ts` | Add remove/restore bottle helpers |
| `qve/src/lib/stores/index.ts` | Export delete store |
| `qve/src/lib/api/client.ts` | Add deleteItem, getDeleteImpact methods |
| `qve/src/lib/api/types.ts` | Add DeleteImpact, DeleteResult types |

### Modified Files — Routes (3)

| File | Change Summary |
|------|---------------|
| `qve/src/routes/+page.svelte` | Handle delete event, wire to deleteStore |
| `qve/src/routes/edit/[id]/+page.svelte` | Add Delete Wine/Bottle buttons |
| `qve/src/routes/history/+page.svelte` | Handle deleteRating event |

**Total: 5 new files + 37 modified files**

---

## 9. Implementation Order

### Phase 1: Database + Backend Foundation
1. Run migration script (`WIN-80_soft_delete.sql`)
2. Create `deleteItem.php` with full cascade logic
3. Create `getDeleteImpact.php`
4. Add `AND deleted = 0` to ALL existing PHP endpoints (the big sweep)
5. Test: verify all views exclude soft-deleted records
6. Test: verify cascade deletes work correctly

### Phase 2: Frontend Foundation
7. Add `trash` icon to `Icon.svelte`
8. Create `delete.ts` store
9. Add API client methods (`deleteItem`, `getDeleteImpact`)
10. Add types to `types.ts`
11. Fix toast timer pause bug
12. Update undo toast duration to 10s

### Phase 3: UI Integration
13. Create `DeleteConfirmModal.svelte`
14. Register in `ModalContainer` and `modal.ts`
15. Add delete button to `WineCard.svelte`
16. Wire through `WineGrid` → `+page.svelte` → deleteStore
17. Add delete buttons to edit page (wine + bottle)
18. Add delete button to `HistoryCard.svelte`
19. Wire through `HistoryGrid` → `history/+page.svelte`
20. Add "×" to `BottleSelector.svelte`

### Phase 4: Edge Cases & Polish
21. Implement sessionStorage persistence for pending deletes
22. Handle tab-switch timer recovery
23. Add store restore methods (wines, history, editWine)
24. Test undo flow end-to-end
25. Test mobile/iOS Safari
26. Test filter count invalidation after delete/undo

---

## 10. Future Considerations

### Not In Scope (Track in Backlog)

| Item | Notes |
|------|-------|
| **Permanent purge / TTL** | Soft-deleted records grow indefinitely. Add auto-purge (e.g., 90 days) or manual purge later. |
| **Producer/Region management UI** | Direct CRUD for producers and regions (currently cascade-only). |
| **Swipe-to-delete** | Especially for HistoryCard. Conflicts with current touch patterns — needs careful implementation. |
| **Agent delete commands** | "Delete that wine" via chat. The `deleteItem.php` endpoint and `delete.ts` store are designed for this — just add the agent handler. |
| **Bulk delete** | Select multiple wines and delete at once. |
| **"Trash" view** | Browse and restore soft-deleted items. Would need a `getDeleted.php` endpoint. |
| **Multi-user deletedBy** | Currently hardcoded to userId = 1. Extend when multi-user support is added. |
| **Audit log integration** | Log all delete/restore operations. The `audit_log` table and patterns exist. |

---

## Appendix: Challenger Review Summary

The plan was stress-tested by a dedicated technical reviewer. All critical and major issues have been resolved:

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | **Critical** | Undo mechanism conflict (immediate vs delayed API) | Resolved: Delayed API (AD-1) |
| 2 | **Critical** | UNIQUE constraint blocks re-creation | Resolved: Composite key with deletedAt (§3.3) |
| 3 | Major | Column naming inconsistency (`isDeleted` vs `deleted`) | Resolved: Standardized on `deleted` (AD-2) |
| 4 | Minor | `deletedBy` column unpopulated | Resolved: Populate with userId (§4.1) |
| 5 | Major | Filter count cache invalidation | Resolved: filterOptions.invalidate() after every delete/undo (§5.2) |
| 6 | Major | getCellarValue.php miscount | Resolved: Added to query audit (§4.3) |
| 7 | Major | Batch timestamp fragility | Resolved: N/A — eliminated by delayed API approach |
| 8 | Major | grapemix/critic_scores JOIN filtering | Resolved: Noted in §3.6, queries must JOIN through wine |
| 9 | Major | Edit page redirect + undo interaction | Resolved: Restore to list, don't navigate back (§7.5) |
| 10 | Major | History store missing remove functions | Resolved: Added to store modifications (§5.7) |
| 11 | Major | checkDuplicate ghost matches | Resolved: Added to query audit (§4.3, §7.8) |
| 12 | Minor | Producer/Region no UI path | Resolved: Cascade-only for V1 (AD-4) |
| 13 | Major | Toast timer pause bug | Resolved: Fix in §5.4 |
| 14 | Minor | cacheWineEnrichment references | No action needed |
| 15 | Minor | getDrunkWines JOIN semantics | Resolved: Use bottles.deleted (AD-3) |
| 16 | Minor | Concurrent delete + undo cascade | Resolved: Eliminated by downward-only cascade — no cross-delete dependencies (§7.4) |
| 17 | Minor | DeleteConfirmModal vs ConfirmModal | Resolved: New component (§5.1) |
| 18 | Minor | sessionStorage tab-switch survival | Resolved: §5.9, §7.7 |
