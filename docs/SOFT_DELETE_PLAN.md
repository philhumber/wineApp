# WIN-80: Soft Delete — Implementation Plan

**Status**: Approved for implementation
**Date**: 2026-02-08
**JIRA**: WIN-80

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

### AD-1: Immediate API Delete + Restore Endpoint

**Decision**: The delete API call fires **immediately** on confirm. The item is removed from frontend stores optimistically at the same time. The undo toast (10s) calls a **restore** API endpoint to reverse the delete if clicked.

**Rationale**:
- Server is always authoritative — no "lost delete" if the browser tab is killed, the user switches apps, or sessionStorage expires
- Downward-only cascade makes restore simple: `SET deleted = 0` on the target entity and all children sharing the same `deletedAt` timestamp
- No need for sessionStorage persistence of pending deletes or visibility-change timer recovery
- The tradeoff (restore API could fail) is mitigated by keeping snapshots for local store rollback

**Implication**: Requires a `restoreItem.php` endpoint alongside `deleteItem.php`. All cascade items share a `deletedAt` timestamp (using `NOW(6)` microsecond precision to prevent collisions), which serves as the batch identifier for atomic restore.

### AD-2: Column Naming — `deleted` (not `isDeleted`)

**Decision**: Use `deleted`, `deletedAt`, `deletedBy` on all tables.

**Rationale**: The `wine` and `bottles` tables already have these columns with this exact naming (discovered during analysis — they exist but are completely unused). Standardizing avoids mixed naming across queries.

### AD-3: History Deletion Uses `bottles.deleted`

**Decision**: Individual drink history entries are deleted by soft-deleting the corresponding bottle record. The `ratings` table does NOT get its own `deleted` column.

**Rationale**: Ratings are 1:1 with drunk bottles. The `getDrunkWines.php` query JOINs through bottles already. Adding `AND bottles.deleted = 0` naturally excludes deleted history entries.

**Important — Rating Aggregation**: The `ratings` table has its own `wineID` column, and the avgRating/avgOverallRating/avgValueRating/allNotes/buyAgainPercent/ratingCount subqueries in `getWines.php` (lines 46-49, 142-146) query `ratings` by `wineID` **without joining through bottles**. This means soft-deleting a bottle would NOT automatically exclude its rating from the wine's aggregate score. To fix this, all rating subqueries must join through bottles and check `bottles.deleted = 0`:

```sql
-- Before (broken — includes ratings for deleted bottles):
SELECT ROUND(AVG(overallRating), 2) FROM ratings WHERE ratings.wineID = wine.wineID

-- After (correct — excludes ratings for deleted bottles):
SELECT ROUND(AVG(r.overallRating), 2)
  FROM ratings r
  JOIN bottles b ON b.bottleID = r.bottleID AND b.deleted = 0
  WHERE r.wineID = wine.wineID
```

This applies to all 6 rating subqueries in `getWines.php` and the `buyAgainPercent`/`ratingCount` queries.

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

### 3.1 Existing Columns (Migration: upgrade to TIMESTAMP(6))

The `wine` and `bottles` tables already have `deleted`, `deletedAt`, `deletedBy` columns and indexes — but `deletedAt` is `timestamp` (second precision). Upgrade to `TIMESTAMP(6)` for microsecond precision (required for `NOW(6)` batch identification):

```sql
-- wine table (exists, needs precision upgrade)
ALTER TABLE wine MODIFY COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL;

-- bottles table (exists, needs precision upgrade)
ALTER TABLE bottles MODIFY COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL;

-- Existing columns (for reference):
-- wine: `deleted` tinyint DEFAULT '0', `deletedBy` int DEFAULT NULL, idx_deleted (deleted)

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
  ADD COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- region table
ALTER TABLE region
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `worldID`,
  ADD COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);
```

### 3.3 Drop UNIQUE Constraints

`producers` has `UNIQUE KEY producerName` and `region` has `UNIQUE KEY regionName`. Soft-deleted records would block re-creation of items with the same name. Rather than adding composite key complexity, simply drop the constraints — duplicate prevention is already handled at the application level (`addWine.php` looks up existing producers/regions by name before inserting).

```sql
ALTER TABLE producers DROP INDEX `producerName`;
ALTER TABLE region DROP INDEX `regionName`;
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

Delete and restore operations should be logged to the `audit_log` table:

```sql
-- Example audit entry for soft delete
INSERT INTO audit_log (tableName, recordID, action, oldValues, newValues, userID, createdAt)
VALUES ('wine', 123, 'SOFT_DELETE', NULL, '{"cascadedTo":"bottles:3"}', 1, NOW());
```

### 3.8 Migration Script

Save as `resources/sql/migrations/WIN-80_soft_delete.sql`:

```sql
-- ============================================
-- WIN-80: Soft Delete Migration
-- Run against: winelist database
-- ============================================

START TRANSACTION;

-- 0. Upgrade existing deletedAt columns to microsecond precision
ALTER TABLE wine MODIFY COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL;
ALTER TABLE bottles MODIFY COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL;

-- 1. Add columns to producers
ALTER TABLE producers
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `producerName`,
  ADD COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- 2. Add columns to region
ALTER TABLE region
  ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `worldID`,
  ADD COLUMN `deletedAt` TIMESTAMP(6) NULL DEFAULT NULL AFTER `deleted`,
  ADD COLUMN `deletedBy` INT DEFAULT NULL AFTER `deletedAt`,
  ADD INDEX `idx_deleted` (`deleted`);

-- 3. Drop UNIQUE constraints (app-level duplicate prevention is sufficient)
ALTER TABLE producers DROP INDEX `producerName`;
ALTER TABLE region DROP INDEX `regionName`;

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
-- All cascade items get the same deletedAt timestamp (microsecond precision)
SET @now = NOW(6);
SET @userId = :userId;

-- Example: delete wine (cascade down to bottles only)
UPDATE bottles SET deleted = 1, deletedAt = @now, deletedBy = @userId
  WHERE wineID = :wineId AND deleted = 0;

UPDATE wine SET deleted = 1, deletedAt = @now, deletedBy = @userId
  WHERE wineID = :wineId AND deleted = 0;

-- That's it. Producer is NOT touched. No upward cascade check needed.
```

**Note**: `NOW(6)` gives microsecond precision, virtually eliminating timestamp collisions for a single-user app. The shared `deletedAt` value is the batch identifier used by the restore endpoint.

### 4.1b New Endpoint: `restoreItem.php`

**Path**: `resources/php/restoreItem.php`
**Method**: POST
**Input**:
```json
{
  "type": "wine|bottle|producer|region",
  "id": 123
}
```

**Response (success)**:
```json
{
  "success": true,
  "restored": {
    "type": "wine",
    "id": 123,
    "name": "Château Margaux 2015",
    "cascadeRestored": {
      "bottles": 3
    }
  }
}
```

**Restore logic** (transaction-wrapped):
1. Look up the entity's `deletedAt` timestamp
2. Restore the entity: `SET deleted = 0, deletedAt = NULL, deletedBy = NULL`
3. Restore all children that share the same `deletedAt` timestamp (they were cascade-deleted together)

```sql
-- Example: restore wine + its cascade-deleted bottles
SET @batchTimestamp = (SELECT deletedAt FROM wine WHERE wineID = :wineId);

UPDATE wine SET deleted = 0, deletedAt = NULL, deletedBy = NULL
  WHERE wineID = :wineId;

UPDATE bottles SET deleted = 0, deletedAt = NULL, deletedBy = NULL
  WHERE wineID = :wineId AND deletedAt = @batchTimestamp;
```

**Why timestamp matching works**: All items in a cascade share the same `deletedAt` value (set by `NOW(6)` in the delete transaction). Bottles that were independently deleted earlier would have a different `deletedAt` and won't be accidentally restored. This is safe because cascade is downward-only — no sibling or parent dependencies to worry about.

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

SELECT COUNT(*) as ratingCount
  FROM bottles WHERE wineID = :id AND deleted = 0 AND bottleDrunk >= 1;

-- Producer impact: count wines and bottles below it
SELECT COUNT(*) as wineCount
  FROM wine WHERE producerID = :id AND deleted = 0;

SELECT COUNT(*) as bottleCount
  FROM bottles b JOIN wine w ON b.wineID = w.wineID
  WHERE w.producerID = :id AND w.deleted = 0 AND b.deleted = 0;

-- Region impact: count producers, wines, and bottles below it
SELECT COUNT(*) as producerCount
  FROM producers WHERE regionID = :id AND deleted = 0;

SELECT COUNT(*) as wineCount
  FROM wine w JOIN producers p ON w.producerID = p.producerID
  WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0;

SELECT COUNT(*) as bottleCount
  FROM bottles b JOIN wine w ON b.wineID = w.wineID
  JOIN producers p ON w.producerID = p.producerID
  WHERE p.regionID = :id AND p.deleted = 0 AND w.deleted = 0 AND b.deleted = 0;
```

### 4.3 Modified Endpoints — Complete Query Audit

Every existing PHP endpoint that reads from affected tables needs `AND deleted = 0` conditions. Below is the exhaustive list:

#### `getWines.php` (HIGHEST IMPACT — ~15 subqueries)
| Location | Change |
|----------|--------|
| Main WHERE clause | Add `AND w.deleted = 0` |
| All bottle subqueries (standardPrice, bottleSources, avgPricePerLiterEUR, bottleCount, etc.) | Add `AND b.deleted = 0` to each |
| **Rating subqueries** (avgRating, avgOverallRating, avgValueRating, allNotes, buyAgainPercent, ratingCount — lines 46-49, 142-146) | **Add `JOIN bottles b ON b.bottleID = r.bottleID AND b.deleted = 0`** — these query `ratings` by `wineID` without going through bottles, so deleted bottle ratings would still be included without this fix |
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
| `updateRating.php` | Updates existing rating, no filter needed (ID-based) |
| Agent cache/config | Reference/cache tables, unrelated |

---

## 5. Frontend Changes

### 5.1 New Components

#### `DeleteConfirmModal.svelte`
**Path**: `qve/src/lib/components/modals/DeleteConfirmModal.svelte`

Props:
```typescript
export let entityType: 'wine' | 'bottle' | 'producer' | 'region';
export let entityId: number;
export let entityName: string;
```

Behavior:
- On mount, fetches cascade impact via `api.getDeleteImpact(entityType, entityId)`
- Shows loading spinner while fetching
- Displays entity name and cascade impact (counts + orphan warnings)
- Cancel / Delete (danger) buttons
- Delete button disabled during loading
- Dispatches `confirm` or `cancel` events

Layout (wine example):
```
┌──────────────────────────────────┐
│  ⚠ Delete "Château Margaux"?    │
│                                  │
│  ┌────────────────────────────┐  │
│  │ This will also delete:     │  │
│  │  • 3 bottles               │  │
│  │  • 2 drink history entries │  │
│  └────────────────────────────┘  │
│                                  │
│  Can be undone for 10 seconds.   │
│                                  │
│        [Cancel]  [Delete]        │
└──────────────────────────────────┘
```

Layout (region example — full cascade):
```
┌──────────────────────────────────┐
│  ⚠ Delete region "Bordeaux"?    │
│                                  │
│  ┌────────────────────────────┐  │
│  │ This will also delete:     │  │
│  │  • 5 producers             │  │
│  │  • 23 wines                │  │
│  │  • 47 bottles              │  │
│  │  • 12 drink history entries│  │
│  └────────────────────────────┘  │
│                                  │
│  Can be undone for 10 seconds.   │
│                                  │
│        [Cancel]  [Delete]        │
└──────────────────────────────────┘
```

### 5.2 New Store: `delete.ts`

**Path**: `qve/src/lib/stores/delete.ts`

This is the orchestrator for all delete operations. It manages the immediate API call, optimistic store removal, and undo via restore API.

```typescript
interface PendingUndo {
  id: string;                    // Unique ID (crypto.randomUUID)
  entityType: 'wine' | 'bottle' | 'producer' | 'region';
  entityId: number;
  entityName: string;
  snapshot: unknown;             // Data snapshot for local rollback if restore fails
  toastId: string;               // Reference to undo toast
}

// Public API
requestDelete(entityType, entityId, entityName): void  // Opens modal
confirmDelete(): Promise<void>                          // After modal confirm
undoDelete(pendingId: string): Promise<void>            // From toast callback — calls restore API
```

**Flow**:
1. `requestDelete` → fetch impact → open `DeleteConfirmModal`
2. User confirms → `confirmDelete`:
   - Snapshot entity from stores
   - Call `api.deleteItem(type, id)` **immediately**
   - On API success: remove from stores, invalidate filter caches, close modal, show undo toast (10s)
   - On API failure: show error toast, do NOT remove from stores
3. Undo clicked → `undoDelete`:
   - Call `api.restoreItem(type, id)`
   - On success: restore snapshot to stores, re-invalidate filter caches, dismiss toast
   - On failure: show error toast ("Couldn't undo — item may need to be re-added")
4. Toast expires without undo → clean up `PendingUndo` entry, done

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

**Timer pause fix** (pre-existing bug, lower priority now): The CSS progress bar pauses on hover but the store's `setTimeout` does not. With immediate API delete, the toast timer no longer triggers an API call — it only controls how long the "Undo" button is visible. However, the visual mismatch is still confusing (progress bar pauses but toast dismisses). Fix by syncing the setTimeout with the component's `paused` state. This is a nice-to-have for V1, not blocking.

### 5.5 Icon Addition

Add `'trash'` to the `IconName` type in `Icon.svelte` with an appropriate SVG path (e.g., Heroicons trash outline).

### 5.6 API Client Additions

New methods in `qve/src/lib/api/client.ts`:

```typescript
async deleteItem(type: 'wine' | 'bottle' | 'producer' | 'region', id: number): Promise<DeleteResult>
async restoreItem(type: 'wine' | 'bottle' | 'producer' | 'region', id: number): Promise<RestoreResult>
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

export interface RestoreResult {
  success: boolean;
  restored: {
    type: string;
    id: number;
    name: string;
    cascadeRestored: { bottles?: number; wines?: number; producers?: number };
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
| `+layout.svelte` | Undo toasts persist across navigation (toast container is in layout). No special handling needed — delete already happened on the server. |

### 5.9 Mobile / iOS Safari Considerations

- **Touch targets**: Delete buttons use same 32px circular style as existing actions — adequate since they're only visible on card expand (full-width)
- **Swipe-to-delete**: NOT implementing in V1 (conflicts with card tap and filter scroll)
- **Tab switch**: No special handling needed — delete API fires immediately, so the server is always authoritative. If the user switches apps and comes back, the undo toast may have expired but the delete is already committed. No sessionStorage persistence required.
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
   b. api.deleteItem('wine', wineID) — IMMEDIATE API call
   c. On API success:
      - wines.removeWineFromList(wineID)
      - history.removeDrunkWinesByWineId(wineID) (if any)
      - filterOptions.invalidate()
      - modal.close()
      - toast.undo('"Château Margaux" deleted', () => deleteStore.undoDelete(pendingId))
   d. On API failure:
      - modal.close()
      - toast.error('Delete failed')
      - No store changes (item stays in UI)
7. IF user clicks "Undo" within 10s:
   - api.restoreItem('wine', wineID)
   - On success: restoreWineToList(snapshot), restoreDrunkWines(historySnapshot), filterOptions.invalidate()
   - On failure: toast.error('Couldn't undo — item may need to be re-added')
8. IF toast expires: clean up PendingUndo entry, done
```

### 6.2 Bottle Delete (from Edit Page)

```
1. User clicks "Delete Bottle" or "×" on bottle pill
2. ConfirmModal: "Delete this bottle?"
   (No cascade — bottle delete never affects the parent wine)
3. On confirm:
   a. Snapshot bottle from editWine store
   b. api.deleteItem('bottle', bottleId) — IMMEDIATE
   c. On success: editWine.removeBottleFromList(bottleId), toast.undo(...)
   d. On failure: toast.error('Delete failed')
4. On undo: api.restoreItem('bottle', bottleId), editWine.restoreBottle(snapshot)
```

Note: Even if this is the last bottle, the wine remains. The wine will show with 0 bottles in the cellar view (existing empty-bottle wines are already handled by the UI).

### 6.3 History Entry Delete

```
1. User clicks delete on HistoryCard
2. ConfirmModal: "Delete this rating for Château Margaux?"
   (No cascade needed — independent deletion)
3. On confirm:
   a. Snapshot entry from history store
   b. api.deleteItem('bottle', bottleId) — IMMEDIATE
   c. On success: history.removeDrunkWine(bottleId), toast.undo(...)
   d. On failure: toast.error('Delete failed')
4. On undo: api.restoreItem('bottle', bottleId), history.restoreDrunkWine(snapshot)
```

---

## 7. Edge Cases & Mitigations

### 7.1 UNIQUE Constraint on Re-creation
**Scenario**: User soft-deletes a producer named "Domaine Leroy", then adds a new wine by "Domaine Leroy".
**Mitigation**: UNIQUE constraints on `producerName` and `regionName` are dropped entirely (§3.3). Duplicate prevention is handled at the application level (`addWine.php` looks up by name with `AND deleted = 0` before inserting). No schema-level conflict possible.

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
**Mitigation**: No special handling needed. The delete API already fired immediately on confirm — the server state is correct. The undo toast will have expired while the app was backgrounded, so the user simply can't undo. This is the expected behavior.

### 7.8 checkDuplicate Ghost Matches
**Scenario**: Adding a wine similar to a soft-deleted one triggers duplicate warning.
**Mitigation**: `checkDuplicate.php` adds `AND deleted = 0` to all queries.

### 7.9 Filter Counts Drift
**Scenario**: After optimistic delete, filter pills show stale counts ("France (12)" should be "France (11)").
**Mitigation**: Call `filterOptions.invalidate()` after every optimistic delete and undo. Counts refresh on next filter interaction.

### 7.10 Delete API Failure
**Scenario**: User confirms delete, but the immediate API call fails (network/server error).
**Mitigation**: Show error toast: "Delete failed". Do NOT remove the item from stores — it stays in the UI as if nothing happened. The user can retry.

### 7.11 Restore API Failure
**Scenario**: User clicks "Undo", but the restore API call fails.
**Mitigation**: Show error toast: "Couldn't undo — you may need to re-add this item". The item remains deleted on the server. The local store snapshot is discarded. This is an edge case (server was reachable moments ago for the delete) but must be handled gracefully.

---

## 8. File Change Manifest

### New Files (6)

| File | Purpose |
|------|---------|
| `resources/sql/migrations/WIN-80_soft_delete.sql` | Database migration script |
| `resources/php/deleteItem.php` | Soft delete endpoint with cascade |
| `resources/php/restoreItem.php` | Undo soft delete (restore entity + cascade children) |
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

**Total: 6 new files + 37 modified files**

---

## 9. Implementation Order

### Phase 1: Database + Backend Foundation
1. Run migration script (`WIN-80_soft_delete.sql`)
2. Create `deleteItem.php` with full cascade logic (using `NOW(6)` for batch timestamp)
3. Create `restoreItem.php` with timestamp-matched cascade restore
4. Create `getDeleteImpact.php`
5. Add `AND deleted = 0` to ALL existing PHP endpoints (the big sweep)
6. Test: verify all views exclude soft-deleted records
7. Test: verify cascade delete + restore round-trip works correctly

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
21. Add store restore methods (wines, history, editWine)
22. Test delete + undo round-trip end-to-end
23. Test restore API failure handling
24. Test mobile/iOS Safari
25. Test filter count invalidation after delete/undo

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
| 1 | **Critical** | Undo mechanism conflict (immediate vs delayed API) | Resolved: Immediate API + restore endpoint (AD-1) — eliminates lost-delete risk on tab kill/app switch |
| 2 | **Critical** | UNIQUE constraint blocks re-creation | Resolved: Drop constraints entirely, app-level prevention sufficient (§3.3) |
| 3 | Major | Column naming inconsistency (`isDeleted` vs `deleted`) | Resolved: Standardized on `deleted` (AD-2) |
| 4 | Minor | `deletedBy` column unpopulated | Resolved: Populate with userId (§4.1) |
| 5 | Major | Filter count cache invalidation | Resolved: filterOptions.invalidate() after every delete/undo (§5.2) |
| 6 | Major | getCellarValue.php miscount | Resolved: Added to query audit (§4.3) |
| 7 | Major | Batch timestamp fragility | Resolved: `NOW(6)` microsecond precision eliminates collisions for single-user app (§4.1) |
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
| 18 | Minor | sessionStorage tab-switch survival | Resolved: N/A — eliminated by immediate API approach. Server always authoritative. (§7.7) |
