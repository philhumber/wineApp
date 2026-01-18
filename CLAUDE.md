# Wine Collection App - Quick Start Guide

**Last Updated**: 2026-01-18
**Status**: Phase 1 Complete ✅ | Sprint 1-2 Complete ✅ | Sprint 3 In Progress 🟡
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

> **💡 For comprehensive project information, see [README.md](README.md)**
> **📚 For detailed documentation, see [docs/README.md](docs/README.md)**

---

## Current Session Context

### Sprint Status

| Sprint | Status | Focus |
|--------|--------|-------|
| Sprint 1 | ✅ COMPLETE | Critical bug fixes (WIN-87, WIN-86, WIN-66, WIN-93) |
| Sprint 2 | ✅ COMPLETE | UX improvements (toast, filters, scroll, view mode) |
| Sprint 3 | 🟡 IN PROGRESS | Features: WIN-84 remaining |
| Qvé Migration | 📋 PLANNED | Svelte/SvelteKit PWA - plan approved |

### What You Need to Know

1. **✅ Phase 1 Complete** - 17 ES6 modules, old `wineapp.js` deprecated (DO NOT LOAD)
2. **🟡 Sprint 3 Active** - 1 remaining issue before Qvé migration
3. **✅ GitHub Setup Complete** - Repo at `philhumber/wineApp` with 3-branch workflow
4. **✅ Credentials Secured** - All credentials in `../wineapp-config/` (outside web root)
5. **📋 Qvé Plan Ready** - Full plan at `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`

### Critical Warnings

⚠️ **DO NOT** load old `resources/wineapp.js` - causes conflicts with modular system
⚠️ **DO NOT** use `ratingManager.closeModal()` - use `modalManager.hideAll()` instead
⚠️ **ALWAYS** refresh dropdowns after mutations - `dropdownManager.refreshAllDropdowns()`
⚠️ **CREDENTIALS** are in `../wineapp-config/` (DB: `config.local.php`, JIRA: `jira.config.json`)

---

## Quick Commands

```bash
# Run local development server
php -S localhost:8000

# Git workflow (always work from develop)
git checkout develop
git pull origin develop
git checkout -b feature/WINE-XX-description

# View open JIRA issues (token in ../wineapp-config/jira.config.json)
curl -u "phil.humber@gmail.com:$(cat ../wineapp-config/jira.config.json | jq -r .token)" \
  "https://philhumber.atlassian.net/rest/api/3/search?jql=project=WIN+AND+status!=Done"

# Database connection
mysql -h 10.0.0.16 -u username -p winelist
```

---

## GitHub & Branching

**Repository**: https://github.com/philhumber/wineApp

**Branch Structure**:
```
main (QA / testing - manual deploy to prod)
  │
  ├── develop (ongoing fixes & features)
  │
  └── svelte-rewrite (Qvé migration)
```

**Workflow**: Create feature branches from `develop`, open PRs, squash merge.
See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/06-reference/GITHUB_QUICK_REFERENCE.md](docs/06-reference/GITHUB_QUICK_REFERENCE.md)

**Credentials**: Stored in `../wineapp-config/` (outside repo):
- `config.local.php` - Database credentials
- `jira.config.json` - JIRA API token (email, token, baseUrl)

---

## Technology Stack (Quick Reference)

- **Frontend**: Vanilla JavaScript ES6+ modules (17 modules, no frameworks)
- **Backend**: PHP 7+ with PDO
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
- **AI**: Google Gemini AI API
- **Architecture**: Observable state, event delegation, template cloning

**See [README.md](README.md) for complete stack details and project structure.**

---

## Key Files to Know

### JavaScript Modules (17 total)
```
resources/js/
├── app.js                          # Main entry, event delegation, init
├── core/
│   ├── api.js                      # WineAPI class, all backend calls
│   ├── state.js                    # AppState, viewMode, filters
│   └── modals.js                   # Modal overlay management
├── ui/
│   ├── cards.js                    # Card rendering, scrollToCard
│   ├── toast.js                    # Toast notifications
│   ├── loading.js                  # AI loading text cycler
│   ├── dropdowns.js                # Filter dropdowns
│   └── navigation.js               # Sidebar navigation
├── features/
│   ├── rating.js                   # 10-star rating system
│   ├── wine-management.js          # Add/edit wines
│   └── bottle-tracking.js          # Add/drink bottles
└── utils/                          # DOM helpers, validation
```

### PHP Backend (17 files)
```
resources/php/
├── getWines.php                    # Complex JOIN query with filters
├── addWine.php                     # Transaction-based insert (4 tables)
├── drinkBottle.php                 # Mark drunk, add rating
├── upload.php                      # 800x800px image processing
├── audit_log.php                   # Change tracking
└── ... (12 more)
```

### HTML Pages
- `index.html` - Main SPA entry
- `addwine.html` - 4-tab wine add form
- `rating.html` - Rating interface (has `#wineToRate`)
- `addBottle.html` - Add bottle form (has `#wineToAdd`)

### Database
- `resources/sql/DBStructure.sql` - Complete schema
- 11 tables: wine, bottles, ratings, producers, region, country, winetype, grapes, grapemix, worlds, audit_log
- **See [README.md](README.md) for complete schema and relationships**

---

## Development Workflow

### Starting a New Session

1. **Read this file** (CLAUDE.md) for current context
2. **Check current sprint** - See Sprint Status table above
3. **Check JIRA board** - https://philhumber.atlassian.net/jira/software/projects/WIN
4. **Pick an issue** from Sprint 3 (WIN-84)
5. **Read relevant docs** if needed:
   - [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - System design
   - [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - Module API reference
   - Recent sprint summaries in [docs/04-sprints/](docs/04-sprints/)

### Making Changes

1. **Create a feature branch** - Always create a branch from `develop` before starting work: `git checkout develop && git pull origin develop && git checkout -b feature/WIN-XX-description`
2. **Read files first** - Never modify code you haven't read
3. **Follow existing patterns** - Maintain consistency with modular architecture
4. **Test thoroughly** - Run 10-point regression test (see [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md))
5. **Update JIRA** - Mark issues as Done when complete
6. **Update docs** - Update CLAUDE.md or relevant sprint docs if needed

### Common Pitfalls to Avoid

1. **Loading old wineapp.js** → Causes conflicts
2. **Wrong modal close function** → Use `modalManager.hideAll()` not `ratingManager.closeModal()`
3. **Not parsing JSON** → Always parse JSON in API responses
4. **Forgetting dropdown refresh** → Call `dropdownManager.refreshAllDropdowns()` after mutations
5. **No transactions** → Always use PDO transactions for multi-table operations
6. **No element checks** → Always check `if (element)` before accessing

**See [README.md](README.md) for detailed pitfall descriptions and solutions.**

---

## Current Sprint Work

### Sprint 3 Remaining Issues (1 issue)

**WIN-84: Add purchase date field**
- Note: `bottles.dateAdded` field already exists in DB!
- Files: `addwine.html`, `wine-management.js`

### Sprint 3 Completed (7 issues) ✅
- WIN-38: Upload button UI - drag & drop zone with responsive thumbnail ✅
- WIN-43: Loading UI improvements (cycling wine-themed messages during AI loading) ✅
- WIN-88: Price scale on wine cards ($ to $$$$$, per-liter comparison, by bottle size) ✅
- WIN-95: Picture upload (800x800px, edge-sampled backgrounds) ✅
- WIN-27: Right-click context menu ✅
- WIN-96: Card collapse scroll behavior ✅
- WIN-NEW: avgRating DECIMAL overflow fix ✅

**See [README.md](README.md) for complete issue list and JIRA board for full details.**

---

## Testing

### Quick Regression Test (10 tests)

Run after each change:

1. Initial page load & initialization
2. Sidebar navigation
3. Filter dropdowns (5 filters)
4. Add wine workflow (4-tab form + AI)
5. Drink bottle & rate wine
6. Add bottle to existing wine
7. Edit wine details
8. Card expand/collapse
9. AI data generation
10. Drunk wines history

**See [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md) for detailed test procedures.**

---

## Qvé Migration Plan (Next Phase)

**Status**: Plan approved (2026-01-13)
**Timeline**: 17-24 days after Sprint 3 completion
**Approach**: Build new Svelte/SvelteKit PWA at `/qve/` alongside existing app

**Key Details**:
- Framework: Svelte/SvelteKit + Melt UI/Bits UI
- PWA: Installable, offline support
- Backend: Reuse existing PHP API unchanged
- Design: Complete mockup at `design/qve-rebrand/qve-mockup.html`

**Full plan**: `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`

**Next Steps**:
1. Complete Sprint 3 remaining issues
2. Create mockups for Add Wine and Drink/Rate flows
3. Begin SvelteKit project initialization

**See [README.md](README.md) for complete roadmap and migration phases.**

---

## Documentation

### Quick Links

**Must-Read**:
- [README.md](README.md) - Comprehensive project reference
- [docs/README.md](docs/README.md) - Documentation hub

**Architecture & Development**:
- [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - Complete system architecture
- [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - Module API reference

**Testing**:
- [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md) - Testing procedures

**Sprint Work**:
- [docs/04-sprints/README.md](docs/04-sprints/README.md) - Sprint index
- [docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Sprint 1 (critical bugs)
- [docs/04-sprints/sprint-02/](docs/04-sprints/sprint-02/) - Sprint 2 (UX improvements)

**Design**:
- [design/qve-rebrand/README.md](design/qve-rebrand/README.md) - Qvé rebrand overview
- [design/qve-rebrand/qve-mockup.html](design/qve-rebrand/qve-mockup.html) - Live mockup

---

## Resources

**GitHub**: https://github.com/philhumber/wineApp
**JIRA Board**: https://philhumber.atlassian.net/jira/software/projects/WIN
**Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
**Developer**: Phil Humber (phil.humber@gmail.com)

---

*This file serves as a concise quick-start guide for new Claude sessions. For detailed information, see [README.md](README.md) and [docs/](docs/).*
