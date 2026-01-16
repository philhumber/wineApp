# Sprint 1 Testing Checklist

**Date**: 2026-01-12
**Sprint**: Critical Bug Fixes
**Tester**: _____________

---

## Quick Verification (15 minutes)

### WIN-87: API Response Nesting

**Test 1: Add Bottle to Existing Wine**
- [✅] Open app with DevTools Console open (F12)
- [✅] Click "Add Bottle" on any wine card
- [✅] Fill in: Bottle Size, Location, Source, Price
- [✅] Submit form
- [✅] ✅ Success message appears
- [✅] ✅ Bottle count increments on card
- [✅] ✅ Console shows: `{ success: true, message: "...", data: {...} }`
- [✅] ❌ Console does NOT show: `{ success: true, data: '{"success":true,...}' }`
- [✅] ❌ No console errors

**Test 2: Drink Bottle with Rating**
- [✅] Click "Drink Bottle" on a wine
- [✅] Select a bottle from dropdown
- [✅] Rate overall (10 glasses) and value (10 money bags)
- [✅] Add tasting notes
- [✅] Click "Lock Rating"
- [✅] ✅ Success message appears
- [✅] ✅ Bottle marked as drunk
- [✅] ✅ Rating displays on wine card
- [✅] ❌ No console errors about undefined properties

**Test 3: Update Wine Details**
- [✅] Right-click (or long-press) a wine card
- [✅] Select "Edit Wine"
- [✅] Modify description or tasting notes
- [✅] Submit changes
- [✅] ✅ Success message appears
- [✅] ✅ Changes saved and displayed
- [❌] ❌ No console errors

---

### WIN-86: Audit Array Serialization

**Test 4: Check Audit Log Database**
1. Perform any of the above operations (add/update/drink)
2. Connect to MySQL database (10.0.0.16)
3. Run query:
   ```sql
   USE winelist;
   SELECT auditID, tableName, recordID, action, columnName, oldValue, newValue, changedAt
   FROM audit_log
   ORDER BY changedAt DESC
   LIMIT 20;
   ```
4. Verify results:
   - [ ] ✅ `oldValue` and `newValue` contain actual data
   - [ ] ✅ Complex values stored as JSON: `{"wineTypeID":1}`
   - [ ] ❌ NO literal string "Array" in any column
   - [ ] ✅ All recent operations logged

---

### WIN-93: Modal Close Error

**Test 5: Add Bottle (Main Error Case)**
- [ ] Click "Add Bottle" on a wine card
- [ ] Fill in bottle details
- [ ] Submit form
- [ ] ✅ Modal closes smoothly
- [ ] ✅ Wine list refreshes
- [ ] ✅ Bottle count updates
- [ ] ❌ NO console error: `ReferenceError: wineToRate is not defined`

**Test 6: Rating Flow (Should Still Work)**
- [ ] Click "Drink Bottle" on a wine
- [ ] Complete rating form
- [ ] Click "Lock Rating"
- [ ] ✅ Rating modal closes properly
- [ ] ❌ No console errors

---

### WIN-66: Transaction Rollback

**Test 7: Normal Operations (Should All Work)**
- [ ] Add a new wine (full workflow)
- [ ] ✅ All data saved correctly
- [ ] Update an existing wine
- [ ] ✅ Changes saved correctly
- [ ] Drink a bottle with rating
- [ ] ✅ Bottle marked drunk, rating saved

**Test 8: Database Integrity Check**
Run after all operations:
```sql
-- Check for orphaned records
SELECT w.wineID, w.wineName, p.producerName
FROM wine w
LEFT JOIN producers p ON w.producerID = p.producerID
WHERE p.producerID IS NULL;
-- Should return 0 rows

-- Check bottle drunk counts match
SELECT w.wineID, w.wineName, w.bottlesDrunk,
       (SELECT COUNT(*) FROM bottles WHERE wineID = w.wineID AND bottleDrunk = 1) as actualDrunk
FROM wine w
WHERE w.bottlesDrunk != (SELECT COUNT(*) FROM bottles WHERE wineID = w.wineID AND bottleDrunk = 1);
-- Should return 0 rows
```
- [ ] ✅ No orphaned records
- [ ] ✅ Bottle counts accurate

---

## Full Regression (30 minutes)

### Core Functionality Tests

**Test 9: Initial Page Load**
- [ ] Open index.html in browser
- [ ] ✅ Wine list loads
- [ ] ✅ Filter dropdowns populate
- [ ] ❌ No console errors

**Test 10: Filtering**
- [ ] Select a country filter
- [ ] ✅ Wine list updates
- [ ] Select a region filter
- [ ] ✅ Wine list filters further
- [ ] Select a type filter
- [ ] ✅ Correct wines displayed
- [ ] Clear filters
- [ ] ✅ All wines displayed again

**Test 11: Navigation**
- [ ] Click hamburger menu
- [ ] ✅ Sidebar slides in
- [ ] Click overlay
- [ ] ✅ Sidebar closes

**Test 12: Add Complete Wine Workflow**
- [ ] Click "Add Wine" button
- [ ] Tab 1 (Region): Fill region details OR select existing
- [ ] ✅ Region form validates
- [ ] Tab 2 (Producer): Fill producer details OR select existing
- [ ] ✅ Producer form validates
- [ ] Tab 3 (Wine): Fill wine details
- [ ] ✅ Wine form validates
- [ ] Tab 4 (Bottle): Fill bottle details
- [ ] ✅ Bottle form validates
- [ ] Submit form
- [ ] ✅ Success message appears
- [ ] ✅ New wine appears in list
- [ ] ❌ No console errors

**Test 13: AI Generation** (if API key active)
- [ ] In Add Wine form, Tab 2
- [ ] Enter producer name
- [ ] Click "Generate with AI"
- [ ] ✅ Loading spinner appears
- [ ] ✅ Fields populate with AI data
- [ ] ❌ No console errors

**Test 14: Image Upload**
- [ ] In Add Wine form, Tab 3
- [ ] Select an image file
- [ ] Click "Upload Image"
- [ ] ✅ Upload succeeds
- [ ] ✅ Image path populated
- [ ] ❌ No console errors

**Test 15: Wine Card Expand/Collapse**
- [ ] Click a wine card to expand
- [ ] ✅ Smooth animation
- [ ] ✅ Details visible
- [ ] Click again to collapse
- [ ] ✅ Smooth collapse
- [ ] ✅ No scroll jumping

**Test 16: Drunk Wines View**
- [ ] Navigate to "Drunk Wines" section
- [ ] ✅ List of consumed wines displays
- [ ] ✅ Ratings visible
- [ ] ✅ "Buy Again" indicators correct
- [ ] ❌ No console errors

---

## Success Criteria Summary

### All Tests Pass (✅)
- [ ] No console errors during any operation
- [ ] All success/error messages display correctly
- [ ] Data persists correctly in database
- [ ] Audit logs contain proper values (JSON, not "Array")
- [ ] No orphaned records (transactions rollback properly)
- [ ] Modal close behavior consistent
- [ ] API responses have correct structure (not nested)

### Browser Testing
- [ ] Chrome/Edge (tested)
- [ ] Firefox (tested)
- [ ] Safari (if available)
- [ ] Mobile view (responsive)

### Database Verification
- [ ] audit_log table has valid entries
- [ ] No "Array" strings in audit log
- [ ] No orphaned foreign key references
- [ ] Bottle drunk counts accurate

---

## Issues Found During Testing

| Test # | Issue Description | Severity | Notes |
|--------|------------------|----------|-------|
|        |                  |          |       |
|        |                  |          |       |
|        |                  |          |       |

---

## Sign-off

**Tester Name**: ___________________________

**Date**: ___________________________

**Status**:
- [ ] ✅ All tests passed - Sprint 1 verified
- [ ] ⚠️ Minor issues found (documented above)
- [ ] ❌ Critical issues found - requires fixes

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Next Steps

If all tests pass:
- [ ] Mark WIN-87, WIN-86, WIN-66, WIN-93 as Done in JIRA
- [ ] Update JIRA with testing notes
- [ ] Proceed to Sprint 2

If issues found:
- [ ] Document issues in table above
- [ ] Create JIRA tickets for new issues
- [ ] Fix critical issues before Sprint 2
- [ ] Re-test failed scenarios
