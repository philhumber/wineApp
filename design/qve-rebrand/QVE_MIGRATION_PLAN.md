# Qvé Migration Plan: Wine Collection App Redesign

**Created**: 2026-01-13
**Status**: Ready for Approval
**Estimated Duration**: 15-21 days of development

---

## Executive Summary

Migrate the existing Wine Collection App to a new **Svelte-based PWA** called "Qvé" with a quiet luxury aesthetic. The new app will be built in parallel at `/qve/` alongside the existing app, using the same PHP backend.

### Key Decisions
- **Approach**: Parallel build (zero risk to existing app)
- **Framework**: Svelte/SvelteKit
- **Components**: Headless primitives (Melt UI or Bits UI) + Custom Qvé CSS
- **Mobile**: PWA with offline support, installable
- **Design**: Mockup-first for all flows before coding
- **Hosting**: Same server at `/qve/` subfolder
- **Branding**: "Qvé" is the official product name
- **Multi-user**: Design for future auth support, but don't implement now
- **Timing**: Finish Sprint 3 first, then begin Qvé migration

---

## Pre-requisite: Complete Sprint 3

**Before starting Qvé migration**, finish the remaining Sprint 3 items in the existing app:

| Issue | Status | Description |
|-------|--------|-------------|
| WIN-95 | To Do | Update Picture Upload (white bg, square) |
| WIN-88 | To Do | Show price value on wineCard ($ to $$$$$) |
| WIN-84 | To Do | Add purchase date for add wine |
| WIN-38 | In Progress | Upload Button UI (hide after success) |
| WIN-43 | To Do | Loading UI Improvements (fun AI messages) |
| WIN-96 | To Verify | Card scroll behavior (likely fixed) |

**Rationale**: These fixes benefit the current production app, and some patterns (like AI loading messages) will be reused in Qvé.

---

## Phase 0: Mockup Design (Before Coding)

**Goal**: Create static mockups for all flows not covered by the existing mockup.

### Required Mockups

| Flow | Priority | Notes |
|------|----------|-------|
| Add Wine (4-step form) | P0 | Region → Producer → Wine → Bottle tabs |
| Drink/Rate Bottle | P0 | Rating selection, notes, bottle picker |
| Add Bottle (modal) | P1 | Single form, attach to existing wine |
| Edit Wine/Bottle | P1 | 2-tab form |
| Toast Notifications | P2 | Success/error styling |
| Empty/Error States | P2 | No wines, loading, network error |

**Design Principles** (from existing mockup):
- Quiet luxury - understated, not flashy
- Cormorant Garamond (headings) + Outfit (body)
- Light mode: morning tasting room | Dark mode: penthouse evening
- Subtle shadows, almost invisible borders
- Accent color: aged cork `#A69B8A`

**Deliverable**: Static HTML mockups in `design/qve-rebrand/` folder

---

## Phase 1: Project Foundation

**Goal**: Set up SvelteKit project with proper configuration for PWA and subfolder deployment.

### 1.1 Initialize SvelteKit Project

```
wineapp/
├── qve/                         # NEW Svelte app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/             # API client (TypeScript)
│   │   │   ├── stores/          # Svelte stores (state)
│   │   │   ├── components/      # UI components
│   │   │   └── styles/          # Design tokens
│   │   ├── routes/              # SvelteKit pages
│   │   └── app.html
│   ├── static/
│   │   ├── manifest.json        # PWA manifest
│   │   ├── sw.js                # Service worker
│   │   └── icons/
│   ├── svelte.config.js
│   └── package.json
├── resources/php/               # EXISTING (unchanged)
└── index.html                   # EXISTING (unchanged)
```

### 1.2 Configure for `/qve/` Deployment

```javascript
// svelte.config.js
export default {
  kit: {
    adapter: adapter({ pages: 'build', fallback: 'index.html' }),
    paths: { base: '/qve' }  // Critical for subfolder
  }
};
```

### 1.3 Extract Design System

Convert CSS from `design/qve-rebrand/qve-mockup.html` into:

| File | Contents |
|------|----------|
| `tokens.css` | Color palette, spacing, typography variables |
| `theme.css` | Light/dark mode definitions |
| `base.css` | Reset, body styles, selections |
| `animations.css` | Transitions, keyframes |

---

## Phase 2: Core Infrastructure

**Goal**: Build the foundational layers that all features depend on.

### 2.1 API Client Layer

Create TypeScript API client mirroring existing `api.js`:

```typescript
// src/lib/api/client.ts
export const api = {
  // Read endpoints
  getWines: (filters) => fetchJSON('getWines.php', mapFilters(filters)),
  getCountries: (filters) => fetchJSON('getCountries.php', filters),
  getRegions: (filters) => fetchJSON('getRegions.php', filters),
  getProducers: (filters) => fetchJSON('getProducers.php', filters),
  getTypes: (filters) => fetchJSON('getTypes.php', filters),
  getYears: (filters) => fetchJSON('getYears.php', filters),
  getBottles: (wineID) => fetchJSON('getBottles.php', { wineID }),
  getDrunkWines: () => fetchJSON('getDrunkWines.php'),

  // Write endpoints
  addWine: (data) => fetchJSON('addWine.php', data),
  addBottle: (data) => fetchJSON('addBottle.php', data),
  updateWine: (data) => fetchJSON('updateWine.php', data),
  updateBottle: (data) => fetchJSON('updateBottle.php', data),
  drinkBottle: (data) => fetchJSON('drinkBottle.php', data),

  // Utilities
  uploadImage: (file) => uploadFile('upload.php', file),
  callAI: (type, prompt) => fetchJSON('callGeminiAI.php', { type, prompt })
};
```

**Filter field mapping** (addresses backend coupling):
```typescript
const filterMap = {
  country: 'countryDropdown',
  region: 'regionDropdown',
  producer: 'producerDropdown',
  type: 'typesDropdown',
  year: 'yearDropdown'
};
```

### 2.2 Svelte Stores

Migrate from `AppState` class to Svelte stores:

| Store | Purpose |
|-------|---------|
| `wines` | Wine list array |
| `filters` | Active filter values |
| `viewMode` | 'ourWines' or 'allWines' |
| `theme` | 'light' or 'dark' (persisted) |
| `viewDensity` | 'compact' or 'medium' (persisted) |
| `toasts` | Notification queue |
| `activeModal` | Current modal state |

### 2.3 PWA Configuration

- `manifest.json` - App metadata, icons, theme colors
- `sw.js` - Service worker for offline support
- Cache strategy: Static assets cached, API calls always network

---

## Phase 3: UI Components

**Goal**: Build reusable components matching Qvé design language.

### Headless Component Strategy

Use **Melt UI** or **Bits UI** for complex interactive components, styled with custom Qvé CSS:

| Component | Use Headless? | Reason |
|-----------|---------------|--------|
| Dropdown/Select | ✅ Yes | Keyboard nav, accessibility, positioning |
| Modal/Dialog | ✅ Yes | Focus trap, escape key, overlay |
| Date Picker | ✅ Yes | Complex interactions, calendar logic |
| Tabs (multi-step form) | ✅ Yes | ARIA roles, keyboard nav |
| Toast | ❌ Custom | Simple enough, Qvé-specific animations |
| Cards | ❌ Custom | Unique design, simple expand/collapse |
| Buttons/Pills | ❌ Custom | Just styled elements |

**Benefits**:
- Accessibility built-in (ARIA, keyboard navigation)
- Complex logic handled (positioning, focus management)
- Full visual control with Qvé CSS
- Smaller bundle than full component libraries

### Layout Components
- `Header.svelte` - Logo, theme toggle, view toggle, actions
- `FilterBar.svelte` - Horizontal scrolling filter pills
- `Toast.svelte` - Notification popups
- `Modal.svelte` - Generic modal wrapper

### Wine Components
- `WineCard.svelte` - Card with expand/collapse
- `WineGrid.svelte` - Grid container (compact/medium views)
- `BottleIndicators.svelte` - SVG bottle silhouettes by size
- `RatingDisplay.svelte` - Rating dot + number
- `WineActions.svelte` - Drink/Add/Edit buttons

### Filter Components
- `FilterPill.svelte` - Toggle button (All, Ours, Red, White...)
- `FilterDropdown.svelte` - Dropdown with dynamic options

### Form Components
- `FormStep.svelte` - Multi-step form container
- `StepIndicator.svelte` - Progress dots
- `AIButton.svelte` - AI generation with loading states
- `ImageUpload.svelte` - Upload with preview

---

## Phase 4: Page Routes

**Goal**: Implement all application pages/flows.

### 4.1 Wine List (Home) - `routes/+page.svelte`
- Load wines on mount
- React to filter changes
- Support compact/medium view toggle
- Card expand/collapse

### 4.2 Add Wine Flow - `routes/add/+page.svelte`
**Requires mockup first**

4-step wizard:
1. Region - Search existing or create new
2. Producer - Search existing or create new
3. Wine - Details + AI generation + image upload
4. Bottle - Size, location, source, price

### 4.3 Add Bottle - `routes/add-bottle/[wineId]/+page.svelte`
Single form to add bottle to existing wine.

### 4.4 Edit Wine/Bottle - `routes/edit/[wineId]/+page.svelte`
Load existing data, allow edits, save changes.

### 4.5 Drink/Rate - `routes/drink/[wineId]/+page.svelte`
**Requires mockup first**

- Bottle selector dropdown
- Rating interface (10-point scale for overall + value)
- Buy again toggle
- Tasting notes
- Drink date picker

### 4.6 History - `routes/history/+page.svelte`
List of consumed wines with ratings.

---

## Phase 5: Advanced Features

**Goal**: Port remaining features from existing app.

### 5.1 AI Data Generation
- Loading spinner with fun messages ("Searching cellars...", "Tasting vintages...")
- Populate form fields with AI response
- Error handling with toast

### 5.2 Scroll-to-Wine After Operations
- After add/edit, scroll to affected wine
- 2-second highlight animation

### 5.3 Filter State Persistence
- Maintain filters after add/edit/drink operations
- View mode preference persisted

---

## Phase 6: Testing & Polish

### Unit Tests (Vitest)
- API client: 80%+ coverage
- Store logic: 80%+ coverage
- Key components: 70%+ coverage

### E2E Tests (Playwright)
- Wine list loading
- Filter interactions
- Theme toggle
- Add wine flow
- Drink/rate flow

### PWA Checklist
- [ ] Manifest loads correctly
- [ ] Service worker registers
- [ ] App installable on mobile
- [ ] Offline fallback works
- [ ] Icons display correctly

### Cross-Browser Testing
- [ ] Chrome (desktop + Android)
- [ ] Safari (desktop + iOS)
- [ ] Firefox
- [ ] Edge

---

## Phase 7: Deployment

### Build
```bash
cd qve
npm run build
# Copy build/ contents to /qve/ on server
```

### Server Config
Ensure SPA routing works for `/qve/*` paths.

---

## Critical Files Reference

### To Extract Design From
- [design/qve-rebrand/qve-mockup.html](qve-mockup.html) - 1,100+ lines CSS

### To Port Patterns From
- [resources/js/core/api.js](../../resources/js/core/api.js) - API client pattern
- [resources/js/core/state.js](../../resources/js/core/state.js) - State management
- [resources/js/ui/cards.js](../../resources/js/ui/cards.js) - Card rendering logic

### To Reference for Flow Design
- [addwine.html](../../addwine.html) - Current 4-step add flow
- [rating.html](../../rating.html) - Current rating interface
- [editWine.html](../../editWine.html) - Current edit form

### Backend (Unchanged)
- [resources/php/getWines.php](../../resources/php/getWines.php) - Main wine query
- [resources/php/addWine.php](../../resources/php/addWine.php) - Add wine transaction
- [resources/php/drinkBottle.php](../../resources/php/drinkBottle.php) - Drink + rate

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Mockups | 2-3 days | None |
| Phase 1: Foundation | 1-2 days | None |
| Phase 2: Infrastructure | 2-3 days | Phase 1 |
| Phase 3: Components | 3-4 days | Phase 2 |
| Phase 4: Routes | 4-5 days | Phase 3, **Phase 0** |
| Phase 5: Advanced | 2-3 days | Phase 4 |
| Phase 6: Testing | 2-3 days | Phase 5 |
| Phase 7: Deploy | 1 day | Phase 6 |

**Total**: 17-24 days

**Critical Path**: Mockups must be done before Phase 4 can proceed past basic wine list.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API field name coupling | Filter mapping adapter in API client |
| Complex form state | Use Svelte stores, consider form library if needed |
| Service worker cache issues | Version cache names, network-first for API |
| Mobile performance | Lazy load images, consider virtual scrolling for large lists |
| Design drift | Extract mockup CSS exactly, mockup ALL flows first |

---

## Future-Proofing: Auth-Ready Architecture

While multi-user auth is **out of scope** for this migration, the architecture should not preclude adding it later.

### Design Patterns to Follow

1. **API Client Abstraction**
   - All API calls go through centralized client
   - Easy to add auth headers later: `Authorization: Bearer <token>`

2. **User Context Store**
   ```typescript
   // src/lib/stores/user.ts
   export const currentUser = writable<User | null>(null);
   export const isAuthenticated = derived(currentUser, u => u !== null);
   ```

3. **Route Guards (Future)**
   - SvelteKit hooks can check auth before loading pages
   - Currently: all routes public
   - Later: wrap with `+layout.server.ts` auth check

4. **Database Ready** (Already done)
   - `audit_log` table already has `changedBy` column
   - `bottles` and `wine` have `deletedBy` column
   - Just need to add `user_id` FK when ready

### What NOT to Build Now
- Login/logout UI
- Session management
- User settings page
- Per-user wine filtering

**When to revisit**: After Qvé is stable and you decide to share with others

---

## Verification Plan

### After Phase 1
- [ ] SvelteKit dev server runs at localhost:5173
- [ ] Build produces static files
- [ ] `/qve/` base path works

### After Phase 2
- [ ] API calls work with existing PHP backend
- [ ] Stores update reactively
- [ ] Theme toggle persists

### After Phase 3
- [ ] Wine cards render with correct styling
- [ ] Compact/medium view toggle works
- [ ] Cards expand/collapse

### After Phase 4
- [ ] All CRUD operations work
- [ ] Filters work correctly
- [ ] Rating saves properly

### After Phase 5
- [ ] AI generation works
- [ ] Scroll-to-wine works
- [ ] Toast notifications appear

### After Phase 6
- [ ] All tests pass
- [ ] PWA installable
- [ ] Works on mobile

### After Phase 7
- [ ] Live at /qve/ on production
- [ ] Old app still works at /
- [ ] Can A/B test between versions

---

## Next Steps

### Immediate (Sprint 3 Completion)
1. Complete remaining Sprint 3 items (WIN-95, WIN-88, WIN-84, WIN-38, WIN-43, WIN-96)
2. Verify all tests pass on existing app

### Then (Qvé Migration)
1. **Create mockups** for Add Wine and Drink/Rate flows
2. **Choose headless library**: Melt UI vs Bits UI (try both, pick one)
3. **Initialize SvelteKit project** in `/qve/` folder
4. **Extract design tokens** from mockup CSS
5. Begin component development

---

## Security Considerations

While auth is deferred, these security practices apply now:

| Area | Current State | Recommendation |
|------|---------------|----------------|
| SQL Injection | ✅ PDO prepared statements | Maintain in new API calls |
| XSS | ⚠️ Some raw HTML insertion | Use Svelte's built-in escaping |
| CSRF | ❌ Not implemented | Consider for mutations when adding auth |
| Input Validation | ✅ Server-side | Also validate client-side for UX |
| Image Upload | ✅ File type validation | Keep current PHP validation |

---

## Future JIRA Items (Post-Migration)

These enhancements are **out of scope** for the UI migration but should be logged for future sprints. Copy these directly into JIRA.

---

### Performance & UX

**WIN-NEW: Skeleton Loading States**
- Type: Task
- Priority: Medium
- Description: Show placeholder card shapes while loading wines. Better perceived performance than spinners. Use CSS animations matching Qvé aesthetic.
- Acceptance: Loading state shows skeleton cards, transitions smoothly to real cards

**WIN-NEW: Image Lazy Loading**
- Type: Task
- Priority: Medium
- Description: Implement lazy loading for wine images using Intersection Observer. Only load images when scrolling into viewport.
- Acceptance: Images load on scroll, no layout shift, placeholder shown before load

**WIN-NEW: Optimistic Updates for Actions**
- Type: Task
- Priority: Low
- Description: Show changes immediately before API confirms. Bottle count decrements instantly on "Drink", rolls back if API fails.
- Acceptance: Actions feel instant, graceful rollback on error

**WIN-NEW: Pull-to-Refresh (Mobile)**
- Type: Task
- Priority: Low
- Description: Native-feeling pull-to-refresh gesture for mobile PWA. Refreshes wine list.
- Acceptance: Pull gesture triggers refresh on iOS and Android

---

### New Features

**WIN-NEW: Keyboard Shortcuts**
- Type: Task
- Priority: Low
- Description: Power user shortcuts: `n` new wine, `f` focus search, `t` toggle theme, `Esc` close modal
- Acceptance: Shortcuts work on desktop, don't conflict with browser

**WIN-NEW: Undo Drink Action**
- Type: Task
- Priority: Medium
- Description: After drinking a bottle, show "Undo" button in toast for 5 seconds. Prevents accidental data loss.
- Acceptance: Undo restores bottle and removes rating

**WIN-NEW: Collection Statistics Dashboard**
- Type: Story
- Priority: Low
- Description: New page showing collection insights: total bottles, total value, breakdown by country/type (charts), drinking trends over time, aging recommendations.
- Acceptance: Dashboard page with charts, filters by date range

**WIN-NEW: Wine Label Scanning**
- Type: Story
- Priority: Low
- Description: Use device camera to capture wine label. AI (Gemini) extracts wine name, producer, year, region. Auto-fills add wine form.
- Acceptance: Camera opens, captures image, AI returns structured data, form populates

---

### Developer Experience

**WIN-NEW: Component Documentation (Storybook/Histoire)**
- Type: Task
- Priority: Low
- Description: Set up Storybook or Histoire for Svelte. Document all Qvé components with props, variants, and usage examples.
- Acceptance: Living style guide deployed, all components documented

**WIN-NEW: CI/CD Pipeline**
- Type: Task
- Priority: Medium
- Description: GitHub Actions workflow: lint on PR, build check, auto-deploy to /qve/ on merge to main.
- Acceptance: Merges to main auto-deploy, PRs show build status

**WIN-NEW: Visual Regression Testing**
- Type: Task
- Priority: Low
- Description: Add Playwright screenshot tests or integrate Chromatic. Catch CSS regressions on PRs.
- Acceptance: PRs show visual diffs, tests block merge on regression

---

### PWA Enhancements

**WIN-NEW: Offline Mutation Queue**
- Type: Story
- Priority: Low
- Description: Queue add/edit/drink operations when offline. Sync when connection returns. Show "pending sync" indicator.
- Acceptance: Can add wine offline, syncs on reconnect, no data loss

**WIN-NEW: PWA Share Target**
- Type: Task
- Priority: Low
- Description: Register app as share target. Users can share wine photos from camera → opens in Qvé for adding.
- Acceptance: "Share to Qvé" appears in OS share sheet

**WIN-NEW: Drink Reminder Notifications**
- Type: Story
- Priority: Low
- Description: Push notifications for wine aging: "Your 2018 Burgundy is entering its prime!" Based on optimal drink windows.
- Acceptance: Opt-in notifications, configurable timing

---

### Content & Localization

**WIN-NEW: First-Time Onboarding**
- Type: Task
- Priority: Medium
- Description: Welcome modal for new users explaining key features. Empty state with "Add your first wine" CTA.
- Acceptance: New users see onboarding, can skip, not shown again

**WIN-NEW: Internationalization Prep**
- Type: Task
- Priority: Low
- Description: Externalize strings, format dates/currencies by locale. Prep for future translations.
- Acceptance: Dates/currencies respect locale, strings in separate file

---

*This plan enables incremental migration with zero risk to the existing production app.*
