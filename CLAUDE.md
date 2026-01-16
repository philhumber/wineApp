# Wine Collection App - Development Guide

**Last Updated**: 2026-01-16
**Status**: Phase 1 Complete, Sprint 1-2 Complete ✅, Sprint 3 In Progress
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Quick Start for New Sessions

### Current Focus
**Sprint 3**: 🟡 IN PROGRESS - Finish remaining items, then begin Qvé migration
**Qvé Migration**: 📋 PLANNED - Full migration plan approved (2026-01-13)

| Sprint | Status | Notes |
|--------|--------|-------|
| Sprint 1 | ✅ COMPLETE | All 4 critical bugs fixed (2026-01-12) |
| Sprint 2 | ✅ COMPLETE | UX: toast, filters, scroll-to-wine, view mode |
| Sprint 3 | 🟡 IN PROGRESS | WIN-27 ✅, WIN-95 ✅, remaining: WIN-88, WIN-84, WIN-38, WIN-43, WIN-96 |
| Qvé Migration | 📋 PLANNED | Svelte/SvelteKit PWA rebuild (17-24 days) |

### What You Need to Know
1. **Phase 1 refactoring is COMPLETE** - 17 ES6 modules, fully tested
2. **Qvé Migration Plan APPROVED** - See `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`
3. **Sprint 3 first, then Qvé** - Complete remaining Sprint 3 items before migration
4. **GitHub branching strategy DOCUMENTED** - See [docs/06-reference/GITHUB_SETUP_PLAN.md](docs/06-reference/GITHUB_SETUP_PLAN.md) and [CONTRIBUTING.md](CONTRIBUTING.md)
5. **Old wineapp.js should NOT be loaded** - causes conflicts
6. **New toast.js module** - Lightweight notification system added
7. **View Mode system** - OURS/ALL/CLEAR buttons with viewMode state for filtering
8. **Qvé Rebrand mockup COMPLETE** - Design work in `design/qve-rebrand/` folder
9. **PHP backend is reusable** - New Svelte frontend will use existing PHP API unchanged

### Key Commands
```bash
# View open JIRA issues (requires API token)
curl -u "phil.humber@gmail.com:[TOKEN]" \
  "https://philhumber.atlassian.net/rest/api/3/search/jql?jql=project=WIN+AND+status!=Done"

# Run local server (if needed)
php -S localhost:8000
```

---

## System Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JavaScript ES6+ (NO frameworks)
- **Backend**: PHP 7+ with PDO
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
- **AI**: Google Gemini AI API
- **Build**: None - pure vanilla, direct file serving

### Project Structure
```
wineapp/
├── index.html                 # Main entry (SPA)
├── addwine.html              # 4-step wine add form
├── addBottle.html            # Add bottle to existing wine
├── editWine.html             # Edit wine details
├── rating.html               # Rating interface
├── drunkList.html            # Consumed wines history
├── CLAUDE.md                 # THIS FILE - dev guide
├── design/                   # UI/UX design mockups
│   └── qve-rebrand/          # Qvé rebrand mockup & docs
├── docs/                     # Complete documentation
│   ├── README.md             # Docs navigation hub
│   ├── 01-overview/          # Architecture, system design
│   ├── 02-development/       # Module guides, migration docs
│   ├── 03-testing/           # Testing guides, verification
│   ├── 04-sprints/           # Sprint reports & checklists
│   ├── 05-issues/            # JIRA issue investigations
│   └── 06-reference/         # Quick refs, glossary
├── resources/
│   ├── wineapp.css           # Main styles (967 lines)
│   ├── wineapp.js            # OLD monolith (DEPRECATED - do not load)
│   ├── js/                   # NEW modular JS (Phase 1 ✅ + Sprint 2)
│   │   ├── app.js           # Main entry & init
│   │   ├── core/            # API, State, Router, Modals
│   │   ├── ui/              # Cards, Forms, Dropdowns, Navigation, Toast
│   │   ├── features/        # Rating, Wine Mgmt, Bottles, AI
│   │   └── utils/           # DOM helpers, Validation, Helpers
│   ├── php/                 # 17 backend endpoints
│   │   ├── getWines.php
│   │   ├── addWine.php
│   │   ├── drinkBottle.php
│   │   ├── updateWine.php
│   │   └── ... (13 more)
│   └── sql/
│       └── DBStructure.sql  # Complete schema
└── images/                  # Wine photos, flags
```

### Key Design Patterns
- **ES6 Modules**: 16 modules with clear separation of concerns
- **Observable State**: Centralized state with subscriber pattern
- **Event Delegation**: Single listener on content area
- **Template Cloning**: Fast DOM manipulation
- **Soft Deletes**: Data preservation with audit trail
- **Transaction Safety**: PDO transactions with rollback

---

## Database Schema

### Core Tables
**wine** (wineID, wineName, wineTypeID, producerID, year, description, tastingNotes, pairing, pictureURL, ABV, drinkDate, rating, bottlesDrunk, deleted, deletedAt, deletedBy)

**bottles** (bottleID, wineID, bottleSize, location, source, price, currency, dateAdded, bottleDrunk, deleted, deletedAt, deletedBy)

**ratings** (ratingID, wineID, bottleID, overallRating, valueRating, drinkDate, buyAgain, Notes, avgRating)

**producers** (producerID, producerName, regionID, town, founded, ownership, description)

**region** (regionID, regionName, countryID, description, climate, soil, map)

**country** (countryID, countryName, code, world_code, full_name, iso3, number, continent)

**winetype** (wineTypeID, wineType: Red, White, Rosé, Sparkling, Dessert, Fortified)

**grapes** (grapeID, grapeName, description, picture) - *Not yet used in UI*

**grapemix** (mixID, wineID, grapeID, mixPercent) - *Not yet used in UI*

**worlds** (name: "Old World", "New World") - *Not yet fully integrated*

**audit_log** (auditID, tableName, recordID, action, columnName, oldValue, newValue, changedBy, changedAt, ipAddress)

### Relationships
```
worlds (1) → (N) country
country (1) → (N) region
region (1) → (N) producers
producers (1) → (N) wine
wine (1) → (N) bottles
wine (1) → (N) ratings ← (1) bottles
wine (1) → (N) grapemix ← (N) grapes
winetype (1) → (N) wine
```

All FKs use **ON DELETE RESTRICT** to prevent data loss.

---

## JIRA Issues - Complete List (45 Open + 1 New)

### ✅ Sprint 1 Complete (2026-01-12) - Critical Bugs FIXED

#### WIN-93: Error when adding bottle only ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed in Phase 1 refactor)
- **Priority**: Medium (but HIGH impact)
- **Error**: `Uncaught ReferenceError: wineToRate is not defined at closeModal`
- **Root Cause**: `app.js:229` calls `ratingManager.closeModal()` after adding bottle, but closeModal() is rating-specific
- **Fix Applied**: Modal management properly separated by context in Phase 1 refactor
- **Test Result**: ✅ PASS - Add bottle works without errors

#### WIN-87: Response data has extra layer ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-12)
- **Priority**: Medium (but HIGH impact)
- **Problem**: Error handling fails due to nested JSON response structure
- **Root Cause**: `api.js:84` wraps already-JSON response: `{ success: true, data: '{"success":true,...}' }`
- **Files Fixed**: [resources/js/core/api.js](resources/js/core/api.js) lines 74-94
- **Fix Applied**: Parse JSON string before returning object
- **Test Result**: ✅ PASS - All API operations return proper objects

#### WIN-66: On SQL failure, everything should roll back ✅ VERIFIED
- **Type**: Bug
- **Status**: ✅ Done (Verified 2026-01-12)
- **Priority**: Medium
- **Problem**: Transactions may not rollback properly on failure
- **Files Verified**: All PHP files with transactions
  - [resources/php/addWine.php](resources/php/addWine.php) - Lines 78, 277, 286-288
  - [resources/php/drinkBottle.php](resources/php/drinkBottle.php) - Lines 84, 142, 151
  - [resources/php/updateWine.php](resources/php/updateWine.php) - Lines 80, 122, 131
  - [resources/php/updateBottle.php](resources/php/updateBottle.php) - Lines 64, 95, 104
- **Verification**: All files have proper try/catch/rollback patterns
- **Test Result**: ✅ PASS - Transaction safety verified

#### WIN-86: Audit function taking arrays and not values ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-12)
- **Priority**: Medium
- **Problem**: Audit log receives arrays instead of scalar values, causing malformed logs
- **Files Fixed**: [resources/php/audit_log.php](resources/php/audit_log.php) lines 21-27
- **Fix Applied**: Serialize arrays to JSON before logging
- **Test Result**: ✅ PASS - Audit logs contain proper values

---

### 🟡 High Priority Bugs/UX (Sprint 2)

#### WIN-XX: Button ID collision causes spurious rating warning ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-12)
- **Priority**: Low (Console warning only - no functional impact)
- **Problem**: Success overlay "Finish!" button uses `id="lockBtn"` causing event delegation to call rating validation
- **Error**: Console warning "Both overall and value ratings must be selected" after editing wine
- **Root Cause**: ID reuse between [rating.html:31](rating.html#L31) and [sucess.html:6](sucess.html#L6)
- **Files Fixed**: [sucess.html](sucess.html) line 6
- **Fix Applied**: Changed `id="lockBtn"` to `id="finishBtn"` in success overlay
- **Test Result**: ✅ PASS - No console warning when clicking "Finish!" button
- **Documentation**: [docs/05-issues/bugs/JIRA_WIN-XX_BUTTON_ID_COLLISION.md](docs/05-issues/bugs/JIRA_WIN-XX_BUTTON_ID_COLLISION.md)
- **Discovered**: During WIN-87 testing on 2026-01-12

#### WIN-90: Dropdowns should refresh after every add and drink ✅ FIXED
- **Type**: Bug + UX Enhancement
- **Status**: ✅ Done (Fixed 2026-01-12)
- **Priority**: High
- **Problem**: Filter dropdowns don't refresh; filters lost after operations; no feedback on success
- **Solution Implemented** (3 parts):
  - **Task A**: Dropdown refresh after add/edit/drink operations
  - **Task B**: Toast notifications + scroll-to-wine after operations
  - **Task C**: Filter state preservation across operations
- **Files Modified**:
  - [resources/js/ui/toast.js](resources/js/ui/toast.js) - NEW: Toast notification system
  - [resources/js/ui/cards.js](resources/js/ui/cards.js) - Added scrollToCard(), data-wine-id attribute
  - [resources/js/core/state.js](resources/js/core/state.js) - Added targetWineID state management
  - [resources/js/features/wine-management.js](resources/js/features/wine-management.js) - Toast, scroll, dropdown refresh
  - [resources/js/features/rating.js](resources/js/features/rating.js) - Toast, scroll preservation, dropdown refresh
  - [resources/js/app.js](resources/js/app.js) - Filter save/restore, ALL button clear
  - [resources/sidebar.html](resources/sidebar.html) - Navigation with proper filter objects
  - [resources/wineapp.css](resources/wineapp.css) - Toast styles, card highlight animation
- **Test Result**: ✅ PASS - All operations show toast, preserve filters, scroll to wine

#### WIN-83: When closing modal, user should go back to current page ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-12 as part of WIN-90)
- **Priority**: High
- **Problem**: Closing modal loses filter state; user loses their filtered view
- **Fix Applied**: Filter state persistence in appState; getWineData() saves/restores filters
- **Files Modified**: See WIN-90 above (Task C: Filter State Preservation)
- **Test Result**: ✅ PASS - Filters preserved after add/edit/drink operations

#### WIN-96: Scroll behaviour when collapsing cards is jarring ✅ FIXED
- **Type**: Task
- **Status**: ✅ Done (Fixed 2026-01-13)
- **Priority**: Medium
- **Problem**: When collapsing expanded cards that were partially above viewport, scroll behavior was inconsistent and jarring
- **Solution Implemented**:
  - Added `smoothScrollTo()` helper function with 200ms ease-out animation to match CSS collapse transition
  - Fixed DOM traversal to find next wine card (cards are wrapped in containers)
  - Smart scroll logic: shows collapsed card at top when header was off-screen, card filled >50% viewport, or next card was below viewport
  - Scroll and collapse animations now synchronized (both 200ms ease-out)
- **Files Modified**: [resources/js/ui/cards.js](resources/js/ui/cards.js) lines 14-32 (smoothScrollTo), lines 277-369 (collapse handling)
- **Key Config**: `topPadding = -50` positions collapsed card slightly above viewport top for visual continuity
- **Test Result**: ✅ PASS - Smooth synchronized collapse and scroll in all scenarios

#### WIN-NEW: avgRating column overflow on perfect 10/10 rating ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-13)
- **Priority**: Low (edge case)
- **Problem**: `ratings.avgRating` column is `DECIMAL(3,2)` which maxes at 9.99. A 10+10 rating = 10.00 causes SQL error.
- **Error**: `SQLSTATE[22003]: Numeric value out of range`
- **Root Cause**: Column definition too narrow for edge case
- **Fix Applied**: `ALTER TABLE ratings MODIFY COLUMN avgRating DECIMAL(4,2);`
- **Discovered**: During WIN-90 testing on 2026-01-12
- **Test Result**: ✅ PASS - Perfect 10/10 ratings now save correctly

#### WIN-27: Stop right-click menu popup ✅ FIXED
- **Type**: Bug
- **Status**: ✅ Done (Fixed 2026-01-13)
- **Problem**: Browser context menu appeared on right-click/long-press instead of custom menu
- **Solution Implemented**:
  - Added `contextmenu` event listener to wine cards in [cards.js:232-241](resources/js/ui/cards.js#L232-L241)
  - Desktop right-click now shows custom context menu (Drink/Add/Edit)
  - Added bottle check in [bottle-tracking.js:295-304](resources/js/features/bottle-tracking.js#L295-L304)
  - "Drink" on wine with 0 bottles shows helpful toast: "No bottles to drink! Add one first?"
- **Files Modified**:
  - [resources/js/ui/cards.js](resources/js/ui/cards.js) - contextmenu handler + wineCardPopUp import
  - [resources/js/features/bottle-tracking.js](resources/js/features/bottle-tracking.js) - bottle check with toast
- **Test Result**: ✅ PASS - Right-click shows custom menu, drink without bottles shows toast

---

### 🟢 Medium Priority UX Improvements (Sprint 3)

#### WIN-94: After add, take user to latest bottle ✅ FIXED
- **Type**: Task
- **Status**: ✅ Done (Fixed 2026-01-12 as part of WIN-90)
- **Priority**: Medium
- **Problem**: After adding wine/bottle, user had to scroll to find it
- **Fix Applied**: setTargetWine() + scrollToCard() with highlight animation
- **Files Modified**: See WIN-90 above (Task B: Post-operation navigation)
- **Test Result**: ✅ PASS - New wine/bottle scrolled into view with highlight

#### WIN-95: Update Picture Upload ✅ FIXED
- **Type**: Task
- **Status**: ✅ Done (Fixed 2026-01-13)
- **Description**: Consistent 800x800px square images with intelligent background color
- **Solution Implemented**:
  - All uploaded images now output as 800x800px JPEG squares
  - Images resized to fit within canvas while maintaining aspect ratio
  - Background color sampled from image edges (dominant color algorithm)
  - Transparent/white backgrounds automatically detected and use white fill
  - Supports PNG, GIF, WebP transparency detection
- **Files Modified**:
  - [resources/php/upload.php](resources/php/upload.php) - Complete rewrite of `rotateAndResizeImage()`, added `getDominantEdgeColor()`
  - [resources/php/migrate_images.php](resources/php/migrate_images.php) - NEW: Batch migration script for existing images
- **Algorithm**:
  1. Quick corner check (5 pixels diagonal from top-left)
  2. If 3+ transparent OR 3+ white → use white background
  3. Otherwise → full edge sampling with color binning to find dominant color
- **Test Result**: ✅ PASS - Images consistently square with appropriate backgrounds

#### WIN-88: Show price value on wineCard
- **Type**: Task
- **Status**: To Do
- **Description**: Display $ to $$$$$ scale based on collection average
- **Algorithm**: Compare wine avg price/mL to collection avg
- **Files**:
  - [resources/php/getWines.php](resources/php/getWines.php) - Add price calc
  - [resources/js/ui/cards.js](resources/js/ui/cards.js) - Display scale
  - [resources/wineapp.css](resources/wineapp.css) - Style indicators

#### WIN-84: Add purchase date for add wine ✅ FIXED
- **Type**: Task
- **Status**: ✅ Done (Fixed 2026-01-13)
- **Note**: `bottles.dateAdded` field already exists in DB!
- **Files**:
  - [addwine.html](addwine.html) - Add date picker to Tab 4
  - [resources/js/features/wine-management.js](resources/js/features/wine-management.js)

#### WIN-38: Upload Button UI
- **Type**: Task
- **Status**: In Progress
- **Description**: Hide button after success, show success/error messages
- **Files**: [resources/js/features/wine-management.js](resources/js/features/wine-management.js)

#### WIN-43: Loading UI Improvements
- **Type**: Task
- **Status**: To Do
- **Description**: Fun text during AI loading ("Searching cellars...", "Tasting vintages...", "Trimming vines...")
- **Files**: [resources/js/features/ai-integration.js](resources/js/features/ai-integration.js)

---

### 🔵 Feature Enhancements (Future)

#### WIN-92: Dropdowns should reflect all wines (inc bottles = 0) or our wines (bottles >0) ✅ FIXED
- **Type**: Task
- **Status**: ✅ Done (Fixed 2026-01-12)
- **Priority**: High
- **Problem**: When on "Our Wines" view (bottles > 0), selecting a dropdown filter returned ALL wines instead of preserving the bottle count constraint
- **Root Cause**: `dropdowns.js:63-68` hardcoded `bottleCount: '0'` in onclick handlers
- **Solution Implemented** (4 parts):
  - **Part A**: View Mode State - Added `viewMode` property to AppState with `setViewMode()` and `getBottleCountForView()`
  - **Part B**: Visual Indicator - Badge in header showing "Our Wines" (wine red) or "All Wines" (steel blue)
  - **Part C**: OURS/ALL/CLEAR Buttons - Toggle view mode while preserving filters; CLEAR resets all filters
  - **Part D**: Filter Active Indicators - Red dot on dropdown buttons when filter is active
- **Files Modified**:
  - [resources/js/core/state.js](resources/js/core/state.js) - Added viewMode state, setViewMode(), getBottleCountForView()
  - [resources/js/app.js](resources/js/app.js) - OURS/ALL/CLEAR buttons, updateViewModeIndicator(), updateFilterIndicators()
  - [resources/js/ui/dropdowns.js](resources/js/ui/dropdowns.js) - Added applyFilter() method, fixed buildDropdownHTML()
  - [resources/wineapp.css](resources/wineapp.css) - View mode badge styles, filter indicator dot styles
  - [resources/header.html](resources/header.html) - Added viewModeIndicator span
  - [resources/sidebar.html](resources/sidebar.html) - Updated navigation with setViewMode() and wineCount parameter
- **Test Result**: ✅ PASS - All view mode filtering tests passed

#### WIN-80: Should be able to delete a bottle (drink with no rating)
- **Type**: Task
- **Status**: To Do

#### WIN-70: Allow cancel 'drink bottle'
- **Type**: Task
- **Status**: To Do
- **Problem**: Bottle deleted before rating, no way to cancel

#### WIN-79: Check if similar region/producer/wine is in the list
- **Type**: Task
- **Status**: In Progress
- **Description**: Prompt user before AI call if similar match exists

#### WIN-34: Filtering and Sorting
- **Type**: Task
- **Status**: To Do
- **Features**: 0 bottles, date added, rating, price, name, producer, region, country, type

#### WIN-24: Search
- **Type**: Task
- **Status**: To Do
- **Description**: Free text search across all wine attributes

#### WIN-68: Sort by buttons
- **Type**: Task
- **Status**: To Do

---

### ✅ Already Complete (Mark as Done in JIRA)

#### WIN-81: Refactor JS in Modules
- **Status**: ✅ COMPLETE (Phase 1 - Jan 2026)
- **Result**: 16 ES6 modules, ~5,241 lines refactored from 1,642-line monolith
- **Action**: Mark as Done

#### WIN-82: Add logging and soft delete
- **Status**: ✅ IMPLEMENTED
- **Tables**: `audit_log`, soft delete fields on `wine` and `bottles`
- **Action**: Verify completeness, mark as Done

#### WIN-96: Scroll behaviour when collapsing cards ✅
- **Status**: ✅ FIXED (2026-01-13)
- **Fix**: Synchronized smooth scroll animation (200ms ease-out) with smart positioning logic
- **Details**: See WIN-96 entry in Sprint 2 section above

---

### 🚀 Future Phases (Out of Current Scope)

- **WIN-42**: Build Image recognition (Phase 2)
- **WIN-37**: Build AI chatbot (winebot)
- **WIN-32/31/30**: Producer and Region Info pages (Phase 4)
- **WIN-69**: Add drink history (already exists as [drunkList.html](drunkList.html)!)
- **WIN-78**: JS/PHP Caching
- **WIN-64**: Use structured output and grounding

---

## Critical Bug Analysis

### WIN-93 Deep Dive: closeModal Error

**Error Message**:
```
Uncaught (in promise) ReferenceError: wineToRate is not defined
at closeModal (wineapp.js:1589:5)
```

**Why It Happens**:
1. User adds a bottle (not rating)
2. `addBottle.html` loads - contains `#wineToAdd` but NO `#wineToRate`
3. After success, `app.js:229` calls `ratingManager.closeModal()`
4. `closeModal()` tries to access `wineToRate` element → CRASH

**Two Flows**:
- **Add Bottle**: addBottle.html → `#wineToAdd` exists → closeModal() fails
- **Drink + Rate**: rating.html → `#wineToRate` exists → closeModal() works

**Solution**:
```javascript
// resources/js/app.js line 229
// WRONG:
ratingManager.closeModal();

// RIGHT:
modalManager.hideAll();
await cardRenderer.refreshWines();
```

**Safety Note**: NEW modular code (rating.js:257) has `if (this.wineToRate)` check, so it won't crash - but semantically wrong function is still called.

---

### WIN-87 Deep Dive: Response Nesting

**Problem**: API error handling fails due to double-nested JSON.

**Current Flow**:
1. PHP returns: `{"success":true,"message":"...","data":{...}}`
2. `api.js:72` → `response.text()` → returns JSON STRING
3. `api.js:84` → wraps string: `{ success: true, data: '{"success":true,...}' }`
4. Caller gets: `result.data` = STRING not OBJECT
5. Accessing `result.data.success` fails because data is a string

**Example**:
```javascript
// What we get:
{
  success: true,
  data: '{"success":true,"message":"Bottle added!","data":{"bottleID":"198"}}'
}

// What we need:
{
  success: true,
  message: "Bottle added!",
  data: { bottleID: "198" }
}
```

**Solution** (api.js:74-90):
```javascript
.then(result => {
    // Parse JSON string to object
    let parsedResult = result;
    try {
        parsedResult = JSON.parse(result);
    } catch (e) {
        // Not JSON, keep as string (legacy)
    }

    if (data == "winePictureUpload") {
        // Handle file upload
        if (parsedResult.startsWith("Filename: ")) {
            document.getElementById("winePicture").value = parsedResult.replace("Filename: ", "");
            return { success: true, data: parsedResult };
        } else {
            return { success: false, data: parsedResult };
        }
    } else {
        return parsedResult; // Return parsed object directly
    }
})
```

---

## Critical Files Reference

### JavaScript Modules (ES6)

#### Core Layer
- **[resources/js/app.js](resources/js/app.js)** - Main entry, event delegation, initialization
- **[resources/js/core/api.js](resources/js/core/api.js)** - WineAPI class, all backend calls
- **[resources/js/core/state.js](resources/js/core/state.js)** - AppState, observable pattern, targetWineID, filter persistence
- **[resources/js/core/router.js](resources/js/core/router.js)** - Hash-based routing (future)

#### UI Layer
- **[resources/js/ui/cards.js](resources/js/ui/cards.js)** - WineCardRenderer, template cloning, scrollToCard
- **[resources/js/ui/forms.js](resources/js/ui/forms.js)** - FormManager, multi-step forms
- **[resources/js/ui/modals.js](resources/js/ui/modals.js)** - ModalManager, overlay handling
- **[resources/js/ui/dropdowns.js](resources/js/ui/dropdowns.js)** - DropdownManager, filters
- **[resources/js/ui/navigation.js](resources/js/ui/navigation.js)** - NavigationManager, sidebar
- **[resources/js/ui/toast.js](resources/js/ui/toast.js)** - ToastManager, notifications (NEW Sprint 2)

#### Features Layer
- **[resources/js/features/rating.js](resources/js/features/rating.js)** - RatingManager, 10-star system
- **[resources/js/features/wine-management.js](resources/js/features/wine-management.js)** - Add/edit wines
- **[resources/js/features/bottle-tracking.js](resources/js/features/bottle-tracking.js)** - Add/drink bottles
- **[resources/js/features/ai-integration.js](resources/js/features/ai-integration.js)** - Gemini AI

#### Utils Layer
- **[resources/js/utils/dom-helpers.js](resources/js/utils/dom-helpers.js)** - DOM manipulation
- **[resources/js/utils/validation.js](resources/js/utils/validation.js)** - Form validation
- **[resources/js/utils/helpers.js](resources/js/utils/helpers.js)** - Date format, utilities

### PHP Backend (17 Files)

#### Main Endpoints
- **[resources/php/getWines.php](resources/php/getWines.php)** - Complex JOIN query with filters
- **[resources/php/addWine.php](resources/php/addWine.php)** - Transaction-based insert (4 tables)
- **[resources/php/addBottle.php](resources/php/addBottle.php)** - Add bottle to wine
- **[resources/php/drinkBottle.php](resources/php/drinkBottle.php)** - Mark drunk, add rating
- **[resources/php/updateWine.php](resources/php/updateWine.php)** - Update wine table
- **[resources/php/updateBottle.php](resources/php/updateBottle.php)** - Update bottle table

#### Reference Data
- **[resources/php/getCountries.php](resources/php/getCountries.php)**
- **[resources/php/getRegions.php](resources/php/getRegions.php)**
- **[resources/php/getProducers.php](resources/php/getProducers.php)**
- **[resources/php/getWineTypes.php](resources/php/getWineTypes.php)**

#### Utilities
- **[resources/php/databaseConnection.php](resources/php/databaseConnection.php)** - PDO connection
- **[resources/php/audit_log.php](resources/php/audit_log.php)** - Change tracking
- **[resources/php/upload.php](resources/php/upload.php)** - Image upload
- **[resources/php/callGeminiAI.php](resources/php/callGeminiAI.php)** - AI endpoint

### HTML Pages
- **[index.html](index.html)** - Main SPA entry, loads app.js
- **[addwine.html](addwine.html)** - 4-tab wine add form
- **[addBottle.html](addBottle.html)** - Add bottle form (has `#wineToAdd`)
- **[editWine.html](editWine.html)** - Edit wine/bottle form
- **[rating.html](rating.html)** - Rating interface (has `#wineToRate`)
- **[drunkList.html](drunkList.html)** - Consumed wines history

### Database
- **[resources/sql/DBStructure.sql](resources/sql/DBStructure.sql)** - Complete schema with CREATE statements

---

## Testing Guide

### Phase 1 Regression Tests (Run After Each Sprint)

1. **Initial Page Load & Initialization**
   - Open index.html
   - Check console for errors
   - Verify wine list loads
   - Verify filter dropdowns populate

2. **Navigation - Open/Close Sidebar**
   - Click hamburger menu
   - Verify sidebar slides in
   - Click overlay to close
   - Verify sidebar closes

3. **Filter Wines with Dropdowns**
   - Test country filter
   - Test region filter (cascading)
   - Test type filter
   - Test producer filter
   - Test year filter
   - Verify wine list updates

4. **Add Wine Workflow**
   - Open Add Wine form
   - Complete all 4 tabs (Region, Producer, Wine, Bottle)
   - Test AI generation for each entity
   - Upload image
   - Submit form
   - Verify wine appears in list

5. **Drink Bottle & Rate Wine**
   - Click "Drink Bottle" on a wine
   - Select bottle from dropdown
   - Rate overall (10 glasses)
   - Rate value (10 money bags)
   - Toggle "Buy Again"
   - Add tasting notes
   - Click "Lock Rating"
   - Verify bottle marked as drunk
   - Verify rating displays on card

6. **Add Bottle to Existing Wine**
   - Click "Add Bottle" on a wine
   - Fill bottle form
   - Submit
   - Verify bottle count increments

7. **Edit Wine Details**
   - Right-click wine card (or long-press mobile)
   - Select "Edit Wine"
   - Modify fields
   - Submit
   - Verify changes saved

8. **Wine Card Expand/Collapse**
   - Click wine card to expand
   - Verify smooth animation
   - Click to collapse
   - Verify no scroll jumping

9. **AI Data Generation**
   - Test wine AI generation
   - Test producer AI generation
   - Test region AI generation
   - Verify loading spinner
   - Verify fields populate

10. **View Drunk Wines History**
    - Navigate to Drunk Wines
    - Verify list displays
    - Verify ratings show
    - Verify "Buy Again" indicator

### Bug-Specific Testing

For each JIRA issue fixed:
1. Reproduce the original bug (before fix)
2. Apply the fix
3. Verify bug no longer occurs
4. Test related functionality
5. Check console for errors
6. Update JIRA issue

---

## Sprint 1 Testing Guide (2026-01-12)

### Testing WIN-87: Response Nesting Fix

**What was fixed**: API responses were double-wrapped, causing `result.data` to be a JSON string instead of an object.

**How to test**:

1. **Add a new bottle to existing wine**:
   - Open the app in browser with DevTools Console open
   - Click "Add Bottle" on any wine card
   - Fill in bottle details (size, location, source, price)
   - Submit the form
   - ✅ **Expected**: Success message appears, bottle count increments
   - ✅ **Expected**: Console shows proper response object (NOT string)
   - ❌ **Before fix**: Would see nested JSON string or error accessing `result.data.bottleID`

2. **Drink a bottle with rating**:
   - Click "Drink Bottle" on a wine with available bottles
   - Select a bottle from dropdown
   - Add ratings and notes
   - Click "Lock Rating"
   - ✅ **Expected**: Success message, bottle marked as drunk
   - ✅ **Expected**: Console log shows `{ success: true, message: "...", data: {...} }`
   - ❌ **Before fix**: Would see `{ success: true, data: '{"success":true,...}' }`

3. **Update wine details**:
   - Right-click a wine card (or long-press on mobile)
   - Click "Edit Wine"
   - Modify any field (description, tasting notes, etc.)
   - Submit changes
   - ✅ **Expected**: Changes saved, success message displayed
   - ✅ **Expected**: No console errors about accessing undefined properties

4. **Console verification**:
   ```javascript
   // In browser console after any operation, check the response:
   // CORRECT (after fix):
   { success: true, message: "Bottle added!", data: { bottleID: "198" } }

   // WRONG (before fix):
   { success: true, data: '{"success":true,"message":"Bottle added!","data":{"bottleID":"198"}}' }
   ```

**Files changed**: [resources/js/core/api.js](resources/js/core/api.js) lines 74-94

---

### Testing WIN-86: Audit Array Serialization

**What was fixed**: Audit log was storing "Array" string instead of actual array contents.

**How to test**:

1. **Verify audit logging is working**:
   - Perform any update operation (update wine, update bottle, drink bottle)
   - Check the `audit_log` table in MySQL database

2. **Database query to verify**:
   ```sql
   -- Connect to database on 10.0.0.16
   USE winelist;

   -- Check recent audit logs
   SELECT * FROM audit_log
   ORDER BY changedAt DESC
   LIMIT 20;
   ```

3. **What to look for**:
   - ✅ **Expected**: `oldValue` and `newValue` columns contain actual data
   - ✅ **Expected**: If value is complex (like wineTypeID array), it's stored as JSON string: `{"wineTypeID":1}`
   - ❌ **Before fix**: Would see literal string "Array" in database columns

4. **Test with array values**:
   - Update a wine's type (triggers wineTypeID which may come as array)
   - Query audit_log table
   - ✅ **Expected**: See JSON-encoded array, not "Array" string

**Files changed**: [resources/php/audit_log.php](resources/php/audit_log.php) lines 21-27

---

### Testing WIN-66: Transaction Rollback

**What was verified**: All transaction-based operations properly rollback on failure.

**How to test** (requires intentional error injection):

1. **Test addWine.php rollback**:
   - Temporarily break the bottle insert (e.g., set invalid bottleSize in SQL)
   - Try to add a new wine
   - ✅ **Expected**: Error message displayed
   - ✅ **Expected**: NO partial data in database (no orphaned region/producer/wine)
   - Query to verify: `SELECT * FROM wine ORDER BY wineID DESC LIMIT 5;`

2. **Test drinkBottle.php rollback**:
   - Temporarily break the rating insert (e.g., invalid SQL)
   - Try to drink a bottle
   - ✅ **Expected**: Error message displayed
   - ✅ **Expected**: Bottle NOT marked as drunk (`bottleDrunk = 0`)
   - ✅ **Expected**: Wine `bottlesDrunk` count NOT incremented

3. **Test updateWine.php rollback**:
   - Temporarily break the audit log or SQL
   - Try to update a wine
   - ✅ **Expected**: Error message displayed
   - ✅ **Expected**: Wine data unchanged in database

4. **Test updateBottle.php rollback**:
   - Similar to updateWine test
   - ✅ **Expected**: Bottle data remains unchanged on error

**Files verified**:
- [resources/php/addWine.php](resources/php/addWine.php) lines 78, 277, 286-288
- [resources/php/drinkBottle.php](resources/php/drinkBottle.php) lines 84, 142, 151
- [resources/php/updateWine.php](resources/php/updateWine.php) lines 80, 122, 131
- [resources/php/updateBottle.php](resources/php/updateBottle.php) lines 64, 95, 104

**Note**: For production testing, you can verify by checking error logs instead of breaking code intentionally.

---

### Testing WIN-93: closeModal Error (Already Fixed)

**What was fixed**: Calling `ratingManager.closeModal()` after non-rating operations caused errors.

**How to test**:

1. **Add bottle to existing wine** (this was the main issue):
   - Click "Add Bottle" on a wine card
   - Fill in bottle details
   - Submit form
   - ✅ **Expected**: Modal closes cleanly, no console errors
   - ✅ **Expected**: Wine list refreshes, bottle count updates
   - ❌ **Before fix**: Console error: `ReferenceError: wineToRate is not defined`

2. **Verify rating flow still works**:
   - Click "Drink Bottle" on a wine
   - Complete the rating
   - Click "Lock Rating"
   - ✅ **Expected**: Rating modal closes properly
   - ✅ **Expected**: No console errors

**Files fixed in Phase 1 refactor**: Modal management now properly separated by context.

---

### General Regression Testing

After Sprint 1 fixes, run the complete regression test suite (Tests 1-10 from main Testing Guide above):

**Priority tests for Sprint 1**:
- ✅ Test 4: Add Wine Workflow (tests WIN-87, WIN-86, WIN-66)
- ✅ Test 5: Drink Bottle & Rate Wine (tests WIN-87, WIN-86, WIN-66)
- ✅ Test 6: Add Bottle to Existing Wine (tests WIN-87, WIN-93)
- ✅ Test 7: Edit Wine Details (tests WIN-87, WIN-86, WIN-66)

**Success criteria**:
- [x] All operations complete without console errors
- [x] Success/error messages display correctly
- [x] Data persists correctly in database
- [x] Audit logs contain proper values (not "Array")
- [x] No orphaned records on errors (transactions rollback properly)
- [x] Modal close behavior works in all contexts

**Test Result**: ✅ ALL TESTS PASSED (2026-01-12)
**Note**: Minor console warning discovered regarding button ID collision (see WIN-XX above) - does not affect functionality

---

## Sprint 2 Testing Guide (2026-01-12)

### Testing WIN-90: UX Improvements (Toast, Scroll, Filter Persistence)

**What was implemented**:
- Toast notifications replace blocking success overlay
- Scroll-to-wine with highlight animation after add/edit
- Filter state preserved across all operations

**Test 1: Toast Notifications**

1. **Add a new wine**:
   - Navigate to Add Wine form
   - Complete all 4 tabs and submit
   - ✅ **Expected**: Toast appears at bottom-center: "Wine added successfully!"
   - ✅ **Expected**: Toast auto-dismisses after 3 seconds
   - ✅ **Expected**: NO blocking overlay - can immediately interact with page

2. **Edit a wine**:
   - Click "Edit" on any wine card
   - Modify any field and submit
   - ✅ **Expected**: Toast appears: "Wine updated successfully!"

3. **Drink a bottle**:
   - Click "Drink Bottle" on a wine with bottles
   - Complete rating (try different ratings)
   - ✅ **Expected**: Contextual toast based on rating:
     - Rating 8-10: "Cheers! Great wine!"
     - Rating 5-7: "Rating saved!"
     - Rating 1-4: "Rating saved. Maybe try a different wine next time!"

4. **Add a bottle**:
   - Click "Add Bottle" on any wine card
   - Fill in bottle details and submit
   - ✅ **Expected**: Toast appears: "Bottle added!"

5. **Error handling**:
   - Try submitting a form with missing required fields
   - ✅ **Expected**: Error toast appears with red styling
   - ✅ **Expected**: Error toast stays longer (5 seconds)
   - ✅ **Expected**: Form data preserved - can retry without re-entering

---

**Test 2: Scroll-to-Wine After Add/Edit**

1. **Add wine and verify scroll**:
   - Scroll to bottom of wine list first
   - Add a new wine
   - ✅ **Expected**: Page scrolls to show the new wine card
   - ✅ **Expected**: New wine card has golden highlight animation (2 seconds)
   - ✅ **Expected**: Card is NOT auto-expanded (user can click to expand)

2. **Edit wine and verify scroll**:
   - Expand a wine card near the bottom
   - Click Edit and make changes
   - ✅ **Expected**: After save, scrolls back to that wine
   - ✅ **Expected**: Wine card highlighted briefly

3. **Add bottle and verify scroll**:
   - Find a wine card, note its position
   - Add a bottle to that wine
   - ✅ **Expected**: Scrolls to the wine, highlights it
   - ✅ **Expected**: Bottle count incremented

---

**Test 3: Filter State Preservation**

1. **Filter then add wine**:
   - Click "TYPES" dropdown and select "Red"
   - ✅ **Expected**: Only red wines shown
   - Add a new red wine
   - ✅ **Expected**: After add, still showing only red wines
   - ✅ **Expected**: New wine appears if it matches filter (is red)

2. **Filter then drink bottle**:
   - Select a country filter (e.g., "France")
   - ✅ **Expected**: Only French wines shown
   - Drink a bottle from one of those wines
   - ✅ **Expected**: After rating, still showing only French wines
   - ✅ **Expected**: Scroll position approximately maintained

3. **Filter then edit wine**:
   - Select a producer filter
   - Edit a wine (change description)
   - ✅ **Expected**: After save, same filter still applied

4. **ALL button clears filters**:
   - Apply multiple filters (type + country)
   - Click "ALL" button
   - ✅ **Expected**: All wines displayed
   - ✅ **Expected**: Previous filters cleared

5. **Navigation resets filters appropriately**:
   - Apply filters
   - Click hamburger menu → "Our Wines"
   - ✅ **Expected**: Shows wines with bottles > 0
   - ✅ **Expected**: Previous filters cleared, new bottleCount filter applied
   - Click hamburger menu → "All Wines"
   - ✅ **Expected**: Shows all wines including empty ones

---

**Test 4: Edge Cases**

1. **Add wine that doesn't match current filter**:
   - Filter by "White" wines
   - Add a new "Red" wine
   - ✅ **Expected**: Toast shows success
   - ✅ **Expected**: Wine NOT visible (doesn't match filter) - correct behavior
   - Click "ALL" button
   - ✅ **Expected**: New red wine visible

2. **Drink last bottle on "Our Wines" view**:
   - Filter to "Our Wines" (bottles > 0)
   - Find a wine with only 1 bottle
   - Drink that bottle
   - ✅ **Expected**: Wine disappears (no bottles left)
   - ✅ **Expected**: Scroll position maintained
   - ✅ **Expected**: No errors

3. **Rapid operations**:
   - Add a bottle, then immediately add another
   - ✅ **Expected**: Each shows toast, no conflicts
   - ✅ **Expected**: Final scroll position is to last wine modified

---

### Sprint 2 Success Criteria

- [x] Toast notifications appear for all success/error states
- [x] Toast auto-dismisses (3s success, 5s error)
- [x] Scroll-to-wine works after add/edit/add bottle
- [x] Highlight animation visible on target wine
- [x] Filters preserved after drink bottle
- [x] Filters preserved after add wine
- [x] Filters preserved after edit wine
- [x] ALL button clears filters
- [x] Navigation sets appropriate filters
- [x] No console errors during any operation
- [x] Error toasts preserve form data

**Files Added/Modified in Sprint 2**:
- NEW: `resources/js/ui/toast.js` - Toast notification system
- `resources/wineapp.css` - Toast styles + highlight animation
- `resources/js/ui/cards.js` - scrollToCard(), data-wine-id
- `resources/js/core/state.js` - targetWineID state, viewMode state
- `resources/js/features/wine-management.js` - Toast, scroll, filters
- `resources/js/features/rating.js` - Toast, scroll preservation
- `resources/js/app.js` - Filter save/restore, OURS/ALL/CLEAR buttons
- `resources/js/ui/dropdowns.js` - applyFilter() method
- `resources/sidebar.html` - Navigation filters
- `resources/header.html` - View mode indicator badge

---

## Testing WIN-92: View Mode Filtering (2026-01-12)

### What Was Implemented

The View Mode Filtering feature allows users to toggle between viewing "Our Wines" (wines with bottles > 0) and "All Wines" (all wines including empty ones) while preserving their active filters.

**Key Components**:
1. **View Mode State**: `viewMode` property in AppState ('ourWines' | 'allWines')
2. **Visual Badge**: Header shows current view mode with color coding
3. **OURS/ALL/CLEAR Buttons**: Quick toggle between views + filter reset
4. **Filter Active Indicators**: Red dots on dropdown buttons when filters are active
5. **Dynamic Filter Resolution**: Dropdown filters respect current view mode

---

### Test A: View Mode Buttons

**Test OURS Button**:
1. Open the app (defaults to "Our Wines" view)
2. Click the "OURS" button in the filter bar
3. ✅ **Expected**: Badge shows "Our Wines" (wine red color)
4. ✅ **Expected**: Only wines with bottles > 0 are displayed
5. ✅ **Expected**: Dropdown counts reflect wines with bottles

**Test ALL Button**:
1. Click the "ALL" button in the filter bar
2. ✅ **Expected**: Badge changes to "All Wines" (steel blue color)
3. ✅ **Expected**: All wines displayed including those with 0 bottles
4. ✅ **Expected**: Dropdown counts include all wines

**Test Button Toggle Behavior**:
1. Apply a filter (e.g., select "France" from countries dropdown)
2. Click "ALL" button
3. ✅ **Expected**: Still showing French wines, but now including those with 0 bottles
4. Click "OURS" button
5. ✅ **Expected**: Still showing French wines, but only those with bottles > 0
6. ✅ **Expected**: Filter is preserved when toggling views

---

### Test B: CLEAR Button

**Test Filter Reset**:
1. Apply multiple filters (e.g., country = France, type = Red)
2. Verify filtered results show
3. Click "CLEAR" button
4. ✅ **Expected**: All filters cleared
5. ✅ **Expected**: Current view mode preserved (still on OURS or ALL)
6. ✅ **Expected**: Filter indicator dots disappear from dropdown buttons

---

### Test C: Dropdown Filter Respects View Mode (CORE BUG FIX)

**The Original Bug**: Selecting a dropdown filter while on "Our Wines" view would show ALL wines.

**Test on "Our Wines" View**:
1. Click "OURS" button (or sidebar "Our Wines")
2. ✅ **Expected**: Badge shows "Our Wines"
3. Open COUNTRIES dropdown and select "France"
4. ✅ **Expected**: Shows ONLY French wines WITH bottles > 0
5. Open TYPES dropdown and select "Red"
6. ✅ **Expected**: Shows ONLY French Red wines WITH bottles > 0
7. ✅ **Expected**: Filter stacking works correctly

**Test on "All Wines" View**:
1. Click "ALL" button (or sidebar "All Wines")
2. ✅ **Expected**: Badge shows "All Wines"
3. Open COUNTRIES dropdown and select "France"
4. ✅ **Expected**: Shows ALL French wines INCLUDING those with 0 bottles
5. ✅ **Expected**: Wines with 0 bottles appear in results

---

### Test D: Filter Active Indicators

**Test Indicator Appearance**:
1. No filters active - verify no red dots on any dropdown buttons
2. Select a country from COUNTRIES dropdown
3. ✅ **Expected**: Red dot appears on COUNTRIES button
4. Select a type from TYPES dropdown
5. ✅ **Expected**: Red dot appears on TYPES button (COUNTRIES dot remains)
6. Click "CLEAR" button
7. ✅ **Expected**: All red dots disappear

**Visual Check**:
- Dots should be small (8px), wine-red colored, positioned at top-right of button
- Dots should have subtle shadow for visibility

---

### Test E: Dropdown Options Only Show Valid Entries

**The Issue**: On "All Wines" view, dropdowns showed countries/regions with 0 wines.

**Test**:
1. Click "ALL" button
2. Open any dropdown (COUNTRIES, TYPES, REGIONS, etc.)
3. ✅ **Expected**: All options have at least 1 wine (no "(0) Country" entries)
4. ✅ **Expected**: Selecting any option shows results (not blank page)

**Technical**: The `wineCount: '1'` parameter is passed to dropdown refresh calls.

---

### Test F: Sidebar Navigation Sync

**Test "Our Wines" Link**:
1. Apply filters (e.g., type = Red)
2. Open sidebar (hamburger menu)
3. Click "Our Wines"
4. ✅ **Expected**: Filters cleared
5. ✅ **Expected**: Badge shows "Our Wines"
6. ✅ **Expected**: Only wines with bottles > 0 displayed

**Test "All Wines" Link**:
1. Apply filters
2. Open sidebar
3. Click "All Wines"
4. ✅ **Expected**: Filters cleared
5. ✅ **Expected**: Badge shows "All Wines"
6. ✅ **Expected**: All wines including 0 bottles displayed

---

### Test G: Edge Cases

**Switching Views When No Results Would Show**:
1. Click "OURS" button
2. Apply a very specific filter that only matches wines with 0 bottles
3. ✅ **Expected**: Empty results (correct behavior)
4. Click "ALL" button
5. ✅ **Expected**: Matching wines now appear

**Rapid Button Clicking**:
1. Click OURS, then immediately ALL, then OURS again
2. ✅ **Expected**: Final state is correct (Our Wines)
3. ✅ **Expected**: No console errors, no race conditions

---

### WIN-92 Success Criteria

- [x] OURS button shows wines with bottles > 0
- [x] ALL button shows all wines including 0 bottles
- [x] CLEAR button resets filters while preserving view mode
- [x] Badge displays current view mode with correct color
- [x] Badge color: wine red (#722F37) for "Our Wines", steel blue (#4682B4) for "All Wines"
- [x] Dropdown filters respect current view mode (core bug fix)
- [x] Filter stacking works with view mode
- [x] OURS/ALL toggle preserves existing filters
- [x] Filter active indicators (red dots) appear on dropdown buttons
- [x] Filter indicators disappear when filters cleared
- [x] Dropdown options only show entries with wines (wineCount: '1')
- [x] Sidebar navigation syncs with view mode
- [x] No console errors during any operation

**Test Result**: ✅ ALL TESTS PASSED (2026-01-12)

---

## Sprint 3 Testing Guide (2026-01-13)

### Completed Issues

#### WIN-NEW: avgRating Column Overflow ✅
- **Fix**: `ALTER TABLE ratings MODIFY COLUMN avgRating DECIMAL(4,2);`
- **Test**: Rate a wine 10/10 (perfect score) - should save without SQL error

#### WIN-27: Right-Click Context Menu ✅
- **Fix**: Desktop right-click now shows custom context menu instead of browser menu

#### WIN-96: Card Collapse Scroll Behavior ✅
- **Fix**: Synchronized smooth scroll (200ms ease-out) with smart positioning logic
- **Key Change**: Added `smoothScrollTo()` function in [cards.js](resources/js/ui/cards.js) to match CSS transition timing

#### WIN-95: Picture Upload Enhancement ✅
- **Fix**: All uploads now produce consistent 800x800px square JPEGs
- **Key Features**:
  - Edge color sampling with dominant color algorithm
  - Transparent background detection (PNG/GIF/WebP) → white fill
  - White background detection → white fill
  - EXIF rotation preserved for mobile photos
- **Files**: [upload.php](resources/php/upload.php), [migrate_images.php](resources/php/migrate_images.php) (new)

### Testing WIN-27

**Test 1: Desktop Right-Click**
1. Open app in desktop browser
2. Right-click on any wine card
3. ✅ **Expected**: Custom context menu appears (Drink/Add/Edit)
4. ✅ **Expected**: Browser context menu does NOT appear

**Test 2: Drink With No Bottles**
1. Click "ALL" to show all wines including those with 0 bottles
2. Right-click on a wine with 0 bottles
3. Click "Drink Bottle"
4. ✅ **Expected**: Toast appears: "No bottles to drink! Add one first?"
5. ✅ **Expected**: Context menu and overlay close
6. ✅ **Expected**: No error, no modal opens

**Test 3: Drink With Bottles Works**
1. Right-click on a wine WITH bottles
2. Click "Drink Bottle"
3. ✅ **Expected**: Rating modal opens as normal

**Test 4: Add/Edit Always Work**
1. Right-click any wine card
2. Click "Add Bottle" → Add bottle modal opens
3. Click "Edit Bottle" → Edit modal opens

### Testing WIN-96: Card Collapse Scroll Behavior

**Test 1: Collapse with header visible**
1. Expand a wine card
2. Scroll so the card header is still visible (even partially)
3. Click to collapse
4. ✅ **Expected**: Smooth collapse, next card position preserved

**Test 2: Collapse with only content visible**
1. Expand a wine card
2. Scroll so only the expanded content area is visible (header above viewport)
3. Click to collapse
4. ✅ **Expected**: Smooth scroll brings collapsed card to top of viewport
5. ✅ **Expected**: Scroll and collapse animations finish simultaneously (200ms)

**Test 3: Collapse card far above viewport**
1. Expand a card, then scroll down several cards
2. Scroll back up and collapse a card that's mostly above viewport
3. ✅ **Expected**: Collapsed card scrolls smoothly to top

### Testing WIN-95: Picture Upload

**Test 1: Upload portrait image (tall wine bottle)**
1. Upload a tall wine bottle image (height > width)
2. ✅ **Expected**: Output is 800x800px square JPEG
3. ✅ **Expected**: Image centered with padding on left/right
4. ✅ **Expected**: Background matches dominant edge color

**Test 2: Upload landscape image**
1. Upload a wide image
2. ✅ **Expected**: Image centered with padding on top/bottom

**Test 3: Upload image with transparent background (PNG/WebP)**
1. Upload a PNG or WebP with transparent areas
2. ✅ **Expected**: Transparent areas filled with WHITE background
3. ✅ **Expected**: No black areas from transparency conversion

**Test 4: Upload image with white background**
1. Upload product image on white background
2. ✅ **Expected**: White padding matches seamlessly

**Test 5: Upload image with colored background**
1. Upload image with solid colored background (e.g., gray, beige)
2. ✅ **Expected**: Padding matches the dominant edge color

**Migration Script** (optional - for existing images):
```bash
php resources/php/migrate_images.php --dry-run  # Preview
php resources/php/migrate_images.php            # Execute
```

### Sprint 3 Success Criteria
- [x] WIN-NEW: avgRating DECIMAL(4,2) allows 10.00 rating
- [x] WIN-27: Desktop right-click shows custom context menu
- [x] WIN-27: Browser context menu blocked on wine cards
- [x] WIN-27: "Drink" with no bottles shows helpful toast
- [x] WIN-27: Context menu + overlay close properly
- [x] WIN-96: Collapse scroll synchronized with 200ms ease-out animation
- [x] WIN-96: Smart positioning based on card visibility and viewport
- [x] WIN-95: All uploads output 800x800px square JPEG
- [x] WIN-95: Transparent backgrounds convert to white
- [x] WIN-95: Edge-sampled background for colored images
- [x] No console errors during any operation

**Test Result**: ✅ ALL TESTS PASSED (2026-01-13)

---

## Development Workflow

### Starting a New Session

1. **Review this file** (CLAUDE.md) for context
2. **Check JIRA** for latest issue status
3. **Read the plan**: `C:\Users\Phil\.claude\plans\transient-doodling-parasol.md`
4. **Pick an issue** from current sprint
5. **Read relevant docs**:
   - [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - System design
   - [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - API reference
   - [docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md](docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md) - Phase 1 testing
   - [docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Sprint 1 bug fixes (2026-01-12)
   - Sprint 2 Testing Guide (in this file) - UX improvements (2026-01-12)

### Making Changes

1. **Read files first** - Never propose changes to unread code
2. **Follow existing patterns** - Maintain consistency
3. **Test thoroughly** - Run regression tests
4. **Update JIRA** - Mark issues as Done
5. **Document changes** - Update relevant docs if needed

### Before Committing

- [ ] All affected tests pass
- [ ] No console errors
- [ ] Mobile tested (if UI change)
- [ ] JIRA issue updated
- [ ] Documentation updated (if needed)

---

## Common Pitfalls to Avoid

### 1. Loading OLD wineapp.js
**Problem**: Causes conflicts with new modular system
**Solution**: Ensure lines 8 and 220 in index.html are commented out

### 2. Calling Wrong Modal Close Function
**Problem**: `ratingManager.closeModal()` after non-rating operations
**Solution**: Use `modalManager.hideAll()` for generic modal close

### 3. Not Parsing JSON in pushData
**Problem**: Returns string instead of object, breaks error handling
**Solution**: Always parse JSON before returning

### 4. Forgetting to Refresh Dropdowns
**Problem**: New wines don't appear in filters
**Solution**: Call `dropdownManager.refreshAllDropdowns()` after mutations

### 5. Not Using Transactions
**Problem**: Partial data on errors
**Solution**: Always use PDO `beginTransaction()`, `commit()`, `rollBack()`

### 6. Not Checking Element Existence
**Problem**: `ReferenceError` when element missing
**Solution**: Always check `if (element)` before accessing

---

## Sprint Execution Guide

### Sprint 0: Documentation ✅ COMPLETE
- [x] Create CLAUDE.md (this file)

### Sprint 1: Critical Bugs ✅ COMPLETE (2026-01-12)
**Goal**: Fix blocking bugs affecting core functionality

Issues:
- [x] WIN-93: closeModal wineToRate error → Already fixed in Phase 1 refactor
- [x] WIN-87: Response nesting → Fixed api.js:74-94 (JSON parsing)
- [x] WIN-66: SQL rollback → Verified all transaction files have proper rollback
- [x] WIN-86: Audit arrays → Fixed audit_log.php:22-27 (JSON serialization)

**Testing**: See Sprint 1 Testing Guide below

### Sprint 2: High Priority UX ✅ COMPLETE (2026-01-12)
**Goal**: Fix UX bugs and navigation issues

Issues:
- [x] WIN-90: Dropdown refresh → Toast, scroll, filter persistence
- [x] WIN-83: Modal state → Store/restore filters
- [x] WIN-94: Navigate to new wine → Scroll + highlight
- [x] WIN-XX: Button ID collision → Fixed finishBtn
- [x] WIN-92: View mode filtering → OURS/ALL/CLEAR buttons + indicators

**Testing**: See Sprint 2 Testing Guide and Testing WIN-92 sections above

### Sprint 3: Medium Priority Features (3-4 hours)
**Goal**: Implement UX improvements

Issues:
- [x] WIN-95: Picture upload → 800x800 square, edge-sampled background ✅
- [ ] WIN-88: Price scale → Calculate and display
- [ ] WIN-84: Purchase date → Add date picker
- [ ] WIN-38: Upload button UI → Success/error states
- [ ] WIN-43: Loading messages → Fun AI text
- [x] WIN-96: Card scroll → ✅ Fixed with synchronized smooth scroll animation
- [x] WIN-27: Right-click menu → ✅ Fixed (see Sprint 3 Testing Guide)

**Testing**: Test each feature individually

### Sprint 4: Architecture Review (2-3 hours)
**Goal**: Ensure solid foundation for future

Tasks:
- [ ] Code quality audit
- [ ] HTML/CSS structure review
- [ ] Database optimization check
- [ ] Security review
- [ ] Documentation updates

**Testing**: Full regression + performance check

---

## Documentation Organization

### Status: ✅ IMPLEMENTED (2026-01-12)
The `docs/` folder has been reorganized from a flat structure into a **7-folder hierarchy** to support project growth and maintainability.

### New Structure
```
docs/
├── README.md                  # Navigation hub
├── 01-overview/              # Architecture and high-level design
├── 02-development/           # Developer guides and module documentation
├── 03-testing/               # Testing guides and verification procedures
├── 04-sprints/               # Sprint execution reports and checklists
├── 05-issues/                # JIRA issue deep-dive investigations
└── 06-reference/             # Quick reference guides and meta-docs
```

**Benefits**:
- Scalable to 50+ documents without clutter
- Clear semantic grouping by purpose
- Sprint isolation for historical tracking
- Improved discoverability for new developers

**Implementation Date**: 2026-01-12
**Files Reorganized**: 11 documentation files moved + 1 sprint index created

For organizational guidelines, see [docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md](docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md)

---

## Qvé Rebrand - UI Design

### Status: ✅ COMPLETE (2026-01-13)

A complete UI mockup for rebranding the app as "Qvé" (from champagne's "cuvée").

### Design Philosophy

> "Quiet luxury - small grower champagne producers, not grand châteaux"
> "Penthouse, 60th floor, champagne and canapés with soft jazz"

### Features Implemented

- **Dual Theme System**: Light mode (morning tasting room) + Dark mode (penthouse evening)
- **Multi-View Density**: Compact grid (4-6 tiles) + Medium list (full cards)
- **Wine Cards**: Bottle indicators, ratings, expand/collapse animations
- **Responsive**: 2-6 columns based on screen width
- **Persistence**: Theme and view mode saved to localStorage

### Design Files

```
design/qve-rebrand/
├── README.md           # Overview and next steps
├── DESIGN_SYSTEM.md    # Colors, typography, spacing tokens
├── COMPONENTS.md       # UI component specifications
├── CHANGELOG.md        # Design iteration history
└── qve-mockup.html     # Live mockup (self-contained)
```

### How to View

1. Open [design/qve-rebrand/qve-mockup.html](design/qve-rebrand/qve-mockup.html) in browser
2. Toggle theme with sun/moon icon
3. Toggle view density with grid/list icons
4. Click cards to expand/collapse

### Integration Path → Qvé Migration Plan

**Status**: Full migration plan approved (2026-01-13)

Instead of incrementally updating the existing app, we're building a **new Svelte/SvelteKit PWA** at `/qve/` alongside the existing app.

**Plan Location**: `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`

**Key Decisions**:
- **Framework**: Svelte/SvelteKit with Melt UI or Bits UI (headless components)
- **Approach**: Parallel build - existing app stays working
- **PWA**: Installable, offline support for mobile
- **Backend**: Reuse existing PHP API unchanged
- **Timeline**: 17-24 days after Sprint 3 completion

**Phases**:
1. Phase 0: Create mockups for Add Wine and Drink/Rate flows
2. Phase 1: Initialize SvelteKit project, extract design tokens
3. Phase 2: API client, Svelte stores, PWA config
4. Phase 3: Build UI components
5. Phase 4: Implement page routes
6. Phase 5: Port advanced features (AI, scroll-to-wine)
7. Phase 6: Testing and polish
8. Phase 7: Deploy to `/qve/`

**Next Steps**:
1. Complete remaining Sprint 3 items
2. Create mockups for missing flows
3. Initialize SvelteKit project

---

## Resources

### Documentation
- **Architecture**: [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md)
- **Module API**: [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md)
- **Migration Guide**: [docs/02-development/MIGRATION_GUIDE.md](docs/02-development/MIGRATION_GUIDE.md)
- **Testing Guide**: [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md)
- **Verification Guide**: [docs/03-testing/VERIFICATION_GUIDE.md](docs/03-testing/VERIFICATION_GUIDE.md)
- **Sprint Index**: [docs/04-sprints/README.md](docs/04-sprints/README.md) - All sprint reports
- **Phase 1 Report**: [docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md](docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md)
- **Sprint 1 Summary**: [docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Critical bug fixes (2026-01-12)
- **📁 Documentation Organization**: [docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md](docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md) - Organizational guide
- **🌿 GitHub Setup Plan**: [docs/06-reference/GITHUB_SETUP_PLAN.md](docs/06-reference/GITHUB_SETUP_PLAN.md) - Complete branching strategy
- **🤝 Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md) - PR workflow and code style

### Design & Migration
- **Qvé Migration Plan**: `C:\Users\Phil\.claude\plans\recursive-petting-cat.md` - Full implementation plan
- **Qvé Rebrand Overview**: [design/qve-rebrand/README.md](design/qve-rebrand/README.md)
- **Design System Tokens**: [design/qve-rebrand/DESIGN_SYSTEM.md](design/qve-rebrand/DESIGN_SYSTEM.md)
- **Component Specs**: [design/qve-rebrand/COMPONENTS.md](design/qve-rebrand/COMPONENTS.md)
- **Design Changelog**: [design/qve-rebrand/CHANGELOG.md](design/qve-rebrand/CHANGELOG.md)
- **Live Mockup**: [design/qve-rebrand/qve-mockup.html](design/qve-rebrand/qve-mockup.html)

### External Links
- **JIRA Board**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **Database**: MySQL on 10.0.0.16 (database: `winelist`)
- **Google Gemini AI**: API key in [resources/js/features/ai-integration.js](resources/js/features/ai-integration.js)

### Quick Commands
```bash
# Search for function definition
grep -r "function functionName" resources/js/

# Find all TODOs in code
grep -r "TODO" resources/

# Count lines in modules
wc -l resources/js/**/*.js

# Check old wineapp.js status
grep -n "wineapp.js" index.html
```

---

## Contact & Support

**Developer**: Phil Humber
**Email**: phil.humber@gmail.com
**JIRA**: https://philhumber.atlassian.net

---

*This file serves as the single source of truth for spinning up new Claude sessions. Keep it updated as the project evolves.*
