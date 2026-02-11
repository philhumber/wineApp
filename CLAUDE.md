# Qvé Wine App - Session Context

**Last Updated**: 2026-02-07 (CLAUDE.md audit - updated architecture, counts, slimmed agent sections)
**Status**: Production - Deployed and stable
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Working Guidelines

**Architecture awareness**: This project underwent a major rearchitecture (Phase 2). ALWAYS verify you are editing current architecture files, not legacy/archived components. The old monolithic `ChatMessage.svelte` has been replaced by modular components in `components/agent/`. When in doubt, check `docs/AGENT_ARCHITECTURE.md` or ask which file is canonical before editing.

**Debugging discipline**: When fixing bugs, state your understanding of the root cause and which files you plan to edit BEFORE implementing. Do not assume the cause — ask if uncertain. This prevents wasted effort on wrong-approach fixes.

**Completeness check**: After implementing a fix or feature, grep the entire codebase for all related occurrences of the changed pattern before declaring done. Check for: other files using the old pattern, duplicate functions that could override the change, and tests referencing old behavior.

**UI edge cases**: When implementing UI/UX changes, enumerate ALL states and edge cases upfront before coding: single vs multiple items, empty states, user messages vs agent messages, mobile vs desktop.

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
.\scripts\deploy.ps1 -DryRun    # Preview changes
.\scripts\deploy.ps1            # Deploy with auto-backup
.\scripts\deploy.ps1 -ListBackups
.\scripts\deploy.ps1 -Rollback "2026-01-18_143022"

# JIRA CLI (REST API v3 + Agile)
.\scripts\jira.ps1 list                      # List open issues (paginated)
.\scripts\jira.ps1 list all                  # List all issues
.\scripts\jira.ps1 get WIN-123               # Get issue details
.\scripts\jira.ps1 create "Fix bug" Bug      # Create issue (Task, Bug, Story)
.\scripts\jira.ps1 update WIN-123 "New title" # Update issue summary
.\scripts\jira.ps1 status WIN-123 "Done"     # Transition status (disambiguates Done vs Cancelled)
.\scripts\jira.ps1 cancel WIN-123            # Transition to Cancelled
.\scripts\jira.ps1 comment WIN-123 "Note"    # Add comment
.\scripts\jira.ps1 backlog                   # Open issues not in any sprint
.\scripts\jira.ps1 sprint                    # Current sprint issues
.\scripts\jira.ps1 sprint-list               # List all sprints with issue counts
.\scripts\jira.ps1 sprint-issues 257         # Show issues in a sprint
.\scripts\jira.ps1 sprint-create "Name"      # Create sprint (max 30 chars)
.\scripts\jira.ps1 sprint-add 257 WIN-1,WIN-2 # Add issues to sprint
.\scripts\jira.ps1 sprint-start 257          # Start sprint (2-week)
.\scripts\jira.ps1 sprint-close 257          # Complete/close sprint
.\scripts\jira.ps1 sprint-delete 257         # Delete future sprint
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
│   ├── api/           # TypeScript API client (client.ts, types.ts)
│   ├── agent/         # Agent architecture (Phase 2) — router, state machine, handlers
│   │   ├── handlers/  # Action handlers (identification, enrichment, addWine, etc.)
│   │   ├── messages/  # Message factory functions
│   │   ├── middleware/ # Error handling, retry tracking, validation
│   │   ├── services/  # API service layer
│   │   └── types.ts, router.ts, stateMachine.ts, personalities.ts
│   ├── components/    # 90+ Svelte components
│   │   ├── ui/        # Icon, ThemeToggle, CurrencySelector, Toast, RatingDisplay, PriceScale, BuyAgainIndicator
│   │   ├── wine/      # WineCard, WineGrid, HistoryCard
│   │   ├── layout/    # Header, CollectionRow, FilterBar, SideMenu, FilterDropdown
│   │   ├── forms/     # FormInput, RatingDots, MiniRatingDots
│   │   ├── wizard/    # WizardStepIndicator, SearchDropdown, AILoadingOverlay
│   │   ├── modals/    # DrinkRateModal, ConfirmModal, DuplicateWarningModal, SettingsModal, AddBottleModal
│   │   ├── edit/      # WineForm, BottleForm, BottleSelector
│   │   └── agent/     # AgentPanel, ChatMessage, ActionChips, CommandInput
│   │       ├── cards/       # DataCard, EnrichmentCard, WineCard
│   │       ├── content/     # ChipsMessage, EnrichmentMessage, ErrorMessage, FormMessage, ImageMessage, TextMessage
│   │       ├── conversation/ # AgentChatContainer, InputArea, MessageList
│   │       ├── enrichment/  # CriticScores, DrinkWindow, GrapeComposition, StyleProfile, etc.
│   │       ├── forms/       # BottleDetailsForm, ManualEntryForm, MatchSelectionList
│   │       └── wine/        # WineConfidenceSection, WineDetailsSection, WineNameSection
│   ├── stores/        # 24 Svelte stores (16 core + 8 agent/settings)
│   ├── utils/         # commandDetector.ts (command/chip detection, brief input handling)
│   └── styles/        # tokens.css, base.css, animations.css, index.css
└── routes/            # SvelteKit file-based routing
    ├── +page.svelte   # Home / Cellar view
    ├── add/           # Add Wine wizard
    ├── history/       # Drink history
    ├── edit/[id]/     # Edit Wine/Bottle
    └── drink/[id]/    # Drink/Rate flow
docs/                  # Detailed reference docs (see below)
```

**Detailed reference docs** in `docs/`:
- `AGENT_ARCHITECTURE.md` — Router, middleware, handlers, state machine, message system, chip configs
- `COMPONENTS.md` — Full component API reference with props and usage
- `STORES.md` — All store APIs with state shapes and actions
- `API.md` — Full API client method reference
- `ARCHITECTURE.md` — System architecture diagrams and data flows
- `SOMMELIER_PERSONALITIES.md` — Agent personality configuration
- `DEVELOPMENT.md` — Extended development guide

---

## Key Stores

For full store APIs, see `docs/STORES.md`.

**Core stores (16):**

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
| settings | `stores/settings.ts` | Collection name, cellar value display |

**Agent stores (7) — Phase 2 rearchitecture split from monolithic agent.ts:**

| Store | File | Purpose |
|-------|------|---------|
| agent | `stores/agent.ts` | Core agent state, phase management, panel open/close |
| agentConversation | `stores/agentConversation.ts` | Chat messages, typing indicators |
| agentIdentification | `stores/agentIdentification.ts` | Identification results, confidence |
| agentEnrichment | `stores/agentEnrichment.ts` | Enrichment data (grapes, critics, drink window) |
| agentAddWine | `stores/agentAddWine.ts` | Add-to-cellar flow state |
| agentPersistence | `stores/agentPersistence.ts` | sessionStorage save/restore |
| agentSettings | `stores/agentSettings.ts` | Agent personality settings |

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

### Agent Session Persistence

State survives mobile browser tab switches (e.g., switching to Camera app). See `docs/AGENT_ARCHITECTURE.md` for full persistence details.

- **sessionStorage**: Messages (max 30), results, images (as data URLs), phase, augmentation context
- **localStorage**: Panel open/close state
- **Orphan protection**: Loading states reset to false on hydration
- **Quota fallback**: Drops image data first, then reduces to last 10 messages

### Confidence Handling (Gotcha)

- **API format**: PHP returns confidence as **percentage (0-100)**, e.g., `18` = 18%
- **Internal format**: `analyzeResultQuality()` normalizes to **decimal (0-1)** for threshold comparisons
- **Thresholds**: `LOW_CONFIDENCE_THRESHOLD = 0.7`, `ESCALATION_CONFIDENCE_THRESHOLD = 0.6`
- **Always use** `identification.getConfidence()` as the authoritative source — `result.confidence` may be lost through serialization during field accumulation flows

### Streaming Card vs Message Card (Gotcha)

**Identification** uses a dual-path rendering approach:
1. **Streaming card** — in `AgentPanel.svelte`, reads from `streamingFields` store, shows progressive field arrival during SSE
2. **Message card** — in `MessageList` via `WineCardMessage.svelte`, reads from `message.data.result`, shows static data after completion

**Never create message cards inside SSE `onEvent` callbacks.** Svelte's reactive rendering is batched — calling `setResult()` (clears streaming card) + `handleIdentificationResultFlow()` (adds message card) inside a synchronous callback causes blank rendering due to `isPrecedingReady` sequencing issues.

**Correct pattern**: Use `onEvent` only for lightweight state updates (e.g., `startEscalation()`). Capture escalated results in a closure variable. Create the message card **after `await` resolves**:
```typescript
let escalatedResult = null;
const result = await api.identifyTextStream(text, onField, (event) => {
  if (event.type === 'refining') identification.startEscalation(2);
  if (event.type === 'refined' && event.data.escalated) escalatedResult = event.data;
  // Do NOT create message cards here!
});
// After await — safe to transition streaming card → message card
identification.setResult(wineResult, confidence);
handleIdentificationResultFlow(wineResult, confidence);
```

**TypeScript gotcha**: TS narrows callback-mutated variables to `never`. Use type assertion: `const esc = escalatedResult as Type | null;`

**Enrichment** uses a single-path approach — the enrichment handler creates one message card immediately (skeleton state) and updates it in-place as SSE fields arrive via `conversation.updateMessage()`. A 7-second delay keeps the typing/thinking message visible before the card appears for LLM responses (cache hits show the card immediately). Text fields (`overview`, `tastingNotes`, `pairingNotes`) stream token-by-token with a blinking cursor via `text_delta` SSE events, throttled at 100ms.

See `PLAN.md` "Critical Lesson" section for full breakdown with broken vs working code examples.

### Gemini REST API Gotchas

When calling Gemini via the REST API (v1beta), NOT the SDK:
- **`googleSearch` camelCase**: REST API requires `googleSearch`, not `google_search`. Snake case silently fails (no grounding, no error).
- **Schema types lowercase**: Use `"type": "object"`, not `"OBJECT"`. Uppercase causes `response_schema` + streaming to produce looping/garbage output.
- **`nullable: true` not `["type", "null"]`**: SDK docs show `{"type": ["string", "null"]}` but REST protobuf rejects arrays — use `"nullable": true` instead.
- **`propertyOrdering`**: Controls field output order in structured output — critical for streaming field detection. Add to all object types in the schema.
- **`response_schema` + `googleSearch` + streaming**: Works on `gemini-3-flash-preview` with `thinkingLevel: MEDIUM`. Does NOT work reliably on `gemini-3-pro-preview` (produces repeating text).
- **Grounding metadata empty with `responseSchema`**: When combining `responseSchema` + `googleSearch`, grounding chunks/supports come back empty. Use fixed confidence (0.7) instead of calculating from metadata.
- **Citation markers in grounded output**: Google Search grounding injects `[[1](url)]` in text fields. Strip with regex in `cleanAndParseJSON()` before JSON parsing.

### Agent Input & Command Detection

Full phase table and command detection in `docs/AGENT_ARCHITECTURE.md`. Key behaviors:

- Text input is **always visible** with phase-aware placeholders
- **New Search Confirmation**: Typing during `action_select`/`result_confirm` shows "Search New" / "Keep Current" chips to prevent accidental progress loss
- **Chip response detection** in `result_confirm`: "yes"/"no" → triggers chip action; unrecognized short input → fallback message
- **Brief input confirmation**: Single words prompt "Just 'X'? Adding more detail will improve the match."
- **Command detection** (`lib/utils/commandDetector.ts`): "start over", "cancel", "go back", "try again" — with false-positive prevention for wine names
- **`pendingNewSearch`** persisted to sessionStorage for mobile tab-switch survival

### Add Bottle to Existing Wine

After "Add to Cellar", `checkDuplicate` runs. If wine exists, user sees "Add Another Bottle" (→ `api.addBottle()`) or "Create New Wine" (→ full matching flow).

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
| `getBottles.php` | Get bottles for a wine |
| `getDrunkWines.php` | History with ratings |
| `getCountries.php` | Countries with bottle counts (cascading) |
| `getTypes.php` | Types with bottle counts (cascading) |
| `getRegions.php` | Regions with bottle counts (cascading) |
| `getProducers.php` | Producers with bottle counts (cascading) |
| `getYears.php` | Vintages with bottle counts (cascading) |
| `getCurrencies.php` | Currencies and bottle sizes for settings |
| `getUserSettings.php` | Retrieve user settings |
| `updateUserSettings.php` | Update user settings |
| `updateRating.php` | Update rating for drunk wine |
| `getCellarValue.php` | Calculate total cellar value |
| `upload.php` | Image upload (800x800) |
| `geminiAPI.php` | AI enrichment |
| `checkDuplicate.php` | Duplicate/similar item detection (fuzzy matching) |
| `databaseConnection.php` | Database connection utility |
| `normalize.php` | String normalization utilities |
| `validators.php` | Input validation utilities |

### Agent Endpoints (`resources/php/agent/`)

| File | Purpose |
|------|---------|
| `_bootstrap.php` | Shared functions: `agentResponse()`, `agentExceptionError()`, `agentStructuredError()` |
| `identifyText.php` | Text-based wine identification |
| `identifyImage.php` | Image-based wine identification |
| `identifyWithOpus.php` | Premium Opus model escalation |
| `agentEnrich.php` | Wine enrichment (grapes, critics, drink window) |
| `clarifyMatch.php` | Match clarification/disambiguation |
| `identifyTextStream.php` | Streaming text identification |
| `identifyImageStream.php` | Streaming image identification |
| `agentEnrichStream.php` | Streaming enrichment endpoint |
| `config/` | Agent configuration (`agent.config.php`) |
| `Identification/` | Service classes (ImageQualityAssessor, IntentDetector, InputClassifier, etc.) |
| `Enrichment/` | Service classes (EnrichmentService, EnrichmentCache, ValidationService, etc.) |
| `LLM/` | LLM client and adapters (ClaudeAdapter, GeminiAdapter, SSLConfig, CircuitBreaker, etc.) |

### Agent Command & Input Detection

See `docs/AGENT_ARCHITECTURE.md` (Section 15: Command Detection) for full tables. Key file: `qve/src/lib/utils/commandDetector.ts`.

---

## Agent Error Handling

Full error handling reference in `docs/AGENT_ARCHITECTURE.md` (Section 16: Error Handling).

**Quick reference:**
- Backend: `agentExceptionError($e, 'endpoint')` for exceptions, `agentStructuredError($type, $msg)` for service errors
- Both return structured JSON with `{ success, message, error: { type, userMessage, retryable, supportRef } }`
- **Support Ref**: `ERR-XXXXXXXX` format, exception-only, debug via `grep "ERR-XXX" /var/log/php_errors.log`
- Frontend: `AgentError.fromResponse(json)`, derived stores (`agentError`, `agentErrorRetryable`, `agentErrorSupportRef`)
- UI: "Try Again" chip (if retryable) + "Start Over" chip, sommelier-personality messages
- Error types: `timeout`(408), `rate_limit`(429), `limit_exceeded`(429), `server_error`(500), `overloaded`(503), `database_error`(500), `ssl_error`(502), `quality_check_failed`(422), `identification_error`(400), `enrichment_error`(400)

---

## Database

**Host**: 10.0.0.16
**Database**: winelist
**Schema**: `resources/sql/Full_DB_Structure.sql` (canonical, 28 tables + 3 views)

**Core** (12): `wine`, `bottles`, `ratings`, `producers`, `region`, `country`, `winetype`, `grapes`, `grapemix`, `worlds`, `currencies`, `bottle_sizes`, `user_settings`, `audit_log`, `critic_scores`
**Agent** (7): `agentUsers`, `agentSessions`, `agentUsageLog`, `agentUsageDaily`, `agentIdentificationResults`, `agentUserTasteProfile`, `agentWineEmbeddings`
**Cache** (3): `cacheWineEnrichment`, `cacheProducers`, `cacheCanonicalAliases`
**Reference** (6): `refAbbreviations`, `refAppellations`, `refGrapeCharacteristics`, `refWineStyles`, `refPairingRules`, `refIntensityProfiles`
**Views** (3): `vw_model_confidence_stats`, `vw_tier_escalation_analysis`, `vw_model_comparison`

See `docs/ARCHITECTURE.md` Section 4 for full ER diagrams and column details.

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
