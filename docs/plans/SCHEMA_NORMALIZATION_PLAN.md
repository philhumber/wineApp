# Database Schema Normalization — Assessment & Fix Plan

**Status**: Approved for implementation
**Date**: 2026-02-08
**JIRA**: WIN-80 (related — schema hygiene prior to soft delete)
**Schema Source**: `resources/sql/Full_DB_Structure.sql` (28 tables + 3 views)

---

## Normalization Assessment

Full audit of all 28 tables + 3 views against normalization forms (1NF–BCNF), referential integrity, data type correctness, and structural hygiene.

### 1NF — Atomic Values & No Repeating Groups

**Result: PASS (with documented exceptions)**

All core wine/cellar tables (`wine`, `bottles`, `ratings`, `producers`, `region`, `country`, `grapes`, `grapemix`, `winetype`) store atomic, single-valued columns. No repeating groups or multi-valued columns in the transactional core.

**Documented exceptions (JSON columns):**

| Table | Column(s) | Justification |
|-------|-----------|---------------|
| `refGrapeCharacteristics` | `alternateNames`, `primaryFlavors`, `secondaryFlavors`, `classicPairings` | Read-only reference data. Normalizing into junction tables would create 4+ new tables for data that is bulk-loaded and never individually queried. |
| `refPairingRules` | `wineTypes`, `wineStyles`, `grapeVarieties`, `avoidTypes`, `avoidStyles` | Same — lookup-only pairing rules. Joined-table approach would yield 5 new junction tables for ~100 rows of reference data. |
| `refWineStyles` | `characteristics`, `typicalGrapes`, `typicalRegions` | Reference data, read-heavy, rarely updated. |
| `refAppellations` | `wineTypes`, `primaryGrapes` | Reference data. |
| `cacheWineEnrichment` | `grapeVarieties`, `criticScores` | Cache table — stores denormalized API responses for fast retrieval. Normalizing defeats the purpose of caching. |
| `cacheProducers` | `certifications` | Cache table, same reasoning. |
| `agentUserTasteProfile` | `preferredTypes`, `preferredCountries`, `preferredGrapes`, `preferredStyles`, `avoidCharacteristics` | User preference blob — sparse, heterogeneous, read as a unit. EAV or JSON is the correct pattern here. |
| `agentIdentificationResults` | `inferencesApplied` | Audit/log data — array of inference types applied during a single identification. Never queried individually. |

**Verdict**: The JSON usage is confined to reference, cache, and analytics tables where it is the pragmatically correct design choice. Core transactional tables are clean 1NF.

---

### 2NF — No Partial Dependencies

**Result: PASS**

Every table uses either a single-column surrogate key (`INT AUTO_INCREMENT`) or a single-column natural key (`sizeCode`, `currencyCode`, `name`). There are zero composite primary keys in the schema. 2NF violations can only occur with composite keys, so the schema satisfies 2NF trivially.

---

### 3NF — No Transitive Dependencies

**Result: 3 violations found (2 dead columns, 1 justified denormalization)**

| Table.Column | Issue | Severity |
|--------------|-------|----------|
| `ratings.wineID` | Derivable from `ratings.bottleID → bottles.wineID`. Transitive dependency: `ratingID → bottleID → wineID`. | **Justified** — removing it would require a JOIN through `bottles` for every ratings query. Performance cost outweighs purity. Keep as-is. |
| `wine.bottlesDrunk` | Derivable from `COUNT(*) FROM bottles WHERE wineID = X AND bottleDrunk = 1`. Denormalized counter maintained by `drinkBottle.php` only, with no decrement mechanism. | **Flagged** — not harmful but fragile. Document the sync dependency. Future: replace with a computed query or VIEW. |
| `wine.rating` | Intended as a cached average rating, but **never populated** by any endpoint. The actual data lives in `ratings.overallRating` / `ratings.avgRating`. | **Dead column** — drop it. |
| `wine.drinkDate` | Overlaps with `wine.drinkWindowEnd`. **Never written** to by any endpoint. | **Dead column** — drop it. |
| `country.continent` | Could be normalized into a separate `continents` table, but there are only 7 continent codes and the country table is essentially reference data. | **Acceptable** — pragmatic inline storage for a fixed-cardinality attribute. |

---

### BCNF — Every Determinant is a Candidate Key

**Result: PASS (1 observation)**

The `country` table has multiple candidate keys: `countryID` (PK), `countryName` (UNIQUE), and likely `code` (ISO alpha-2), `iso3` (ISO alpha-3), `number` (ISO numeric) — but only `countryID` and `countryName` have UNIQUE constraints declared. The `code`, `iso3`, and `number` columns should have UNIQUE constraints to enforce their candidate key status, though in practice the ISO country dataset guarantees uniqueness.

All other tables have a single candidate key (their PK), so BCNF is satisfied trivially.

**Recommended action**: Add UNIQUE constraints to `country.code`, `country.iso3`, and `country.number` — these are ISO-standard identifiers that should be unique by definition.

---

### 4NF/5NF — Multi-Valued & Join Dependencies

**Result: Not applicable**

The JSON columns noted in the 1NF section technically represent multi-valued dependencies (e.g., a pairing rule maps to multiple wine types). Strict 4NF would require junction tables. As documented above, this is intentionally not normalized for reference/cache tables. Core tables have no multi-valued dependency issues.

---

### Referential Integrity (FK Coverage)

**Enforced FKs (14 constraints):**

| Child Table | Column | References | Action |
|-------------|--------|------------|--------|
| `agentSessions` | `userId` | `agentUsers.id` | ON DELETE CASCADE |
| `agentUserTasteProfile` | `userId` | `agentUsers.id` | ON DELETE CASCADE |
| `bottles` | `wineID` | `wine.wineID` | ON DELETE RESTRICT |
| `country` | `world_code` | `worlds.name` | ON DELETE RESTRICT |
| `critic_scores` | `wineID` | `wine.wineID` | ON DELETE CASCADE |
| `grapemix` | `wineID` | `wine.wineID` | ON DELETE RESTRICT |
| `grapemix` | `grapeID` | `grapes.grapeID` | ON DELETE RESTRICT |
| `producers` | `regionID` | `region.regionID` | ON DELETE RESTRICT |
| `ratings` | `bottleID` | `bottles.bottleID` | ON DELETE RESTRICT |
| `ratings` | `wineID` | `wine.wineID` | ON DELETE RESTRICT |
| `refAppellations` | `parentAppellation` | `refAppellations.id` | ON DELETE SET NULL |
| `region` | `countryID` | `country.countryID` | ON DELETE RESTRICT |
| `wine` | `producerID` | `producers.producerID` | ON DELETE RESTRICT |
| `wine` | `wineTypeID` | `winetype.wineTypeID` | ON DELETE RESTRICT |

**Missing FKs (should add):**

| Child Table | Column | Should Reference | Risk |
|-------------|--------|-----------------|------|
| `bottles` | `bottleSize` | `bottle_sizes.sizeCode` | Low — frontend constrains values via dropdown |
| `bottles` | `currency` | `currencies.currencyCode` | Low — frontend constrains values via dropdown |

**Missing FKs (intentionally omitted — document only):**

| Child Table | Column | Would Reference | Reason for Omission |
|-------------|--------|----------------|---------------------|
| `agentUsageLog` | `userId` | `agentUsers.id` | Log retention — logs should survive user deletion |
| `agentUsageLog` | `sessionId` | `agentSessions.id` | Log retention — logs should survive session purge |
| `agentUsageDaily` | `userId` | `agentUsers.id` | Aggregate analytics — same reasoning |
| `agentIdentificationResults` | `userId` | `agentUsers.id` | Audit trail independence |
| `agentIdentificationResults` | `sessionId` | `agentSessions.id` | Audit trail independence |
| `cacheWineEnrichment` | `wineId` | `wine.wineID` | Cache may outlive source wine (enrichment data is reusable) |
| `audit_log` | `changedBy` | (no user table yet) | Audit logs must be immutable and independent |

**Edge case — consider adding:**

| Child Table | Column | Would Reference | Notes |
|-------------|--------|----------------|-------|
| `agentWineEmbeddings` | `wineId` | `wine.wineID` | Unlike cache, embeddings are wine-specific. FK with `ON DELETE CASCADE` would be appropriate. |

---

### Data Type Appropriateness

| Table.Column | Current Type | Problem | Recommended Type |
|--------------|-------------|---------|-----------------|
| `wine.ABV` | `DECIMAL(10,0)` | 10-digit integer precision for a 2-digit percentage. Drops decimal — 13.5% stored as 14. | `DECIMAL(4,1) DEFAULT NULL` |
| `grapemix.mixPercent` | `DECIMAL(10,0)` | 10-digit integer precision for a 0–100 percentage. | `DECIMAL(5,2) NOT NULL` |
| `producers.founded` | `TEXT NOT NULL` | TEXT type for what is typically a short string or year. NOT NULL forces empty strings. | `VARCHAR(100) DEFAULT NULL` (needs data review first) |
| `wine.rating` | `DECIMAL(10,0)` | Dead column (never written), but also absurd precision if it were used. | Drop column entirely. |

---

### Nullability Issues

Multiple columns across `producers`, `region`, `grapes`, and `wine` are declared `TEXT NOT NULL` but frequently store empty strings because the data isn't always available. This conflates "no data" with "empty string", which is semantically incorrect.

**Affected columns**: `producers.town`, `producers.founded`, `producers.ownership`, `producers.description`, `region.description`, `region.climate`, `region.soil`, `region.map`, `grapes.description`, `grapes.picture`, `wine.description`, `wine.tastingNotes`, `wine.pairing`, `wine.pictureURL`

**Impact**: Low — PHP already handles both null and empty string. But NULL is the correct representation of "unknown/not provided" in relational databases.

---

### Collation Inconsistencies

| Collation | Tables Using It |
|-----------|----------------|
| `utf8mb4_0900_ai_ci` | Most tables (default) |
| `utf8mb4_unicode_ci` | `cacheCanonicalAliases`, `critic_scores`, `refAbbreviations` |
| `cp850_general_ci` | `vw_model_comparison` (phpMyAdmin export artifact) |

The `utf8mb4_0900_ai_ci` vs `utf8mb4_unicode_ci` split is cosmetic — both are accent-insensitive, case-insensitive Unicode collations. The `0900` variant is MySQL 8.0's updated Unicode standard. Not a functional issue, but could cause problems if JOINing columns across tables with different collations. Worth standardizing in a future cleanup.

The `cp850_general_ci` on the view stand-in is a phpMyAdmin export artifact and not a real concern (the actual VIEW doesn't have a collation).

---

### Naming Convention Audit

| Convention | Examples | Prevalence |
|-----------|----------|------------|
| **camelCase columns** | `wineID`, `producerID`, `bottleSize`, `wineName`, `bottleDrunk` | ~80% of columns (dominant) |
| **snake_case columns** | `world_code`, `full_name`, `enrichment_status`, `drink_window` | ~15% of columns (mostly newer additions) |
| **Irregular** | `ratings.Notes` (capital N), `ABV` (all caps) | ~5% |
| **Singular table names** | `wine`, `region`, `country`, `audit_log` | ~50% of tables |
| **Plural table names** | `bottles`, `ratings`, `grapes`, `producers`, `currencies` | ~50% of tables |

Not worth fixing now (would cascade to all PHP endpoints and TypeScript types), but the convention should be documented for new work.

---

### Summary Scorecard

| Normal Form | Result | Notes |
|-------------|--------|-------|
| **1NF** | PASS | JSON confined to reference/cache tables |
| **2NF** | PASS | No composite keys |
| **3NF** | 2 dead columns + 1 justified violation | `wine.rating`, `wine.drinkDate` (drop); `ratings.wineID` (keep) |
| **BCNF** | PASS | `country` could use additional UNIQUE constraints |
| **4NF/5NF** | N/A | JSON columns are intentional |
| **FK coverage** | 14/16 core FKs enforced | 2 missing on `bottles` (easy add) |
| **Data types** | 3 oversized columns | `wine.ABV`, `grapemix.mixPercent`, `producers.founded` |
| **Nullability** | 14 columns incorrectly NOT NULL | Forces empty strings instead of NULL |
| **Collation** | Minor inconsistency | Functional but should standardize |
| **Naming** | Mixed conventions | Document for new columns, don't fix existing |

---

## Fix Plan

### Priority 1: Missing Foreign Keys on Core Tables (Low Risk, High Value)

These are straightforward FK additions on core wine-cellar tables. Frontend dropdowns already constrain input to valid values, so existing data should be clean.

#### 1a. `bottles.bottleSize` → `bottle_sizes.sizeCode`
- **File**: `resources/sql/Full_DB_Structure.sql` (and migration script)
- **Prerequisite**: Verify all existing `bottleSize` values match `bottle_sizes.sizeCode` entries:
  ```sql
  SELECT DISTINCT b.bottleSize FROM bottles b
  LEFT JOIN bottle_sizes bs ON b.bottleSize = bs.sizeCode
  WHERE bs.sizeCode IS NULL;
  ```
- **Migration**: `ALTER TABLE bottles ADD CONSTRAINT fk_bottle_size FOREIGN KEY (bottleSize) REFERENCES bottle_sizes(sizeCode);`
- **PHP impact**: None — `addWine.php:273`, `addBottle.php:56`, `updateBottle.php:58` already use values from the dropdown

#### 1b. `bottles.currency` → `currencies.currencyCode`
- **Prerequisite**: Verify existing values:
  ```sql
  SELECT DISTINCT b.currency FROM bottles b
  LEFT JOIN currencies c ON b.currency = c.currencyCode
  WHERE c.currencyCode IS NULL AND b.currency IS NOT NULL;
  ```
- **Migration**: `ALTER TABLE bottles ADD CONSTRAINT fk_bottle_currency FOREIGN KEY (currency) REFERENCES currencies(currencyCode);`
- **PHP impact**: None

---

### Priority 2: Data Type Corrections (Low Risk)

#### 2a. `wine.ABV` — `DECIMAL(10,0)` → `DECIMAL(4,1)`
- Current precision is absurdly large and drops the decimal (13.5% stored as 14)
- Column is **never written to** in the PHP codebase, so no code changes needed
- **Migration**: `ALTER TABLE wine MODIFY ABV DECIMAL(4,1) DEFAULT NULL;`

#### 2b. `grapemix.mixPercent` — `DECIMAL(10,0)` → `DECIMAL(5,2)`
- Current type allows 10-digit integers for a percentage field
- **Migration**: `ALTER TABLE grapemix MODIFY mixPercent DECIMAL(5,2) NOT NULL;`
- **PHP impact**: `addWine.php` inserts this value — no code change needed, just more appropriate storage

#### 2c. `producers.founded` — `TEXT NOT NULL` → assess whether to change to `VARCHAR(100)` or keep as TEXT
- Data review needed first: `SELECT founded FROM producers ORDER BY LENGTH(founded) DESC LIMIT 20;`
- If all values are short strings or years, change to `VARCHAR(100) DEFAULT NULL`
- **PHP impact**: `addWine.php:47` trims the value; no code change needed
- Also make it **nullable** — not all producers have known founding dates

---

### Priority 3: Clean Up Orphaned/Legacy Columns (Medium Risk)

#### 3a. `wine.drinkDate` — Never written, never read meaningfully
- Column is `YEAR DEFAULT NULL`, **never populated** anywhere in the codebase
- Overlaps conceptually with `wine.drinkWindowEnd`
- **Action**: Drop the column
- **Migration**: `ALTER TABLE wine DROP COLUMN drinkDate;`
- **PHP impact**: Check `getWines.php` (line ~45) and `getDrunkWines.php` (line ~30) — remove from SELECT if present
- **Frontend impact**: Check TypeScript types in `qve/src/lib/api/types.ts` for `drinkDate`

#### 3b. `wine.rating` — Never written, displayed but always NULL
- Column is `DECIMAL(10,0) DEFAULT NULL`, never populated by any PHP endpoint
- The actual rating data lives in `ratings.overallRating` / `ratings.avgRating`
- **Action**: Drop the column (or repurpose as a computed cache later)
- **PHP impact**: Remove from SELECT in `getWines.php` and `getDrunkWines.php`
- **Frontend impact**: Check if any component reads `wine.rating` vs derived from ratings table

#### 3c. `wine.bottlesDrunk` — Denormalized counter, single sync point
- Currently incremented in `drinkBottle.php:164` only
- No mechanism to decrement if a rating is deleted or corrected
- **Action**: Keep for now (removing it would require query changes), but add a comment documenting the sync dependency
- **Future**: Consider replacing with a VIEW or computed query

---

### Priority 4: Make TEXT NOT NULL Columns Nullable (Low Risk)

These columns force empty strings when data isn't available. Making them nullable is more semantically correct.

**Columns to change to nullable:**
- `producers.town` — not every producer has a known town
- `producers.founded` — not every producer has a known founding
- `producers.ownership` — not always available
- `producers.description` — not always available
- `region.description`, `region.climate`, `region.soil`, `region.map` — not always populated
- `grapes.description`, `grapes.picture` — not always available
- `wine.description`, `wine.tastingNotes`, `wine.pairing`, `wine.pictureURL` — often empty on initial add

**Migration pattern** (repeat for each):
```sql
ALTER TABLE producers MODIFY town VARCHAR(255) DEFAULT NULL;
ALTER TABLE producers MODIFY founded TEXT DEFAULT NULL;
-- etc.
```

**PHP impact**: Minimal — PHP already handles null via `?? null` or `?? ''` patterns. Frontend already handles missing values with fallbacks.

---

### Priority 5: Agent/Cache FK Constraints (Optional, Low Priority)

These are deliberately loose for operational reasons (cache records may outlive their source wine, usage logs shouldn't fail if sessions are purged). Document the intentional omission rather than adding constraints.

**Document-only** (add SQL comments):
- `agentUsageLog.userId` / `sessionId` — intentionally no FK (log retention)
- `agentIdentificationResults.userId` / `sessionId` — intentionally no FK
- `cacheWineEnrichment.wineId` — intentionally no FK (cache may outlive wine)
- `agentWineEmbeddings.wineId` — consider adding FK with `ON DELETE CASCADE`

---

### Priority 6: Naming Convention Standardization (Future / Breaking)

Not recommended now — would require cascading changes across all PHP endpoints and TypeScript types. Document the convention for new columns:

**Current mixed conventions:**
- camelCase columns: `wineID`, `producerID`, `bottleSize`, `wineName`
- snake_case columns: `world_code`, `full_name`, `enrichment_status`
- Table names: singular (`wine`, `region`) vs pseudo-plural (`bottles`, `ratings`, `grapes`, `producers`)

**Recommendation**: Adopt a convention for all new columns going forward. The existing camelCase convention is dominant, so standardize on that.

---

## What NOT To Fix

These are technically normalization violations but are **correct design decisions**:

1. **`ratings.wineID` (3NF violation)** — Keep the redundant wineID. Removing it would require JOINing through bottles for every ratings query. The performance cost outweighs the purity benefit.

2. **JSON columns in reference/cache tables (1NF/4NF)** — Keep as-is. Normalizing `refPairingRules.wineTypes` into a junction table would create 5+ new tables for minimal benefit on read-heavy reference data.

3. **`worlds` table with name as PK** — Only 3 rows, rarely changed. Not worth adding a surrogate key.

4. **`user_settings` EAV pattern** — Appropriate for sparse, heterogeneous settings. A normalized approach would require schema changes for each new setting.

---

## Verification

After applying migrations:
1. Run `php -S localhost:8000` and test the add wine flow end-to-end (addWine.php exercises bottles, producers, grapemix)
2. Test the drink/rate flow (drinkBottle.php exercises ratings, wine.bottlesDrunk)
3. Run `npm run check` in `qve/` to catch any TypeScript type mismatches from dropped columns
4. Verify cascading filters still work (getCountries, getTypes, getRegions, getProducers, getYears)
5. Test agent identification and enrichment flows

---

## Files to Modify

| File | Changes |
|------|---------|
| `resources/sql/Full_DB_Structure.sql` | Add FK constraints, modify column types, drop orphaned columns |
| New migration script (e.g., `resources/sql/migrations/normalize_schema.sql`) | All ALTER TABLE statements |
| `resources/php/getWines.php` | Remove `drinkDate` and `rating` from SELECT (if dropped) |
| `resources/php/getDrunkWines.php` | Same |
| `qve/src/lib/api/types.ts` | Remove `drinkDate` and `rating` from Wine type (if dropped) |
