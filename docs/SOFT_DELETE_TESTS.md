# WIN-80: Soft Delete Test Suite

**Status**: Tests written (TDD) - Feature not yet implemented
**Date**: 2026-02-08

---

## Overview

This document describes the test suite created for the Soft Delete feature (WIN-80). Tests are written following TDD principles - they will FAIL initially and PASS once the feature is implemented.

---

## Test Files

### 1. Frontend Store Tests

**File**: `qve/src/lib/stores/__tests__/delete.test.ts`

Tests the core delete orchestration store:

| Test Category | Count | Will Pass When |
|---------------|-------|----------------|
| `requestDelete` | 4 | `delete.ts` store created with `requestDelete` function |
| `confirmDelete` | 8 | `confirmDelete` implements optimistic removal, toast, timer |
| `undoDelete` | 7 | `undoDelete` clears timer, restores snapshot |
| `cancelDelete` | 1 | `cancelDelete` closes modal without changes |
| `cancelAllPending` | 2 | `cancelAllPending` restores all and clears timers |
| Multiple pending deletes | 3 | Multiple independent delete timers work |
| API commit failure | 2 | API failure triggers restoration + error toast |
| sessionStorage persistence | 4 | Pending deletes survive tab switch |
| Entity-specific behaviors | 3 | Bottle/history delete doesn't cascade up |

**Run**: `cd qve && npm run test -- --filter=delete`

---

### 2. Toast Timer Tests

**File**: `qve/src/lib/stores/__tests__/toast-timer.test.ts`

Tests the timer pause/resume functionality needed for soft delete:

| Test Category | Count | Will Pass When |
|---------------|-------|----------------|
| Undo toast duration | 2 | Default changed from 5000ms to 10000ms |
| Timer auto-removal | 2 | Already passing (existing behavior) |
| Pausable timer | 4 | `pause(id)` / `resume(id)` methods added |
| Enhanced timer interface | 3 | `onExpire`, `isPaused`, `elapsedMs` added |

**Run**: `cd qve && npm run test -- --filter=toast-timer`

---

### 3. DeleteConfirmModal Component Tests

**File**: `qve/src/lib/components/modals/__tests__/DeleteConfirmModal.test.ts`

Tests the delete confirmation modal UI:

| Test Category | Count | Will Pass When |
|---------------|-------|----------------|
| Basic rendering | 3 | `DeleteConfirmModal.svelte` created |
| Impact display - wine | 4 | Cascade impact section renders |
| Impact display - region | 2 | Large cascade (4+ types) uses grid |
| Undo hint | 2 | "10 seconds to undo" message shows |
| Buttons | 5 | Cancel/Delete buttons work |
| Loading state | 3 | Skeleton shows while fetching impact |
| Accessibility | 4 | ARIA attributes, focus trap, Escape key |
| Animation | 1 | modalReveal animation applied |
| Entity type variations | 3 | Wording adjusts for bottle/producer/region |
| Dark theme | 1 | Dark theme styles applied |

**Run**: `cd qve && npm run test -- --filter=DeleteConfirmModal`

---

### 4. Integration Tests

**File**: `qve/tests/integration/soft-delete.test.ts`

End-to-end tests for complete delete flows:

| Test Category | Count | Will Pass When |
|---------------|-------|----------------|
| Full flow - undo before timer | 1 | Complete flow works: delete → confirm → undo → restored |
| Full flow - timer expires | 1 | Complete flow works: delete → confirm → wait → API called |
| Multiple pending deletes | 1 | Independent timers, selective undo |
| Tab switch recovery | 3 | sessionStorage persistence works |
| Filter cache invalidation | 2 | `filterOptions.invalidate()` called |
| API failure recovery | 1 | Restore on API error + error toast |
| Bottle delete (no cascade) | 1 | Bottle delete doesn't affect wine |
| History entry delete | 1 | History delete removes entry only |

**Run**: `cd qve && npm run test -- tests/integration/soft-delete`

---

### 5. PHP Backend Tests

**File**: `resources/php/tests/SoftDeleteTest.php`

PHPUnit tests for PHP endpoints:

| Test Class | Test Count | Will Pass When |
|------------|------------|----------------|
| `DeleteItemTest` | 13 | `deleteItem.php` created with cascade logic |
| `GetDeleteImpactTest` | 5 | `getDeleteImpact.php` created |
| `DeletedRecordFilteringTest` | 15 | All endpoints add `AND deleted = 0` |
| `DeleteAuditLogTest` | 3 | Audit logging implemented |
| `SoftDeleteUniqueConstraintTest` | 3 | Database migration run |

**Setup**:
```bash
cd resources/php/tests
composer install
./vendor/bin/phpunit
```

---

## Test Infrastructure Setup

### Frontend (Vitest)

Already configured in `qve/vitest.config.ts`. No additional setup needed.

```bash
# Run all tests
cd qve && npm run test

# Run specific test file
npm run test -- --filter=delete

# Run with coverage
npm run test -- --coverage
```

### Backend (PHPUnit)

New infrastructure created:

```
resources/php/tests/
├── composer.json        # PHPUnit dependency
├── phpunit.xml          # PHPUnit configuration
├── bootstrap.php        # Test bootstrap
└── SoftDeleteTest.php   # Test file
```

**Setup**:
```bash
cd resources/php/tests
composer install
./vendor/bin/phpunit
```

---

## Implementation Checklist

Use this checklist to track which tests will pass as you implement:

### Phase 1: Database + Backend Foundation

- [ ] Run migration `WIN-80_soft_delete.sql`
  - Tests: `SoftDeleteUniqueConstraintTest` (3 tests)
- [ ] Create `deleteItem.php`
  - Tests: `DeleteItemTest` (13 tests)
- [ ] Create `getDeleteImpact.php`
  - Tests: `GetDeleteImpactTest` (5 tests)
- [ ] Add `AND deleted = 0` to all PHP endpoints
  - Tests: `DeletedRecordFilteringTest` (15 tests)
- [ ] Add audit logging
  - Tests: `DeleteAuditLogTest` (3 tests)

### Phase 2: Frontend Foundation

- [ ] Add `trash` icon to `Icon.svelte`
- [ ] Create `delete.ts` store
  - Tests: `delete.test.ts` - requestDelete (4 tests)
  - Tests: `delete.test.ts` - confirmDelete (8 tests)
  - Tests: `delete.test.ts` - undoDelete (7 tests)
  - Tests: `delete.test.ts` - cancelDelete (1 test)
  - Tests: `delete.test.ts` - cancelAllPending (2 tests)
- [ ] Add API client methods
- [ ] Fix toast timer pause bug
  - Tests: `toast-timer.test.ts` - pausable timer (4 tests)
- [ ] Update undo toast duration to 10s
  - Tests: `toast-timer.test.ts` - undo duration (1 test)

### Phase 3: UI Integration

- [ ] Create `DeleteConfirmModal.svelte`
  - Tests: `DeleteConfirmModal.test.ts` (28 tests)
- [ ] Add delete button to `WineCard.svelte`
- [ ] Wire through to home page
- [ ] Add delete buttons to edit page
- [ ] Add delete button to `HistoryCard.svelte`
- [ ] Add "x" to `BottleSelector.svelte`

### Phase 4: Edge Cases & Polish

- [ ] Implement sessionStorage persistence
  - Tests: `delete.test.ts` - sessionStorage (4 tests)
- [ ] Handle tab-switch timer recovery
  - Tests: `soft-delete.test.ts` - tab switch (3 tests)
- [ ] Add store restore methods
  - Tests: `restoreWineToList`, `removeDrunkWinesByWineId`, `restoreDrunkWines`
- [ ] Test undo flow end-to-end
  - Tests: `soft-delete.test.ts` - full flows (2 tests)

---

## Running All Tests

### Frontend

```bash
cd qve

# All soft-delete related tests
npm run test -- --filter="delete|toast-timer|DeleteConfirmModal|soft-delete"

# With watch mode during development
npm run test -- --watch --filter=delete
```

### Backend

```bash
cd resources/php/tests

# All PHP tests
./vendor/bin/phpunit

# Specific test class
./vendor/bin/phpunit --filter=DeleteItemTest
```

---

## Test Coverage Goals

| Area | Target Coverage |
|------|-----------------|
| `delete.ts` store | 90%+ |
| `DeleteConfirmModal.svelte` | 85%+ |
| `deleteItem.php` | 95%+ |
| `getDeleteImpact.php` | 95%+ |
| Modified endpoints (filtering) | Test each endpoint has `deleted = 0` |

---

## Notes

1. **Mock Strategy**: Frontend tests mock the API client (`$lib/api`), toast store, wines store, and history store to test the delete store in isolation.

2. **Timer Testing**: Vitest's `vi.useFakeTimers()` is used to control time for testing the 10-second undo window.

3. **Integration Tests**: These test the full flow and require multiple stores to work together. They may need to be adjusted as implementation details are finalized.

4. **PHP Tests**: Use MockPDO to avoid database dependencies. For true integration testing, consider a test database with seeded data.

5. **Skip Markers**: Many tests use `it.skip()` or `this->markTestSkipped()` to indicate they're waiting for implementation. Remove these as features are built.
