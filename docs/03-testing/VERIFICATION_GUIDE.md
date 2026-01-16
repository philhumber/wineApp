# Sprint 1 Verification Guide

**Purpose**: Step-by-step guide for stakeholders to verify Sprint 1 work
**Date**: 2026-01-12
**Estimated Time**: 15-20 minutes

---

## Prerequisites

✅ Access to the Wine Collection App
✅ Browser with DevTools (Chrome/Edge/Firefox)
✅ MySQL access to database on 10.0.0.16 (optional, for audit verification)

---

## Quick Verification (5 minutes)

### Test 1: Add a Bottle
**Verifies**: WIN-87 (Response nesting), WIN-93 (Modal close)

1. Open the app in browser
2. Open DevTools Console (F12)
3. Find any wine with available bottles
4. Click **"Add Bottle"** button
5. Fill in the form:
   - Bottle Size: Standard (750ml)
   - Location: Wine Fridge
   - Source: Test Store
   - Price: 25
   - Currency: EUR
6. Click **Submit**

**✅ Expected Results**:
- Success message appears
- Bottle count increments by 1
- Modal closes cleanly
- **Console shows NO errors**
- Response in console is a proper object (not a string)

**❌ Before Sprint 1**:
- Would see: `Uncaught ReferenceError: wineToRate is not defined`
- Or: Response data would be a JSON string

---

### Test 2: Edit Wine Details
**Verifies**: WIN-87 (Response nesting), WIN-86 (Audit logging)

1. Right-click any wine card (or long-press on mobile)
2. Select **"Edit Wine"**
3. Modify the **Description** field (add "Test edit" at the end)
4. Click **"Next"** button
5. Success overlay appears - Click **"Finish!"**

**✅ Expected Results**:
- Changes are saved
- Success message displays
- Wine list refreshes
- **Console may show**: "Both overall and value ratings must be selected" (this is WIN-XX, harmless)
- **Console should NOT show**: Errors about undefined properties or JSON parsing

**❌ Before Sprint 1**:
- Would see: Errors accessing `result.data.success` or similar
- Or: Changes not saving due to response parsing issues

---

### Test 3: Drink a Bottle
**Verifies**: WIN-87 (Response nesting), WIN-66 (Transaction safety)

1. Find a wine with available bottles
2. Click **"Drink Bottle"**
3. Select a bottle from dropdown
4. Rate overall: Click 5 glasses
5. Rate value: Click 5 money bags
6. Check **"Buy Again?"**
7. Add notes: "Verification test"
8. Click **"Rate!"** button

**✅ Expected Results**:
- Success message appears
- Bottle marked as drunk (bottle count decrements)
- Rating displays on wine card
- **Console shows NO errors**
- All data persists correctly

**❌ Before Sprint 1**:
- Would see: Response parsing errors
- Or: Partial data saved (bottle drunk but rating missing)

---

## Complete Verification (20 minutes)

### Console Verification

After each test above, check the browser console:

1. **Look for responses** (usually logged by the app):
   ```javascript
   // ✅ CORRECT (Sprint 1 fix):
   {
     success: true,
     message: "Bottle added!",
     data: { bottleID: "198" }
   }

   // ❌ WRONG (before fix):
   {
     success: true,
     data: '{"success":true,"message":"Bottle added!","data":{"bottleID":"198"}}'
   }
   ```

2. **Check for errors**:
   - ✅ NO errors about "wineToRate is not defined"
   - ✅ NO errors about accessing undefined properties
   - ⚠️ OK: "Both overall and value ratings must be selected" (only after editing wine - this is WIN-XX, minor issue for Sprint 2)

---

### Database Verification (Optional)

**Verifies**: WIN-86 (Audit array serialization), WIN-66 (Transaction safety)

#### Connect to Database
```bash
# SSH to database server (if needed)
ssh user@10.0.0.16

# Connect to MySQL
mysql -u username -p winelist
```

#### Check Audit Logs
```sql
-- View recent audit entries
SELECT
    tableName,
    columnName,
    oldValue,
    newValue,
    changedAt
FROM audit_log
ORDER BY changedAt DESC
LIMIT 10;
```

**✅ Expected Results**:
- `oldValue` and `newValue` contain actual data (not "Array")
- Complex values are JSON strings: `{"wineTypeID":1}`
- All recent changes are logged

**❌ Before Sprint 1**:
- Would see: Literal string "Array" in oldValue/newValue columns

#### Check Transaction Integrity
```sql
-- Check for orphaned bottles (bottles without wine)
SELECT b.bottleID, b.wineID
FROM bottles b
LEFT JOIN wine w ON b.wineID = w.wineID
WHERE w.wineID IS NULL;

-- Expected: 0 rows (no orphaned bottles)

-- Check for orphaned wines (wines without producer)
SELECT w.wineID, w.wineName, p.producerName
FROM wine w
LEFT JOIN producers p ON w.producerID = p.producerID
WHERE p.producerID IS NULL;

-- Expected: 0 rows (no orphaned wines)
```

**✅ Expected Results**:
- Both queries return 0 rows
- Data integrity maintained even after errors

---

## Regression Testing

Run these quick tests to ensure nothing broke:

### Test A: Page Load
1. Open index.html
2. ✅ Wine list loads
3. ✅ Filter dropdowns populate
4. ✅ No console errors

### Test B: Filters
1. Select a country filter
2. ✅ Wine list updates
3. Select a region filter
4. ✅ Wine list updates (cascading works)
5. ✅ No console errors

### Test C: Wine Card Interaction
1. Click a wine card to expand
2. ✅ Smooth animation
3. Click again to collapse
4. ✅ No scroll jumping
5. ✅ No console errors

### Test D: AI Generation (Optional)
1. Click **"Add Wine"**
2. On any tab, click **"Update Information..."** button
3. ✅ Loading spinner appears
4. ✅ Fields populate with AI data
5. ✅ No console errors

---

## Known Issues (Non-Blocking)

### WIN-XX: Button ID Collision Warning
**When it appears**: After editing a wine, when success overlay shows
**What you see**: Console warning "Both overall and value ratings must be selected"
**Impact**: None - purely cosmetic console warning
**Status**: Documented for Sprint 2 (1-line fix)

**This is NOT a failure** - it's a known minor issue discovered during testing.

---

## Issue Checklist

After verification, confirm these issues are resolved:

- [ ] **WIN-93**: Add bottle no longer crashes with "wineToRate" error ✅
- [ ] **WIN-87**: API responses are proper objects (not JSON strings) ✅
- [ ] **WIN-86**: Audit logs contain actual values (not "Array") ✅
- [ ] **WIN-66**: Transaction safety verified (no orphaned records) ✅

---

## Troubleshooting

### Problem: Still seeing "wineToRate" errors
**Solution**: Ensure old wineapp.js is NOT loaded. Check [index.html](../index.html) lines 8 and 220 are commented out.

### Problem: Console shows nested JSON strings
**Solution**: Clear browser cache and hard refresh (Ctrl+Shift+R). The api.js fix should be loaded.

### Problem: Can't see console logs
**Solution**:
1. Open DevTools (F12)
2. Go to "Console" tab
3. Ensure log level is set to "All" or "Verbose"

### Problem: Database queries return errors
**Solution**: Verify connection credentials and database name (`winelist` on 10.0.0.16)

---

## Success Criteria

Sprint 1 verification is successful if:

✅ All 3 Quick Verification tests pass
✅ Console shows proper JSON objects (not strings)
✅ No blocking errors in console
✅ Database audit logs contain proper values (if checked)
✅ No orphaned records in database (if checked)
⚠️ Button ID warning is acceptable (WIN-XX, documented for Sprint 2)

---

## Report Issues

If you find any problems during verification:

1. **Check this guide** for known issues
2. **Check console** for error details
3. **Take screenshots** of any errors
4. **Document**:
   - What you were doing (which test)
   - What you expected
   - What actually happened
   - Console error messages
   - Browser/OS information

5. **Contact**: phil.humber@gmail.com or add to JIRA

---

## Next Steps After Verification

Once verification is complete:

1. ✅ Mark Sprint 1 as verified in JIRA
2. ✅ Update JIRA issues (WIN-93, WIN-87, WIN-86, WIN-66) to "Done"
3. 📋 Deploy to production (if applicable)
4. 📋 Begin Sprint 2 planning
5. 📋 Create WIN-XX JIRA issue for button ID collision

---

## Documentation References

- **Main Guide**: [CLAUDE.md](../CLAUDE.md)
- **Sprint 1 Summary**: [SPRINT1_SUMMARY.md](SPRINT1_SUMMARY.md)
- **Test Checklist**: [SPRINT1_TEST_CHECKLIST.md](SPRINT1_TEST_CHECKLIST.md)
- **Completion Report**: [SPRINT1_COMPLETION_REPORT.md](SPRINT1_COMPLETION_REPORT.md)
- **New Issue**: [JIRA_WIN-XX_BUTTON_ID_COLLISION.md](JIRA_WIN-XX_BUTTON_ID_COLLISION.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Quick Reference: Test Status

| Test | Issue | Status | Time |
|------|-------|--------|------|
| Add Bottle | WIN-87, WIN-93 | ✅ PASS | 2 min |
| Edit Wine | WIN-87, WIN-86 | ✅ PASS | 2 min |
| Drink Bottle | WIN-87, WIN-66 | ✅ PASS | 3 min |
| Console Check | All | ✅ PASS | 2 min |
| Database Audit | WIN-86 | ✅ PASS | 3 min |
| Database Integrity | WIN-66 | ✅ PASS | 2 min |
| Regression Tests | All | ✅ PASS | 5 min |

**Total Time**: 15-20 minutes
**Overall Status**: ✅ ALL TESTS PASSING

---

*Last Updated: 2026-01-12*
*Sprint: 1 of 4*
*Next Sprint Focus: UX Improvements*
