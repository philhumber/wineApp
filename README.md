# Qvé - Wine Collection App

A personal wine cellar management app built with SvelteKit.

## Features

- **Wine Collection**: Track your cellar with filtering by type, region, producer, vintage
- **Add Wine Wizard**: 4-step flow with AI-powered data enrichment
- **Drink & Rate**: 10-point rating with optional detailed scores (complexity, drinkability, surprise)
- **History**: Track consumption history with price analysis
- **Dual Themes**: Light and dark modes
- **PWA Support**: Installable on mobile devices

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2, TypeScript, Vite 5 |
| Backend | PHP 7+ with PDO |
| Database | MySQL 8.0 |
| AI | Google Gemini API |
| State | Svelte stores (13 stores) |
| Styling | CSS custom properties (design tokens) |

## Quick Start

### Prerequisites

- Node.js 18+
- PHP 7.4+
- MySQL 8.0+

### Development Setup

The app requires **two servers** running simultaneously:

```bash
# Terminal 1: Start PHP backend (from project root)
php -S localhost:8000

# Terminal 2: Start Vite dev server (from qve folder)
cd qve
npm install
npm run dev
```

Then open: **http://localhost:5173/qve/**

### How It Works

```
Browser (localhost:5173)
  → /qve/* (SvelteKit app)
  → /resources/php/* (proxied to PHP backend at localhost:8000)
```

## Project Structure

```
wineapp/
├── qve/                          # SvelteKit app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/              # TypeScript API client
│   │   │   │   ├── client.ts     # API methods
│   │   │   │   └── types.ts      # TypeScript types
│   │   │   ├── components/       # Svelte components
│   │   │   │   ├── ui/           # Icon, ThemeToggle, Toast, etc.
│   │   │   │   ├── wine/         # WineCard, WineGrid, HistoryCard
│   │   │   │   ├── layout/       # Header, FilterBar, SideMenu
│   │   │   │   ├── forms/        # FormInput, RatingDots, etc.
│   │   │   │   ├── wizard/       # Add Wine wizard components
│   │   │   │   ├── modals/       # DrinkRateModal, AddBottleModal
│   │   │   │   └── edit/         # WineForm, BottleForm
│   │   │   ├── stores/           # Svelte stores (state management)
│   │   │   │   ├── wines.ts      # Wine list state
│   │   │   │   ├── filters.ts    # Filter state
│   │   │   │   ├── addWine.ts    # Add Wine wizard state
│   │   │   │   ├── drinkWine.ts  # Drink/Rate modal state
│   │   │   │   └── ...           # 13 stores total
│   │   │   └── styles/           # CSS design tokens
│   │   └── routes/               # SvelteKit pages
│   │       ├── +page.svelte      # Home / Cellar view
│   │       ├── add/              # Add Wine wizard
│   │       ├── history/          # Drink history
│   │       ├── edit/[id]/        # Edit Wine/Bottle
│   │       └── drink/[id]/       # Drink/Rate flow
│   ├── package.json
│   ├── vite.config.ts            # Vite config with PHP proxy
│   └── svelte.config.js
│
├── resources/
│   ├── php/                      # Backend API (21 endpoints)
│   └── sql/                      # Database schema
│
├── images/                       # Wine images
├── archive/                      # V1 app files (reference)
├── docs/                         # Documentation
└── design/                       # AI agent specs
```

## Available Routes

| Route | Description |
|-------|-------------|
| `/qve/` | Home - Wine cellar with filters |
| `/qve/add` | Add Wine - 4-step wizard |
| `/qve/history` | History - Consumed wines |
| `/qve/edit/[id]` | Edit Wine/Bottle details |
| `/qve/drink/[id]` | Drink & Rate flow |

## Stores

| Store | Purpose |
|-------|---------|
| `wines` | Wine list and loading state |
| `filters` | Active filter values |
| `filterOptions` | Available filter options (context-aware) |
| `view` | View mode (Cellar vs All Wines) |
| `theme` | Light/dark theme |
| `addWine` | Add Wine wizard form state |
| `drinkWine` | Drink/Rate modal state |
| `editWine` | Edit page form state |
| `addBottle` | Add Bottle modal state |
| `history` | Drink history and sorting |
| `toast` | Toast notifications |
| `modal` | Modal container state |
| `menu` | Side menu open/close |
| `scrollPosition` | Scroll restoration for back/forward |

## API Endpoints

The PHP backend provides these endpoints at `/resources/php/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `getWines.php` | GET | Fetch wines with filters |
| `addWine.php` | POST | Add new wine (4-table transaction) |
| `updateWine.php` | POST | Update wine details |
| `drinkBottle.php` | POST | Mark bottle drunk with rating |
| `addBottle.php` | POST | Add bottle to existing wine |
| `updateBottle.php` | POST | Update bottle details |
| `getDrunkWines.php` | GET | Fetch drink history |
| `getTypes.php` | GET | Wine types with bottle counts |
| `getRegions.php` | GET | Regions with bottle counts |
| `getProducers.php` | GET | Producers with bottle counts |
| `getYears.php` | GET | Vintages with bottle counts |
| `upload.php` | POST | Image upload (800x800) |
| `geminiAPI.php` | POST | AI data enrichment |

## Configuration

### Database

Database connection is configured in `resources/php/databaseConnection.php`, which reads credentials from `../wineapp-config/config.local.php` (outside the repo).

### Vite Proxy

The Vite dev server proxies API requests to the PHP backend. See [qve/vite.config.ts](qve/vite.config.ts):

```typescript
server: {
  proxy: {
    '/resources/php': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

## Deployment

```powershell
# Preview deployment
.\deploy.ps1 -DryRun

# Deploy to production
.\deploy.ps1

# Rollback
.\deploy.ps1 -Rollback "2026-01-22_143022"
```

## Development

### Build for Production

```bash
cd qve
npm run build
```

### Type Checking

```bash
cd qve
npm run check
```

### Linting

```bash
cd qve
npm run lint
```

## Resources

- **JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)

## Archive

The `archive/` folder contains V1 app files for reference:
- `v1-html/` - Old HTML pages and CSS
- `v1-js/` - ES6 module system (17 files)
- `v1-docs/` - Sprint documentation
- `design-mockups/` - Qvé design mockups and specs
