# Module Guide - Detailed API Reference

This document provides detailed API documentation for each JavaScript module in the refactored wine collection app.

**Last Updated:** 2026-01-11

---

## Core Modules

### `core/api.js` - API Communication Layer

**Status:** ✅ Complete

**Purpose:** Centralize all backend communication with PHP endpoints.

#### Class: `WineAPI`

**Constructor:**
```javascript
const api = new WineAPI(baseURL = './resources/php/');
```

**Parameters:**
- `baseURL` (string, optional) - Base URL for PHP endpoints. Default: `'./resources/php/'`

---

#### Methods

##### `fetchJSON(endpoint, filterData)`

Generic method for GET/POST JSON requests.

**Parameters:**
- `endpoint` (string) - Full or relative endpoint URL
- `filterData` (object|null) - Optional data for POST requests

**Returns:** `Promise<object>` - Response with `{success, message, data}`

**Example:**
```javascript
const response = await wineAPI.fetchJSON('./resources/php/getWines.php', {
  bottleCount: '1',
  countryDropdown: 'France'
});

if (response.success) {
  console.log(response.data.wineList);
}
```

---

##### `pushData(endpoint, data)`

Generic method for POST requests (JSON or file upload).

**Parameters:**
- `endpoint` (string) - API endpoint
- `data` (object|string) - Data to send. Use `"winePictureUpload"` for file uploads

**Returns:** `Promise<object>` - `{success, data, message}`

**Example - JSON:**
```javascript
const result = await wineAPI.pushData('./resources/php/addWine.php', {
  wineName: 'Château Margaux',
  year: 2015,
  // ... other fields
});
```

**Example - File Upload:**
```javascript
const result = await wineAPI.pushData('./resources/php/upload.php', "winePictureUpload");
```

---

##### Wine Data Methods

**`getWines(filterData)`**

Get wine list with optional filtering.

**Parameters:**
```javascript
filterData = {
  bottleCount: '0' | '1',          // 0 = all wines, 1 = wines with bottles
  typesDropdown: 'Red' | 'White' | ...,
  countryDropdown: 'France' | ...,
  regionDropdown: 'Bordeaux' | ...,
  producerDropdown: 'Château Margaux' | ...,
  yearDropdown: '2015' | ...
}
```

**Returns:** `Promise<object>` with wine list

**Example:**
```javascript
const wines = await wineAPI.getWines({ bottleCount: '1', countryDropdown: 'France' });
```

---

**`getDrunkWines(filterData)`**

Get list of consumed bottles with ratings.

**Returns:** `Promise<object>` with drunk wine list

---

##### Reference Data Methods

All return lists for dropdown population:

**`getCountries(filterData)`** - List of countries with wine counts

**`getTypes(filterData)`** - List of wine types (Red, White, etc.)

**`getRegions(filterData)`** - List of wine regions

**`getProducers(filterData)`** - List of producers

**`getYears(filterData)`** - List of vintage years

**Example:**
```javascript
const countries = await wineAPI.getCountries();
// Response: { success: true, data: { wineList: [...] } }
```

---

##### Bottle Methods

**`getBottles(data)`**

Get all bottles for a specific wine.

**Parameters:**
```javascript
data = { wineID: 123 }
```

**Returns:** `Promise<object>` with bottle list

---

##### Wine Management Methods

**`addWine(wineData)`**

Add a new wine (includes region, producer, wine, bottle).

**Parameters:**
```javascript
wineData = {
  // Region
  regionSearch: 'Bordeaux',
  regionDescription: '...',
  climate: '...',
  // ... (full structure in addWine.html form)
}
```

**Returns:** `Promise<object>`

---

**`updateWine(wineData)`**

Update wine details.

**Parameters:**
```javascript
wineData = {
  wineID: 123,
  wineName: 'New Name',
  description: '...',
  // ... other wine fields
}
```

---

**`updateBottle(bottleData)`**

Update bottle details.

**Parameters:**
```javascript
bottleData = {
  bottleID: 456,
  location: 'Wine Cellar',
  price: 150,
  // ... other bottle fields
}
```

---

##### Rating Methods

**`drinkBottle(ratingData)`**

Record drinking a bottle with rating.

**Parameters:**
```javascript
ratingData = {
  bottleID: 456,
  wineID: 123,
  overallRating: 9,
  valueRating: 8,
  drinkDate: '2026-01-11',
  buyAgain: 1,
  Notes: 'Excellent wine...'
}
```

**Returns:** `Promise<object>`

---

##### File Upload

**`uploadImage()`**

Upload wine picture from file input with id `fileToUpload`.

**Returns:** `Promise<object>`

**Side Effect:** Sets `#winePicture` input value to filename

---

##### AI Integration

**`callGeminiAI(type, prompt)`**

Call Google Gemini API for data generation.

**Parameters:**
- `type` (string) - `'region'` | `'producer'` | `'wine'`
- `prompt` (string) - Prompt for AI

**Returns:** `Promise<object>` with AI-generated data

**Example:**
```javascript
const aiData = await wineAPI.callGeminiAI('wine', 'Château Margaux 2015');
```

---

#### Global Instance

```javascript
window.wineAPI  // Global instance, pre-instantiated
```

#### Backward Compatibility

Standalone functions exported for legacy code:

```javascript
import { fetchJSON, pushData } from './core/api.js';

await fetchJSON('./resources/php/getWines.php');
await pushData('./resources/php/addWine.php', data);
```

---

## `core/state.js` - State Management

**Status:** ✅ Complete

**Purpose:** Centralized state management with observable pattern.

#### Class: `AppState`

**Constructor:**
```javascript
const state = new AppState();
```

---

#### State Properties

```javascript
{
  // Form navigation
  currentTab: 0,              // Current form tab (0-based)

  // Rating state
  currentOverall: 0,          // Current overall rating (0-10)
  currentValue: 0,            // Current value rating (0-10)
  preview: 0,                 // Preview rating on hover
  locked: false,              // Rating locked/submitted

  // Edit cache
  editCache: {},              // Cached data for edit form
  addORedit: '',              // 'add' | 'edit' mode

  // Long-press detection
  timer: false,               // Timer for long-press
  duration: 700,              // Long-press duration (ms)

  // Wine data
  wines: [],                  // Current wine list
  filters: {},                // Active filter criteria

  // Navigation
  currentView: 'wines',       // Current route/view

  // Observers
  listeners: []               // State change listeners
}
```

---

#### Methods

##### `setState(updates)`

Update state and notify all listeners.

**Parameters:**
- `updates` (object) - Properties to update

**Example:**
```javascript
appState.setState({
  currentTab: 1,
  wines: newWineList
});
```

---

##### `subscribe(listener)`

Subscribe to state changes.

**Parameters:**
- `listener` (function) - Callback function `(state) => {}`

**Returns:** Unsubscribe function

**Example:**
```javascript
const unsubscribe = appState.subscribe((state) => {
  console.log('Wines updated:', state.wines.length);
});

// Later...
unsubscribe();  // Stop listening
```

---

##### `notify()`

Notify all listeners of state change (called automatically by `setState`).

---

##### `resetFormState()`

Reset form-related state to defaults.

**Example:**
```javascript
appState.resetFormState();
// currentTab = 0, editCache = {}, addORedit = ''
```

---

##### `resetRatingState()`

Reset rating-related state.

**Example:**
```javascript
appState.resetRatingState();
// currentOverall = 0, currentValue = 0, preview = 0, locked = false
```

---

##### `setFilters(filterUpdates)`

Update filters and notify listeners.

**Parameters:**
```javascript
filterUpdates = {
  countryDropdown: 'France',
  typesDropdown: 'Red'
}
```

**Example:**
```javascript
appState.setFilters({ countryDropdown: 'France' });
```

---

##### `clearFilters()`

Clear all filters.

---

##### `setWines(wines)`

Update wine list and notify.

**Parameters:**
- `wines` (array) - Array of wine objects

---

#### Global Instance

```javascript
window.appState  // Global instance
```

#### Backward Compatible Exports

Legacy global variables also exported:

```javascript
import {
  currentTab,
  setCurrentTab,
  currentOverall,
  setCurrentOverall,
  // ... etc
} from './core/state.js';
```

---

## `core/router.js` - Hash-Based Routing

**Status:** ✅ Complete (Future-ready)

**Purpose:** Enable SPA navigation without server requests.

#### Class: `Router`

**Constructor:**
```javascript
const router = new Router();
```

Automatically initializes and listens to hash changes.

---

#### Methods

##### `register(path, handler)`

Register a route handler.

**Parameters:**
- `path` (string) - Route pattern (e.g., `'wines'`, `'region/:name'`)
- `handler` (function) - Handler function `async (params) => {}`

**Example:**
```javascript
router.register('wines', async (params) => {
  await loadWineList(params);
});

router.register('region/:name', async (params) => {
  await loadRegionPage(params.name);
});
```

---

##### `navigate(path, params)`

Navigate to a route programmatically.

**Parameters:**
- `path` (string) - Route path
- `params` (object, optional) - Query parameters

**Example:**
```javascript
router.navigate('wines');
router.navigate('region/Bordeaux');
router.navigate('wines', { filter: 'red' });  // #wines?filter=red
```

---

##### `parseHash()`

Parse current URL hash.

**Returns:** `{ path, params }`

**Example:**
```javascript
// URL: #wines?filter=red&country=France
const { path, params } = router.parseHash();
// path = 'wines'
// params = { filter: 'red', country: 'France' }
```

---

##### `matchRoute(path)`

Match path to registered route.

**Returns:** `{ handler, params }` or `null`

---

##### `getCurrentRoute()`

Get current route path.

**Returns:** `string`

---

##### `back()`

Go back to previous page.

**Example:**
```javascript
router.back();  // Same as browser back button
```

---

#### Pattern Matching

Supports dynamic segments with `:paramName`:

```javascript
router.register('region/:name', async ({ name }) => {
  console.log('Region:', name);
});

// Navigate to #region/Bordeaux
// Handler called with params = { name: 'Bordeaux' }
```

---

#### Global Instance

```javascript
window.router  // Global instance
```

---

## `ui/modals.js` - Modal & Overlay Management

**Status:** ✅ Complete

**Purpose:** Manage modal display and scroll prevention.

#### Functions

##### `showOverlay()`

Show dimmed background overlay.

**Side Effects:**
- Displays `#myOverlay` element
- Adds fade-in animation
- Disables page scrolling

**Example:**
```javascript
import { showOverlay } from './ui/modals.js';
showOverlay();
```

---

##### `hideOverlay()`

Hide background overlay.

**Side Effects:**
- Fade-out animation (300ms)
- Hides `#myOverlay`
- Re-enables scrolling

---

##### `disableScroll()`

Prevent page scrolling (for modals).

**Supports:**
- Mouse wheel
- Touch events
- Keyboard arrows
- Cross-browser compatible

---

##### `enableScroll()`

Re-enable page scrolling.

---

#### Class: `ModalManager`

Advanced modal management with stacking.

**Constructor:**
```javascript
const manager = new ModalManager();
```

---

##### `show(modal, showOverlayBg)`

Show a modal.

**Parameters:**
- `modal` (string|HTMLElement) - Modal ID or element
- `showOverlayBg` (boolean) - Show background overlay (default: true)

**Example:**
```javascript
modalManager.show('ratingModal');
modalManager.show(document.getElementById('myModal'), false);
```

---

##### `hide(modal, hideOverlayBg)`

Hide a modal.

**Parameters:**
- `modal` (string|HTMLElement)
- `hideOverlayBg` (boolean) - Hide overlay if last modal (default: true)

---

##### `hideAll()`

Hide all active modals and overlay.

---

##### `hasActiveModals()`

Check if any modals are active.

**Returns:** `boolean`

---

#### Global Instance & Functions

```javascript
window.modalManager   // ModalManager instance
window.showOverlay    // Function
window.hideOverlay    // Function
window.disableScroll  // Function
window.enableScroll   // Function
```

---

## UI Modules

### `ui/cards.js` - Wine Card Rendering

**Status:** ✅ Complete

**Purpose:** Template-based wine card rendering and display.

#### Class: `WineCardRenderer`

**Constructor:**
```javascript
const renderer = new WineCardRenderer();
```

---

##### `render(elementId, wineData, isDrunkList)`

Render wine list into container element.

**Parameters:**
- `elementId` (string) - Container element ID
- `wineData` (Array) - Array of wine objects
- `isDrunkList` (boolean) - Whether this is drunk wines list (default: false)

**Example:**
```javascript
const wines = await wineAPI.getWines({ bottleCount: '1' });
await wineCardRenderer.render('contentArea', wines.data.wineList);
```

---

##### `createWineCard(template, wineItem, isDrunkList)`

Create a single wine card from template.

**Returns:** `DocumentFragment` - Cloned and populated card

---

##### `initializeCardToggles()`

Initialize expand/collapse functionality for all wine cards.

**Called automatically** after rendering.

---

##### `clearCache()`

Clear cached templates (useful when updating template files).

---

#### Global Instance & Functions

```javascript
window.wineCardRenderer              // WineCardRenderer instance
window.loadWineCardTemplate()        // Legacy function
window.initializeWineCardToggles()   // Legacy function
```

**Legacy Usage:**
```javascript
// Old way (still works)
await loadWineCardTemplate('contentArea', wines, null);

// New way (preferred)
await wineCardRenderer.render('contentArea', wines);
```

---

### `ui/forms.js` - Form Navigation & Validation

**Status:** ✅ Complete

**Purpose:** Multi-step form navigation, validation, and submission.

#### Class: `FormManager`

**Constructor:**
```javascript
const manager = new FormManager();
```

---

##### `showTab(n)`

Display specified tab of multi-step form.

**Parameters:**
- `n` (number) - Tab index to show (0-based)

**Side Effects:**
- Updates prev/next button visibility
- Updates button text ("Next" vs "Submit")
- Updates step indicator

---

##### `nextPrev(n)`

Navigate to next or previous tab.

**Parameters:**
- `n` (number) - Direction: `1` for next, `-1` for previous

**Returns:** `boolean` - Success status

**Behavior:**
- Validates form before moving forward
- Allows going back without validation
- Triggers submission at end of form

**Example:**
```javascript
// Next button
formManager.nextPrev(1);

// Previous button
formManager.nextPrev(-1);
```

---

##### `validateForm()`

Validate current form tab.

**Returns:** `boolean` - True if valid, false otherwise

**Validation Rules:**
- `data-validatetype="text"` - Required, cannot be empty
- `data-validatetype="year"` - Optional, but if provided must be 1000-2100
- `data-validatetype="date"` - Date validation

**Visual Feedback:**
- Sets `valid="invalid"` attribute on invalid fields
- CSS can style `[valid="invalid"]` with red border

---

##### `setMode(mode)`

Set form mode (add or edit).

**Parameters:**
- `mode` (string) - `'add'` or `'edit'`

**Example:**
```javascript
formManager.setMode('add');
formManager.showTab(0);
```

---

##### `reset()`

Reset form to first tab and clear mode.

---

#### Global Instance & Functions

```javascript
window.formManager      // FormManager instance
window.showTab()        // Legacy function
window.nextPrev()       // Legacy function
window.validateForm()   // Legacy function
```

---

### `ui/dropdowns.js` - Filter Dropdown Population

**Status:** ✅ Complete

**Purpose:** Load and populate filter dropdowns for countries, regions, types, etc.

#### Class: `DropdownManager`

**Constructor:**
```javascript
const manager = new DropdownManager(api);
```

**Parameters:**
- `api` (WineAPI, optional) - API instance (uses global if not provided)

---

##### `loadDropdown(endpoint, elementId, filterData)`

Load and populate a single dropdown.

**Parameters:**
- `endpoint` (string) - API endpoint
- `elementId` (string) - Dropdown element ID
- `filterData` (object, optional) - Filter criteria

**Example:**
```javascript
await dropdownManager.loadDropdown(
  './resources/php/getCountries.php',
  'countryDropdown'
);
```

---

##### `refreshAll(filterData)`

Refresh all filter dropdowns in parallel.

**Parameters:**
- `filterData` (object, optional) - Filter to apply to all dropdowns

**Dropdowns Refreshed:**
- Countries (`countryDropdown`)
- Wine Types (`typesDropdown`)
- Regions (`regionDropdown`)
- Producers (`producerDropdown`)
- Years (`yearDropdown`)

**Example:**
```javascript
await dropdownManager.refreshAll();
```

---

##### `loadByType(type, filterData)`

Load specific dropdown by type name.

**Parameters:**
- `type` (string) - `'country'`, `'type'`, `'region'`, `'producer'`, or `'year'`
- `filterData` (object, optional)

**Example:**
```javascript
await dropdownManager.loadByType('country');
```

---

##### `clearAll()`

Clear all filter dropdown content.

---

#### Global Instance & Functions

```javascript
window.dropdownManager       // DropdownManager instance
window.loadDropdown()        // Legacy function
window.refreshDropDowns()    // Legacy function
```

---

### `ui/navigation.js` - Sidebar & Navigation

**Status:** ✅ Complete

**Purpose:** Manage sidebar navigation and content area.

#### Class: `NavigationManager`

**Constructor:**
```javascript
const manager = new NavigationManager();
```

---

##### `open()`

Open sidebar navigation with animation.

**Side Effects:**
- Shows sidebar with slide-in animation
- Shows overlay to dim background

---

##### `close()`

Close sidebar navigation with animation.

**Side Effects:**
- Hides sidebar with slide-out animation
- Hides overlay
- 300ms animation duration

---

##### `toggle()`

Toggle sidebar open/close state.

---

##### `clearContentArea(newContent)`

Clear content area and optionally load new HTML.

**Parameters:**
- `newContent` (string, optional) - HTML file path to load

**Example:**
```javascript
// Just clear
await navigationManager.clearContentArea();

// Clear and load new content
await navigationManager.clearContentArea('./addwine.html');
```

---

##### `loadHTMLContent(endpoint, elementId, append)`

Load HTML content into element.

**Parameters:**
- `endpoint` (string) - HTML file path
- `elementId` (string) - Target element ID
- `append` (boolean) - Append (true) or replace (false), default: false

**Example:**
```javascript
await navigationManager.loadHTMLContent('./header.html', 'headerArea');
```

---

##### `navigateTo(view)`

Navigate to specific view/page.

**Parameters:**
- `view` (string) - View name

**Supported Views:**
- `'wines'` - Wine list (bottles >= 1)
- `'all-wines'` - All wines (including empty)
- `'drunk-wines'` - Drunk wines history
- `'add-wine'` - Add wine form

**Example:**
```javascript
navigationManager.navigateTo('wines');
```

---

#### Global Instance & Functions

```javascript
window.navigationManager      // NavigationManager instance
window.nav_open()             // Legacy function
window.nav_close()            // Legacy function
window.clearContentArea()     // Legacy function
window.loadHTMLContent()      // Legacy function
```

---

## Modules To Be Documented (TODO)

### Feature Modules
- `features/rating.js` - Rating system
- `features/wine-management.js` - Add/edit wine workflows
- `features/bottle-tracking.js` - Drink/add bottle functionality
- `features/ai-integration.js` - Gemini AI integration

### Feature Modules
- `features/rating.js` - Rating system
- `features/wine-management.js` - Add/edit wine workflows
- `features/bottle-tracking.js` - Drink/add bottle functionality
- `features/ai-integration.js` - Gemini AI integration

### Utility Modules
- `utils/dom-helpers.js` - DOM manipulation utilities
- `utils/validation.js` - Form validation
- `utils/helpers.js` - General utilities

### Main App
- `app.js` - Application initialization

---

## Usage Examples

### Complete Wine Loading Flow

```javascript
import { wineAPI } from './core/api.js';
import { appState } from './core/state.js';

// Set filters
appState.setFilters({
  bottleCount: '1',
  countryDropdown: 'France'
});

// Fetch wines
const response = await wineAPI.getWines(appState.filters);

if (response.success) {
  // Update state
  appState.setWines(response.data.wineList);

  // Render (when cards.js is complete)
  // wineCardRenderer.render(appState.wines);
}
```

### Modal Flow

```javascript
import { modalManager } from './ui/modals.js';

// Show rating modal
modalManager.show('starOverlay');

// User submits rating...

// Hide modal
modalManager.hide('starOverlay');
```

### Future: Routing

```javascript
import { router } from './core/router.js';

// Register routes
router.register('region/:name', async ({ name }) => {
  const regionData = await wineAPI.getRegionDetails({ regionName: name });
  renderRegionPage(regionData);
});

// Navigate
router.navigate('region/Bordeaux');
```

---

## Feature Modules

### `features/rating.js` - Wine Rating System

**Status:** ✅ Complete

**Purpose:** Manage wine rating functionality with 10-star rating system for overall and value ratings.

#### Class: `RatingManager`

**Constructor:**
```javascript
const ratingManager = new RatingManager();
```

---

#### Methods

##### `createRating(index, icon)`

Create a rating button with event handlers.

**Parameters:**
- `index` (number) - Button value (1-10)
- `icon` (string) - Icon type ('Overall' or 'Value')

**Returns:** `HTMLButtonElement` - Configured rating button

**Example:**
```javascript
for (let i = 1; i <= 10; i++) {
  const btn = ratingManager.createRating(i, 'Overall');
  ratingRow.appendChild(btn);
}
```

---

##### `render(ratingRow)`

Render rating row according to current/preview/locked state.

**Parameters:**
- `ratingRow` (HTMLElement) - Rating row element to render

---

##### `select(value, ratingRow)`

Commit rating selection.

**Parameters:**
- `value` (number) - Selected rating value (1-10)
- `ratingRow` (HTMLElement) - Rating row element

---

##### `lockRating()`

Lock the rating and submit to backend.

**Returns:** `Promise<void>`

**Example:**
```javascript
await ratingManager.lockRating();
```

---

##### `closeModal()`

Close rating modal and reset state.

---

##### `initializeRatingRow(ratingType, containerId, maxRating = 10)`

Initialize rating row with buttons.

**Parameters:**
- `ratingType` (string) - 'Overall' or 'Value'
- `containerId` (string) - Container element ID
- `maxRating` (number, optional) - Maximum rating value (default 10)

**Example:**
```javascript
ratingManager.initializeRatingRow('Overall', 'ratingRowOverall', 10);
ratingManager.initializeRatingRow('Value', 'ratingRowValue', 10);
```

---

##### Legacy Functions

For backward compatibility, the following global functions are available:
- `createRating(index, icon)`
- `render(ratingRow)`
- `select(value, ratingRow)`
- `lockRating()`
- `closeModal()`
- `focusStar(value)`

---

### `features/wine-management.js` - Wine CRUD Operations

**Status:** ✅ Complete

**Purpose:** Handle adding, editing, and managing wine workflows.

#### Class: `WineManagementManager`

**Constructor:**
```javascript
const wineManager = new WineManagementManager();
```

---

#### Methods

##### `loadAddWinePage()`

Load the add wine page with initial data.

**Returns:** `Promise<void>`

---

##### `loadEditWinePage()`

Load the edit wine page.

**Returns:** `Promise<void>`

---

##### `populateAddWineList(listToUpdate, filterData)`

Populate cascading add wine list (region → producer → wine).

**Parameters:**
- `listToUpdate` (string) - List ID to update ('regionList' or 'producerList')
- `filterData` (string) - Filter value

**Returns:** `Promise<void>`

---

##### `addWine()`

Add a new wine to the collection.

**Returns:** `Promise<void>`

**Example:**
```javascript
await wineManager.addWine();
```

---

##### `editWine()`

Edit an existing wine.

**Returns:** `Promise<void>`

---

##### `uploadImage()`

Upload wine image.

**Returns:** `Promise<void>`

---

##### `populateEditBottle(bottleID)`

Populate edit bottle form with existing data.

**Parameters:**
- `bottleID` (string|number) - Bottle ID

**Returns:** `Promise<void>`

---

##### Legacy Functions

For backward compatibility:
- `loadAddWinePage()`
- `loadEditWinePage()`
- `populateAddWineList(listToUpdate, filterData)`
- `addWine()`
- `editWine()`
- `uploadImage()`
- `populateEditBottle(bottleID)`

---

### `features/bottle-tracking.js` - Bottle Management

**Status:** ✅ Complete

**Purpose:** Handle drinking bottles, adding bottles, and editing bottle information.

#### Class: `BottleTrackingManager`

**Constructor:**
```javascript
const bottleManager = new BottleTrackingManager();
```

---

#### Methods

##### `drinkBottle(wineID)`

Drink a bottle - show rating modal.

**Parameters:**
- `wineID` (string|number) - Wine ID

**Returns:** `Promise<void>`

**Example:**
```javascript
await bottleManager.drinkBottle(123);
```

---

##### `addBottle(wineID)`

Add a bottle to an existing wine.

**Parameters:**
- `wineID` (string|number) - Wine ID

**Returns:** `Promise<void>`

---

##### `editBottle(wineID)`

Edit bottle information for a wine.

**Parameters:**
- `wineID` (string|number) - Wine ID

**Returns:** `Promise<void>`

---

##### `getBottles(wineID)`

Get bottles for a specific wine.

**Parameters:**
- `wineID` (string|number) - Wine ID

**Returns:** `Promise<Array>` - Array of bottles

---

##### Legacy Functions

For backward compatibility:
- `drinkBottle(wineID)`
- `addBottle(wineID)`
- `editBottle(wineID)`

---

### `features/ai-integration.js` - Gemini AI Data Generation

**Status:** ✅ Complete

**Purpose:** Handle AI-powered data generation for wines, producers, and regions using Google Gemini API.

#### Class: `AIIntegrationManager`

**Constructor:**
```javascript
const aiManager = new AIIntegrationManager();
```

---

#### Methods

##### `getAIData(requestType, requestData)`

Get AI-generated data from Gemini.

**Parameters:**
- `requestType` (string) - Type of request ('wine', 'producer', or 'region')
- `requestData` (string) - Data to send to AI

**Returns:** `Promise<object>` - AI-generated data

**Example:**
```javascript
const wineData = await aiManager.getAIData('wine', 'Red Wine - Château Margaux, 2015 - Bordeaux');
console.log(wineData.description);
console.log(wineData.tasting);
console.log(wineData.pairing);
```

---

##### `genRegionData()`

Generate region data using AI.

**Returns:** `Promise<void>`

---

##### `genProducerData()`

Generate producer data using AI.

**Returns:** `Promise<void>`

---

##### `genWineData()`

Generate wine data using AI.

**Returns:** `Promise<void>`

**Example:**
```javascript
// User fills in wine name, year, producer
// Then clicks "Generate Data" button
await aiManager.genWineData();
// Form fields are populated with AI-generated data
```

---

##### Legacy Functions

For backward compatibility:
- `getAIData(requestType, requestData)`
- `genRegionData()`
- `genProducerData()`
- `genWineData()`

---

## Utility Modules

### `utils/dom-helpers.js` - DOM Manipulation Utilities

**Status:** ✅ Complete

**Purpose:** Common DOM manipulation functions for list management, pop-ups, and UI operations.

#### Functions

##### `hideList(elementID)`

Hide a list element by collapsing its height.

**Parameters:**
- `elementID` (string) - Element ID of the list

---

##### `showList(elementID)`

Show a list element by expanding its height.

**Parameters:**
- `elementID` (string) - Element ID of the list

---

##### `filterList(searchBoxID, listElementID)`

Filter list items based on search input.

**Parameters:**
- `searchBoxID` (string) - Search input element ID
- `listElementID` (string) - List element ID

**Example:**
```javascript
filterList('findProducer', 'producerList');
```

---

##### `selectList(selectedItem, searchBoxID, listElementID)`

Select an item from a list.

**Parameters:**
- `selectedItem` (string) - Selected item value
- `searchBoxID` (string) - Search input element ID
- `listElementID` (string) - List element ID

---

##### `hidePopUps()`

Hide all pop-up/context menus.

---

##### `autoGrowAllTextareas()`

Auto-grow all textareas to fit content.

---

##### `closeDropdowns()`

Close all open dropdowns.

---

##### `initializeWineCardToggles()`

Initialize wine card expand/collapse functionality.

---

### `utils/validation.js` - Form Validation Utilities

**Status:** ✅ Complete

**Purpose:** Form validation functions and rules.

#### Validation Rules

##### `ValidationRules.text(value)`

Validate text field (non-empty).

**Returns:** `boolean` - True if valid

---

##### `ValidationRules.year(value)`

Validate year (1000-2100 range, optional).

**Returns:** `boolean` - True if valid

---

##### `ValidationRules.date(value)`

Validate date (optional).

**Returns:** `boolean` - True if valid

---

##### `ValidationRules.email(value)`

Validate email address.

**Returns:** `boolean` - True if valid

---

#### Functions

##### `validateInput(input, validationType)`

Validate a single input field.

**Parameters:**
- `input` (HTMLInputElement|HTMLTextAreaElement) - Input element
- `validationType` (string) - Validation type (text, year, date, etc.)

**Returns:** `boolean` - True if valid

**Example:**
```javascript
const input = document.getElementById('wineName');
const isValid = validateInput(input, 'text');
```

---

##### `validateForm(container)`

Validate all inputs in a form or container.

**Parameters:**
- `container` (HTMLElement) - Container element

**Returns:** `boolean` - True if all inputs are valid

---

##### `sanitizeInput(input)`

Sanitize input to prevent XSS.

**Parameters:**
- `input` (string) - Input string

**Returns:** `string` - Sanitized string

---

### `utils/helpers.js` - General Utility Functions

**Status:** ✅ Complete

**Purpose:** Date formatting, text utilities, and other helper functions.

#### Date Functions

##### `formatDate(date, locale = 'en-GB', options = {})`

Format date to localized string.

**Parameters:**
- `date` (Date|string|number) - Date to format
- `locale` (string, optional) - Locale string
- `options` (object, optional) - Intl.DateTimeFormat options

**Returns:** `string` - Formatted date string

---

##### `formatDateDDMMYYYY(date)`

Format date to dd/mm/yyyy format.

**Parameters:**
- `date` (Date|string|number) - Date to format

**Returns:** `string` - Formatted date string

---

##### `getCurrentDateDDMMYYYY()`

Get current date as dd/mm/yyyy string.

**Returns:** `string` - Current date formatted as dd/mm/yyyy

---

#### Text Functions

##### `truncateText(text, maxLength, suffix = '...')`

Truncate text to specified length with ellipsis.

**Parameters:**
- `text` (string) - Text to truncate
- `maxLength` (number) - Maximum length
- `suffix` (string, optional) - Suffix to append

**Returns:** `string` - Truncated text

---

##### `capitalizeFirst(str)`

Capitalize first letter of string.

**Returns:** `string` - Capitalized string

---

##### `slugify(str)`

Convert string to slug (URL-friendly).

**Returns:** `string` - Slug string

---

#### Utility Functions

##### `formatPrice(amount, currency = 'GBP', locale = 'en-GB')`

Format price with currency symbol.

**Returns:** `string` - Formatted price string

---

##### `debounce(func, wait)`

Debounce function to limit execution rate.

**Returns:** `Function` - Debounced function

---

##### `throttle(func, limit)`

Throttle function to limit execution rate.

**Returns:** `Function` - Throttled function

---

##### `deepClone(obj)`

Deep clone an object.

**Returns:** `object` - Cloned object

---

##### `isEmpty(value)`

Check if value is empty.

**Returns:** `boolean` - True if empty

---

---

## Integration Module

### `app.js` - Main Application Entry Point

**Status:** ✅ Complete

**Purpose:** Initialize all modules and set up the wine collection application.

#### Class: `WineApp`

**Constructor:**
```javascript
const app = new WineApp();
```

---

#### Methods

##### `init()`

Initialize the application.

**Returns:** `Promise<void>`

**Example:**
```javascript
await app.init();
```

**Initialization Steps:**
1. Load sidebar and header HTML
2. Set up event listeners (event delegation)
3. Load initial wine data
4. Initialize filter dropdowns
5. Set up dropdown positioning

---

##### `loadPageElements()`

Load sidebar and header HTML content.

**Returns:** `Promise<void>`

---

##### `setupEventListeners()`

Set up event listeners using event delegation.

**Listeners:**
- Content area clicks (#lockBtn, #cancelBtn, #addBtn, #genWineData, etc.)
- Dropdown close on outside click
- Overlay click to hide pop-ups

---

##### `handleContentClick(event)`

Handle clicks within content area (event delegation).

**Parameters:**
- `event` (Event) - Click event

**Returns:** `Promise<void>`

---

##### `getModule(name)`

Get module by name.

**Parameters:**
- `name` (string) - Module name ('api', 'state', 'router', etc.)

**Returns:** Module instance

**Example:**
```javascript
const api = app.getModule('api');
const wines = await api.getWines();
```

---

##### `reload()`

Reload application data (useful for testing).

**Returns:** `Promise<void>`

---

#### Global Access

The app instance is globally accessible for debugging:

```javascript
// In browser console
window.wineApp.modules.api.getWines({ bottleCount: '1' });
window.wineApp.modules.state.setFilters({ countryDropdown: 'France' });
window.wineApp.reload();
```

---

#### Module Properties

The `modules` object contains references to all initialized modules:

```javascript
{
  api: wineAPI,
  state: appState,
  router: router,
  modalManager: modalManager,
  cardRenderer: wineCardRenderer,
  formManager: formManager,
  dropdownManager: dropdownManager,
  navigationManager: navigationManager,
  ratingManager: ratingManager,
  wineManager: wineManagementManager,
  bottleManager: bottleTrackingManager,
  aiManager: aiIntegrationManager
}
```

---

#### Auto-Initialization

The app automatically initializes when the script loads:

```javascript
// Runs automatically on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}
```

---

#### Usage in index.html

```html
<!-- Load old wineapp.js for backward compatibility -->
<script type="text/javascript" src="./resources/wineapp.js"></script>

<!-- Load new modular system -->
<script type="module" src="./resources/js/app.js"></script>
```

---

---

## Next Steps

Phase 1 refactoring is now complete! All 16 modules have been created and documented. See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for testing and deployment instructions.
