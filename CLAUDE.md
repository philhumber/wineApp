# Qvé Wine App - Session Context

**Last Updated**: 2026-01-27
**Status**: Production - Deployed and stable
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Quick Start

```bash
# Terminal 1: Frontend (from qve directory)
cd qve && npm run dev

# Terminal 1 (mobile testing): Expose to local network
cd qve && npm run dev -- --host
# Then access via Network URL (e.g., http://10.0.1.13:5173/qve/) on mobile

# Terminal 2: PHP backend (from project root)
php -S localhost:8000

# Git workflow (always work from develop)
git checkout develop
git pull origin develop
git checkout -b feature/WINE-XX-description

# Database connection
mysql -h 10.0.0.16 -u username -p winelist

# Deploy to production (PowerShell)
.\deploy.ps1 -DryRun    # Preview changes
.\deploy.ps1            # Deploy with auto-backup
.\deploy.ps1 -ListBackups
.\deploy.ps1 -Rollback "2026-01-18_143022"

# JIRA CLI (REST API v3)
.\scripts\jira.ps1 list                      # List open issues
.\scripts\jira.ps1 get WIN-123               # Get issue details
.\scripts\jira.ps1 create "Fix bug" Bug      # Create issue (Task, Bug, Story)
.\scripts\jira.ps1 status WIN-123 "Done"     # Transition status
.\scripts\jira.ps1 comment WIN-123 "Note"    # Add comment
.\scripts\jira.ps1 sprint                    # Current sprint issues
```

Open: **http://localhost:5173/qve/**

---

## Development Commands

```bash
cd qve
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run check        # TypeScript + Svelte check
npm run lint         # ESLint
npm run format       # Prettier
```

---

## Architecture Overview

```
qve/src/
├── lib/
│   ├── api/           # TypeScript API client
│   │   ├── client.ts  # All API methods
│   │   └── types.ts   # Wine, Bottle, Rating types
│   ├── components/    # 40+ Svelte components
│   │   ├── ui/        # Icon, ThemeToggle, CurrencySelector, Toast, RatingDisplay, PriceScale, BuyAgainIndicator
│   │   ├── wine/      # WineCard, WineGrid, HistoryCard
│   │   ├── layout/    # Header, CollectionRow, FilterBar, SideMenu, FilterDropdown
│   │   ├── forms/     # FormInput, RatingDots, MiniRatingDots
│   │   ├── wizard/    # WizardStepIndicator, SearchDropdown, AILoadingOverlay
│   │   ├── modals/    # DrinkRateModal, ConfirmModal, DuplicateWarningModal
│   │   └── edit/      # WineForm, BottleForm, BottleSelector
│   ├── stores/        # 16 Svelte stores (state management)
│   └── styles/        # tokens.css, base.css, animations.css
└── routes/            # SvelteKit file-based routing
    ├── +page.svelte   # Home / Cellar view
    ├── add/           # Add Wine wizard
    ├── history/       # Drink history
    ├── edit/[id]/     # Edit Wine/Bottle
    └── drink/[id]/    # Drink/Rate flow
```

---

## Key Stores

| Store | File | Purpose |
|-------|------|---------|
| wines | `stores/wines.ts` | Wine list, loading state, fetchWines() |
| filters | `stores/filters.ts` | Active filter values (country, type, region, producer, year) |
| filterOptions | `stores/filterOptions.ts` | Available options, context-aware cascading |
| cellarSort | `stores/cellarSort.ts` | Cellar view sorting (9 sort keys) |
| view | `stores/view.ts` | Cellar vs All Wines mode |
| addWine | `stores/addWine.ts` | 4-step wizard state, validation |
| drinkWine | `stores/drinkWine.ts` | Drink/Rate modal state |
| editWine | `stores/editWine.ts` | Edit page form state, dirty checking |
| addBottle | `stores/addBottle.ts` | Add Bottle modal state |
| history | `stores/history.ts` | Drink history, filtering, sorting (11 sort keys) |
| toast | `stores/toast.ts` | Toast notifications |
| modal | `stores/modal.ts` | Modal container state |
| menu | `stores/menu.ts` | Side menu open/close |
| theme | `stores/theme.ts` | Light/dark theme |
| currency | `stores/currency.ts` | Display currency, conversion utilities, formatCompactValue |
| scrollPosition | `stores/scrollPosition.ts` | Scroll restoration |

---

## API Client

All backend calls go through `lib/api/client.ts`:

```typescript
import { api } from '$lib/api';

// Fetch wines with filters
const wines = await api.getWines({ type: 'Red', cellarOnly: true });

// Add wine (4-table transaction)
const result = await api.addWine(wineData);

// Drink bottle with rating
await api.drinkBottle(bottleId, { rating: 8, notes: '...' });

// AI enrichment
const data = await api.enrichWithAI('producer', 'Château Margaux');
```

---

## Component Patterns

### Form Components
```svelte
<FormInput bind:value={name} label="Wine Name" required />
<FormSelect bind:value={type} options={typeOptions} label="Type" />
<FormTextarea bind:value={notes} label="Notes" rows={3} />
```

### Rating Components
```svelte
<!-- 10-dot main rating -->
<RatingDots bind:value={rating} />

<!-- 5-dot mini ratings (optional) -->
<MiniRatingDots bind:value={complexity} label="Complexity" />
```

### Modal Pattern
```svelte
<DrinkRateModal wineId={id} on:close={handleClose} on:rated={handleRated} />
<ConfirmModal message="Discard changes?" on:confirm={discard} on:cancel={stay} />
```

### Header Architecture
Unified header structure used across Cellar, All Wines, and History pages:
```
Header.svelte
├── header-top: Menu + Logo + Density Toggle + Search
├── CollectionRow: Title + View Toggle (Cellar/All) + Stats
└── FilterBar/HistoryFilterBar: Scrollable pills | Sort controls
```
- **CollectionRow**: Displays page title, Cellar/All toggle, wine count + value
- **FilterBar**: Horizontal scroll for filter pills with `touch-action: pan-x`, fixed sort controls on right separated by `|`
- Stats use `formatCompactValue()` for compact display (e.g., `~£45k`)

---

## Mobile & iOS Safari

### Responsive Grid (WineGrid.svelte)
Mobile-first approach with fixed column counts:
```css
.wine-grid.view-compact {
  grid-template-columns: repeat(2, 1fr);  /* Default: 2 columns */
}
@media (min-width: 560px)  { repeat(3, 1fr); }
@media (min-width: 768px)  { repeat(4, 1fr); }
@media (min-width: 992px)  { repeat(5, 1fr); }
@media (min-width: 1200px) { repeat(6, 1fr); }
```
**Note**: Avoid `auto-fill, minmax()` on mobile - causes overflow when minimum exceeds available space.

### Overflow Prevention (base.css)
Required for iOS Safari horizontal scroll prevention:
```css
html, body {
  overflow-x: hidden;
  max-width: 100vw;  /* Prevents fixed elements from extending viewport */
}
```
Also add to fixed-position containers like `.header`:
```css
.header {
  overflow-x: hidden;
  max-width: 100vw;
}
```

### Touch Scroll vs Tap Detection (FilterPill.svelte)
Prevent scroll gestures from triggering click handlers:
```typescript
let touchStartX = 0, touchStartY = 0;
const SCROLL_THRESHOLD = 10; // pixels

function handleTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

function handleTouchEnd(e: TouchEvent) {
  const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
  const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
  if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) return; // Was scroll
  // Handle tap...
}
```

### iOS Safari Utility Classes (base.css)
```css
.scroll-momentum { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
.no-overscroll { overscroll-behavior: none; }
```

---

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/qve/` | `+page.svelte` | Home with WineGrid, filters |
| `/qve/add` | `add/+page.svelte` | 4-step wizard |
| `/qve/history` | `history/+page.svelte` | HistoryGrid with sorting |
| `/qve/edit/[id]` | `edit/[id]/+page.svelte` | Two-tab edit (Wine/Bottle) |
| `/qve/drink/[id]` | `drink/[id]/+page.svelte` | DrinkRateModal page |

---

## Current Sprint Backlog

### Sprint 6: iOS + Navigation + Ratings (Current)
- WIN-131: iOS testing/bug fixes
- WIN-128: Back button / swipe navigation
- WIN-122: Fix UI flashing/highlighting
- WIN-117: Edit ratings from history
- WIN-114: Image view enhancements

### Completed: Sprint 5 (Currency + Card Details)
- WIN-134: Implement bottle_sizes and currencies tables ✓
- WIN-133: Fix TypeScript error in WineStep.svelte ✓
- WIN-132: Fix TypeScript error in RegionStep.svelte ✓
- WIN-130: Allow currency display setting ✓
- WIN-125: Add/Edit screen consistency ✓
- WIN-111: Additional wine card details ✓
- WIN-103: Remove hardcoded currencies/sizes ✓
- WIN-99: Audit JSON display fix ✓

### Completed: Sprint 4 (Security + Quick Wins)
- WIN-119: Secure wineapp-config directory ✓
- WIN-34: Finish filtering/sorting ✓
- WIN-79: Finish duplicate checking ✓
- WIN-124: Double field label bug ✓
- WIN-129: Form not clearing bug ✓
- WIN-115: Browser tab titles ✓
- WIN-116: Qve to Qvé branding ✓

### Sprint 7: Collection Features + Data Quality
- WIN-121/126: Collection naming
- WIN-127: Collection value data
- WIN-113: Region parent level search
- WIN-123: Field validation vs SQL

### Sprint 8: Data Management + Infrastructure
- WIN-97: Audit functions for all operations
- WIN-80: Soft delete support
- WIN-78: JS/PHP caching
- WIN-108: AI extract region from producer
- WIN-32: Producer/region info cards

### Sprint 9: Wishlist + Grape Data
- WIN-109: Wine wishlist
- WIN-112: Grape data capture

### Backlog: AI Features
- WIN-42: Image recognition
- WIN-37: AI chatbot (winebot)
- WIN-64: Structured output and grounding
- WIN-118: Vector database evaluation

---

## PHP Backend

Endpoints in `resources/php/`:

| File | Purpose |
|------|---------|
| `getWines.php` | Main query with JOINs and filters |
| `addWine.php` | 4-table transaction insert |
| `updateWine.php` | Update wine details |
| `drinkBottle.php` | Mark drunk + add rating |
| `addBottle.php` | Add bottle to wine |
| `updateBottle.php` | Update bottle details |
| `getDrunkWines.php` | History with ratings |
| `getCountries.php` | Countries with bottle counts (cascading) |
| `getTypes.php` | Types with bottle counts (cascading) |
| `getRegions.php` | Regions with bottle counts (cascading) |
| `getProducers.php` | Producers with bottle counts (cascading) |
| `getYears.php` | Vintages with bottle counts (cascading) |
| `getCurrencies.php` | Currencies and bottle sizes for settings |
| `upload.php` | Image upload (800x800) |
| `geminiAPI.php` | AI enrichment |
| `checkDuplicate.php` | Duplicate/similar item detection (fuzzy matching) |

---

## Database

**Host**: 10.0.0.16
**Database**: winelist
**Schema**: `resources/sql/DBStructure.sql`

Key tables: wine, bottles, ratings, producers, region, country, winetype, currencies, bottle_sizes

---

## Configuration

**Database credentials**: `../wineapp-config/config.local.php` (outside repo)
**JIRA credentials**: `../wineapp-config/jira.config.json` (email + API token)
**Vite proxy**: `qve/vite.config.ts` proxies `/resources/php` to PHP backend

---

## Common Tasks

### Add a new component
1. Create in `qve/src/lib/components/<category>/`
2. Export from `qve/src/lib/components/index.ts`
3. Import: `import { MyComponent } from '$lib/components'`

### Add a new store
1. Create in `qve/src/lib/stores/`
2. Export from `qve/src/lib/stores/index.ts`
3. Import: `import { myStore } from '$lib/stores'`

### Add a new API endpoint
1. Add method to `qve/src/lib/api/client.ts`
2. Add types to `qve/src/lib/api/types.ts`

### Modify PHP endpoint
1. Edit file in `resources/php/`
2. Test with both old and new app if needed

---

## Archive Reference

V1 app files preserved in `archive/`:
- `v1-html/` - Old HTML pages, CSS
- `v1-js/` - ES6 modules (17 files)
- `v1-docs/` - Sprint docs, MODULE_GUIDE
- `design-mockups/` - Qvé mockups and design system

---

## Resources

- **JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **GitHub**: https://github.com/philhumber/wineApp
- **Developer**: Phil Humber (phil.humber@gmail.com)
