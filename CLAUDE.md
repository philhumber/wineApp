# Qvé Wine App - Session Context

**Last Updated**: 2026-01-25
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

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit 2, TypeScript 5
- **Backend**: PHP 8.x (built-in server)
- **Database**: MySQL (remote: 10.0.0.16)
- **Build**: Vite 5, adapter-static (SPA)
- **PWA**: @vite-pwa/sveltekit (offline-capable)
- **UI**: bits-ui component library

**Path Aliases** (svelte.config.js):
- `$api` → src/lib/api
- `$stores` → src/lib/stores
- `$styles` → src/lib/styles
- `$components` → src/lib/components

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
│   │   ├── layout/    # Header, FilterBar, SideMenu, FilterDropdown
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
| currency | `stores/currency.ts` | Display currency preference, conversion utilities |
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

## Current Work

See [JIRA Sprint Board](https://philhumber.atlassian.net/jira/software/projects/WIN) for current tickets.

```bash
.\scripts\jira.ps1 sprint    # View current sprint issues
.\scripts\jira.ps1 list      # List all open issues
```

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

## Gotchas

- **iOS Safari**: Touch events require special handling; use `touch-action: manipulation` for interactive elements
- **PWA caching**: API calls use NetworkFirst strategy with 5-min cache; force refresh may be needed during dev
- **Vite proxies**: Both `/resources/php` AND `/images` are proxied to PHP backend (port 8000)
- **Base path**: All routes are under `/qve/` (configured in svelte.config.js)
- **Svelte 5**: Uses runes syntax (`$state`, `$derived`, `$effect`) - not legacy reactive statements

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

## References

- **JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **GitHub**: https://github.com/philhumber/wineApp
- **Legacy code**: `archive/` directory (v1 HTML/JS, design mockups)
