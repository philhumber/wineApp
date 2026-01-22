# Qvé Wine Collection

SvelteKit-based PWA for personal wine collection management.

## Prerequisites

- **Node.js 18+** (tested with v24.13.0)
- **PHP 7+** with PDO extension (for backend API)
- **MySQL 8.0** database

## Quick Start

```bash
# 1. Start PHP backend (from wineapp root directory)
cd "c:\Users\Phil\Google Drive\dev\wineapp"
php -S localhost:8000

# 2. In a new terminal, start Vite dev server
cd qve
npm install
npm run dev
```

Open **http://localhost:5173/qve/** in your browser.

## Development Environment

### Two Servers Required

The app requires two servers running simultaneously:

| Server | Port | Purpose |
|--------|------|---------|
| PHP | 8000 | Backend API (`/resources/php/`) |
| Vite | 5173 | Frontend dev server (`/qve/`) |

### API Proxy Configuration

During development, Vite proxies API requests to the PHP backend. This is configured in `vite.config.ts`:

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

**Request flow:**
```
Browser → localhost:5173/resources/php/getWines.php
       ↓ (Vite proxy)
       → localhost:8000/resources/php/getWines.php
       ↓ (PHP processes)
       → MySQL database
```

## Troubleshooting

### 404 Not Found (API endpoints)

**Cause:** Vite proxy not reaching PHP server

**Solution:** Ensure PHP server is running:
```bash
# Must run from wineapp root (not qve folder)
cd "c:\Users\Phil\Google Drive\dev\wineapp"
php -S localhost:8000
```

### 500 Internal Server Error

**Cause:** PHP running from wrong directory (can't find files)

**Solution:** Run PHP server from wineapp root directory, not the qve subfolder.

### ECONNREFUSED

**Cause:** PHP server not running at all

**Solution:** Start the PHP server in a separate terminal window.

### TypeScript Errors

**Cause:** Missing dependencies or type definitions

**Solution:**
```bash
npm install
npm run check
```

### Node Version Error

**Cause:** Node.js version < 18

**Solution:** Upgrade Node.js to v18 or higher. SvelteKit requires Node 18+.

## Project Structure

```
qve/
├── src/
│   ├── lib/
│   │   ├── api/           # TypeScript API client
│   │   │   ├── client.ts  # WineApiClient class
│   │   │   ├── types.ts   # Type definitions
│   │   │   └── index.ts   # Public exports
│   │   ├── stores/        # Svelte stores
│   │   │   ├── theme.ts   # Light/dark theme (localStorage)
│   │   │   ├── wines.ts   # Wine data
│   │   │   ├── filters.ts # Filter state
│   │   │   ├── view.ts    # View mode/density
│   │   │   ├── toast.ts   # Notifications
│   │   │   ├── modal.ts   # Modal state
│   │   │   └── index.ts   # Public exports
│   │   ├── styles/        # Design tokens
│   │   │   ├── tokens.css # CSS custom properties
│   │   │   ├── base.css   # Reset & base styles
│   │   │   ├── animations.css
│   │   │   └── index.css  # Combined import
│   │   └── components/    # UI components (Phase 2)
│   └── routes/
│       ├── +layout.svelte # Root layout
│       ├── +layout.ts     # SPA configuration
│       ├── +page.svelte   # Home page
│       ├── add/           # Add wine page
│       ├── edit/[id]/     # Edit wine page
│       ├── drink/[id]/    # Drink bottle page
│       └── history/       # Drunk wines history
├── static/                # Static assets
├── svelte.config.js       # SvelteKit configuration
├── vite.config.ts         # Vite + PWA configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## Available Scripts

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Build for production (outputs to build/)
npm run preview  # Preview production build
npm run check    # Run TypeScript type checking
npm run lint     # Run ESLint
npm run format   # Format with Prettier
```

## Configuration

### Base Path

The app is configured for subfolder deployment at `/qve/`. This is set in `svelte.config.js`:

```javascript
paths: {
  base: '/qve'
}
```

### PWA

PWA configuration is in `vite.config.ts`. The app:
- Caches static assets (JS, CSS, HTML, images, fonts)
- Caches Google Fonts for offline use
- Uses NetworkFirst strategy for API calls (5-minute cache)

### Theme

Theme (light/dark) is stored in localStorage and applied via CSS custom properties. See `src/lib/stores/theme.ts` and `src/lib/styles/tokens.css`.

## API Client

The TypeScript API client (`src/lib/api/client.ts`) provides type-safe access to all PHP endpoints:

```typescript
import { api } from '$api';

// Get wines with filters
const wines = await api.getWines({ countryDropdown: 'France' });

// Get dropdown options
const countries = await api.getCountries();

// Add a new wine
const { wineID } = await api.addWine(wineData);
```

## Design Tokens

Design tokens are extracted from the mockups in `design/qve-rebrand/`. Key tokens:

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | #FAF9F7 | #0C0B0A |
| `--text-primary` | #2D2926 | #F0EDE6 |
| `--accent` | #A69B8A | #B8AFA0 |

See `src/lib/styles/tokens.css` for complete list.

## Phase Status

- **Phase 0:** Mockup Design ✅
- **Phase 1:** SvelteKit Foundation ✅ (current)
- **Phase 2:** Core Infrastructure (next)
- **Phase 3:** Wine List & Cards
- **Phase 4:** Forms & Modals
- **Phase 5:** Polish & Launch

See `design/qve-rebrand/QVE_MIGRATION_PLAN.md` for detailed roadmap.
