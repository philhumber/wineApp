# Qvé Wine App - Session Context

**Last Updated**: 2026-01-22
**Status**: Production - Deployed and stable
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Quick Start

```bash
# Terminal 1: PHP backend (from project root)
php -S localhost:8000

# Terminal 2: Vite dev server (from qve folder)
cd qve && npm run dev
```

Open: **http://localhost:5173/qve/**

---

## Architecture Overview

```
qve/src/
├── lib/
│   ├── api/           # TypeScript API client
│   │   ├── client.ts  # All API methods
│   │   └── types.ts   # Wine, Bottle, Rating types
│   ├── components/    # 40+ Svelte components
│   │   ├── ui/        # Icon, ThemeToggle, Toast, RatingDisplay
│   │   ├── wine/      # WineCard, WineGrid, HistoryCard
│   │   ├── layout/    # Header, FilterBar, SideMenu, FilterDropdown
│   │   ├── forms/     # FormInput, RatingDots, MiniRatingDots
│   │   ├── wizard/    # WizardStepIndicator, SearchDropdown, AILoadingOverlay
│   │   ├── modals/    # DrinkRateModal, AddBottleModal, ConfirmModal
│   │   └── edit/      # WineForm, BottleForm, BottleSelector
│   ├── stores/        # 14 Svelte stores (state management)
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
| filters | `stores/filters.ts` | Active filter values (type, region, producer, year) |
| filterOptions | `stores/filterOptions.ts` | Available options, context-aware caching |
| view | `stores/view.ts` | Cellar vs All Wines mode |
| addWine | `stores/addWine.ts` | 4-step wizard state, validation |
| drinkWine | `stores/drinkWine.ts` | Drink/Rate modal state |
| editWine | `stores/editWine.ts` | Edit page form state, dirty checking |
| addBottle | `stores/addBottle.ts` | Add Bottle modal state |
| history | `stores/history.ts` | Drink history, sorting |
| toast | `stores/toast.ts` | Toast notifications |
| modal | `stores/modal.ts` | Modal container state |
| menu | `stores/menu.ts` | Side menu open/close |
| theme | `stores/theme.ts` | Light/dark theme |
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

## Current Sprint Backlog

### Sprint 4: Security + Quick Wins
| Key | Summary | Status |
|-----|---------|--------|
| WIN-119 | Secure wineapp-config directory | To Do |
| WIN-34 | Finish filtering/sorting | In Progress |
| WIN-79 | Finish duplicate checking | In Progress |
| WIN-124 | Double field label bug | To Do |
| WIN-129 | Form not clearing bug | To Do |
| WIN-115 | Browser tab titles | To Do |
| WIN-116 | Qve to Qvé branding | To Do |

### Sprint 5: Currency + Card Details
- WIN-103: Remove hardcoded currencies/sizes
- WIN-130: Allow currency display setting
- WIN-111: Additional wine card details
- WIN-125: Add/Edit screen consistency
- WIN-99: Audit JSON display fix

See [plan file](C:\Users\Phil\.claude\plans\harmonic-crafting-wombat.md) for full sprint breakdown.

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
| `getTypes.php` | Types with bottle counts |
| `getRegions.php` | Regions with bottle counts |
| `getProducers.php` | Producers with bottle counts |
| `getYears.php` | Vintages with bottle counts |
| `upload.php` | Image upload (800x800) |
| `geminiAPI.php` | AI enrichment |

---

## Database

**Host**: 10.0.0.16
**Database**: winelist
**Schema**: `resources/sql/DBStructure.sql`

Key tables: wine, bottles, ratings, producers, region, country, winetype

---

## Configuration

**Database credentials**: `../wineapp-config/config.local.php` (outside repo)
**JIRA API**: `../wineapp-config/jira.config.json`
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

## Deployment

```powershell
.\deploy.ps1 -DryRun    # Preview
.\deploy.ps1            # Deploy with backup
.\deploy.ps1 -Rollback "2026-01-22_143022"
```

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
