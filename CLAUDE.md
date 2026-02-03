# Qvé Wine App - Session Context

**Last Updated**: 2026-02-01 (Sprint cleanup - JIRA is now source of truth)
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
│   │   ├── edit/      # WineForm, BottleForm, BottleSelector
│   │   └── agent/     # AgentPanel, ChatMessage, ActionChips, CommandInput, enrichment/
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
| agent | `stores/agent.ts` | Wine Assistant state, identification, enrichment, session persistence (sessionStorage) |

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
const TAP_TIMEOUT = 300; // ms

function handleTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}

function handleTouchEnd(e: TouchEvent) {
  const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
  const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
  const elapsed = Date.now() - touchStartTime;
  if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD || elapsed > TAP_TIMEOUT) return;
  // Handle tap...
}
```

### FilterDropdown Portal Pattern (FilterDropdown.svelte)
The dropdown uses a portal to escape the header's stacking context on iOS:
- Elements are moved to `document.body` on mount via `portalTarget`
- Dark theme styles must use `:global(html[data-theme="dark"])` selectors with hardcoded colors
- CSS variables don't inherit reliably when elements are portaled on iOS
- Theme attribute is copied to portal container but explicit color overrides are required

### iOS Safari Utility Classes (base.css)
```css
.scroll-momentum { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
.no-overscroll { overscroll-behavior: none; }
```

### Agent Session Persistence (stores/agent.ts)
Wine Assistant state survives mobile browser tab switches (e.g., switching to Camera app):

| Data | Storage | Lifetime |
|------|---------|----------|
| Chat messages, results, images | sessionStorage | Tab close clears |
| Panel open/close state | localStorage | Persists across sessions |

**Persisted state**: messages (max 30), lastResult, augmentationContext, enrichmentData, pendingNewSearch, phase, image data (base64)

**Images**: Stored as data URLs (not ObjectURLs) for cross-reload survival

**Clear triggers**:
| Trigger | Function | Effect |
|---------|----------|--------|
| Panel opens with no messages | `startSession()` | Clears storage, new greeting |
| "Start Over" button | `resetConversation()` | Adds divider + greeting, keeps history |
| Tab closed | Browser | sessionStorage auto-cleared |
| Hard reset | `fullReset()` | Clears all storage, closes panel |

**Persistence timing**:
- Debounced (500ms): Message additions, phase changes
- Immediate: Identification results, augmentation context, pendingNewSearch (critical for retry/mobile)

**Quota handling**: Graceful fallback drops image data first, then reduces to last 10 messages

**Orphan protection**: Loading states (`isLoading`, `isTyping`, `isEnriching`) reset to false on hydration

### Agent Input Behavior (AgentPanel.svelte)

The text input is **always visible** across all conversation phases, with phase-aware placeholders:

| Phase | Placeholder | Behavior on Text Submit |
|-------|-------------|------------------------|
| `greeting` | "Type wine name or take a photo..." | Starts fresh identification |
| `path_selection` | "Type wine name or take a photo..." | Starts fresh identification |
| `await_input` | "Type wine name or take a photo..." | Starts fresh identification |
| `identifying` | "Processing..." | Input disabled |
| `result_confirm` | "Or type to search again..." | Shows confirmation if wine identified |
| `action_select` | "Or identify another wine..." | Shows confirmation if wine identified |
| `confirm_new_search` | "Choose an option above..." | Input disabled |
| `handle_incorrect` | "Describe what I got wrong..." | Clears context, starts fresh |
| `augment_input` (text) | "Tell me more about this wine..." | Merges with existing context |
| `augment_input` (image) | "Add details visible in the image..." | Combines with original image |
| `complete` | "Processing..." | Input disabled |

**New Search Confirmation**: When user types during `action_select` phase (or `result_confirm` if not a chip response) with an identified wine, a confirmation prompt appears asking "Did you want to search for something new instead?" with chips:
- **Search New**: Clears context and proceeds with new identification
- **Keep Current**: Returns to previous phase with original chips

**Processing order in `result_confirm` phase**:
1. Chip response detection runs first ("yes", "yep", "no" → triggers Yes/No chip)
2. Only non-chip-response text triggers the new search confirmation

This prevents accidental loss of progress if user input is misunderstood. Conversational commands (like "start over") still execute immediately without confirmation.

**Confirmation state persistence**: `pendingNewSearch` is stored in sessionStorage to survive mobile tab switches (e.g., switching to Camera app and back).

**Input disabled**: During `identifying` (loading), `confirm_new_search` (awaiting chip selection), and `complete` (navigating to add-wine).

### Add Bottle to Existing Wine (WIN-145)

When user adds a wine that already exists in their cellar:

1. **Early check**: After "Add to Cellar" is tapped, `checkDuplicate` runs with producer name, wine name, and vintage
2. **If wine exists**: Shows `existing_wine_choice` message with:
   - "I found [wine] by [producer] already in your cellar with X bottles"
   - **Add Another Bottle** → Skips to bottle form, calls `api.addBottle()`
   - **Create New Wine** → Starts full region/producer/wine matching flow
3. **If no match**: Normal matching flow proceeds

**Key files:**
- `AgentPanel.svelte`: `handleAddToCellar()` early check, `add_bottle_existing` handler
- `agent.ts`: `AgentAddState.existingWineId`, `existing_wine_choice` message type
- `ChatMessage.svelte`: Renders `existing_wine_choice` message

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

For up-to-date task status, see [JIRA Board](https://philhumber.atlassian.net/jira/software/projects/WIN).

```bash
.\scripts\jira.ps1 list                    # All open issues
.\scripts\jira.ps1 sprint                  # Current sprint
.\scripts\jira.ps1 get WIN-123             # Issue details
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

### Agent Endpoints (`resources/php/agent/`)

| File | Purpose |
|------|---------|
| `_bootstrap.php` | Shared functions: `agentResponse()`, `agentExceptionError()`, `agentStructuredError()` |
| `identifyText.php` | Text-based wine identification |
| `identifyImage.php` | Image-based wine identification |
| `identifyWithOpus.php` | Premium Opus model escalation |
| `agentEnrich.php` | Wine enrichment (grapes, critics, drink window) |

### Agent Command Detection (`qve/src/lib/utils/commandDetector.ts`)

Client-side detection intercepts conversational commands before API calls:

| Command | Triggers | Action |
|---------|----------|--------|
| `start_over` | "start", "start over", "restart", "reset", "new wine" | Reset conversation |
| `cancel` | "stop", "cancel", "never mind", "quit", "exit" | Close panel |
| `go_back` | "back", "go back", "undo", "previous" | Return to await_input |
| `try_again` | "try again", "retry", "one more time" | Re-execute last action |

**False positive prevention**: Wine indicators checked first ("Château Cancel" → wine query), long text (>6 words) treated as wine query, punctuation normalized.

### Agent Chip Response Detection (`qve/src/lib/utils/commandDetector.ts`)

Users can type natural language responses instead of tapping chips. Detection runs in `result_confirm` phase only.

| Response Type | Example Triggers | Chip Actions Triggered |
|---------------|------------------|------------------------|
| Positive | "yes", "ok", "correct", "thats right", typos like "corectt" | `correct`, `confirm_direction`, `use_grape_as_name` |
| Negative | "no", "wrong", "not right", "incorrect", typos like "worng" | `not_correct`, `wrong_direction` |

**Behavior:**
- Multi-word input allowed: "yes please", "no thanks" → matches
- Short unrecognized input (1-3 words): Shows "I didn't quite catch that" fallback
- Wine indicators in input: Proceeds to identification instead
- Long input (4+ words): Proceeds to identification instead

### Brief Input Confirmation (`qve/src/lib/utils/commandDetector.ts`)

Single-word inputs trigger a confirmation prompt before making LLM API calls:

| Input | Behavior |
|-------|----------|
| "Margaux" | Prompt: "Just 'Margaux'? Adding more detail will improve the match." |
| "Champagne" | Prompt (even wine terms are ambiguous alone) |
| "2018" | Prompt (vintage alone is ambiguous) |
| "Margaux 2018" | No prompt (2+ words) |

**Chips shown:**
- **Search Anyway** → proceeds with the single word
- **I'll Add More** → user can type more, text accumulates (e.g., "Margaux" + "2018" → "Margaux 2018")

**When prompt is skipped:**
- Multi-word input (2+ words)
- In `augment_input` phase with existing context (user is providing details)
- Commands detected first ("start", "cancel", etc.)

---

## Agent Error Handling

The agent uses structured error responses for user-friendly error messages with retry support.

### Error Types (`AgentErrorType`)
| Type | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `timeout` | 408 | Yes | LLM took too long |
| `rate_limit` | 429 | Yes | Too many requests |
| `limit_exceeded` | 429 | No | Daily quota reached |
| `server_error` | 500 | Yes | Unexpected error |
| `overloaded` | 503 | Yes | Service overwhelmed |
| `database_error` | 500 | Yes | DB connection issue |
| `quality_check_failed` | 422 | No | Image too unclear |
| `identification_error` | 400 | No | Could not identify wine |
| `enrichment_error` | 400 | No | Could not enrich wine |

### Backend Error Functions (`_bootstrap.php`)

```php
// For exceptions (500 errors, timeouts, etc.)
agentExceptionError($e, 'endpointName');

// For service-level errors (success=false from LLM)
agentStructuredError($errorType, $fallbackMessage);
```

Both return structured JSON:
```json
{
  "success": false,
  "message": "Our sommelier is taking longer than expected...",
  "error": {
    "type": "timeout",
    "userMessage": "Our sommelier is taking longer than expected...",
    "retryable": true,
    "supportRef": "ERR-A3F7B2C1"
  }
}
```

### Support Reference

A unique error identifier that links user-facing errors to server-side debug logs.

**Format**: `ERR-XXXXXXXX` (8 uppercase hex chars)
- Generated from: `MD5(timestamp + errorType + endpoint)`
- Example: `ERR-A3F7B2C1`

**When it appears**:
- Only for **exception errors** (500s, timeouts caught in catch blocks)
- NOT for service-level errors (when LLM returns `success: false`)
- Retryable errors (timeout, rate_limit) still get a reference since they hit the exception path

**What gets logged** (PHP error log):
```
[Agent Error] Exception in identifyText | Context: {
  "type": "timeout",
  "message": "cURL error 28: Operation timed out",
  "supportRef": "ERR-A3F7B2C1",
  "trace": "#0 /var/www/.../AgentIdentificationService.php(123)..."
}
```

**Debugging workflow**:
1. User reports: "I got error ERR-A3F7B2C1"
2. Search PHP logs: `grep "ERR-A3F7B2C1" /var/log/php_errors.log`
3. Find full context: error type, message, stack trace, timestamp, endpoint

**User display** (in AgentPanel):
```
Our sommelier is taking longer than expected. Please try again or start over.

Reference: ERR-A3F7B2C1
```

### Frontend Error Handling

**Types** (`types.ts`):
```typescript
interface AgentErrorInfo {
  type: AgentErrorType;
  userMessage: string;
  retryable: boolean;
  supportRef?: string | null;
}

class AgentError extends Error {
  static fromResponse(json: AgentErrorResponse): AgentError;
  static isAgentError(error: unknown): error is AgentError;
}
```

**Stores** (`agent.ts`):
```typescript
// Derived stores for error state
export const agentError;           // Full AgentErrorInfo | null
export const agentErrorMessage;    // string | null
export const agentErrorRetryable;  // boolean
export const agentErrorSupportRef; // string | null
```

**UI** (`AgentPanel.svelte`):
- Tracks `lastAction` for retry functionality
- `showErrorWithRetry()` displays error with action chips
- "Try Again" chip (if retryable) repeats last action
- "Start Over" chip resets conversation
- Support reference shown on new line when available

### Error Message Style (Sommelier Personality)
- "Our sommelier is taking longer than expected..."
- "Our sommelier is quite busy at the moment..."
- "We've reached our tasting limit for today..."
- "That image is a bit unclear. Could you try a clearer photo?"

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
