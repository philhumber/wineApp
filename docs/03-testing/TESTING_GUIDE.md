# Testing & Validation Guide - Phase 1 Refactoring

**Document Version:** 1.0
**Date:** 2026-01-12
**Status:** Ready for Execution

---

## Overview

This guide provides a comprehensive testing approach to validate that the refactored modular architecture works identically to the original monolithic `wineapp.js` code. **All tests must pass before proceeding to Phase 2.**

---

## Testing Objective

**Goal:** Verify 100% functional equivalence between the new modular architecture and the original code.

**Success Criteria:**
- ✅ All 10 critical user workflows complete successfully
- ✅ Zero JavaScript console errors
- ✅ No functional regressions from original wineapp.js
- ✅ Backward compatibility maintained
- ✅ Mobile/touch interactions work correctly

---

## Pre-Testing Checklist

Before starting tests, verify:

- [ ] Both `resources/wineapp.js` (old) and `resources/js/app.js` (new) are loaded in [index.html](../index.html)
- [ ] Browser developer console is open (F12)
- [ ] Test data exists in database (wines, regions, producers)
- [ ] PHP backend is running (if using local server)
- [ ] Gemini API key is configured for AI tests

---

## Critical Testing Workflows

### Test 1: Initial Page Load & Initialization ⭐ CRITICAL

**What This Tests:** Module loading, initialization sequence, data fetching

**Steps:**
1. Open browser developer console (F12)
2. Navigate to `index.html` (or your app URL)
3. Monitor console during page load
4. Look for these console messages:
   - `🍷 Wine Collection App module loaded`
   - `🍷 Initializing Wine Collection App...`
   - `Loading page elements...`
   - `Setting up event listeners...`
   - `Loading initial data...`
   - `✅ Wine Collection App initialized successfully`

**Expected Results:**
- ✅ No JavaScript errors in console
- ✅ Sidebar loads on left with "Our Wines", "Drunk Wines", "Add Wine" links
- ✅ Header loads at top with hamburger menu and filter buttons
- ✅ Wine list displays in main content area
- ✅ Filter dropdowns (Country, Type, Region, Producer, Year) populate with data
- ✅ Wine cards show: name, producer, region, bottle count icons, country flag

**Failure Indicators:**
- ❌ Console errors: "Cannot find module" or "import error"
- ❌ Blank page or "Content Loading..." never replaced
- ❌ Missing sidebar or header
- ❌ Empty dropdowns

**Debug Commands:**
```javascript
// Check if app initialized
console.log(window.wineApp.initialized); // Should be true

// Check modules loaded
console.log(window.wineApp.modules); // Should show all 12 modules

// Check state
console.log(window.appState.wines); // Should show wine array
```

---

### Test 2: Navigation - Open/Close Sidebar ⭐ CRITICAL

**What This Tests:** `nav_open()`, `nav_close()`, overlay management, touch handlers

**Steps:**
1. Click hamburger menu icon (☰) in top-left header
2. Verify sidebar slides in from left
3. Verify dark overlay appears behind sidebar
4. Click overlay (dark background area)
5. Verify sidebar closes and slides out
6. Click hamburger again to reopen
7. Click "Our Wines" link in sidebar
8. Verify sidebar closes automatically after navigation

**Expected Results:**
- ✅ Sidebar animates smoothly (slide in/out transition)
- ✅ Overlay blocks interaction with content behind it
- ✅ Clicking overlay closes sidebar
- ✅ Clicking sidebar link navigates AND closes sidebar
- ✅ No console errors

**Mobile/Touch Testing:**
- Repeat test on mobile device or use browser dev tools mobile mode
- Verify touch gestures work correctly
- Verify sidebar doesn't go off-screen

**Debug Commands:**
```javascript
// Manually open sidebar
window.nav_open();

// Manually close sidebar
window.nav_close();
```

---

### Test 3: Filter Wines with Dropdowns ⭐ CRITICAL

**What This Tests:** `getWineData()`, `loadDropdown()`, dropdown positioning, cascading filters

**Steps:**
1. Click "Country" filter button in header
2. Verify dropdown opens below button with list of countries
3. Verify each country shows flag emoji and count: "(15) 🇫🇷 France"
4. Select a country (e.g., "France")
5. Verify wine list updates to show only French wines
6. Verify other dropdowns update (Region should now only show French regions)
7. Click "Region" dropdown
8. Select a region (e.g., "Bordeaux")
9. Verify wine list filters to French Bordeaux wines
10. Click "Type" dropdown
11. Select "Red"
12. Verify wine list shows only French Bordeaux Red wines
13. Refresh page to clear filters (or look for "Reset" button)

**Expected Results:**
- ✅ Each dropdown opens below/above button (smart positioning)
- ✅ Dropdowns show counts: "(15) France"
- ✅ Wine list updates immediately after each selection
- ✅ Cascading filters work (Country → Region → Type)
- ✅ No duplicate wines appear
- ✅ Bottle count icons reflect filtered results
- ✅ Empty states handled gracefully ("No wines found")

**Edge Cases to Test:**
- Test on small screen (dropdown should reposition if going off-screen)
- Scroll page while dropdown is open (should reposition correctly)
- Select filter with zero results

**Debug Commands:**
```javascript
// Check current filters
console.log(window.appState.filters);

// Manually load wines with filter
window.getWineData('./resources/php/getWines.php', { countryDropdown: 'France' });

// Refresh all dropdowns
window.refreshDropDowns({ bottleCount: '1' });
```

---

### Test 4: Add Wine Workflow - Complete Journey ⭐⭐ CRITICAL

**What This Tests:** Multi-step form, validation, AI integration, cascading selects, image upload

#### Part A: Navigate to Add Wine

1. Click hamburger menu
2. Click "Add Wine"
3. Verify add wine form loads in content area
4. Verify form shows 3 tabs/steps: **Region**, **Producer**, **Wine**
5. Verify you're on the Region tab (first tab active)

#### Part B: Region Selection/Creation

1. In "Find or add a region" search box, type partial name: **"Bord"**
2. Verify dropdown filters and shows matching regions (Bordeaux should appear)
3. To test region creation, type a new region name: **"TestRegion123"**
4. Verify "Tap here to add a new region" link appears at bottom
5. Click the "add a new region" link
6. Verify region details form expands below
7. Enter region details:
   - **Region Name:** TestRegion123
   - **Country:** Select from dropdown (e.g., France)
8. Click **"Get More Information About This Region"** button
9. Verify loading spinner/indicator appears
10. Wait 3-10 seconds for AI response
11. Verify these fields populate with AI-generated data:
    - Description (history, characteristics)
    - Climate (temperature, rainfall, seasons)
    - Soil (composition, terroir effects)
12. Verify textareas auto-grow to fit content
13. Click **"Next"** button to proceed to Producer tab

#### Part C: Producer Selection/Creation

1. Verify you're now on the Producer tab (tab 2 active)
2. In "Find or add a producer" search box, type: **"TestProducer456"**
3. Verify "Tap here to add a new producer" link appears
4. Click the "add a new producer" link
5. Enter producer name: **TestProducer456**
6. Select region from dropdown (should show TestRegion123 if just created)
7. Click **"Get More Information About This Producer"** button
8. Verify loading indicator appears
9. Wait for AI to generate:
   - Description (history, awards, notable vintages)
   - Ownership (select from: Family, Corporate, Cooperative, etc.)
   - Founded (year established)
   - Town (location)
10. Click **"Next"** to proceed to Wine tab

#### Part D: Wine Details & Submission

1. Verify you're now on the Wine tab (tab 3 active)
2. Enter wine details:
   - **Wine Name:** TestWine789
   - **Year:** 2020
   - **Wine Type:** Red (select from dropdown)
3. Click **"Get More Information About This Wine"** button
4. Wait for AI to generate:
   - Description (awards, highlights, serving temperature)
   - Tasting Notes (nose, palate, finish)
   - Food Pairing (recommended dishes)
5. **Optional - Upload Image:**
   - Click "Choose File" button
   - Select image file from computer
   - Click "Upload" button
   - Verify success message appears
   - Verify image preview shows
6. Complete bottle details:
   - **Bottle Size:** 750ml (select from dropdown)
   - **Storage Location:** TestCellar
   - **Source/Shop:** TestShop
   - **Purchase Price:** 50
   - **Currency:** USD (or GBP/EUR)
   - **Purchase Date:** Select today's date
7. Click **"Submit"** button at bottom
8. Confirm dialog appears: "Are you sure you want to add this wine?"
9. Click **OK** to confirm
10. Verify success message/page displays
11. Navigate back to wine list (click "Our Wines" in sidebar)
12. Verify TestWine789 appears in the main wine list
13. Click the wine card to expand
14. Verify all details saved correctly

**Expected Results:**
- ✅ Form tabs switch correctly (Region → Producer → Wine)
- ✅ Validation prevents proceeding with empty required fields
- ✅ "Next" button disabled until required fields filled
- ✅ AI data generation completes in 3-10 seconds per request
- ✅ AI-generated text is relevant and well-formatted
- ✅ All textareas auto-grow to fit content
- ✅ Image upload shows success message
- ✅ Wine successfully created in database
- ✅ Wine appears in list with all details intact
- ✅ No console errors throughout entire workflow

**Failure Indicators:**
- ❌ Form tabs don't switch when clicking Next/Previous
- ❌ AI button does nothing or times out (>15 seconds)
- ❌ Validation doesn't work (can submit empty form)
- ❌ Wine not created in database
- ❌ Wine doesn't appear in list after submission
- ❌ Console errors at any step

**Debug Commands:**
```javascript
// Check current tab
console.log(window.appState.currentTab); // Should be 0, 1, or 2

// Manually trigger AI generation
window.genWineData();
window.genProducerData();
window.genRegionData();

// Check form validation
console.log(window.validateForm(document.querySelector('.form-container')));
```

---

### Test 5: Drink Bottle & Rate Wine ⭐⭐ CRITICAL

**What This Tests:** Rating system, modal management, bottle tracking, data submission

**Steps:**
1. From wine list, find any wine card with bottles available
2. Click **"Drink Bottle"** button on the wine card
3. Verify rating modal opens as full-screen overlay
4. Verify modal shows:
   - Wine name and producer at top
   - Bottle selection dropdown (shows all available bottles for this wine)
   - Drink date field (defaulted to today)
   - Overall Rating (10 wine glass icons)
   - Value Rating (10 money bag icons)
   - Buy Again toggle (Yes/No)
   - Tasting notes textarea
5. Select a bottle from the dropdown
6. Verify bottle details show (size, location, vintage, etc.)
7. Set drink date (can use calendar picker or leave as today)
8. **Rate Overall Quality:**
   - Hover mouse over wine glass icons (1-10)
   - Verify icons highlight on hover (preview effect)
   - Click to select rating (e.g., click 8th icon for 8/10)
   - Verify selection stays highlighted
9. **Rate Value for Money:**
   - Hover over money bag icons (1-10)
   - Click to select rating (e.g., click 7th icon for 7/10)
   - Verify selection stays highlighted
10. Select **"Buy Again"**: Choose Yes or No
11. Enter tasting notes in textarea: "Full-bodied, great tannins, pairs well with steak"
12. Verify **"Lock Rating"** button is now enabled (after both ratings selected)
13. Click **"Lock Rating"** button
14. Verify confirmation dialog or auto-submit
15. Verify modal closes after submission
16. Verify wine list refreshes
17. Verify wine card now shows:
    - Updated bottle count (decremented by 1)
    - Average rating badge
18. Click hamburger menu → **"Drunk Wines"**
19. Verify TestWine789 appears in drunk wines list
20. Verify card shows your ratings (8/10 overall, 7/10 value)

**Expected Results:**
- ✅ Modal centers on screen with dark overlay
- ✅ Modal blocks scrolling on background page
- ✅ Rating icons highlight on hover (preview effect)
- ✅ Selected ratings stay highlighted after click
- ✅ Both ratings must be selected before "Lock Rating" enables
- ✅ Rating successfully submits to PHP backend
- ✅ Wine moves to "Drunk Wines" list
- ✅ Average rating calculates and displays correctly
- ✅ Modal closes cleanly without scroll issues
- ✅ No console errors

**Edge Cases:**
- Try clicking "Lock Rating" before rating both (should be disabled/show error)
- Click "Cancel" button mid-rating (should close modal without saving)
- Try rating same wine twice with different bottles

**Debug Commands:**
```javascript
// Check current ratings
window.wineApp.modules.ratingManager.getCurrentRatings();

// Manually open rating modal
window.drinkBottle(123); // Replace 123 with actual wineID
```

---

### Test 6: Add Bottle to Existing Wine

**What This Tests:** `addBottle()`, form submission, data persistence

**Steps:**
1. From wine list, click **"Add Bottle"** button on any wine card
2. Verify add bottle modal opens
3. Verify modal shows wine name at top
4. Enter bottle details:
   - **Bottle Size:** 1500ml (Magnum) - select from dropdown
   - **Storage Location:** Wine Fridge
   - **Source/Shop:** Local Wine Store
   - **Purchase Price:** 100
   - **Currency:** EUR
   - **Purchase Date:** Select today
5. Click **"Add"** or **"Submit"** button
6. Verify success message appears
7. Verify modal closes
8. Verify wine card updates immediately with new bottle count
9. Verify bottle count increments by 1
10. Verify bottle icon changes if large bottle (magnum icon may appear)

**Expected Results:**
- ✅ Modal opens correctly with pre-filled wine info
- ✅ All form fields accept input
- ✅ Submission succeeds without errors
- ✅ Bottle count increments visually
- ✅ Visual indicators update (icons change for magnum/large bottles)
- ✅ No console errors

---

### Test 7: Edit Wine Details

**What This Tests:** `editBottle()`, `editWine()`, data loading, update submission

**Steps:**
1. **On Desktop:** Right-click on any wine card
   **On Mobile:** Long-press (touch and hold) wine card for 500ms
2. Verify context menu appears next to cursor/touch point
3. Context menu should show options:
   - Edit Bottle
   - Edit Wine
   - Delete Wine (if implemented)
4. Click **"Edit Bottle"** option
5. Verify edit form loads in content area
6. Verify dropdown shows all existing bottles for this wine
7. Select a bottle from the dropdown
8. Verify bottle details populate in form:
   - Bottle size, storage location, source, price, currency, purchase date
9. Verify wine details are also shown/editable:
   - Wine name, year, type, description, tasting notes, pairing
10. Modify wine details:
    - Change description text
    - Update tasting notes
    - Modify food pairing suggestions
11. Click **"Submit"** button at bottom
12. Confirm dialog: "Are you sure you want to edit this wine?"
13. Click **OK** to confirm
14. Verify success message appears
15. Navigate back to wine list
16. Expand the wine card
17. Verify changes are saved and displayed
18. **Persistence Test:** Refresh page (F5)
19. Find wine again and expand card
20. Verify changes still persist after page reload

**Expected Results:**
- ✅ Context menu appears on right-click (desktop) or long-press (mobile)
- ✅ Context menu positions correctly near cursor/touch
- ✅ Edit form loads with all existing data pre-populated
- ✅ All fields are editable
- ✅ Changes save successfully to database
- ✅ Updated data displays immediately in wine list
- ✅ Changes persist after page refresh
- ✅ No console errors

---

### Test 8: Wine Card Expand/Collapse & Touch Gestures

**What This Tests:** Card rendering, touch handlers, context menus, animations

**Steps:**
1. Find any wine card in the list (collapsed state)
2. Click anywhere on the wine card (NOT on buttons)
3. Verify card expands with smooth animation
4. Verify expanded section shows:
   - Full wine description
   - Tasting notes (nose, palate, finish)
   - Food pairing recommendations
   - Bottle details table (size, location, source, price, date)
   - Action buttons at bottom (Drink Bottle, Add Bottle, Edit)
5. Verify page doesn't jump or scroll unexpectedly
6. Click the wine card again (anywhere except buttons)
7. Verify card collapses with smooth animation
8. Verify collapsed state shows only: name, producer, region, bottle count
9. **Mobile Only Tests:**
   - Switch to mobile device or enable mobile emulation in dev tools
   - Touch and hold wine card for 500ms
   - Verify context menu appears near touch point
   - Verify menu shows: Edit Bottle, Edit Wine options
   - Tap outside the menu (on overlay)
   - Verify menu closes
10. Test multiple cards:
    - Expand 3 different wine cards
    - Verify all expand correctly
    - Collapse them in random order
    - Verify animations work smoothly for all

**Expected Results:**
- ✅ Card expands smoothly with animation (no jerky movement)
- ✅ Expanded content doesn't cause page to jump or scroll
- ✅ All card content displays correctly when expanded
- ✅ Card collapse animation is smooth
- ✅ Touch gestures work on mobile (long-press for 500ms)
- ✅ Context menu positions correctly near touch point
- ✅ Context menu doesn't go off-screen
- ✅ Multiple cards can be expanded/collapsed independently
- ✅ No console errors

---

### Test 9: AI Data Generation for All Entity Types

**What This Tests:** Gemini AI integration, JSON parsing, error handling, async operations

#### Test 9A: Wine AI Generation

1. Navigate to Add Wine form (sidebar → Add Wine)
2. Go to **Wine tab** (click Wine or Next through previous tabs)
3. Enter wine name: **"Château Margaux"**
4. Enter year: **2015**
5. In producer search, select or enter: **"Château Margaux"**
6. Click **"Get More Information About This Wine"** button
7. Verify loading indicator shows (spinner or "Loading..." text)
8. Wait 3-10 seconds for AI response
9. Verify these fields populate with AI-generated content:
   - **Description:** Awards, highlights, serving temperature (2-3 sentences)
   - **Tasting Notes:** Nose and palate description (3-5 sentences)
   - **Food Pairing:** Recommended dishes and why (2-3 suggestions)
10. Verify text is relevant to Château Margaux 2015
11. Verify textareas auto-grow to fit content

#### Test 9B: Producer AI Generation

1. Go to **Producer tab**
2. Enter producer name: **"Domaine de la Romanée-Conti"**
3. Click **"Get More Information About This Producer"** button
4. Verify loading indicator appears
5. Wait for AI response (3-10 seconds)
6. Verify these fields populate:
   - **Description:** History, notable awards, famous vintages
   - **Ownership:** Should select appropriate type (Family, Corporate, Cooperative)
   - **Founded:** Year established (e.g., 1869)
   - **Town:** Location (e.g., Vosne-Romanée)
7. Verify information is factually accurate for DRC

#### Test 9C: Region AI Generation

1. Go to **Region tab**
2. Enter region name: **"Burgundy"**
3. Select country: **France**
4. Click **"Get More Information About This Region"** button
5. Verify loading indicator appears
6. Wait for AI response
7. Verify these fields populate:
   - **Description:** History, characteristics, notable wines, recommendations
   - **Climate:** Temperature ranges, rainfall, growing seasons
   - **Soil:** Composition (limestone, clay), terroir effects on wines
8. Verify information is accurate for Burgundy wine region

#### Error Handling Tests

1. Test with nonsense input:
   - Wine name: "asdfxyz123notarealwine"
   - Click "Get More Information"
   - Should return graceful error: "Wine cannot be found" or similar
2. Test with no internet connection:
   - Disconnect internet
   - Try AI generation
   - Should show error: "Network error" or "Unable to connect"
3. Test timeout (if API is slow):
   - Should timeout after 15-20 seconds with error message

**Expected Results:**
- ✅ AI requests complete in 3-10 seconds (average ~5 seconds)
- ✅ Loading indicator displays during request
- ✅ Generated text is relevant and informative
- ✅ Generated text is well-formatted (proper sentences, grammar)
- ✅ All expected fields populate (no missing fields)
- ✅ No "Error occurred" messages for valid inputs
- ✅ Textareas auto-grow to fit generated content
- ✅ Invalid inputs show graceful error messages
- ✅ Network errors are caught and displayed
- ✅ No console errors (except expected network errors when testing offline)

**Debug Commands:**
```javascript
// Manually trigger AI generation
window.genWineData(); // Current wine context
window.genProducerData(); // Current producer context
window.genRegionData(); // Current region context

// Check AI integration module
console.log(window.wineApp.modules.aiManager);
```

---

### Test 10: View Drunk Wines History

**What This Tests:** Alternative wine list view, rating display, filtering, historical data

**Steps:**
1. Click hamburger menu icon
2. Click **"Drunk Wines"** link in sidebar
3. Verify sidebar closes
4. Verify content area loads drunk wines list (not regular wine list)
5. Verify page title shows "Drunk Wines" or similar
6. For each wine card in drunk wines list, verify it shows:
   - Wine name at top
   - Producer and region below name
   - **Overall rating displayed prominently** (e.g., "8/10" with wine glass icon)
   - **Value rating** (e.g., "7/10" with money icon)
   - Drink date (e.g., "Drunk on: 12/01/2026")
   - "Buy Again" indicator/badge (if user marked Yes)
   - Tasting notes preview (first 100 characters)
7. Verify ratings are color-coded or visually distinct:
   - High ratings (8-10): Green or gold color
   - Medium ratings (5-7): Yellow or orange color
   - Low ratings (1-4): Red color
8. Test filtering (if available):
   - Filter by rating range (e.g., "Show 8+ rated wines")
   - Filter by date range
   - Filter by "Buy Again" status
9. Click a wine card to expand
10. Verify full tasting notes display
11. Click hamburger menu
12. Click **"Our Wines"** to return to main list
13. Verify you're back to the regular wine list (wines with bottles, not drunk wines)

**Expected Results:**
- ✅ Drunk wines load correctly in separate view
- ✅ All historical data displays accurately
- ✅ Ratings display prominently with proper icons
- ✅ Ratings are color-coded by score
- ✅ Drink dates show correctly formatted
- ✅ "Buy Again" indicator shows when applicable
- ✅ Tasting notes truncate with "..." if too long
- ✅ Navigation between "Our Wines" and "Drunk Wines" works smoothly
- ✅ Filtering works (if implemented)
- ✅ No console errors

---

## Browser & Device Testing Matrix

After completing all 10 critical tests above, repeat testing across different browsers and devices:

### Desktop Browsers

- [ ] **Chrome** (latest version) - Windows/Mac
- [ ] **Firefox** (latest version) - Windows/Mac
- [ ] **Edge** (latest version) - Windows
- [ ] **Safari** (latest version) - Mac

### Mobile Browsers

- [ ] **Chrome Mobile** - Android device or emulator
- [ ] **Safari Mobile** - iOS device or simulator
- [ ] **Firefox Mobile** - Android device

### Responsive Breakpoints

Test at these viewport sizes (use browser dev tools):

- [ ] **Desktop:** 1920x1080 (full HD)
- [ ] **Laptop:** 1366x768 (common laptop resolution)
- [ ] **Tablet Portrait:** 768x1024 (iPad portrait)
- [ ] **Tablet Landscape:** 1024x768 (iPad landscape)
- [ ] **Mobile:** 375x667 (iPhone SE / common phone size)

**What to Check at Each Breakpoint:**
- Layout doesn't break or overflow
- Dropdowns reposition correctly
- Modals center properly
- Touch targets are large enough (mobile)
- Text is readable without zooming

---

## Console Error Monitoring

**Throughout ALL tests, keep browser console open and monitor for these issues:**

### ❌ Critical Errors (Must Fix Before Continuing)

- `Uncaught ReferenceError: [function] is not defined`
  - Means a function wasn't exported globally
  - Check module exports at end of file
- `Uncaught TypeError: Cannot read property of undefined`
  - Usually a timing issue or missing data
  - Check async/await usage
- `Failed to load module`
  - Module path incorrect or file doesn't exist
  - Check import statements
- `Import/Export syntax errors`
  - Syntax error in ES6 module
  - Check for missing semicolons, brackets
- `Fetch failed` or `Network error`
  - PHP endpoint not responding
  - Check PHP backend is running
  - Check file paths are correct

### ⚠️ Warnings (Investigate, May Not Block)

- `Warning: [function] is deprecated`
  - Function still works but should be updated eventually
- `Element not found`
  - May be timing issue (element not loaded yet)
  - May indicate broken HTML template
- `Performance` warnings
  - App works but may be slow
  - Consider optimization later

### ✅ Expected Console Output (Good Messages)

When app loads successfully, you should see:

```
🍷 Wine App module loaded
🍷 Initializing Wine Collection App...
Loading page elements...
Setting up event listeners...
Loading initial data...
Loading dropdowns...
✅ Wine Collection App initialized successfully
```

---

## Testing Utilities & Debug Commands

### Check Module Loading

Open browser console and run:

```javascript
// Should return WineApp instance
console.log(window.wineApp);

// Should show all 12 module instances
console.log(window.wineApp.modules);

// Should return true
console.log(window.wineApp.initialized);
```

### Manually Trigger Functions

```javascript
// Navigation
window.nav_open();
window.nav_close();

// Data Loading
window.getWineData('./resources/php/getWines.php');
window.refreshDropDowns({ bottleCount: '1' });

// Check App State
console.log(window.appState.wines); // Array of wines
console.log(window.appState.filters); // Current filter settings

// AI Generation
window.genWineData();
window.genProducerData();
window.genRegionData();

// Rating
window.drinkBottle(123); // Replace 123 with actual wineID
```

### Test Individual Modules

```javascript
// Test API module
await window.wineApp.modules.api.getWines({ bottleCount: '1' });

// Test rating manager
window.wineApp.modules.ratingManager.getCurrentRatings();

// Test dropdown manager
await window.wineApp.modules.dropdownManager.refreshAll();

// Test state management
window.appState.setFilters({ countryDropdown: 'France' });
console.log(window.appState.getFilters());
```

---

## Post-Testing Actions

### If ALL Tests Pass ✅

**Congratulations! The refactoring is validated.**

1. **Document Results:**
   - Update [REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md) with test status
   - Mark all modules as "Tested: ✅"
   - Add date of successful testing

2. **Optional Cleanup:**
   - **Consider removing** old `resources/wineapp.js` (keep backup first!)
   - Comment out the old wineapp.js script tag in [index.html](../index.html)
   - Test again to ensure new modules work standalone
   - If issues, restore old wineapp.js immediately

3. **Proceed to Phase 2:**
   - Ready to implement Phase 2: AI Image Recognition
   - Ready to implement Phase 3: Recommendations Engine
   - Ready to implement Phase 4: Region/Producer Pages
   - Stable, modular foundation confirmed ✅

### If Any Tests Fail ❌

**Don't panic! Follow this debug process:**

1. **Document the Failure:**
   - Note which test number failed
   - Copy the exact console error message
   - Take screenshot if it's a visual issue
   - Note which browser/device it occurred on

2. **Initial Debug Steps:**
   - Check if function is exported globally:
     ```javascript
     console.log(typeof window.functionName); // Should NOT be "undefined"
     ```
   - Verify module imports in [app.js](../resources/js/app.js)
   - Check HTML inline event handlers match exported function names
   - Look for timing issues (async/await problems)

3. **Common Issues & Fixes:**

   **Issue:** "Function is not defined"
   - **Cause:** Function not exported globally
   - **Fix:** Add `window.functionName = functionName;` at end of module file

   **Issue:** "Cannot read property of null"
   - **Cause:** Element not found in DOM
   - **Fix:** Check element ID in HTML, ensure it exists

   **Issue:** "Module not found"
   - **Cause:** Import path incorrect
   - **Fix:** Check relative path in import statement

   **Issue:** Data doesn't load
   - **Cause:** PHP backend not responding
   - **Fix:** Ensure PHP server running, check endpoint paths

4. **Fix and Retest:**
   - Fix issues in specific module files
   - Refresh page (Ctrl+F5 / Cmd+Shift+R for hard refresh)
   - Rerun the failed test
   - Rerun adjacent tests to ensure no side effects

5. **If Stuck:**
   - Check [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) troubleshooting section
   - Review [MODULE_GUIDE.md](MODULE_GUIDE.md) for module API reference
   - Consider rolling back to original wineapp.js temporarily

---

## Risk Assessment

### High-Risk Areas (Test These First & Thoroughly)

1. **Navigation functions** - Used extensively throughout app
2. **Global function exports** - Required for HTML inline handlers
3. **Rating system** - Complex state management with multiple interactions
4. **AI integration** - External API, network errors, timeout handling
5. **Touch gestures** - Mobile-specific, device-dependent behavior

### Medium-Risk Areas

1. Form validation - Edge cases with empty/invalid inputs
2. Dropdown positioning - Can go off-screen on small viewports
3. Modal scroll prevention - Browser-specific behavior
4. Image upload - File handling, server communication
5. Data persistence - Database transactions

### Low-Risk Areas

1. Wine card rendering - Well-tested pattern, template-based
2. Utility functions - Pure functions, deterministic output
3. Router - Not actively used yet, prepared for future

---

## Success Metrics

### Quantitative Metrics

- ✅ **10/10 critical workflows pass** - All tests complete successfully
- ✅ **0 console errors** during testing - No JavaScript errors
- ✅ **4+ browsers tested** - Chrome, Firefox, Edge, Safari
- ✅ **2+ mobile devices tested** - iOS and Android

### Qualitative Metrics

- ✅ App "feels" identical to before refactoring
- ✅ No noticeable performance degradation
- ✅ No visual regressions (layout, styling)
- ✅ User workflows are smooth and intuitive
- ✅ Animations and transitions work smoothly

### Timeline Estimate

- **Phase 1 Testing:** 2-4 hours
  - Run all 10 critical tests: ~1.5 hours
  - Browser/device testing: ~1 hour
  - Documentation: ~0.5 hour

- **Bug Fixes (if needed):** 1-3 hours
  - Depends on number and severity of issues

- **Final Validation:** 1 hour
  - Retest failed tests
  - Final smoke test across all browsers

**Total Estimated Time:** 4-8 hours to complete full validation

---

## Quick Reference Checklist

Print this checklist and check off as you complete each test:

```
PHASE 1 REFACTORING TESTING CHECKLIST

Pre-Testing Setup:
[ ] Both old and new JS files loaded in index.html
[ ] Browser console open (F12)
[ ] Test data exists in database
[ ] PHP backend running

Critical Tests:
[ ] Test 1: Initial Page Load & Initialization
[ ] Test 2: Navigation - Open/Close Sidebar
[ ] Test 3: Filter Wines with Dropdowns
[ ] Test 4: Add Wine Workflow (Region/Producer/Wine)
[ ] Test 5: Drink Bottle & Rate Wine
[ ] Test 6: Add Bottle to Existing Wine
[ ] Test 7: Edit Wine Details
[ ] Test 8: Wine Card Expand/Collapse & Touch
[ ] Test 9: AI Data Generation (Wine/Producer/Region)
[ ] Test 10: View Drunk Wines History

Browser Testing:
[ ] Chrome (latest)
[ ] Firefox (latest)
[ ] Edge (latest)
[ ] Safari (latest)

Mobile Testing:
[ ] Chrome Mobile (Android)
[ ] Safari Mobile (iOS)

Responsive Testing:
[ ] Desktop (1920x1080)
[ ] Laptop (1366x768)
[ ] Tablet Portrait (768x1024)
[ ] Tablet Landscape (1024x768)
[ ] Mobile (375x667)

Post-Testing:
[ ] Document results in REFACTORING_PROGRESS.md
[ ] Update module status to "Tested: ✅"
[ ] Consider removing old wineapp.js (optional)
[ ] Ready to proceed to Phase 2 ✅
```

---

## Debugging Workflow - When Tests Fail

### How to Report Issues

When you encounter errors during testing, share this information:

**1. Which Test Failed**
- Test number (e.g., "Test 3: Filter Wines with Dropdowns")
- Specific step where it failed (e.g., "Step 5: Wine list didn't update")

**2. Console Errors (Critical)**
Copy the **complete error message** from browser console including:
- Error type (ReferenceError, TypeError, etc.)
- Error message
- File name and line number
- Stack trace (the lines below the error)

**Example:**
```
Uncaught ReferenceError: nav_open is not defined
    at HTMLButtonElement.onclick (index.html:45)
    at HTMLDocument.addEventListener (app.js:98)
```

**3. What You Expected vs. What Happened**
- "Expected sidebar to open, but nothing happened"
- "Expected wine list to filter, but shows all wines"

**4. Browser & Device Info**
- Browser: Chrome 120 on Windows 11
- Screen size: Desktop 1920x1080
- Mobile or Desktop mode

### Quick Copy Commands

Run these in console and copy the output:

```javascript
// Copy module status
copy(JSON.stringify({
  initialized: window.wineApp?.initialized,
  modules: Object.keys(window.wineApp?.modules || {}),
  wines: window.appState?.wines?.length,
  filters: window.appState?.filters
}, null, 2));

// Check for missing functions
const criticalFunctions = [
  'nav_open', 'nav_close', 'getWineData', 'refreshDropDowns',
  'drinkBottle', 'addBottle', 'genWineData', 'hidePopUps'
];
const missing = criticalFunctions.filter(fn => typeof window[fn] === 'undefined');
console.log('Missing functions:', missing);
```

### Debugging Session Template

When you paste errors, use this format:

```
TEST FAILED: Test #[number]
STEP: [which step]
BROWSER: [browser name and version]

CONSOLE ERROR:
[paste complete error here]

WHAT HAPPENED:
[describe what you saw]

WHAT I EXPECTED:
[describe what should have happened]

MODULE STATUS:
[paste output from copy command above]
```

### Example Debugging Report

```
TEST FAILED: Test #2
STEP: Step 1 - Clicking hamburger menu
BROWSER: Chrome 120.0.6099.109 on Windows 11

CONSOLE ERROR:
Uncaught ReferenceError: nav_open is not defined
    at HTMLButtonElement.onclick (sidebar.html:12:35)
    at HTMLButtonElement.dispatch (jquery-3.6.0.min.js:2)

WHAT HAPPENED:
Clicked hamburger menu icon, nothing happened. Console shows error.

WHAT I EXPECTED:
Sidebar should slide in from left with overlay.

MODULE STATUS:
{
  "initialized": true,
  "modules": ["api", "state", "router", "modalManager", "cardRenderer", ...],
  "wines": 42,
  "filters": {}
}
```

### Where to Report

You can:
1. **Paste here in chat** - I'll diagnose and provide fixes
2. **Create a testing log file** - I can help create `docs/TESTING_LOG.md`
3. **Screenshot visual issues** - For layout/styling problems

### What I'll Do

When you report an error, I will:
1. ✅ Identify the root cause
2. ✅ Explain why it's happening
3. ✅ Provide the exact fix (file path, code change)
4. ✅ Tell you how to verify the fix worked
5. ✅ Update documentation if needed

### Common Issues - Quick Fixes

**"Function is not defined"**
```javascript
// Check if it exists in module but not globally
console.log(window.wineApp.modules.navigationManager.open); // exists?
console.log(window.nav_open); // undefined?
```
→ I'll add the global export

**"Cannot read property of null"**
```javascript
// Find the element
console.log(document.getElementById('elementID')); // null?
```
→ I'll fix the element ID or ensure it loads

**"Module failed to load"**
```javascript
// Check network tab in dev tools for 404 errors
```
→ I'll fix the import path

---

## Additional Resources

- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Migration phases and troubleshooting
- [MODULE_GUIDE.md](MODULE_GUIDE.md) - Complete API reference for all modules
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and data flow
- [REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md) - Detailed session logs

---

## Ready to Start Testing?

1. **Open your app** in browser with console open (F12)
2. **Start with Test 1** - Initial Page Load
3. **If anything fails** - Copy the error and paste it here
4. **I'll help debug** and get you back on track
5. **Continue through all 10 tests**

**Remember:** The goal is 100% functional equivalence. Report issues as you find them, and we'll fix them together!

**Good luck with testing! 🍷**
