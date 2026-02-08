# WIN-123: Field Validation vs SQL Fields — Implementation Plan

**Status**: Revised — deep dive complete, awaiting approval
**Approach**: Augment existing store-level validation pattern with shared utilities
**Scope**: Full stack (frontend blur + backend validators + DB constraints)

---

## Changes from Original Plan

| Change | Type | Why |
|--------|------|-----|
| Agent forms refactored to use FormInput + field names standardized | [NEW] | Agent forms use raw `<input>`, won't inherit maxlength/blur. Field names (`size`/`location`) don't match wizard (`bottleSize`/`storageLocation`) |
| `FIELD_RULES` map → simple utility functions | [REVISED] | Rule map can't handle conditional required (create vs search mode). Simple functions + store-level context is cleaner |
| Use existing `blur` event, not new `validate` event | [REVISED] | FormInput already dispatches `blur`. Adding `validate` is redundant |
| Sub-ratings: 1–5 with NULL = not rated | [REVISED] | PHP already treats 0 as NULL. Eliminates 0-vs-NULL ambiguity |
| Price/currency: price requires currency, no DB constraint | [REVISED] | DB "both-or-neither" constraint would block legitimate updates. Enforce coupling in PHP/frontend only |
| DB migration: removed `chk_price_currency`, `chk_currency_len`; added `IF NOT EXISTS`; fixed sub-rating range to 1–5 | [REVISED] | `CHAR(3)` already enforces length. Migration needs idempotency |
| AddBottleModal added to scope | [NEW] | Uses raw inputs + addBottle store. Actively used form with no validation |
| `updateRating.php` added to backend scope | [NEW] | Writes same rating data to same table. Must use same validators |
| `agentAddWine.ts` gets validation infrastructure | [NEW] | Store has zero error state or validation methods |
| editWine gets two validateFieldBlur methods (wine + bottle) | [REVISED] | Store manages two separate forms with different field sets |
| DrinkRateModal: submit-only validation | [REVISED] | RatingDots/MiniRatingDots aren't FormInput — they constrain input via UI. Blur pattern doesn't apply |
| Fix drinkBottle.php copy-paste bug | [NEW] | 3 sub-ratings check `complexityRating` instead of their own field — production bug |
| PHP: replace inline validation, not supplement | [REVISED] | Endpoints already have `empty()` checks that would run before new validators |

---

## Decisions Made

| Decision | Answer |
|----------|--------|
| Validation timing | Blur via existing `blur` event (text inputs), submit-only (ratings) |
| DB CHECK constraints | Yes, ratings + price only (no coupling or currency length) |
| Empty text fields (description, tastingNotes, etc.) | Allow empty strings, no schema change |
| Future purchaseDate | Allowed |
| Price + currency coupling | Currency required when price is set (frontend + backend, no DB constraint) |
| Agent forms | Refactor to FormInput first, then same validation rules as wizard/edit |
| Rating ranges | Main ratings: 1–10, sub-ratings: 1–5 (NULL = not rated) |
| Agent field names | Standardize to match wizard (`size`→`bottleSize`, `location`→`storageLocation`) |

---

## Validation Rules

| Field | Required | Max Length | Range | Notes |
|-------|----------|-----------|-------|-------|
| wineName | Yes | 50 | — | |
| regionName | Yes (create mode) | 50 | — | Skip in search mode |
| producerName | Yes (create mode) | 255 | — | Skip in search mode |
| storageLocation | Yes | 50 | — | Code uses `storageLocation`, not `location` |
| source | Yes | 50 | — | |
| bottleSize | Yes | 50 | — | Select field — validate on submit, not blur |
| price | No | — | >= 0 | decimal(10,2) |
| currency | If price set | 3 (exact) | — | char(3), select field |
| purchaseDate | No | — | Valid date | Future dates OK |
| overallRating | Yes | — | 1–10 | |
| valueRating | Yes | — | 1–10 | |
| complexityRating | No | — | 1–5 | NULL = not rated |
| drinkabilityRating | No | — | 1–5 | NULL = not rated |
| surpriseRating | No | — | 1–5 | NULL = not rated |
| foodPairingRating | No | — | 1–5 | NULL = not rated |
| appellation | No | 150 | — | WIN-148, location TBD |

---

## New Files (2)

### 1. `qve/src/lib/utils/validation.ts`

Simple utility functions (not a rule map). Stores handle contextual logic.

```typescript
// Field length limits — single source of truth
export const FIELD_MAX_LENGTHS = {
  wineName: 50,
  regionName: 50,
  producerName: 255,
  storageLocation: 50,
  source: 50,
  bottleSize: 50,
  appellation: 150
} as const;

// Simple validators — return error message or null
export function validateRequired(value: string, fieldLabel: string): string | null
export function validateLength(value: string, maxLength: number): string | null
export function validateRange(value: number, min: number, max: number, fieldLabel: string): string | null

// Cross-field validator
export function validatePriceCurrency(
  price: string | undefined,
  currency: string | undefined
): { price?: string; currency?: string }
```

Stores call these utilities within their own `validateFieldBlur()` methods, adding context-aware logic (e.g., create mode checks).

### 2. `resources/sql/migrations/WIN-123_validation_constraints.sql`

DB CHECK constraints as last line of defense. Idempotent with verification + rollback.

```sql
-- Ratings (1-10 main, 1-5 optional with NULL = not rated)
ALTER TABLE ratings
  ADD CONSTRAINT IF NOT EXISTS chk_overall_range CHECK (overallRating BETWEEN 1 AND 10),
  ADD CONSTRAINT IF NOT EXISTS chk_value_range CHECK (valueRating BETWEEN 1 AND 10),
  ADD CONSTRAINT IF NOT EXISTS chk_complexity_range CHECK (complexityRating IS NULL OR complexityRating BETWEEN 1 AND 5),
  ADD CONSTRAINT IF NOT EXISTS chk_drinkability_range CHECK (drinkabilityRating IS NULL OR drinkabilityRating BETWEEN 1 AND 5),
  ADD CONSTRAINT IF NOT EXISTS chk_surprise_range CHECK (surpriseRating IS NULL OR surpriseRating BETWEEN 1 AND 5),
  ADD CONSTRAINT IF NOT EXISTS chk_foodpairing_range CHECK (foodPairingRating IS NULL OR foodPairingRating BETWEEN 1 AND 5);

-- Bottles (price non-negative only — no coupling or currency length constraints)
ALTER TABLE bottles
  ADD CONSTRAINT IF NOT EXISTS chk_price_nonneg CHECK (price IS NULL OR price >= 0);

-- Verification
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN ('ratings', 'bottles');

-- Rollback (run manually if needed)
-- ALTER TABLE ratings DROP CHECK chk_overall_range, DROP CHECK chk_value_range, ...
-- ALTER TABLE bottles DROP CHECK chk_price_nonneg;
```

> Note: `chk_price_currency` removed (coupling enforced in app layer). `chk_currency_len` removed (CHAR(3) already enforces). Sub-rating range changed from 0–5 to 1–5.

---

## Modified Files (25)

### Layer 0: Agent Form Refactor (prerequisite) [NEW]

| # | File | Changes |
|---|------|---------|
| 1 | `qve/src/lib/agent/types.ts` | Rename `BottleFormData.size`→`bottleSize`, `location`→`storageLocation` |
| 2 | `qve/src/lib/components/agent/forms/BottleDetailsForm.svelte` | Replace raw `<input>`/`<select>` with `FormInput`/`FormSelect`. Update field names |
| 3 | `qve/src/lib/components/agent/forms/ManualEntryForm.svelte` | Replace raw `<input>` with `FormInput`. Conditional fields based on `missingFields` prop |
| 4 | `qve/src/lib/agent/handlers/addWine.ts` | Update `buildAddWinePayload()` to read from renamed fields |

### Layer 1: Foundation

| # | File | Changes |
|---|------|---------|
| 5 | `qve/src/lib/utils/validation.ts` | **Create**: `FIELD_MAX_LENGTHS`, `validateRequired()`, `validateLength()`, `validateRange()`, `validatePriceCurrency()` |
| 6 | `resources/php/validators.php` | **Create** 4 new functions: `validateStringField()`, `validatePriceCurrency()`, `validatePurchaseDate()`, `validateRating()`. All trim internally, handle type coercion, return validated values or throw |
| 7 | `qve/src/lib/components/forms/FormInput.svelte` | Add `maxlength` prop bound to `<input>` element. No new event — use existing `blur` |

### Layer 2: Stores (add `validateFieldBlur()`, enhance submit validation)

| # | File | Changes |
|---|------|---------|
| 8 | `qve/src/lib/stores/addWine.ts` | Import validation utils, add `validateFieldBlur(section, field, value)`, update `validateStep()` to use shared rules. Context-aware: skip required checks in search mode |
| 9 | `qve/src/lib/stores/editWine.ts` | Add `validateWineFieldBlur(field, value)` + `validateBottleFieldBlur(field, value)` (two methods for two-tab form). Enhance `validateWine()` + `validateBottle()` |
| 10 | `qve/src/lib/stores/addBottle.ts` | Add `validateFieldBlur(field, value)`. Fix: currency required only when price is set (currently required unconditionally) |
| 11 | `qve/src/lib/stores/drinkWine.ts` | Update `validate()` for rating ranges: main 1–10, sub 1–5 with NULL. No blur validation (RatingDots constrains input) |
| 12 | `qve/src/lib/stores/agentAddWine.ts` | **[NEW]** Add `errors: { bottle: Record<string, string>, manual: Record<string, string> }` state, `validateFieldBlur(field, value)`, `validateBottleForm()`, `clearError(field)` |

### Layer 3: UI — Wire `on:blur` handlers + maxlength on inputs

| # | File | Changes |
|---|------|---------|
| 13 | `qve/src/routes/add/steps/RegionStep.svelte` | `on:blur` → `addWineStore.validateFieldBlur('region', 'regionName', value)` + `maxlength={50}` |
| 14 | `qve/src/routes/add/steps/ProducerStep.svelte` | `on:blur` → `addWineStore.validateFieldBlur('producer', 'producerName', value)` + `maxlength={255}` |
| 15 | `qve/src/routes/add/steps/WineStep.svelte` | `on:blur` → `addWineStore.validateFieldBlur('wine', 'wineName', value)` + `maxlength={50}` |
| 16 | `qve/src/routes/add/steps/BottleStep.svelte` | `on:blur` on storageLocation, source + `maxlength`. Price/currency: coupling check on submit only |
| 17 | `qve/src/lib/components/edit/WineForm.svelte` | `on:blur` → `editWineStore.validateWineFieldBlur(field, value)` + `maxlength` |
| 18 | `qve/src/lib/components/edit/BottleForm.svelte` | `on:blur` → `editWineStore.validateBottleFieldBlur(field, value)` + `maxlength` on storageLocation, source |
| 19 | `qve/src/lib/components/modals/DrinkRateModal.svelte` | Submit-only validation via `drinkWineStore.validate()`. No blur handlers on rating components |
| 20 | `qve/src/lib/components/modals/AddBottleModal.svelte` | **[NEW]** Refactor raw inputs to FormInput/FormSelect. Wire `on:blur` → `addBottleStore.validateFieldBlur()` |
| 21 | `qve/src/lib/components/agent/forms/BottleDetailsForm.svelte` | Wire `on:blur` → `agentAddWineStore.validateFieldBlur()` + `maxlength` (FormInput from Layer 0 refactor) |
| 22 | `qve/src/lib/components/agent/forms/ManualEntryForm.svelte` | Wire `on:blur` for conditional fields. Only validate fields that are rendered (check `missingFields` prop) |

### Layer 4: Backend — Replace inline validation with validators

| # | File | Changes |
|---|------|---------|
| 23 | `resources/php/addWine.php` | **Replace** lines 26-34 inline `empty()` checks with `validateStringField()` calls. Add `validatePriceCurrency()`, `validatePurchaseDate()` |
| 24 | `resources/php/updateWine.php` | **Replace** inline checks with `validateStringField()` for wineName |
| 25 | `resources/php/addBottle.php` | **Replace** inline checks with `validateStringField()`, `validatePriceCurrency()`, `validatePurchaseDate()` |
| 26 | `resources/php/updateBottle.php` | Same as addBottle |
| 27 | `resources/php/drinkBottle.php` | **Fix copy-paste bug first** (3 sub-ratings check `complexityRating`). Then replace all rating validation with `validateRating()` |
| 28 | `resources/php/updateRating.php` | **[NEW]** Replace lines 44-58 with `validateRating()` calls. Same pattern as drinkBottle |

---

## Build Sequence

### Phase A: Agent Form Refactor [NEW] (prerequisite — no validation yet)
1. Rename fields in `agent/types.ts`: `size`→`bottleSize`, `location`→`storageLocation`
2. Refactor `BottleDetailsForm.svelte` to use `FormInput`/`FormSelect`
3. Refactor `ManualEntryForm.svelte` to use `FormInput`
4. Update `buildAddWinePayload()` in `agent/handlers/addWine.ts`
5. Verify: `npm run check` clean, agent add-wine flow still works end-to-end

### Phase B: Foundation (no user-facing changes)
6. Create `validation.ts` — `FIELD_MAX_LENGTHS`, `validateRequired()`, `validateLength()`, `validateRange()`, `validatePriceCurrency()`
7. Extend `validators.php` — 4 new functions (trim internally, handle type coercion)
8. Verify: `php -l validators.php` + `npm run check`

### Phase C: FormInput component
9. Add `maxlength` prop to `FormInput.svelte` (bind to `<input>` element)

### Phase D: Stores
10. `addWine.ts` — add `validateFieldBlur(section, field, value)`, update `validateStep()`
11. `editWine.ts` — add `validateWineFieldBlur()` + `validateBottleFieldBlur()`, update `validateWine()` + `validateBottle()`
12. `addBottle.ts` — add `validateFieldBlur()`, fix currency to only require when price set
13. `drinkWine.ts` — update `validate()` for 1–5 sub-rating range
14. `agentAddWine.ts` — add errors state, `validateFieldBlur()`, `validateBottleForm()`

### Phase E: UI wiring (wizard)
15. RegionStep — `on:blur` handler + `maxlength`
16. ProducerStep — `on:blur` handler + `maxlength`
17. WineStep — `on:blur` handler + `maxlength`
18. BottleStep — `on:blur` on text inputs + `maxlength`. Price/currency check on submit

### Phase F: UI wiring (edit + modals)
19. WineForm — `on:blur` handler + `maxlength`
20. BottleForm — `on:blur` handler + `maxlength`
21. DrinkRateModal — submit-only (no blur changes)
22. AddBottleModal — refactor raw inputs to FormInput + wire `on:blur`

### Phase G: UI wiring (agent forms)
23. BottleDetailsForm — wire `on:blur` + `maxlength` (FormInput from Phase A)
24. ManualEntryForm — wire `on:blur` for conditional fields only

### Phase H: Backend hardening
25. **Fix drinkBottle.php copy-paste bug** (sub-ratings checking wrong field)
26. addWine.php — **replace** inline checks with validators
27. updateWine.php — **replace** inline checks with validators
28. addBottle.php — **replace** inline checks with validators
29. updateBottle.php — **replace** inline checks with validators
30. drinkBottle.php — replace rating validation with `validateRating()`
31. updateRating.php — replace rating validation with `validateRating()`

### Phase I: Database constraints
32. Run data audit queries on `winelist_test` (check for existing violations)
33. Apply migration (idempotent with `IF NOT EXISTS`)
34. Verify constraints with `INFORMATION_SCHEMA` query

### Phase J: Verification
35. `npm run check` — TypeScript clean
36. `php -l` on all modified PHP files
37. Run automated tests (see Testing section)
38. Manual test: add wine wizard, edit wine, drink/rate, add bottle modal, agent flow

---

## Validation Flow (per field)

```
User types in field
    │
    ▼
User blurs field (text inputs only)
    │
    ▼
FormInput dispatches existing "blur" event
    │
    ▼
Component on:blur handler calls store.validateFieldBlur(field, value)
    │
    ▼
Store calls validateRequired() / validateLength() from validation.ts
  + adds context-aware logic (e.g., skip required in search mode)
    │
    ▼
Error stored in state.errors[section][field] → renders under field via error prop
    │
    ▼
User fixes field → error clears on next blur
    │
    ▼
User clicks Submit / Next
    │
    ▼
store.validateStep() / validateWine() / validateBottle() re-validates ALL fields
  + cross-field checks (price/currency coupling)
    │
    ▼
API call → PHP endpoint
    │
    ▼
validators.php re-validates server-side (trim + type coerce + range check)
    │
    ▼
DB INSERT → CHECK constraints as final safety net
```

**Exceptions:**
- **Rating components** (RatingDots/MiniRatingDots): Submit-only validation. UI constrains to valid range via component behavior.
- **Select fields** (bottleSize, currency): Submit-only validation. Dropdown options are pre-constrained.
- **ManualEntryForm**: Only validate fields that are rendered (based on `missingFields` prop).

---

## Edge Cases

| Case | Handling |
|------|----------|
| Price without currency | Error on currency field: "Currency required when price is set" |
| Currency without price | Allow (user might set price later) |
| Price = 0 | Valid (free bottle / gift) |
| Sub-rating not set | NULL stored in DB (not 0) |
| Sub-rating = 1 | Valid minimum |
| Main rating = 0 | Invalid (minimum 1) |
| wineName exactly 50 chars | Valid (at limit) |
| wineName 51 chars | Blocked by `maxlength` attribute. Blur error if somehow exceeded |
| Empty string in required field | Error on blur: "Wine name is required" |
| Whitespace-only in required field | Trimmed → treated as empty → error |
| Existing wine selected (search mode) | Skip required validation for that section |
| ManualEntryForm — field not in missingFields | Skip validation for that field |
| Agent field names after refactor | All use wizard names (`bottleSize`, `storageLocation`) |
| addBottle currency currently required always | Fix: only require when price is set |

---

## Testing Strategy

### Automated Tests

#### 1. `qve/src/lib/utils/__tests__/validation.test.ts` — Unit tests for validation utilities

```
validateRequired()
  - empty string → error
  - whitespace-only → error (trimmed)
  - valid string → null

validateLength()
  - at limit → null
  - over limit → error
  - empty string → null (length 0 is fine, required is separate)

validateRange()
  - at min → null
  - at max → null
  - below min → error
  - above max → error

validatePriceCurrency()
  - price set, no currency → { currency: error }
  - price set, currency set → {}
  - no price, no currency → {}
  - no price, currency set → {} (allowed)
  - negative price → { price: error }
  - price = 0 → {} (valid)

FIELD_MAX_LENGTHS
  - verify all keys match expected values
```

#### 2. `resources/php/tests/ValidatorsTest.php` — PHP validator unit tests

```
validateStringField()
  - required + empty → exception
  - required + whitespace only → exception (trims first)
  - required + valid → trimmed string
  - optional + empty → empty string or null
  - over max length → exception
  - at max length → valid

validatePriceCurrency()
  - price + currency → { price: float, currency: string }
  - price + no currency → exception
  - no price + no currency → { price: null, currency: null }
  - no price + currency → { price: null, currency: string }
  - negative price → exception
  - empty string price → null normalization

validatePurchaseDate()
  - valid date → Y-m-d formatted string
  - empty → null
  - invalid format → exception
  - future date → valid (allowed by spec)

validateRating()
  - required, value in range → int
  - required, missing → exception
  - required, below min → exception
  - required, above max → exception
  - optional, null → null
  - optional, value in range → int
  - string "5" → int 5 (type coercion)
```

#### 3. Store validation tests (lightweight)

```
addWine.validateFieldBlur()
  - create mode + empty required → sets error
  - search mode + empty required → no error (skipped)
  - over max length → sets error
  - valid value → clears error

addBottle.validateFieldBlur()
  - price set, no currency → sets currency error
  - price cleared → clears currency error
```

### Manual Testing Checklist (post-implementation)

1. **Add Wine Wizard**
   - [ ] Type 51 chars in wine name — maxlength blocks at 50
   - [ ] Leave required field empty, tab away — error appears
   - [ ] Fix the field, tab away — error clears
   - [ ] Click Next with empty required field — step validation catches it
   - [ ] Enter price without currency — error on submit
   - [ ] Complete full wizard successfully — no false positives

2. **Edit Wine**
   - [ ] Wine tab: leave wineName empty, tab away — error
   - [ ] Bottle tab: set price, clear currency — error on save
   - [ ] Save with valid data — success

3. **Drink/Rate Modal**
   - [ ] Try to submit without overall rating — error
   - [ ] Set sub-rating, leave main rating — error on submit
   - [ ] Edit existing rating — validation works same way

4. **Add Bottle Modal**
   - [ ] Required fields show errors on blur
   - [ ] Price/currency coupling works
   - [ ] Submit with valid data — success

5. **Agent Flow**
   - [ ] BottleDetailsForm shows maxlength + blur errors
   - [ ] ManualEntryForm validates only rendered fields
   - [ ] Complete agent add-wine — data saves correctly
   - [ ] Verify field names translate correctly to API payload

6. **Database**
   - [ ] Insert rating with overallRating = 0 → CHECK fails
   - [ ] Insert bottle with price = -1 → CHECK fails
   - [ ] Insert valid data → succeeds

---

## Out of Scope

- Schema changes to make NOT NULL text fields nullable (description, tastingNotes, etc.)
- Region uniqueness fix (UNIQUE per country instead of global)
- ABV range validation
- Producer `founded` year validation
- Zod-style schema system (deferred — can be a future refactor)
- buyAgain field validation (boolean, not a rating)
- Appellation field UI wiring (WIN-148 — field location TBD)
