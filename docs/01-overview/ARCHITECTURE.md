# Wine Collection App - Architecture Documentation

## Overview

This document describes the architecture of the Wine Collection Management application, a full-stack web application for managing a personal wine collection with features for cataloging, rating, and tracking wine inventory.

**Last Updated:** 2026-01-11
**Status:** Phase 1 Refactoring In Progress

---

## Technology Stack

### Frontend
- **Language:** Vanilla JavaScript (ES6+)
- **Architecture:** Modular SPA (Single Page Application)
- **Styling:** Custom CSS with responsive design
- **No frameworks:** Pure JavaScript implementation

### Backend
- **Language:** PHP 7+
- **Database Driver:** PDO (PHP Data Objects)
- **API Style:** REST-like JSON endpoints

### Database
- **System:** MySQL
- **Server:** 10.0.0.16
- **Database Name:** `winelist`

### External Services
- **Google Gemini AI API:** Wine data generation (descriptions, tasting notes)
- **Future:** Gemini Vision API for label scanning (Phase 2)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Frontend)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  HTML Pages (index.html, addwine.html, etc.)         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Modular JavaScript Layer                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │   Core   │  │    UI    │  │    Features      │   │  │
│  │  │  Modules │  │  Modules │  │    Modules       │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                 │
│                      WineAPI (AJAX)                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓ JSON/HTTP
┌────────────────────────┴────────────────────────────────────┐
│                   PHP Backend (Middle Tier)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Endpoints (getWines.php, addWine.php, etc.)       │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Business Logic & Database Connection              │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         ↓ PDO/SQL
┌────────────────────────┴────────────────────────────────────┐
│                     MySQL Database                           │
│  Tables: wine, bottles, ratings, producers, region,         │
│          country, winetype, audit_log                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Module Structure

### Directory Organization

```
resources/js/
├── core/                   # Core system functionality
│   ├── api.js             # API communication layer
│   ├── state.js           # Application state management
│   └── router.js          # Hash-based routing
│
├── ui/                     # UI components
│   ├── cards.js           # Wine card rendering (TODO)
│   ├── forms.js           # Form handling (TODO)
│   ├── modals.js          # Modal/overlay management
│   ├── dropdowns.js       # Filter dropdowns (TODO)
│   └── navigation.js      # Sidebar/header nav (TODO)
│
├── features/               # Feature-specific modules
│   ├── wine-management.js # Add/edit/delete wines (TODO)
│   ├── bottle-tracking.js # Drink/add bottles (TODO)
│   ├── rating.js          # Rating system (TODO)
│   └── ai-integration.js  # Gemini AI integration (TODO)
│
├── utils/                  # Utility functions
│   ├── dom-helpers.js     # DOM manipulation (TODO)
│   ├── validation.js      # Form validation (TODO)
│   └── helpers.js         # General utilities (TODO)
│
└── app.js                  # Application initialization (TODO)
```

---

## Core Modules (Completed)

### 1. API Layer (`core/api.js`)

**Purpose:** Centralize all backend communication

**Key Class:** `WineAPI`

**Responsibilities:**
- HTTP requests to PHP endpoints
- JSON serialization/deserialization
- File uploads (wine pictures)
- Error handling

**Key Methods:**
```javascript
fetchJSON(endpoint, filterData)  // Generic GET/POST for JSON
pushData(endpoint, data)         // Generic POST for data/files
getWines(filterData)             // Get wine list
getCountries/Regions/Producers() // Get reference data
addWine(wineData)                // Add new wine
updateWine/Bottle()              // Update records
drinkBottle(ratingData)          // Record consumption
callGeminiAI(type, prompt)       // AI data generation
```

**Global Instance:** `window.wineAPI`

**Backward Compatibility:** Yes - exported standalone functions

---

### 2. State Management (`core/state.js`)

**Purpose:** Manage application state with observable pattern

**Key Class:** `AppState`

**State Properties:**
- `currentTab` - Multi-step form navigation
- `currentOverall/Value` - Rating values
- `editCache` - Cached edit data
- `wines[]` - Current wine list
- `filters{}` - Active filter criteria
- `currentView` - Active route/view

**Key Methods:**
```javascript
setState(updates)            // Update state & notify
subscribe(listener)          // Listen to state changes
setFilters(filterUpdates)    // Update filters
setWines(wines)              // Update wine list
resetFormState()             // Clear form state
resetRatingState()           // Clear rating state
```

**Pattern:** Observable - components subscribe to state changes

**Global Instance:** `window.appState`

---

### 3. Router (`core/router.js`)

**Purpose:** Hash-based SPA routing (future-ready)

**Key Class:** `Router`

**Routes (Planned):**
- `#wines` - Wine list (default)
- `#add-wine` - Add wine form
- `#region/:name` - Region detail page (Phase 4)
- `#producer/:name` - Producer detail page (Phase 4)
- `#recommendations` - Recommendations (Phase 3)
- `#drunk-wines` - Drunk wines history

**Key Methods:**
```javascript
register(path, handler)      // Register route handler
navigate(path, params)       // Navigate to route
matchRoute(path)             // Pattern matching
handleRoute()                // Process route change
```

**Pattern Matching:** Supports dynamic segments (`:name`)

**Global Instance:** `window.router`

---

### 4. Modal Manager (`ui/modals.js`)

**Purpose:** Manage overlays and prevent scroll

**Key Class:** `ModalManager`

**Key Functions:**
```javascript
showOverlay()                // Show dimmed background
hideOverlay()                // Hide background
disableScroll()              // Prevent page scroll
enableScroll()               // Restore scroll
```

**ModalManager Methods:**
```javascript
show(modal, showOverlayBg)   // Show modal
hide(modal, hideOverlayBg)   // Hide modal
hideAll()                    // Hide all modals
hasActiveModals()            // Check active state
```

**Features:**
- Stack-based modal tracking
- Scroll prevention with cross-browser support
- Fade animations

**Global Instance:** `window.modalManager`

---

## Database Schema

### Complete Table Structure

**wine** - Core wine information
- `wineID` (PK, AUTO_INCREMENT)
- `wineName` (VARCHAR 50)
- `wineTypeID` (FK → winetype)
- `producerID` (FK → producers)
- `year` (YEAR, nullable)
- `description`, `tastingNotes`, `pairing` (TEXT)
- `pictureURL` (TEXT)
- `ABV` (DECIMAL 10,0, nullable) - Alcohol by volume
- `drinkDate` (YEAR, nullable) - Optimal drinking date
- `rating` (DECIMAL 10,0, nullable) - Legacy field
- `bottlesDrunk` (INT, default 0) - Counter for consumed bottles
- **Soft Delete Fields:**
  - `deleted` (TINYINT, default 0)
  - `deletedAt` (TIMESTAMP, nullable)
  - `deletedBy` (INT, nullable)
- **Indexes:** PK, FK on producerID, FK on wineTypeID, idx_deleted

**bottles** - Individual bottle tracking
- `bottleID` (PK, AUTO_INCREMENT)
- `wineID` (FK → wine, ON DELETE RESTRICT)
- `bottleSize` (VARCHAR 50) - Piccolo, Standard, Magnum, etc.
- `location` (VARCHAR 50) - Wine Fridge, Wine Cellar, etc.
- `source` (VARCHAR 50) - Where purchased
- `price` (DECIMAL 10,2, nullable)
- `currency` (CHAR 3, nullable) - USD, EUR, etc.
- `dateAdded` (DATE)
- `bottleDrunk` (TINYINT 1, default 0) - 0=available, 1=consumed
- **Soft Delete Fields:**
  - `deleted` (TINYINT, default 0)
  - `deletedAt` (TIMESTAMP, nullable)
  - `deletedBy` (INT, nullable)
- **Indexes:** PK, FK on wineID, idx_deleted

**ratings** - Tasting notes and ratings
- `ratingID` (PK, AUTO_INCREMENT)
- `wineID` (FK → wine, ON DELETE RESTRICT)
- `bottleID` (FK → bottles, ON DELETE RESTRICT)
- `overallRating` (INT 1-10)
- `valueRating` (INT 1-10)
- `drinkDate` (DATE)
- `buyAgain` (TINYINT 1) - 0=no, 1=yes
- `Notes` (TEXT)
- `avgRating` (DECIMAL 3,2, nullable) - Calculated field
- **Indexes:** PK, FK on wineID, FK on bottleID

**producers** - Wine producers/wineries
- `producerID` (PK, AUTO_INCREMENT)
- `producerName` (VARCHAR 255, UNIQUE)
- `regionID` (FK → region, ON DELETE RESTRICT)
- `town` (VARCHAR 255)
- `founded` (INT) - Year established
- `ownership` (VARCHAR 255) - Family, Cooperative, LVMH, etc.
- `description` (TEXT)
- **Indexes:** PK, UNIQUE on producerName, FK on regionID

**region** - Wine regions
- `regionID` (PK, AUTO_INCREMENT)
- `regionName` (VARCHAR 50, UNIQUE)
- `countryID` (FK → country, ON DELETE RESTRICT)
- `description` (TEXT)
- `climate` (TEXT) - Climate characteristics
- `soil` (TEXT) - Soil composition
- `map` (TEXT) - Map image URL
- **Indexes:** PK, UNIQUE on regionName, FK on countryID

**country** - Countries (ISO standard)
- `countryID` (PK, AUTO_INCREMENT)
- `countryName` (VARCHAR 255, UNIQUE)
- `code` (CHAR 2) - ISO 3166-1 alpha-2 (FR, US, IT)
- `world_code` (VARCHAR 255, FK → worlds)
- `full_name` (VARCHAR 255) - Full English name
- `iso3` (CHAR 3) - ISO 3166-1 alpha-3 (FRA, USA, ITA)
- `number` (CHAR 3) - ISO 3166-1 numeric
- `continent` (CHAR 2) - Continent code
- **Indexes:** PK, UNIQUE on countryName, FK on world_code

**winetype** - Wine categories
- `wineTypeID` (PK, AUTO_INCREMENT)
- `wineType` (VARCHAR 20) - Red, White, Rosé, Sparkling, Dessert, Fortified
- **Indexes:** PK

**grapes** - Grape varieties (future feature)
- `grapeID` (PK, AUTO_INCREMENT)
- `grapeName` (VARCHAR 50)
- `description` (TEXT)
- `picture` (TEXT) - Grape image URL
- **Indexes:** PK
- **Status:** Table exists but not yet used in UI

**grapemix** - Wine grape blend composition (future feature)
- `mixID` (PK, AUTO_INCREMENT)
- `wineID` (FK → wine, ON DELETE RESTRICT)
- `grapeID` (FK → grapes, ON DELETE RESTRICT)
- `mixPercent` (DECIMAL 10,0) - Percentage of grape in blend
- **Indexes:** PK, FK on wineID, FK on grapeID
- **Status:** Table exists but not yet used in UI

**worlds** - Wine world categorization
- `name` (PK, VARCHAR 255) - "Old World", "New World"
- **Indexes:** PK
- **Usage:** Categorizes countries by wine tradition

**audit_log** - Comprehensive change tracking
- `auditID` (PK, AUTO_INCREMENT)
- `tableName` (VARCHAR 50) - Table being audited
- `recordID` (INT) - ID of changed record
- `action` (ENUM) - INSERT, UPDATE, DELETE
- `columnName` (VARCHAR 50, nullable) - Specific column changed
- `oldValue` (TEXT, nullable) - Previous value
- `newValue` (TEXT, nullable) - New value
- `changedBy` (INT, nullable) - User ID (future multi-user)
- `changedAt` (TIMESTAMP, default CURRENT_TIMESTAMP)
- `ipAddress` (VARCHAR 45, nullable) - IPv4/IPv6 address
- **Indexes:** PK, composite on (tableName, recordID), idx on changedAt

### Relationships

```
worlds (1) ──→ (N) country
country (1) ──→ (N) region
region (1) ──→ (N) producers
producers (1) ──→ (N) wine
wine (1) ──→ (N) bottles
wine (1) ──→ (N) grapemix ←── (N) grapes
winetype (1) ──→ (N) wine

wine (1) ──→ (N) ratings
bottles (1) ──→ (N) ratings
```

**All foreign keys use ON DELETE RESTRICT** to prevent accidental data loss.

### Data Integrity Features

**Soft Delete Pattern:**
- `wine` and `bottles` tables support soft deletes
- Records marked as deleted instead of removed
- Preserves historical data for ratings and audit trail
- Enables "undelete" functionality

**Audit Trail:**
- Column-level change tracking
- Before/after values captured
- Timestamp and IP address logged
- Ready for multi-user environment

**Unique Constraints:**
- `country.countryName` - Prevent duplicate countries
- `region.regionName` - Prevent duplicate regions
- `producers.producerName` - Prevent duplicate producers

**Performance Indexes:**
- Foreign key indexes for JOIN performance
- `idx_deleted` on wine and bottles for fast filtering
- Composite index on audit_log (tableName, recordID)

---

## Data Flow

### Loading Wine List
```
User Action (Filter)
    → appState.setFilters()
    → wineAPI.getWines(filters)
    → PHP: getWines.php
    → MySQL: Complex JOIN query
    → PHP: Return JSON
    → WineCardRenderer.render()
    → DOM Update
```

### Adding a Wine
```
User Input (Multi-step Form)
    → FormManager.nextPrev()
    → FormManager.validate()
    → wineAPI.addWine(data)
    → PHP: addWine.php (Transaction)
    → MySQL: INSERT into region/producer/wine/bottles
    → PHP: audit_log.php
    → Return success
    → Refresh wine list
```

### Drinking a Bottle
```
Long Press Wine Card
    → Context Menu
    → "Drink Bottle"
    → Load rating.html modal
    → User rates wine
    → wineAPI.drinkBottle(ratingData)
    → PHP: drinkBottle.php
    → MySQL: INSERT rating, UPDATE bottle.bottleDrunk
    → Close modal
    → Refresh wine list
```

---

## Key Patterns & Conventions

### Module Pattern
- ES6 modules with `export`
- Classes for stateful components
- Pure functions for utilities

### Naming Conventions
- **Classes:** PascalCase (`WineAPI`, `AppState`)
- **Functions:** camelCase (`fetchJSON`, `showOverlay`)
- **Files:** kebab-case (`wine-management.js`)
- **Constants:** UPPER_SNAKE_CASE

### Error Handling
- `try/catch` for async operations
- PHP returns `{success, message, data}` format
- Console logging for debugging

### Backward Compatibility
- Global instances for gradual migration
- Exported standalone functions
- Original variable names preserved

---

## Security Considerations

### Current Implementation
- ✅ PDO prepared statements (SQL injection prevention)
- ✅ HTTPS for all requests (assumed)
- ✅ Server-side validation
- ✅ No sensitive data in frontend

### Future Improvements
- Add CSRF tokens
- Input sanitization on backend
- Rate limiting for API endpoints
- Authentication/authorization (if multi-user)

---

## Performance Considerations

### Current
- Template cloning for wine cards (fast DOM manipulation)
- Async/await for non-blocking operations
- Single API call for wine list with filters

### Future Optimizations
- Lazy loading for large wine collections
- Caching for reference data (countries, regions)
- Debounced search/filter inputs
- Virtual scrolling for 100+ wines

---

## Browser Compatibility

**Target Browsers:**
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest - desktop & iOS)
- Mobile browsers (Chrome Android, Safari iOS)

**Required Features:**
- ES6 modules
- Fetch API
- Promises/async-await
- CSS Grid
- CSS Flexbox

---

## Deployment Architecture

**Current Setup:**
- Static HTML/CSS/JS files
- PHP files in `resources/php/`
- MySQL database on local network (10.0.0.16)
- Images in `images/` directory

**No Build Process:**
- Pure vanilla JavaScript (no bundler needed)
- Direct file serving
- Suitable for personal/small-scale use

---

## Future Architecture (Post-Refactoring)

### Phase 2: AI Image Recognition
- Add `features/label-scanner.js`
- New PHP endpoint: `scanWineLabel.php`
- Gemini Vision API integration
- New table: `wine_label_scans`

### Phase 3: Recommendations
- Add `features/recommendations.js`
- New PHP endpoint: `getRecommendations.php`
- Recommendation algorithm (hybrid filtering)
- New database view: `user_preferences`

### Phase 4: Region/Producer Pages
- Use `router.js` for navigation
- New templates: `regionDetail.html`, `producerDetail.html`
- New PHP endpoints: `getRegionDetails.php`, `getProducerDetails.php`
- Breadcrumb navigation

### Phase 5+: Future Features (Leveraging Existing Schema)

**Grape Blend Tracking** - `grapes` and `grapemix` tables already exist
- Add UI to specify grape composition (e.g., "60% Cabernet Sauvignon, 40% Merlot")
- Display grape blends on wine cards and detail views
- Filter/search by grape variety
- Grape variety detail pages with descriptions and characteristics
- Blend visualization (pie charts, bars)

**Wine World Classification** - `worlds` table already exists
- Display "Old World" vs "New World" badge on wines
- Filter by wine world (Old World: France, Italy, Spain; New World: USA, Australia, etc.)
- Educational content about wine world traditions and differences

**Extended Wine Details** - Fields exist but not yet displayed
- **ABV (Alcohol by Volume)** - Display percentage on wine cards
- **Optimal Drinking Date** - Show peak drinking window
- Alerts/notifications for wines approaching peak drinking date
- Sort by ABV for planning meals/occasions

**Multi-User & Authentication** - `audit_log` already has user tracking fields
- User accounts and authentication
- Per-user wine collections
- Shared collections (family/household)
- User-specific ratings and preferences
- Activity feed from audit log

**Soft Delete Management** - Pattern already implemented
- "Recently Deleted" view
- Undelete/restore functionality
- Permanent delete after X days
- Deleted items in audit history

**Additional Enhancements:**
- UI/UX redesign with modern framework or enhanced vanilla CSS
- Wine wishlist/shopping list
- Price tracking over time and value appreciation
- Cellar valuation calculator
- Advanced analytics and insights dashboard
- Export/import (CSV, JSON)
- Mobile PWA or native app
- Barcode scanning integration
- Social sharing of wines/collections
- Integration with wine APIs (Vivino, CellarTracker)

---

## Migration Strategy

### Incremental Refactoring
1. ✅ **Session 1:** Core modules (api, state, router, modals)
2. **Session 2:** UI modules (cards, forms, dropdowns, navigation)
3. **Session 3:** Feature modules (rating, wine-mgmt, bottles, AI)
4. **Session 4:** Integration & testing

### Testing Approach
- Manual regression testing after each session
- Verify all existing features work
- Browser console error checking
- Mobile device testing

---

## Related Documentation

- [Module Guide](MODULE_GUIDE.md) - Detailed API reference for each module
- [Refactoring Progress](REFACTORING_PROGRESS.md) - Current status tracker
- [API Reference](API_REFERENCE.md) - Backend PHP endpoints
- [Implementation Plan](../C:\Users\Phil\.claude\plans\nifty-foraging-aurora.md) - Overall project plan
